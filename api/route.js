const REQUEST_TIMEOUT_MS = 9500;

function send(res, status, body) {
  res.status(status).json(body);
}

function isLngLat(value) {
  if (!value || typeof value !== 'string') return false;
  const [lng, lat] = value.split(',').map(Number);
  return Number.isFinite(lng) && Number.isFinite(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'method_not_allowed' });

  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) return send(res, 500, { ok: false, error: 'ORS_API_KEY ontbreekt in Vercel Environment Variables.' });

  const start = String(req.query.start || '');
  const end = String(req.query.end || '');
  const profile = String(req.query.profile || 'driving-car');
  const allowedProfiles = new Set(['driving-car', 'driving-hgv', 'cycling-regular', 'foot-walking']);

  if (!isLngLat(start) || !isLngLat(end)) return send(res, 400, { ok: false, error: 'Ongeldige start/end coördinaten.' });
  if (!allowedProfiles.has(profile)) return send(res, 400, { ok: false, error: 'Ongeldig ORS profiel.' });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = new URL(`https://api.openrouteservice.org/v2/directions/${profile}`);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('start', start);
    url.searchParams.set('end', end);

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) return send(res, response.status, { ok: false, error: data?.error?.message || `ORS ${response.status}` });
    return send(res, 200, data);
  } catch (error) {
    return send(res, 504, { ok: false, error: String(error?.message || error) });
  } finally {
    clearTimeout(timer);
  }
}
