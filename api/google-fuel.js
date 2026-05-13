// Roadora Google Fuel API — v4.1 Route Core Lock
// Server-side Google Places proxy for fuel stations along an ORS route.
// Safe for Vercel: API key stays in Environment Variables.

const CONFIG = {
  cacheName: '__ROADORA_GOOGLE_FUEL_CACHE_V41__',
  cacheTtlMs: 12 * 60 * 1000,
  requestTimeoutMs: 8500,
  maxPoints: 16,
  maxResultsPerPoint: 5,
  maxTotalResults: 34,
  defaultRadiusMeters: 7000,
  minRadiusMeters: 1500,
  maxRadiusMeters: 9000,
  concurrency: 4,
  routeEngine: 'route-core-lock-v1',
  placeMode: 'fuel'
};

const memoryCache = globalThis[CONFIG.cacheName] || new Map();
globalThis[CONFIG.cacheName] = memoryCache;

function send(res, status, body) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
  res.status(status).json(body);
}

function trimCache(maxEntries = 80) {
  if (memoryCache.size <= maxEntries) return;
  const keys = Array.from(memoryCache.keys());
  for (const key of keys.slice(0, Math.max(0, keys.length - maxEntries))) memoryCache.delete(key);
}

function roundCoord(value, digits = 3) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const m = 10 ** digits;
  return Math.round(n * m) / m;
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
    progress: Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : index,
    distanceFromStartMeters: Number.isFinite(distanceFromStartMeters) ? Math.max(0, Math.round(distanceFromStartMeters)) : null
  };
}

function cacheKey(points, radiusMeters, mode) {
  const compact = points.map(p => `${roundCoord(p.lat)},${roundCoord(p.lng)}`).join('|');
  return `${CONFIG.placeMode}:${mode || 'default'}:${radiusMeters}:${compact}`;
}

function inferBrand(name = '') {
  const value = String(name).toLowerCase();
  if (value.includes('shell')) return 'Shell';
  if (value.includes('bp')) return 'BP';
  if (value.includes('esso') || value.includes('exxon')) return 'Esso';
  if (value.includes('aral')) return 'Aral';
  if (value.includes('total')) return 'TotalEnergies';
  if (value.includes('avia')) return 'AVIA';
  if (value.includes('texaco')) return 'Texaco';
  if (value.includes('q8')) return 'Q8';
  if (value.includes('eni')) return 'Eni';
  if (value.includes('tinq')) return 'Tinq';
  return 'Tankstation';
}

function inferAmenities(place) {
  const text = [
    place?.displayName?.text,
    place?.formattedAddress,
    ...(Array.isArray(place?.types) ? place.types : [])
  ].filter(Boolean).join(' ').toLowerCase();

  const amenities = new Set(['WC', 'Shop']);
  if (text.includes('cafe') || text.includes('café') || text.includes('coffee') || text.includes('bakery') || text.includes('restaurant')) amenities.add('Koffie');
  if (text.includes('charging') || text.includes('ev') || text.includes('electric')) amenities.add('EV');
  if (text.includes('car_wash') || text.includes('wash')) amenities.add('Wasstraat');
  return Array.from(amenities).slice(0, 5);
}

