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
  const errors = [];

  function addPlace(place) {
    const id = place.id;
    const loc = place.location;

    if (!id || !loc || unique.has(id)) return;

    unique.set(id, {
      id,
      name: place.displayName?.text || "Tankstation",
      address: place.formattedAddress || "",
      lat: loc.latitude,
      lng: loc.longitude,
      rating: place.rating || null,
      openNow: place.currentOpeningHours?.openNow ?? null
    });
  }

  async function googleRequest(body, label) {
    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchNearby",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.currentOpeningHours.openNow"
        },
        body: JSON.stringify(body)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      errors.push({
        label,
        status: response.status,
        message: data.error?.message || JSON.stringify(data.error || data)
      });
      return [];
    }

    return data.places || [];
  }

  for (const point of points.slice(0, 6)) {
    if (typeof point.lat !== "number" || typeof point.lng !== "number") continue;

    const radius = Math.max(5000, Math.min(Number(radiusMeters) || 30000, 50000));

    const places = await googleRequest(
      {
        includedTypes: ["gas_station"],
        maxResultCount: 10,
        locationRestriction: {
          circle: {
            center: {
              latitude: point.lat,
              longitude: point.lng
            },
            radius
          }
        }
      },
      "searchNearby gas_station"
    );

    places.forEach(addPlace);
  }

  const places = Array.from(unique.values()).slice(0, 24);

  return res.status(200).json({
    places,
    count: places.length,
    debug: {
      searchedPoints: points.slice(0, 6).length,
      radiusMeters: Math.max(5000, Math.min(Number(radiusMeters) || 30000, 50000)),
      errors
    }
  });
}
