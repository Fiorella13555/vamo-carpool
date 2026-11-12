import { describe, expect, it } from "vitest";
import { dedupeExactByKey, parseCsv } from "./parse";

describe("parseCsv", () => {
  it("parsea el formato real: índice,Nombre, con encabezado", () => {
    const csv = [",Buscados", "0,Lidonil Vasquez Rodriguez", "1,Darwin Chuup Wasum"].join("\n");
    expect(parseCsv(csv)).toEqual([
      { nombreOriginal: "Lidonil Vasquez Rodriguez" },
      { nombreOriginal: "Darwin Chuup Wasum" },
    ]);
  });

  it("ignora líneas de comentario que empiezan con #", () => {
    const csv = ["# DATOS FICTICIOS - SOLO DEMOSTRACION", ",Buscados", "0,Nombre Ficticio Apellido"].join("\n");
    expect(parseCsv(csv)).toEqual([{ nombreOriginal: "Nombre Ficticio Apellido" }]);
  });

  it("ignora líneas vacías", () => {
    const csv = [",Buscados", "0,Juan Perez", "", "1,Ana Lopez", "   "].join("\n");
    expect(parseCsv(csv)).toEqual([{ nombreOriginal: "Juan Perez" }, { nombreOriginal: "Ana Lopez" }]);
  });

  it("devuelve arreglo vacío si no hay filas de datos", () => {
    expect(parseCsv(",Buscados")).toEqual([]);
    expect(parseCsv("")).toEqual([]);
  });
});

describe("dedupeExactByKey", () => {
  it("conserva la primera aparición y cuenta los duplicados", () => {
    const items = ["A", "B", "A", "C", "B", "B"];
    const result = dedupeExactByKey(items, (x) => x);
    expect(result.unique).toEqual(["A", "B", "C"]);
    expect(result.duplicateCount).toBe(3);
  });

  it("no reporta duplicados si todo es distinto", () => {
    const result = dedupeExactByKey(["A", "B", "C"], (x) => x);
    expect(result.unique).toEqual(["A", "B", "C"]);
    expect(result.duplicateCount).toBe(0);
  });

  it("funciona con arreglo vacío", () => {
    const result = dedupeExactByKey<string>([], (x) => x);
    expect(result.unique).toEqual([]);
    expect(result.duplicateCount).toBe(0);
  });
});
