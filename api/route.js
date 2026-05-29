// Roadora v39.7.x — Future proof ORS route API
// Doel:
// - echte ORS route blijven laden
// - geen Vercel 504 meer door eindeloos wachten op ORS
// - automatisch proberen: nieuwe HeiGIT/ORS host -> oude ORS host
// - Maps-export ongemoeid laten: dit endpoint is alleen voor de Roadora-kaartlijn

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const key = process.env.ORS_API_KEY || process.env.OPENROUTESERVICE_API_KEY || process.env.OPEN_ROUTE_SERVICE_API_KEY;
  if (!key) return res.status(500).json({ ok:false, error:'ORS_API_KEY ontbreekt in Vercel env' });

  const q = req.query || {};
  const profile = sanitizeProfile(q.profile);
  const start = parseCoord(q.start || '4.4777,51.9244');
  const end = parseCoord(q.end || '11.4041,47.2692');
  const via = parseWaypoints(q.waypoints || q.via || '').slice(0, 9);

  if (!start || !end) {
    return res.status(400).json({ ok:false, error:'Ongeldige start/eind coordinaten' });
  }

  const requestedCoordinates = compactCoords([start, ...via, end]);
  if (requestedCoordinates.length < 2) {
    return res.status(400).json({ ok:false, error:'Te weinig geldige routepunten' });
  }

  try {
    let route = await tryOrsRoute({ key, profile, coordinates: requestedCoordinates, radiusesMode:'wide' });
    if (route.ok) {
      return res.status(200).json(addRoadoraMeta(route.data, {
        mode:'full-waypoints',
        requestedWaypoints: via.length,
        usedWaypoints: via.length,
        skippedWaypoints: [],
        upstream: route.upstream || null
      }));
    }

    route = await tryOrsRoute({ key, profile, coordinates: requestedCoordinates, radiusesMode:'unlimited' });
    if (route.ok) {
      return res.status(200).json(addRoadoraMeta(route.data, {
        mode:'full-waypoints-unlimited-snap',
        requestedWaypoints: via.length,
        usedWaypoints: via.length,
        skippedWaypoints: [],
        upstream: route.upstream || null
      }));
    }

    if (via.length) {
      const segmented = await buildSegmentedRoute({ key, profile, start, end, via });
      if (segmented.ok) return res.status(200).json(segmented.data);
    }

    const direct = await tryOrsRoute({ key, profile, coordinates:[start, end], radiusesMode:'unlimited' });
    if (direct.ok) {
      return res.status(200).json(addRoadoraMeta(direct.data, {
        mode:'direct-recovery',
        requestedWaypoints: via.length,
        usedWaypoints: 0,
        skippedWaypoints: via.map(coordLabel),
        upstream: direct.upstream || null
      }));
    }

    const last = direct || route || {};
    const safeStatus = normalizeClientStatus(last.status || 502);
    return res.status(safeStatus).json({
      ok:false,
      error:'ORS route fout',
      status:last.status || 502,
      upstream:last.upstream || null,
      detail:last.detail || null,
      attempts:last.attempts || null
    });
  } catch (err) {
    return res.status(500).json({ ok:false, error: err?.message || 'Route API fout' });
  }
}

function sanitizeProfile(value) {
  const p = String(value || 'driving-car').replace(/[^a-z-]/g, '') || 'driving-car';
  const allowed = new Set(['driving-car','driving-hgv','cycling-regular','foot-walking']);
  return allowed.has(p) ? p : 'driving-car';
}

function parseCoord(value) {
  const parts = String(value || '').split(',').map(v => Number(String(v).trim()));
  if (parts.length !== 2) return null;
  const [lng, lat] = parts;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
  return [round6(lng), round6(lat)];
}

function parseWaypoints(raw) {
  return String(raw || '')
    .split('|')
    .map(parseCoord)
    .filter(Boolean);
}

function compactCoords(coords) {
  const out = [];
  for (const c of coords.filter(Boolean)) {
    const prev = out[out.length - 1];
    if (!prev || Math.abs(prev[0] - c[0]) > 0.00001 || Math.abs(prev[1] - c[1]) > 0.00001) out.push(c);
  }
  return out;
}

function round6(n) { return Math.round(Number(n) * 1e6) / 1e6; }
function coordLabel(c) { return `${round6(c[0])},${round6(c[1])}`; }

function radiusesFor(coordinates, mode) {
  if (mode === 'unlimited') return coordinates.map(() => -1);
  return coordinates.map((_, i) => (i === 0 || i === coordinates.length - 1) ? 10000 : 50000);
}

function orsEndpoints(profile) {
  return [
    {
      name:'heigit-openrouteservice',
      url:`https://api.heigit.org/openrouteservice/v2/directions/${profile}/geojson`
    },
    {
      name:'legacy-openrouteservice',
      url:`https://api.openrouteservice.org/v2/directions/${profile}/geojson`
    }
  ];
}

