export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "GOOGLE_MAPS_API_KEY ontbreekt in Vercel Environment Variables"
    });
  }

  const { points = [], radiusMeters = 30000 } = req.body || {};

  if (!Array.isArray(points) || points.length === 0) {
    return res.status(400).json({ error: "Geen routepunten ontvangen" });
  }

  const unique = new Map();

  for (const point of points.slice(0, 6)) {
    if (typeof point.lat !== "number" || typeof point.lng !== "number") {
      continue;
    }

    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.currentOpeningHours.openNow,places.evChargeOptions"
        },
        body: JSON.stringify({
          textQuery: "EV charging station",
          maxResultCount: 8,
          locationBias: {
            circle: {
              center: {
                latitude: point.lat,
                longitude: point.lng
              },
              radius: Math.max(
                5000,
                Math.min(Number(radiusMeters) || 30000, 50000)
              )
            }
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Google Places Text Search error:", data);
      continue;
    }

    for (const place of data.places || []) {
      const id = place.id;
      const loc = place.location;

      if (!id || !loc || unique.has(id)) continue;

      const connectors =
        place.evChargeOptions?.connectorAggregation || [];

      const evOptions = connectors.length
        ? connectors
            .map((c) => `${c.count || "?"}× ${c.type || "connector"}`)
            .slice(0, 2)
            .join(", ")
        : null;

      unique.set(id, {
        id,
        name: place.displayName?.text || "Laadstation",
        address: place.formattedAddress || "",
        lat: loc.latitude,
        lng: loc.longitude,
        rating: place.rating || null,
        openNow: place.currentOpeningHours?.openNow ?? null,
        evOptions
      });
    }
  }

  return res.status(200).json({
    places: Array.from(unique.values()).slice(0, 16)
  });
}
