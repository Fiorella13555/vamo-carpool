import { describe, expect, it } from "vitest";
import { distanceToPolylineMeters, haversineMeters } from "./distance";

describe("haversineMeters", () => {
  it("devuelve ~0 para el mismo punto", () => {
    expect(haversineMeters({ lat: -12.09, lng: -77.02 }, { lat: -12.09, lng: -77.02 })).toBeCloseTo(
      0,
      3,
    );
  });

  it("aproxima ~111 km por grado de latitud", () => {
    const d = haversineMeters({ lat: -12.0, lng: -77.0 }, { lat: -11.0, lng: -77.0 });
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });
});

describe("distanceToPolylineMeters", () => {
  // Segmento recto de ~1.1km a lo largo de la longitud, en la latitud de
  // Javier Prado (~-12.09), donde 1 grado de longitud ≈ 108.7 km.
  const route = [
    { lat: -12.09, lng: -77.0 },
    { lat: -12.09, lng: -76.99 },
  ];

  it("es ~0 para un punto sobre la ruta", () => {
    expect(distanceToPolylineMeters({ lat: -12.09, lng: -76.995 }, route)).toBeLessThan(1);
  });

  it("es ~150m para un punto perpendicular a 150m de la ruta", () => {
    // ~150m en latitud ≈ 150 / 111320 grados.
    const offsetLat = -12.09 + 150 / 111320;
    const d = distanceToPolylineMeters({ lat: offsetLat, lng: -76.995 }, route);
    expect(d).toBeGreaterThan(140);
    expect(d).toBeLessThan(160);
  });

  it("es grande para un punto lejos de la ruta (otro distrito)", () => {
    const d = distanceToPolylineMeters({ lat: -12.3, lng: -77.3 }, route);
    expect(d).toBeGreaterThan(10000);
  });

  it("devuelve Infinity para una polilínea vacía", () => {
    expect(distanceToPolylineMeters({ lat: -12.09, lng: -77.0 }, [])).toBe(Infinity);
  });
});
