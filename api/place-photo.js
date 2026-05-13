export default async function handler(req, res) {
  const { photoName, maxWidth = 900 } = req.query;

  if (!photoName) {
    return res.status(400).json({ error: "Missing photoName" });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Missing GOOGLE_PLACES_API_KEY" });
  }

  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${apiKey}`;

  try {
    const response = await fetch(url, { redirect: "follow" });

    if (!response.ok) {
      return res.status(response.status).json({ error: "Photo fetch failed" });
    }

    return res.redirect(response.url);
  } catch (error) {
    return res.status(500).json({ error: "Photo proxy failed" });
  }
}
