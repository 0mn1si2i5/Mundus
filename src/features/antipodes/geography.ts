export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export function normalizeLongitude(longitude: number): number {
  const normalized = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
}

export function antipodeOf(point: GeoPoint): GeoPoint {
  return {
    latitude: -point.latitude,
    longitude: normalizeLongitude(point.longitude + 180),
  };
}
