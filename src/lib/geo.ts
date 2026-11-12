export interface LatLng {
  lat: number;
  lng: number;
}

// Bounding box aproximado de Lima Metropolitana (incluye Callao). Debe
// coincidir con point_in_lima() en la migración SQL: esa es la que de
// verdad protege la base de datos, esta copia es solo para dar feedback
// inmediato en el formulario antes de llegar al servidor.
export const LIMA_BOUNDING_BOX = {
  minLat: -12.4,
  maxLat: -11.65,
  minLng: -77.2,
  maxLng: -76.7,
};

export function isInLima({ lat, lng }: LatLng): boolean {
  return (
    lat >= LIMA_BOUNDING_BOX.minLat &&
    lat <= LIMA_BOUNDING_BOX.maxLat &&
    lng >= LIMA_BOUNDING_BOX.minLng &&
    lng <= LIMA_BOUNDING_BOX.maxLng
  );
}

export function pointToWkt({ lat, lng }: LatLng): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}

export function lineStringToWkt(points: LatLng[]): string {
  const coords = points.map((p) => `${p.lng} ${p.lat}`).join(", ");
  return `SRID=4326;LINESTRING(${coords})`;
}
