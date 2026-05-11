export default async function handler(req, res) {
  // Roadora ORS proxy — keeps ORS_API_KEY safely on Vercel.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const body = req.method === 'POST' ? req.body : req.query;
    const start = body.start || '4.4777,51.9244'; // lon,lat Rotterdam
    const end = body.end || '11.4041,47.2692';   // lon,lat Innsbruck
    const profile = body.profile || 'driving-car';

    if (!process.env.ORS_API_KEY) {
      return res.status(500).json({ error: 'Missing ORS_API_KEY environment variable' });
    }

    const startCoords = String(start).split(',').map(Number);
    const endCoords = String(end).split(',').map(Number);

    if (startCoords.length !== 2 || endCoords.length !== 2 || startCoords.some(Number.isNaN) || endCoords.some(Number.isNaN)) {
      return res.status(400).json({ error: 'Invalid coordinates. Use lon,lat format.' });
    }

    const safeProfile = encodeURIComponent(profile);
    const endpoints = [
      `https://api.openrouteservice.org/v2/directions/${safeProfile}/geojson`,
      `https://api.heigit.org/v2/directions/${safeProfile}/geojson`
    ];

    let lastError = null;

    for (const url of endpoints) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: process.env.ORS_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/geo+json, application/json'
        },
        body: JSON.stringify({ coordinates: [startCoords, endCoords] })
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) return res.status(200).json(data);
      lastError = { status: response.status, data };
    }

    return res.status(lastError?.status || 502).json({
      error: 'ORS request failed',
      details: lastError?.data || null
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unknown server error' });
  }
}
