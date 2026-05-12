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

  const { points = [], radiusMeters = 50000 } = req.body || {};

  if (!Array.isArray(points) || points.length === 0) {
    return res.status(400).json({ error: "Geen routepunten ontvangen" });
  }

  const unique = new Map();
  const errors = [];

  function addPlace(place) {
    const id = place.id || place.place_id;
    const loc = place.location;

    if (!id || !loc || unique.has(id)) return;

    const connectors = place.evChargeOptions?.connectorAggregation || [];

    const evOptions = connectors.length
      ? connectors
          .map((c) => `${c.count || "?"}× ${c.type || "connector"}`)
          .slice(0, 2)
          .join(", ")
      : null;

    unique.set(id, {
      id,
      name: place.displayName?.text || place.name || "Laadstation",
      address: place.formattedAddress || place.vicinity || "",
      lat: loc.latitude,
      lng: loc.longitude,
      rating: place.rating || null,
      openNow: place.currentOpeningHours?.openNow ?? null,
      evOptions
    });
  }

  async function googleRequest(endpoint, body, label) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.currentOpeningHours.openNow,places.evChargeOptions"
      },
      body: JSON.stringify(body)
    });

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
    if (typeof point.lat !== "number" || typeof point.lng !== "number") {
      continue;
    }

    const radius = Math.max(
      10000,
      Math.min(Number(radiusMeters) || 50000, 50000)
    );

    const nearbyPlaces = await googleRequest(
      "https://places.googleapis.com/v1/places:searchNearby",
      {
        includedTypes: ["electric_vehicle_charging_station"],
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
      "searchNearby electric_vehicle_charging_station"
    );

    nearbyPlaces.forEach(addPlace);

    const textPlaces = await googleRequest(
      "https://places.googleapis.com/v1/places:searchText",
      {
        textQuery: "EV charging station",
        maxResultCount: 10,
        locationBias: {
          circle: {
            center: {
              latitude: point.lat,
              longitude: point.lng
            },
            radius
          }
        }
      },
      "searchText EV charging station"
    );

    textPlaces.forEach(addPlace);

    const dutchPlaces = await googleRequest(
      "https://places.googleapis.com/v1/places:searchText",
      {
        textQuery: "laadpaal elektrische auto",
        maxResultCount: 10,
        locationBias: {
          circle: {
            center: {
              latitude: point.lat,
              longitude: point.lng
            },
            radius
          }
        }
      },
      "searchText laadpaal elektrische auto"
    );

    dutchPlaces.forEach(addPlace);
  }

  const places = Array.from(unique.values()).slice(0, 20);

  return res.status(200).json({
    places,
    count: places.length,
    debug: {
      searchedPoints: points.slice(0, 6).length,
      radiusMeters: Math.max(10000, Math.min(Number(radiusMeters) || 50000, 50000)),
      errors
    }
  });
}
