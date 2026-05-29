// Roadora v6.9.1 — ORS route API timeout + endpoint fallback
// Maps-export blijft ongemoeid: dit endpoint is alleen voor de Roadora-kaartlijn.

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
        endpoint: route.endpoint,
        requestedWaypoints: via.length,
        usedWaypoints: via.length,
        skippedWaypoints: []
      }));
    }

    route = await tryOrsRoute({ key, profile, coordinates: requestedCoordinates, radiusesMode:'unlimited' });
    if (route.ok) {
      return res.status(200).json(addRoadoraMeta(route.data, {
        mode:'full-waypoints-unlimited-snap',
        endpoint: route.endpoint,
        requestedWaypoints: via.length,
        usedWaypoints: via.length,
        skippedWaypoints: []
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
        endpoint: direct.endpoint,
        requestedWaypoints: via.length,
        usedWaypoints: 0,
        skippedWaypoints: via.map(coordLabel)
      }));
    }

    return res.status(direct.status || route.status || 502).json({
      ok:false,
      error:'ORS route fout',
      status: direct.status || route.status || 502,
      detail: direct.detail || route.detail || null,
      triedEndpoints: direct.triedEndpoints || route.triedEndpoints || ORS_ENDPOINTS.map(e => e.name)
    });
  } catch (err) {
    return res.status(500).json({ ok:false, error: err?.message || 'Route API fout' });
  }
}

const ORS_ENDPOINTS = [
  {
    name: 'heigit',
    base: 'https://api.heigit.org/openrouteservice/v2/directions'
  },
  {
    name: 'openrouteservice-legacy',
    base: 'https://api.openrouteservice.org/v2/directions'
  }
];

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

  let last = null;
  const triedEndpoints = [];

  for (const endpoint of ORS_ENDPOINTS) {
    triedEndpoints.push(endpoint.name);
    const result = await postOrs({ endpoint, key, profile, body });
    if (result.ok) return result;
    last = result;

    // Bij key/request-fouten heeft opnieuw proberen op legacy meestal geen zin.
    if ([400, 401, 403, 404, 405, 406, 429].includes(Number(result.status))) break;
  }

  return {
    ok:false,
    status:last?.status || 502,
    detail:last?.detail || null,
    triedEndpoints
  };
}

async function postOrs({ endpoint, key, profile, body }) {
  const url = `${endpoint.base}/${profile}/geojson`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8500);

  try {
    const orsRes = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: key,
        'Content-Type': 'application/json',
        Accept: 'application/json, application/geo+json'
      },
      body: JSON.stringify(body)
    });

    const text = await orsRes.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = { raw: String(text || '').slice(0, 500) }; }

    if (!orsRes.ok) {
      return { ok:false, status:orsRes.status, endpoint:endpoint.name, detail:data };
    }
    if (!hasGeometry(data)) {
      return { ok:false, status:502, endpoint:endpoint.name, detail:{ message:'ORS response zonder geometry', response:data } };
    }
    return { ok:true, status:orsRes.status, endpoint:endpoint.name, data };
  } catch (err) {
    const aborted = err?.name === 'AbortError';
    return {
      ok:false,
      status: aborted ? 504 : 502,
      endpoint:endpoint.name,
      detail:{ message: aborted ? 'ORS timeout na 8.5s' : (err?.message || 'ORS fetch failed') }
    };
  } finally {
    clearTimeout(timeout);
  }
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
  let lastEndpoint = null;

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

    lastEndpoint = segment.endpoint || lastEndpoint;
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
    endpoint:lastEndpoint,
    requestedWaypoints: via.length,
    usedWaypoints: used.length,
    skippedWaypoints: skipped
  };

  const data = {
    type:'FeatureCollection',
    bbox: bboxOf(merged),
    features:[{
      type:'Feature',
      properties:{ summary:{ distance, duration }, roadora: meta },
      geometry:{ type:'LineString', coordinates: merged }
    }],
    ok:true,
    roadora: meta
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
