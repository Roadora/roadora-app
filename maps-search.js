export default async function handler(req, res) {
  try {
    const { q = "tankstation", lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        error: "Missing lat/lng query parameters"
      });
    }

    if (!process.env.SERPAPI_KEY) {
      return res.status(500).json({
        error: "SERPAPI_KEY environment variable is not set"
      });
    }

    const params = new URLSearchParams({
      engine: "google_maps",
      q,
      ll: `@${lat},${lng},14z`,
      type: "search",
      api_key: process.env.SERPAPI_KEY
    });

    const response = await fetch("https://serpapi.com/search?" + params.toString());

    if (!response.ok) {
      return res.status(response.status).json({
        error: "SerpApi request failed"
      });
    }

    const data = await response.json();

    const results = (data.local_results || [])
      .map((item) => ({
        name: item.title,
        address: item.address,
        rating: item.rating,
        reviews: item.reviews,
        type: item.type,
        lat: item.gps_coordinates?.latitude,
        lng: item.gps_coordinates?.longitude,
        place_id: item.place_id,
        link: item.place_id
          ? `https://www.google.com/maps/place/?q=place_id:${item.place_id}`
          : item.website || item.link || null
      }))
      .filter((x) => x.lat && x.lng);

    return res.status(200).json({
      query: q,
      count: results.length,
      results
    });
  } catch (error) {
    return res.status(500).json({
      error: "Unexpected server error",
      message: error.message
    });
  }
}
