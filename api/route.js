// Roadora ORS Simple Stable Route API
// Doel:
// - eerst ORS weer betrouwbaar testen/herstellen
// - één simpele Directions V2 call
// - geen segmented recovery/retry-loop die Vercel kan laten time-outen
// - Maps-export blijft volledig ongemoeid

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

  const coordinates = compactCoords([start, ...via, end]);
  if (coordinates.length < 2) {
    return res.status(400).json({ ok:false, error:'Te weinig geldige routepunten' });
  }

  try {
    const result = await fetchOrsOnce({ key, profile, coordinates });

    if (!result.ok) {
      return res.status(result.status || 502).json({
        ok:false,
        error:'ORS route fout',
        status: result.status || 502,
        endpoint: result.endpoint,
        detail: result.detail || null
      });
    }

    return res.status(200).json(addRoadoraMeta(result.data, {
      mode:'simple-stable-ors-v1',
      endpoint: result.endpoint,
      requestedWaypoints: via.length,
      usedWaypoints: via.length,
      skippedWaypoints: []
    }));
  } catch (err) {
    return res.status(502).json({
      ok:false,
      error:'Route API fout',
      message: err?.message || String(err)
    });
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

async function fetchOrsOnce({ key, profile, coordinates }) {
  const endpoint = `https://api.heigit.org/openrouteservice/v2/directions/${profile}/geojson`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8500);

  const body = {
    coordinates,
    instructions: false,
    geometry_simplify: false,
    elevation: false,
    preference: 'recommended',
    units: 'm'
  };

  try {
    const orsRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: key,
        'Content-Type': 'application/json',
        Accept: 'application/json, application/geo+json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const text = await orsRes.text();
    let data;
    try { data = JSON.parse(text); }
    catch (_) { data = { raw: String(text || '').slice(0, 1200) }; }

    if (!orsRes.ok) {
      return { ok:false, status:orsRes.status, endpoint, detail:data };
    }

    if (!hasGeometry(data)) {
      return { ok:false, status:502, endpoint, detail:{ message:'ORS response zonder geometry', data } };
    }

    return { ok:true, status:orsRes.status, endpoint, data };
  } catch (err) {
    const isAbort = err?.name === 'AbortError';
    return {
      ok:false,
      status: isAbort ? 504 : 502,
      endpoint,
      detail:{ message: isAbort ? 'ORS timeout na 8.5 seconden' : (err?.message || String(err)) }
    };
  } finally {
    clearTimeout(timer);
  }
}

function hasGeometry(data) {
  const coords = data?.features?.[0]?.geometry?.coordinates;
  return Array.isArray(coords) && coords.length > 1;
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
