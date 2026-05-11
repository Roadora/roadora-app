export default async function handler(req, res) {
  // Roadora ORS proxy — keeps ORS_API_KEY out of the frontend.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const body = req.method === 'POST' ? req.body : req.query;
    const start = body.start || '4.4777,51.9244'; // lon,lat Rotterdam
    const end = body.end || '11.4041,47.2692';   // lon,lat Innsbruck
    const profile = body.profile || 'driving-car';

    if (!process.env.ORS_API_KEY) {
      return res.status(500).json({ error: 'Missing ORS_API_KEY environment variable' });
    }

    const key = encodeURIComponent(process.env.ORS_API_KEY);
    const safeProfile = encodeURIComponent(profile);
    const query = `api_key=${key}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;

    // Heigit is the new ORS host; openrouteservice is kept as a fallback while accounts migrate.
    const urls = [
      `https://api.heigit.org/v2/directions/${safeProfile}?${query}`,
      `https://api.openrouteservice.org/v2/directions/${safeProfile}?${query}`
    ];

    let lastError = null;
    for (const url of urls) {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => ({}));
      if (response.ok) return res.status(200).json(data);
      lastError = { status: response.status, data };
    }

    return res.status(lastError?.status || 502).json({ error: 'ORS request failed', details: lastError?.data || null });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unknown server error' });
  }
}
