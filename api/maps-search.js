module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const key = process.env.SERPAPI_KEY;

    if (!key) {
      return res.status(500).json({
        ok: false,
        error: "SERPAPI_KEY ontbreekt in Vercel Environment Variables"
      });
    }

    const q = req.query.q || "tankstation";
    const lat = req.query.lat;
    const lng = req.query.lng;
    const zoom = req.query.zoom || "14";

    const params = new URLSearchParams({
      engine: "google_maps",
      q,
      type: "search",
      hl: "nl",
      api_key: key
    });

    if (lat && lng) {
      params.set("ll", `@${lat},${lng},${zoom}z`);
    }

    const serpUrl = "https://serpapi.com/search.json?" + params.toString();
    const response = await fetch(serpUrl);

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        ok: false,
        error: "SerpApi gaf geen JSON terug",
        raw: text.slice(0, 500)
      });
    }

    if (!response.ok || data.error) {
      return res.status(502).json({
        ok: false,
        error: data.error || "SerpApi request failed",
        status: response.status
      });
    }

    const results = (data.local_results || [])
      .map((item) => ({
        name: item.title,
        address: item.address,
        rating: item.rating,
        reviews: item.reviews,
        type: item.type,
        lat: item.gps_coordinates && item.gps_coordinates.latitude,
        lng: item.gps_coordinates && item.gps_coordinates.longitude,
        place_id: item.place_id,
        link: item.place_id
          ? `https://www.google.com/maps/place/?q=place_id:${item.place_id}`
          : item.website || item.link || null
      }))
      .filter((x) => x.lat && x.lng);

    return res.status(200).json({
      ok: true,
      query: q,
      lat,
      lng,
      zoom,
      count: results.length,
      results
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Onbekende serverfout"
    });
  }
};