async function tryOrsRoute({ key, profile, coordinates, radiusesMode = 'wide' }) {
  const body = {
    coordinates,
    instructions: false,
    geometry_simplify: false,
    elevation: false,
    preference: 'recommended',
    units: 'm',
    radiuses: radiusesFor(coordinates, radiusesMode)
  };

  const attempts = [];
  for (const endpoint of orsEndpoints(profile)) {
    const result = await fetchOrsWithTimeout(endpoint, key, body, 8500);
    attempts.push({
      upstream:endpoint.name,
      status:result.status || null,
      ok:!!result.ok,
      error:result.error || null
    });

    if (result.ok && hasGeometry(result.data)) {
      return { ok:true, status:result.status, data:result.data, upstream:endpoint.name, attempts };
    }

    // Bij key/profiel/request-fouten heeft fallback naar andere host meestal geen zin.
    // Toch geven we de fout duidelijk terug in plaats van Vercel te laten time-outen.
    if ([400,401,403,404,406,429].includes(Number(result.status))) {
      return {
        ok:false,
        status:result.status,
        detail:result.data || { error:result.error },
        upstream:endpoint.name,
        attempts
      };
    }
  }

  const last = attempts[attempts.length - 1] || {};
  return {
    ok:false,
    status:last.status || 502,
    detail:{ message:last.error || 'Geen bruikbare ORS geometry teruggekregen' },
    upstream:last.upstream || null,
    attempts
  };
}

async function fetchOrsWithTimeout(endpoint, key, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const orsRes = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        Authorization: key,
        'Content-Type': 'application/json',
        Accept: 'application/json, application/geo+json',
        'User-Agent': 'Roadora/39.7 route-proxy'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const text = await orsRes.text();
    let data;
    try { data = JSON.parse(text); }
    catch (_) { data = { raw: String(text || '').slice(0, 1200) }; }

    return {
      ok: orsRes.ok,
      status: orsRes.status,
      data,
      error: orsRes.ok ? null : `HTTP ${orsRes.status}`
    };
  } catch (err) {
    const aborted = err?.name === 'AbortError';
    return {
      ok:false,
      status: aborted ? 504 : 502,
      data:{ message: aborted ? `ORS timeout na ${timeoutMs}ms` : (err?.message || 'ORS fetch failed') },
      error: aborted ? 'timeout' : (err?.message || 'fetch failed')
    };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeClientStatus(status) {
  const s = Number(status) || 502;
  // Voorkom dat Vercel zelf als 504 blijft ogen; geef gecontroleerde JSON terug.
  if (s === 504) return 502;
  if (s < 400 || s > 599) return 502;
  return s;
}

function hasGeometry(data) {
  const coords = data?.features?.[0]?.geometry?.coordinates;
  return Array.isArray(coords) && coords.length > 1;
}

function summaryOf(data) {
  return data?.features?.[0]?.properties?.summary || { distance:0, duration:0 };
}

function coordsOf(data) {
  return data?.features?.[0]?.geometry?.coordinates || [];
}

function addRoadoraMeta(data, meta) {
  data.ok = true;
  data.roadora = meta;
  if (data.features?.[0]) {
    data.features[0].properties = data.features[0].properties || {};
    data.features[0].properties.roadora = meta;
  }
  return data;
}

async function buildSegmentedRoute({ key, profile, start, end, via }) {
  const routePoints = [start, ...via, end];
  let current = routePoints[0];
  const merged = [];
  let distance = 0;
  let duration = 0;
  const used = [];
  const skipped = [];
  const upstreams = [];

  for (let i = 1; i < routePoints.length; i++) {
    const target = routePoints[i];
    const isFinal = i === routePoints.length - 1;
    const segment = await tryOrsRoute({ key, profile, coordinates:[current, target], radiusesMode:'unlimited' });

    if (!segment.ok) {
      if (!isFinal) {
        skipped.push(coordLabel(target));
        continue;
      }
      return { ok:false, status:segment.status, detail:segment.detail };
    }

    if (segment.upstream) upstreams.push(segment.upstream);

    const part = coordsOf(segment.data);
    if (part.length) {
      if (merged.length) merged.push(...part.slice(1));
      else merged.push(...part);
    }
    const s = summaryOf(segment.data);
    distance += Number(s.distance || 0);
    duration += Number(s.duration || 0);
    if (!isFinal) used.push(coordLabel(target));
    current = target;
  }

  if (merged.length < 2) return { ok:false, status:502, detail:'Segmented route heeft geen geometry' };

  const meta = {
    mode:'segmented-waypoint-recovery',
    requestedWaypoints: via.length,
    usedWaypoints: used.length,
    skippedWaypoints: skipped,
    upstream: Array.from(new Set(upstreams)).join(',') || null
  };

  const data = {
    type:'FeatureCollection',
    bbox: bboxOf(merged),
    features:[{
      type:'Feature',
      properties:{ summary:{ distance, duration }, roadora:meta },
      geometry:{ type:'LineString', coordinates: merged }
    }],
    ok:true,
    roadora:meta
  };

  return { ok:true, data };
}

function bboxOf(coords) {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat].map(round6);
}
