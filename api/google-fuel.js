export default async function handler(req, res) {

  try {

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'places.displayName,places.location,places.formattedAddress'
        },
        body: JSON.stringify({
          textQuery: 'tankstation Rotterdam',
          maxResultCount: 10
        })
      }
    );

    const data = await response.json();

    const places = (data.places || []).map(place => ({
      name: place.displayName?.text || 'Tankstation',
      address: place.formattedAddress || '',
      lat: place.location?.latitude,
      lng: place.location?.longitude
    }));

    return res.status(200).json({
      places,
      count: places.length,
      raw: data
    });

  } catch (err) {

    return res.status(500).json({
      error: err.message
    });

  }

}
