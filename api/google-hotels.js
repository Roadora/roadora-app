const CACHE_TTL_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 9000;
const MAX_POINTS = 18;
const MAX_RESULTS_PER_POINT = 5;
const MAX_TOTAL_RESULTS = 36;
const DEFAULT_RADIUS_METERS = 16000;

const memoryCache = globalThis.__ROADORA_GOOGLE_HOTELS_CACHE__ || new Map();
globalThis.__ROADORA_GOOGLE_HOTELS_CACHE__ = memoryCache;

function send(res, status, body) {
  res.status(status).json(body);
}

function roundCoord(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null;
}

function normalizePoint(point, index = 0) {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const progress = Number(point?.progress);
  const distanceFromStartMeters = Number(point?.distanceFromStartMeters);
  return {
    lat,
    lng,
    index,
    progress: Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : null,
    distanceFromStartMeters: Number.isFinite(distanceFromStartMeters) ? Math.max(0, Math.round(distanceFromStartMeters)) : null
  };
}

function cacheKey(points, radiusMeters, mode) {
  const compact = points.map(p => `${roundCoord(p.lat)},${roundCoord(p.lng)}`).join('|');
  return `${mode || 'default'}:${radiusMeters}:${compact}`;
}

function inferHotelAmenities(place) {
  const text = [
    place?.displayName?.text,
    place?.formattedAddress,
    place?.editorialSummary?.text,
    ...(Array.isArray(place?.types) ? place.types : [])
  ].filter(Boolean).join(' ').toLowerCase();

  const amenities = new Set(['Wifi', 'Parkeren']);
  if (text.includes('breakfast') || text.includes('ontbijt')) amenities.add('Ontbijt');
  if (text.includes('family') || text.includes('familie') || text.includes('children')) amenities.add('Familie');
  if (text.includes('pet') || text.includes('dog') || text.includes('huisdier')) amenities.add('Hond');
  if (text.includes('charging') || text.includes('ev') || text.includes('electric')) amenities.add('EV');
  if (text.includes('spa') || text.includes('wellness') || text.includes('pool') || text.includes('zwembad')) amenities.add('Wellness');
  return Array.from(amenities).slice(0, 6);
}

function normalizePlace(hit) {
  const place = hit?.place || hit;
  const lat = Number(place?.location?.latitude);
  const lng = Number(place?.location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const name = place?.displayName?.text || 'Hotel langs route';
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
    userRatingCount: typeof place?.userRatingCount === 'number' ? place.userRatingCount : null,
    openNow,
    provider: 'Google Places',
    status: openNow === true ? 'nu open' : 'beschikbaarheid checken',
    detourLabel: '± 10 min van route',
    amenities: inferHotelAmenities(place),
    googleMapsUri: place?.googleMapsUri || null,
    website: place?.websiteUri || null,
    phone: place?.nationalPhoneNumber || null,
    priceLevel: place?.priceLevel || null,
    photoName: Array.isArray(place?.photos) && place.photos[0]?.name ? place.photos[0].name : null,
    summary: place?.editorialSummary?.text || null,
    routeSampleIndex: Number.isFinite(hit?.sampleIndex) ? hit.sampleIndex : null,
    routeProgress: Number.isFinite(hit?.point?.progress) ? hit.point.progress : null,
    distanceFromStartMeters: Number.isFinite(hit?.point?.distanceFromStartMeters) ? hit.point.distanceFromStartMeters : null
  };
}

async function searchHotelsNearPoint({ apiKey, point, radiusMeters }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
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
          'places.userRatingCount',
          'places.priceLevel',
          'places.regularOpeningHours.openNow',
          'places.googleMapsUri',
          'places.websiteUri',
          'places.nationalPhoneNumber',
          'places.photos.name',
          'places.types',
          'places.editorialSummary'
        ].join(',')
      },
      body: JSON.stringify({
        textQuery: 'hotel OR motel OR lodging',
        maxResultCount: MAX_RESULTS_PER_POINT,
        languageCode: 'nl',
        locationBias: {
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

    return Array.isArray(data?.places)
      ? data.places.map(place => ({ place, sampleIndex: point.index, point }))
      : [];
  } finally {
    clearTimeout(timer);
  }
}

function scoreHotel(place) {
  const rating = Number(place.rating || 0);
  const reviews = Math.min(0.8, Math.log10(Math.max(1, Number(place.userRatingCount || 0))) / 5);
  const openBonus = place.openNow === true ? 0.1 : 0;
  return rating + reviews + openBonus;
}

function dedupeAndSpread(rawHits, maxTotal = MAX_TOTAL_RESULTS) {
  const seen = new Set();
  const normalized = [];

  for (const hit of rawHits) {
    const place = normalizePlace(hit);
    if (!place) continue;
    const id = place.id || `${roundCoord(place.lat)},${roundCoord(place.lng)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    normalized.push(place);
  }

  const bySegment = new Map();
  normalized.forEach((place, order) => {
    const key = Number.isFinite(place.routeSampleIndex) ? place.routeSampleIndex : order;
    if (!bySegment.has(key)) bySegment.set(key, []);
    bySegment.get(key).push({ ...place, __order: order });
  });

  for (const list of bySegment.values()) {
    list.sort((a, b) => scoreHotel(b) - scoreHotel(a) || a.__order - b.__order);
  }

  const keys = Array.from(bySegment.keys()).sort((a, b) => a - b);
  const result = [];
  let round = 0;
  while (result.length < maxTotal && round < 4) {
    for (const key of keys) {
      const item = bySegment.get(key)?.[round];
      if (item) {
        result.push(item);
        if (result.length >= maxTotal) break;
      }
    }
    round += 1;
  }

  return result
    .sort((a, b) => {
      const ap = Number.isFinite(a.routeProgress) ? a.routeProgress : (a.routeSampleIndex || 0);
      const bp = Number.isFinite(b.routeProgress) ? b.routeProgress : (b.routeSampleIndex || 0);
      return ap - bp;
    })
    .map(({ __order, ...place }) => place);
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
  const mode = String(body.mode || 'route_planning');
  const points = Array.isArray(body.points)
    ? body.points.map(normalizePoint).filter(Boolean).slice(0, MAX_POINTS)
    : [];
  const radiusMeters = Math.max(5000, Math.min(25000, Number(body.radiusMeters) || DEFAULT_RADIUS_METERS));

  if (!points.length) {
    return send(res, 200, { ok: true, status: 'no_route_points', source: 'google', places: [] });
  }

  const key = cacheKey(points, radiusMeters, mode);
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) {
    return send(res, 200, { ...cached.payload, cached: true });
  }

  try {
    const settled = await Promise.allSettled(points.map(point => searchHotelsNearPoint({ apiKey, point, radiusMeters })));
    const rawHits = settled.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    const errors = settled.filter(result => result.status === 'rejected').map(result => String(result.reason?.message || result.reason)).slice(0, 3);
    const places = dedupeAndSpread(rawHits, MAX_TOTAL_RESULTS);

    const payload = {
      ok: true,
      status: places.length ? 'live' : (errors.length ? 'partial_error' : 'empty'),
      source: 'google',
      cached: false,
      routeEngine: 'along-route-v2',
      searchedPoints: points.length,
      radiusMeters,
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
      routeEngine: 'along-route-v2',
      message: String(error?.message || error),
      places: []
    });
  }
}