function normalizePlace(hit) {
  const place = hit?.place || hit;
  const lat = Number(place?.location?.latitude);
  const lng = Number(place?.location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const name = place?.displayName?.text || 'Tankstation';
  const openNow = typeof place?.regularOpeningHours?.openNow === 'boolean'
    ? place.regularOpeningHours.openNow
    : null;

  return {
    id: place?.id || place?.name || `${roundCoord(lat, 5)},${roundCoord(lng, 5)}`,
    name,
    address: place?.formattedAddress || 'Langs je route',
    lat,
    lng,
    rating: typeof place?.rating === 'number' ? place.rating : null,
    userRatingCount: typeof place?.userRatingCount === 'number' ? place.userRatingCount : null,
    openNow,
    provider: 'Google Places',
    brand: inferBrand(name),
    status: openNow === true ? 'nu open' : openNow === false ? 'mogelijk gesloten' : 'openingstijden checken',
    detourLabel: '± 2 min van route',
    amenities: inferAmenities(place),
    googleMapsUri: place?.googleMapsUri || null,
    website: place?.websiteUri || null,
    phone: place?.nationalPhoneNumber || null,
    photoName: Array.isArray(place?.photos) && place.photos[0]?.name ? place.photos[0].name : null,
    routeSampleIndex: Number.isFinite(hit?.sampleIndex) ? hit.sampleIndex : null,
    routeProgress: Number.isFinite(hit?.point?.progress) ? hit.point.progress : null,
    distanceFromStartMeters: Number.isFinite(hit?.point?.distanceFromStartMeters) ? hit.point.distanceFromStartMeters : null
  };
}

async function searchNearbyFuel({ apiKey, point, radiusMeters }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);

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
          'places.userRatingCount',
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
        maxResultCount: CONFIG.maxResultsPerPoint,
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

    return Array.isArray(data?.places)
      ? data.places.map(place => ({ place, sampleIndex: point.index, point }))
      : [];
  } finally {
    clearTimeout(timer);
  }
}

async function runLimited(items, limit, worker) {
  const results = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const current = items[cursor++];
      try {
        results.push({ status: 'fulfilled', value: await worker(current) });
      } catch (reason) {
        results.push({ status: 'rejected', reason });
      }
    }
  });
  await Promise.all(workers);
  return results;
}

function scoreFuel(place) {
  const rating = Number(place.rating || 0);
  const reviews = Math.min(0.5, Math.log10(Math.max(1, Number(place.userRatingCount || 0))) / 6);
  const brandBonus = place.brand && place.brand !== 'Tankstation' ? 0.2 : 0;
  const openBonus = place.openNow === true ? 0.25 : 0;
  return rating + reviews + brandBonus + openBonus;
}

function dedupeAndSpread(rawHits, maxTotal = CONFIG.maxTotalResults) {
  const seen = new Set();
  const normalized = [];

  for (const hit of rawHits) {
    const place = normalizePlace(hit);
    if (!place) continue;
    const id = place.id || `${roundCoord(place.lat, 4)},${roundCoord(place.lng, 4)}`;
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
    list.sort((a, b) => scoreFuel(b) - scoreFuel(a) || a.__order - b.__order);
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
  const mode = String(body.mode || 'route_quick');
  const points = Array.isArray(body.points)
    ? body.points.map(normalizePoint).filter(Boolean).slice(0, CONFIG.maxPoints)
    : [];
  const radiusMeters = Math.max(CONFIG.minRadiusMeters, Math.min(CONFIG.maxRadiusMeters, Number(body.radiusMeters) || CONFIG.defaultRadiusMeters));

  if (!points.length) {
    return send(res, 200, { ok: true, status: 'no_route_points', source: 'google', routeEngine: CONFIG.routeEngine, places: [] });
  }

  const key = cacheKey(points, radiusMeters, mode);
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.savedAt < CONFIG.cacheTtlMs) {
    return send(res, 200, { ...cached.payload, cached: true });
  }

  try {
    const settled = await runLimited(points, CONFIG.concurrency, point => searchNearbyFuel({ apiKey, point, radiusMeters }));
    const rawHits = settled.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    const errors = settled.filter(result => result.status === 'rejected').map(result => String(result.reason?.message || result.reason)).slice(0, 4);
    const places = dedupeAndSpread(rawHits, CONFIG.maxTotalResults);

    const payload = {
      ok: true,
      status: places.length ? (errors.length ? 'partial_live' : 'live') : (errors.length ? 'partial_error' : 'empty'),
      source: 'google',
      cached: false,
      routeEngine: CONFIG.routeEngine,
      searchedPoints: points.length,
      radiusMeters,
      count: places.length,
      places,
      errors
    };

    trimCache();
    memoryCache.set(key, { savedAt: Date.now(), payload });
    return send(res, 200, payload);
  } catch (error) {
    return send(res, 200, {
      ok: false,
      status: 'error',
      source: 'google',
      routeEngine: CONFIG.routeEngine,
      message: String(error?.message || error),
      places: []
    });
  }
}
