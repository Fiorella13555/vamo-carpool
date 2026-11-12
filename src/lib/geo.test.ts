import { describe, expect, it } from "vitest";
import { isInLima, lineStringToWkt, pointToWkt } from "./geo";

describe("isInLima", () => {
  it("acepta un punto sobre Av. Javier Prado", () => {
    expect(isInLima({ lat: -12.0875, lng: -77.003 })).toBe(true);
  });

  it("rechaza un punto en Arequipa", () => {
    expect(isInLima({ lat: -16.409, lng: -71.537 })).toBe(false);
  });

  it("rechaza un punto en Cusco", () => {
    expect(isInLima({ lat: -13.532, lng: -71.967 })).toBe(false);
  });

  it("rechaza un punto en el mar, fuera del límite oeste", () => {
    expect(isInLima({ lat: -12.05, lng: -77.5 })).toBe(false);
  });
});

describe("pointToWkt", () => {
  it("escribe lng antes que lat (orden WKT)", () => {
    expect(pointToWkt({ lat: -12.09, lng: -77.04 })).toBe(
      "SRID=4326;POINT(-77.04 -12.09)",
    );
  });
});

describe("lineStringToWkt", () => {
  it("concatena los puntos en orden lng lat", () => {
    expect(
      lineStringToWkt([
        { lat: -12.09, lng: -77.04 },
        { lat: -12.08, lng: -76.97 },
      ]),
    ).toBe("SRID=4326;LINESTRING(-77.04 -12.09, -76.97 -12.08)");
  });
});
