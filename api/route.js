/*
 * Roadora
 * Copyright (c) 2026 Stephan Kerkhof
 * Alle rechten voorbehouden.
 */

// Roadora v6.9.0 — Future proof ORS route API
// Doel:
// - echte ORS route blijven laden, ook als een tussenstop lastig te snappen is
// - nooit meteen 406 teruggeven bij een foute stop; eerst herstellen
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
    // 1) Normale volledige roadtrip-route via alle stops.
    let route = await tryOrsRoute({ key, profile, coordinates: requestedCoordinates, radiusesMode:'wide' });
    if (route.ok) {
      return res.status(200).json(addRoadoraMeta(route.data, {
        mode:'full-waypoints',
        requestedWaypoints: via.length,
        usedWaypoints: via.length,
        skippedWaypoints: []
      }));
    }

    // 2) Zelfde route, maar met onbeperkt/sneller snappen. Dit vangt stops af die net naast de weg liggen.
    route = await tryOrsRoute({ key, profile, coordinates: requestedCoordinates, radiusesMode:'unlimited' });
    if (route.ok) {
      return res.status(200).json(addRoadoraMeta(route.data, {
        mode:'full-waypoints-unlimited-snap',
        requestedWaypoints: via.length,
        usedWaypoints: via.length,
        skippedWaypoints: []
      }));
    }

    // 3) Segment-herstel: routeer start -> stop -> stop -> eind per stuk.
    // Als één stop ORS breekt, slaan we alleen die stop over en houden we de rest van de route echt.
    if (via.length) {
      const segmented = await buildSegmentedRoute({ key, profile, start, end, via });
      if (segmented.ok) return res.status(200).json(segmented.data);
    }

    // 4) Laatste herstel: gewone A→B ORS route. Dus liever echte hoofdroute dan statische fallback in de app.
    const direct = await tryOrsRoute({ key, profile, coordinates:[start, end], radiusesMode:'unlimited' });
    if (direct.ok) {
      return res.status(200).json(addRoadoraMeta(direct.data, {
        mode:'direct-recovery',
        requestedWaypoints: via.length,
        usedWaypoints: 0,
        skippedWaypoints: via.map(coordLabel)
      }));
    }

    return res.status(direct.status || route.status || 502).json({
      ok:false,
      error:'ORS route fout',
      status: direct.status || route.status || 502,
      detail: direct.detail || route.detail || null
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
  return [round6(lng), round6(lat)]; // ORS verwacht [lng, lat]
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
  // Endpoints hoeven niet extreem ruim te zijn; tussenstops wel, omdat Google/POI-pins vaak naast de rijbaan liggen.
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

  const orsRes = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
    method: 'POST',
    headers: {
      Authorization: key,
      'Content-Type': 'application/json',
      Accept: 'application/json, application/geo+json'
    },
    body: JSON.stringify(body)
  });

  const text = await orsRes.text();
  let data;
  try { data = JSON.parse(text); } catch (_) { data = { raw: text }; }

  if (!orsRes.ok) return { ok:false, status:orsRes.status, detail:data };
  if (!hasGeometry(data)) return { ok:false, status:502, detail:data };
  return { ok:true, status:orsRes.status, data };
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

  for (let i = 1; i < routePoints.length; i++) {
    const target = routePoints[i];
    const isFinal = i === routePoints.length - 1;
    const segment = await tryOrsRoute({ key, profile, coordinates:[current, target], radiusesMode:'unlimited' });

    if (!segment.ok) {
      if (!isFinal) {
        skipped.push(coordLabel(target));
        continue;
      }
      // Eindbestemming mag nooit worden overgeslagen.
      return { ok:false, status:segment.status, detail:segment.detail };
    }

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

  const data = {
    type:'FeatureCollection',
    bbox: bboxOf(merged),
    features:[{
      type:'Feature',
      properties:{
        summary:{ distance, duration },
        roadora:{
          mode:'segmented-waypoint-recovery',
          requestedWaypoints: via.length,
          usedWaypoints: used.length,
          skippedWaypoints: skipped
        }
      },
      geometry:{ type:'LineString', coordinates: merged }
    }],
    ok:true,
    roadora:{
      mode:'segmented-waypoint-recovery',
      requestedWaypoints: via.length,
      usedWaypoints: used.length,
      skippedWaypoints: skipped
    }
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
