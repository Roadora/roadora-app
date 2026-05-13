// Roadora route API — v3.8.3 query compatible hotfix
// Supports the existing app.js flow:
//   GET /api/route?start=lng,lat&end=lng,lat&profile=driving-car
// Also supports future POST body usage.

export default async function handler(req, res) {
  const startedAt = Date.now();

  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({
        ok: false,
        error: 'Method not allowed',
        allowed: ['GET', 'POST']
      });
    }

    const apiKey = process.env.ORS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: 'ORS_API_KEY ontbreekt in Vercel Environment Variables'
      });
    }

    const input = readInput(req);
    const profile = normalizeProfile(input.profile || 'driving-car');
    const start = parseLngLat(input.start);
    const end = parseLngLat(input.end);

    if (!start || !end) {
      return res.status(400).json({
        ok: false,
        error: 'Ongeldige start/end coördinaten.',
        expected: '/api/route?start=4.4777,51.9244&end=11.4041,47.2692&profile=driving-car',
        received: {
          start: input.start ?? null,
          end: input.end ?? null,
          profile
        }
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 14000);

    const orsUrl = `https://api.openrouteservice.org/v2/directions/${encodeURIComponent(profile)}/geojson`;

    const orsResponse = await fetch(orsUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/geo+json, application/json'
      },
      body: JSON.stringify({
        coordinates: [start, end],
        instructions: false,
        elevation: false
      })
    }).finally(() => clearTimeout(timeout));

    const text = await orsResponse.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_) {
      data = { raw: text };
    }

    if (!orsResponse.ok) {
      return res.status(orsResponse.status).json({
        ok: false,
        error: `ORS ${orsResponse.status}`,
        status: orsResponse.status,
        profile,
        ors: data
      });
    }

    if (!data || !Array.isArray(data.features) || !data.features[0]?.geometry?.coordinates) {
      return res.status(502).json({
        ok: false,
        error: 'ORS response mist GeoJSON features[0].geometry.coordinates',
        profile,
        ors: data
      });
    }

    // Keep the exact GeoJSON shape that app.js expects:
    // data.features[0].geometry.coordinates
    return res.status(200).json({
      ok: true,
      source: 'ors',
      profile,
      ms: Date.now() - startedAt,
      ...data
    });
  } catch (err) {
    const isAbort = err?.name === 'AbortError';
    return res.status(isAbort ? 504 : 500).json({
      ok: false,
      error: isAbort ? 'ORS timeout' : (err?.message || 'Route API fout')
    });
  }
}

function readInput(req) {
  if (req.method === 'POST') {
    const body = req.body || {};
    return {
      start: body.start ?? body.origin ?? body.from,
      end: body.end ?? body.destination ?? body.to,
      profile: body.profile ?? body.vehicle
    };
  }

  return {
    start: req.query?.start,
    end: req.query?.end,
    profile: req.query?.profile
  };
}

function parseLngLat(value) {
  if (Array.isArray(value) && value.length >= 2) {
    const lng = Number(value[0]);
    const lat = Number(value[1]);
    return validLngLat(lng, lat) ? [lng, lat] : null;
  }

  if (typeof value !== 'string') return null;

  const parts = value.split(',').map(v => Number(String(v).trim()));
  if (parts.length < 2) return null;

  const [lng, lat] = parts;
  return validLngLat(lng, lat) ? [lng, lat] : null;
}

function validLngLat(lng, lat) {
  return Number.isFinite(lng) && Number.isFinite(lat) &&
    lng >= -180 && lng <= 180 &&
    lat >= -90 && lat <= 90;
}

function normalizeProfile(profile) {
  const allowed = new Set([
    'driving-car',
    'driving-hgv',
    'cycling-regular',
    'cycling-road',
    'foot-walking'
  ]);

  const p = String(profile || 'driving-car').trim();
  return allowed.has(p) ? p : 'driving-car';
}
