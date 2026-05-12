export default async function handler(req, res) {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'Missing GOOGLE_MAPS_API_KEY'
      });
    }

    const { points = [], radiusMeters = 30000 } = req.body || {};

    const unique = new Map();

    for (const point of points) {

      const response = await fetch(
        'https://places.googleapis.com/v1/places:searchNearby',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask':
              'places.id,places.displayName,places.location,places.formattedAddress'
          },
          body: JSON.stringify({
            includedTypes: ['gas_station'],
            maxResultCount: 20,
            locationRestriction: {
              circle: {
                center: {
                  latitude: point.lat,
                  longitude: point.lng
                },
                radius: radiusMeters
              }
            }
          })
        }
      );

      const data = await response.json();

      for (const place of data.places || []) {

        if (!place.location) continue;

        unique.set(place.id, {
          id: place.id,
          name: place.displayName?.text || 'Tankstation',
          address: place.formattedAddress || '',
          lat: place.location.latitude,
          lng: place.location.longitude
        });
      }
    }

    return res.status(200).json({
      places: [...unique.values()],
      count: unique.size
    });

  } catch (err) {

    return res.status(500).json({
      error: err.message
    });
  }
}
