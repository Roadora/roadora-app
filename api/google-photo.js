// Roadora Google Places Photo proxy — v4.2 Hotel UX v2
// Keeps GOOGLE_MAPS_API_KEY server-side while showing Places photos in the app.

export default async function handler(req, res) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return res.status(500).send('GOOGLE_MAPS_API_KEY missing');

  const name = String(req.query?.name || '').trim();
  const width = Math.max(120, Math.min(900, Number(req.query?.w) || 420));
  if (!name || !name.startsWith('places/')) return res.status(400).send('Invalid photo name');

  const url = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${width}&key=${encodeURIComponent(apiKey)}`;
  try {
    const r = await fetch(url, { redirect: 'follow' });
    if (!r.ok) return res.status(r.status).send('Photo not available');
    const contentType = r.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(502).send('Photo proxy error');
  }
}
