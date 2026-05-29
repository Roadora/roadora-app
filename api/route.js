// Roadora ORS route API — dual endpoint + timeout + safe recovery
// Alleen backend route lijn. Raakt Google Maps export/navigatie niet aan.

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
  const via = parseWaypoints(q.waypoints || q.via || '').slice(0, 8);

  if (!start || !end) return res.status(400).json({ ok:false, error:'Ongeldige start/eind coordinaten' });

  // Houd request licht en voorspelbaar: eerst alleen hoofdroute, daarna pas met waypoints.
  const fullCoords = compactCoords([start, ...via, end]);
  const directCoords = compactCoords([start, end]);

  try {
    const attempts = [];

    // 1. Nieuw officieel ORS/HeiGIT endpoint, met volledige routepunten.
    if (fullCoords.length >= 2) {
      attempts.push(await callOrsBothHosts({ key, profile, coordinates: fullCoords, label:'full' }));
      const hit = attempts[attempts.length - 1];
      if (hit.ok) return res.status(200).json(addRoadoraMeta(hit.data, {
        mode:'ors-full-dual-endpoint',
        host: hit.host,
        requestedWaypoints: via.length,
        usedWaypoints: via.length,
        skippedWaypoints: []
      }));
    }

    // 2. Directe hoofdroute. Zo krijgt Roadora liever een echte wegenroute dan een rechte fallbacklijn.
    attempts.push(await callOrsBothHosts({ key, profile, coordinates: directCoords, label:'direct' }));
    const direct = attempts[attempts.length - 1];
    if (direct.ok) return res.status(200).json(addRoadoraMeta(direct.data, {
      mode:'ors-direct-recovery-dual-endpoint',
      host: direct.host,
      requestedWaypoints: via.length,
      usedWaypoints: 0,
      skippedWaypoints: via.map(coordLabel)
    }));

    return res.status(502).json({
      ok:false,
      error:'ORS route fout: beide endpoints faalden',
      attempts: attempts.map(cleanAttempt)
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
  return String(raw || '').split('|').map(parseCoord).filter(Boolean);
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

function radiusesFor(coordinates) {
  // Klein en veilig houden. Grote radiuses kunnen ORS traag maken of validatieproblemen geven.
  return coordinates.map(() => 5000);
}

async function callOrsBothHosts({ key, profile, coordinates, label }) {
  const hosts = [
    {
      host:'heigit',
      url:`https://api.heigit.org/openrouteservice/v2/directions/${profile}/geojson`
    },
    {
      host:'openrouteservice-legacy',
      url:`https://api.openrouteservice.org/v2/directions/${profile}/geojson`
    }
  ];

  const details = [];
  for (const h of hosts) {
    const r = await tryOrsRoute({ key, url: h.url, host: h.host, coordinates, timeoutMs: 6500, label });
    if (r.ok) return r;
    details.push(r);
  }
  return { ok:false, label, detail: details };
}

async function tryOrsRoute({ key, url, host, coordinates, timeoutMs, label }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const body = {
    coordinates,
    instructions: false,
    geometry_simplify: true,
    elevation: false,
    preference: 'recommended',
    units: 'm',
    radiuses: radiusesFor(coordinates)
  };

  try {
    const orsRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: key,
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json, application/geo+json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const text = await orsRes.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = { raw: text.slice(0, 500) }; }

    if (!orsRes.ok) return { ok:false, host, label, status:orsRes.status, detail:data };
    if (!hasGeometry(data)) return { ok:false, host, label, status:502, detail:'ORS response zonder geometry' };
    return { ok:true, host, status:orsRes.status, data };
  } catch (err) {
    const isTimeout = err?.name === 'AbortError';
    return {
      ok:false,
      host,
      label,
      status: isTimeout ? 504 : 502,
      detail: isTimeout ? `ORS timeout na ${timeoutMs / 1000} seconden` : (err?.message || 'ORS fetch fout')
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

function cleanAttempt(a) {
  if (!a) return null;
  return {
    ok: !!a.ok,
    label: a.label,
    host: a.host,
    status: a.status,
    detail: Array.isArray(a.detail) ? a.detail.map(cleanAttempt) : a.detail
  };
}
