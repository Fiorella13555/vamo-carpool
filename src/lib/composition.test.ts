import { describe, expect, it } from "vitest";
import { formatSexComposition } from "./composition";

describe("formatSexComposition", () => {
  it("sin confirmados", () => {
    expect(formatSexComposition(0, 0)).toBe("sin pasajeros confirmados aún");
  });

  it("solo mujeres", () => {
    expect(formatSexComposition(0, 3)).toBe("solo mujeres");
  });

  it("solo hombres", () => {
    expect(formatSexComposition(2, 0)).toBe("solo hombres");
  });

  it("mezcla en plural", () => {
    expect(formatSexComposition(3, 2)).toBe("3 hombres, 2 mujeres");
  });

  it("mezcla en singular", () => {
    expect(formatSexComposition(1, 1)).toBe("1 hombre, 1 mujer");
  });
});
