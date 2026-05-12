export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'GOOGLE_MAPS_API_KEY ontbreekt in Vercel'
      });
    }

    const { points = [], radiusMeters = 30000 } = req.body || {};

    if (!points.length) {
      return res.status(400).json({
        error: 'Geen routepunten ontvangen'
      });
    }

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
              'places.id,places.displayName,places.formattedAddress,places.location,places.rating'
          },
          body: JSON.stringify({
            includedTypes: ['gas_station'],
            maxResultCount: 10,
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

      console.log('GOOGLE RESPONSE:', data);

      if (!response.ok) {
        console.error(data);
        continue;
      }

      for (const place of data.places || []) {
        if (!place.location) continue;

        unique.set(place.id, {
          id: place.id,
          name: place.displayName?.text || 'Tankstation',
          address: place.formattedAddress || '',
          lat: place.location.latitude,
          lng: place.location.longitude,
          rating: place.rating || null
        });
      }
    }

    return res.status(200).json({
      places: Array.from(unique.values())
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: err.message
    });
  }
}
