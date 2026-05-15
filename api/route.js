export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const key = process.env.ORS_API_KEY || process.env.OPENROUTESERVICE_API_KEY || process.env.OPEN_ROUTE_SERVICE_API_KEY;
    if (!key) {
      return res.status(500).json({ ok:false, error:'ORS_API_KEY ontbreekt in Vercel env' });
    }

    const q = req.query || {};
    const profile = String(q.profile || 'driving-car').replace(/[^a-z-]/g, '') || 'driving-car';
    const start = String(q.start || '4.4777,51.9244');
    const end = String(q.end || '11.4041,47.2692');
    const rawVia = String(q.waypoints || q.via || '').trim();

    function parseCoord(value) {
      const parts = String(value).split(',').map(Number);
      if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
      return [parts[0], parts[1]]; // ORS expects [lng, lat]
    }

    const coordinates = [parseCoord(start)]
      .concat(rawVia ? rawVia.split('|').map(parseCoord).filter(Boolean) : [])
      .concat([parseCoord(end)])
      .filter(Boolean);

    if (coordinates.length < 2) {
      return res.status(400).json({ ok:false, error:'Ongeldige route-coordinaten' });
    }

    const orsRes = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
      method: 'POST',
      headers: {
        'Authorization': key,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        coordinates,
        instructions: false,
        preference: 'recommended',
        units: 'm'
      })
    });

    const text = await orsRes.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = { raw: text }; }

    if (!orsRes.ok) {
      return res.status(orsRes.status).json({ ok:false, error:'ORS route fout', status:orsRes.status, detail:data });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ ok:false, error: err?.message || 'Route API fout' });
  }
}
