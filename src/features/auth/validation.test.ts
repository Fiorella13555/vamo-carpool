import { describe, expect, it } from "vitest";
import { isValidDni } from "./validation";

describe("isValidDni", () => {
  it("acepta un DNI de 8 dígitos", () => {
    expect(isValidDni("12345678")).toBe(true);
  });

  it.each(["1234567", "123456789", "1234567a", "", "1234 678", "12345.78"])(
    "rechaza '%s'",
    (dni) => {
      expect(isValidDni(dni)).toBe(false);
    },
  );
});
