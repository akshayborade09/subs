import * as Location from 'expo-location';

/** Approximate centroids for supported delivery pincodes (Mumbai). */
const PINCODE_CENTROIDS: Record<string, { latitude: number; longitude: number; area: string }> = {
  '400051': { latitude: 19.159, longitude: 72.998, area: 'Airoli' },
  '400068': { latitude: 19.2495, longitude: 72.859, area: 'Dahisar East' },
  '400081': { latitude: 19.1136, longitude: 72.8697, area: 'Andheri East' },
  '400100': { latitude: 19.1868, longitude: 72.8482, area: 'Malad East' },
  '400101': { latitude: 19.2058, longitude: 72.8662, area: 'Kandivali East' },
};

export function pincodeCentroid(pincode: string): { latitude: number; longitude: number; area: string } | null {
  return PINCODE_CENTROIDS[pincode.replace(/\D/g, '').slice(0, 6)] ?? null;
}

export function isPincodeQuery(query: string): boolean {
  return /^\d{6}$/.test(query.trim());
}

export function formatPlaceLabel(place: Location.LocationGeocodedAddress, fallbackPincode = ''): string {
  const pincode = place.postalCode ?? fallbackPincode;
  const label = [place.name, place.street, place.district, place.city, place.region, pincode]
    .filter((part, index, all) => part && all.indexOf(part) === index)
    .join(', ');
  if (pincode && !/\b\d{6}\b/.test(label)) {
    return `${label}, ${pincode}`;
  }
  return label;
}

export async function reverseGeocodeLabel(coordinate: { latitude: number; longitude: number }): Promise<string | null> {
  try {
    const places = await Location.reverseGeocodeAsync(coordinate);
    const place = places[0];
    if (!place) return null;
    return formatPlaceLabel(place);
  } catch {
    return null;
  }
}

export async function geocodeLocationQuery(query: string): Promise<{ latitude: number; longitude: number; label: string } | null> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return null;

  if (isPincodeQuery(trimmed)) {
    const known = PINCODE_CENTROIDS[trimmed];
    if (known) {
      const label = await reverseGeocodeLabel({ latitude: known.latitude, longitude: known.longitude })
        ?? `${known.area}, Mumbai ${trimmed}`;
      return { latitude: known.latitude, longitude: known.longitude, label };
    }

    for (const attempt of [`${trimmed}, Mumbai, Maharashtra, India`, `${trimmed}, India`]) {
      const results = await Location.geocodeAsync(attempt);
      const result = results[0];
      if (!result) continue;
      const label = await reverseGeocodeLabel(result) ?? `${trimmed}, India`;
      return { latitude: result.latitude, longitude: result.longitude, label };
    }

    return null;
  }

  const results = await Location.geocodeAsync(trimmed);
  const result = results[0];
  if (!result) return null;
  const label = await reverseGeocodeLabel(result) ?? trimmed;
  return { latitude: result.latitude, longitude: result.longitude, label };
}

function withPincode(label: string, pincode: string): string {
  if (label.includes(pincode)) return label;
  const withoutOtherPincode = label.replace(/,?\s*\b\d{6}\b/g, '').replace(/,\s*$/, '');
  return withoutOtherPincode ? `${withoutOtherPincode}, ${pincode}` : pincode;
}

/**
 * Resolves the delivery-availability pincode into a location label for the
 * address screen. The entered pincode stays authoritative — reverse geocoding a
 * centroid can land on a neighbouring code and flip the serviceability check.
 */
export async function geocodePincodeLocation(
  pincode: string,
): Promise<{ latitude: number; longitude: number; label: string } | null> {
  const normalized = pincode.replace(/\D/g, '').slice(0, 6);
  if (normalized.length !== 6) return null;
  const known = pincodeCentroid(normalized);
  const fallback = known
    ? { latitude: known.latitude, longitude: known.longitude, label: `${known.area}, Mumbai, ${normalized}` }
    : null;
  try {
    const resolved = await geocodeLocationQuery(normalized);
    if (!resolved) return fallback;
    return { ...resolved, label: withPincode(resolved.label, normalized) };
  } catch {
    return fallback;
  }
}

export async function searchLocationSuggestions(query: string): Promise<string[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  if (isPincodeQuery(trimmed)) {
    const resolved = await geocodeLocationQuery(trimmed);
    return resolved ? [resolved.label] : [];
  }

  const results = await Location.geocodeAsync(trimmed);
  const labels = await Promise.all(
    results.slice(0, 5).map(async (match, index) => {
      const label = await reverseGeocodeLabel(match);
      return label ?? `${trimmed} · ${index + 1}`;
    }),
  );
  return Array.from(new Set(labels.filter(Boolean)));
}
