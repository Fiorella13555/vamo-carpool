import type { LatLng } from "./geo";

const EARTH_RADIUS_M = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function distanceToSegmentMeters(point: LatLng, a: LatLng, b: LatLng): number {
  // Proyección a un plano local centrado en `a`, usando la latitud del punto
  // como referencia para convertir grados de longitud a metros. Suficiente
  // para segmentos cortos (unos pocos km) como los de esta app.
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(toRad(point.lat));

  const toXY = (p: LatLng) => ({
    x: (p.lng - a.lng) * mPerDegLng,
    y: (p.lat - a.lat) * mPerDegLat,
  });

  const p = toXY(point);
  const ab = toXY(b);

  const abLenSq = ab.x * ab.x + ab.y * ab.y;
  const t = abLenSq === 0 ? 0 : Math.max(0, Math.min(1, (p.x * ab.x + p.y * ab.y) / abLenSq));
  const closest = { x: ab.x * t, y: ab.y * t };
  return Math.hypot(p.x - closest.x, p.y - closest.y);
}

export function distanceToPolylineMeters(point: LatLng, polyline: LatLng[]): number {
  if (polyline.length === 0) return Infinity;
  if (polyline.length === 1) return haversineMeters(point, polyline[0]);

  let min = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = distanceToSegmentMeters(point, polyline[i], polyline[i + 1]);
    if (d < min) min = d;
  }
  return min;
}
