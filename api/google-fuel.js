const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8500;
const MAX_POINTS = 9;
const MAX_RESULTS_PER_POINT = 8;
const DEFAULT_RADIUS_METERS = 8000;

const memoryCache = globalThis.__ROADORA_GOOGLE_FUEL_CACHE__ || new Map();
globalThis.__ROADORA_GOOGLE_FUEL_CACHE__ = memoryCache;

function send(res, status, body) {
  res.status(status).json(body);
}

function roundCoord(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null;
}

function normalizePoint(point) {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function cacheKey(points, radiusMeters) {
  const compact = points.map(p => `${roundCoord(p.lat)},${roundCoord(p.lng)}`).join('|');
  return `${radiusMeters}:${compact}`;
}

function inferBrand(name = '') {
  const value = String(name).toLowerCase();
  if (value.includes('shell')) return 'Shell';
  if (value.includes('bp')) return 'BP';
  if (value.includes('esso')) return 'Esso';
  if (value.includes('aral')) return 'Aral';
  if (value.includes('total')) return 'TotalEnergies';
  if (value.includes('avia')) return 'AVIA';
  if (value.includes('texaco')) return 'Texaco';
  if (value.includes('q8')) return 'Q8';
  if (value.includes('eni')) return 'Eni';
  return 'Tankstation';
}

function inferAmenities(place) {
  const text = [
    place?.displayName?.text,
    place?.formattedAddress,
    ...(Array.isArray(place?.types) ? place.types : [])
  ].filter(Boolean).join(' ').toLowerCase();

  const amenities = new Set(['WC', 'Shop']);
  if (text.includes('cafe') || text.includes('coffee') || text.includes('bakery') || text.includes('restaurant')) amenities.add('Koffie');
  if (text.includes('charging') || text.includes('ev') || text.includes('electric')) amenities.add('EV');
  if (text.includes('car_wash') || text.includes('wash')) amenities.add('Wasstraat');
  return Array.from(amenities).slice(0, 5);
}

function normalizePlace(place) {
  const lat = Number(place?.location?.latitude);
  const lng = Number(place?.location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const name = place?.displayName?.text || 'Tankstation';
  const openNow = typeof place?.regularOpeningHours?.openNow === 'boolean'
    ? place.regularOpeningHours.openNow
    : null;

  return {
    id: place?.id || place?.name || `${lat},${lng}`,
    name,
    address: place?.formattedAddress || 'Langs je route',
    lat,
    lng,
    rating: typeof place?.rating === 'number' ? place.rating : null,
    openNow,
    provider: 'Google Places',
    brand: inferBrand(name),
    status: openNow === true ? 'nu open' : openNow === false ? 'mogelijk gesloten' : 'openingstijden checken',
    detourLabel: '± 2 min van route',
    amenities: inferAmenities(place),
    googleMapsUri: place?.googleMapsUri || null,
    website: place?.websiteUri || null,
    phone: place?.nationalPhoneNumber || null,
    photoName: Array.isArray(place?.photos) && place.photos[0]?.name ? place.photos[0].name : null
  };
}

async function searchNearbyFuel({ apiKey, point, radiusMeters }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': [
          'places.id',
          'places.name',
          'places.displayName',
          'places.formattedAddress',
          'places.location',
          'places.rating',
          'places.regularOpeningHours.openNow',
          'places.googleMapsUri',
          'places.websiteUri',
          'places.nationalPhoneNumber',
          'places.photos.name',
          'places.types'
        ].join(',')
      },
      body: JSON.stringify({
        includedTypes: ['gas_station'],
        maxResultCount: MAX_RESULTS_PER_POINT,
        rankPreference: 'DISTANCE',
        locationRestriction: {
          circle: {
            center: { latitude: point.lat, longitude: point.lng },
            radius: radiusMeters
          }
        }
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = data?.error?.message || `Google Places ${response.status}`;
      const code = data?.error?.status || 'GOOGLE_PLACES_ERROR';
      throw new Error(`${code}: ${message}`);
    }

    return Array.isArray(data?.places) ? data.places : [];
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST') return send(res, 405, { ok: false, status: 'method_not_allowed', places: [] });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return send(res, 200, {
      ok: false,
      status: 'misconfigured',
      source: 'backend',
      message: 'GOOGLE_MAPS_API_KEY ontbreekt in Vercel Environment Variables.',
      places: []
    });
  }

  const body = req.body || {};
  const points = Array.isArray(body.points)
    ? body.points.map(normalizePoint).filter(Boolean).slice(0, MAX_POINTS)
    : [];
  const radiusMeters = Math.max(1000, Math.min(12000, Number(body.radiusMeters) || DEFAULT_RADIUS_METERS));

  if (!points.length) {
    return send(res, 200, { ok: true, status: 'no_route_points', source: 'google', places: [] });
  }

  const key = cacheKey(points, radiusMeters);
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) {
    return send(res, 200, { ...cached.payload, cached: true });
  }

  try {
    const settled = await Promise.allSettled(points.map(point => searchNearbyFuel({ apiKey, point, radiusMeters })));
    const rawPlaces = settled.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    const errors = settled.filter(result => result.status === 'rejected').map(result => String(result.reason?.message || result.reason)).slice(0, 3);

    const seen = new Set();
    const places = [];

    for (const raw of rawPlaces) {
      const place = normalizePlace(raw);
      if (!place) continue;
      const id = place.id || `${roundCoord(place.lat)},${roundCoord(place.lng)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      places.push(place);
      if (places.length >= 24) break;
    }

    const payload = {
      ok: true,
      status: places.length ? 'live' : (errors.length ? 'partial_error' : 'empty'),
      source: 'google',
      cached: false,
      count: places.length,
      places,
      errors
    };

    memoryCache.set(key, { savedAt: Date.now(), payload });
    return send(res, 200, payload);
  } catch (error) {
    return send(res, 200, {
      ok: false,
      status: 'error',
      source: 'google',
      message: String(error?.message || error),
      places: []
    });
  }
}
