import { describe, expect, it } from "vitest";
import {
  DEFAULT_THRESHOLDS,
  evaluateMatch,
  levenshtein,
  normalizeName,
  tokenize,
  tokenSimilarity,
} from "./watchlistMatching";

describe("normalizeName", () => {
  it("pasa a mayúsculas y quita tildes", () => {
    expect(normalizeName("José María Núñez")).toBe("JOSE MARIA NUNEZ");
  });

  it("quita puntuación suelta", () => {
    expect(normalizeName("Torres .")).toBe("TORRES");
  });

  it("colapsa espacios múltiples", () => {
    expect(normalizeName("Juan   Pérez   Gómez")).toBe("JUAN PEREZ GOMEZ");
  });

  it("recorta espacios al inicio y al final", () => {
    expect(normalizeName("  Ana Lucía  ")).toBe("ANA LUCIA");
  });
});

describe("tokenize", () => {
  it("separa por espacios y descarta vacíos", () => {
    expect(tokenize("JUAN PEREZ GOMEZ")).toEqual(["JUAN", "PEREZ", "GOMEZ"]);
  });

  it("devuelve arreglo vacío para texto vacío", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("levenshtein", () => {
  it("es 0 para strings idénticos", () => {
    expect(levenshtein("GARCIA", "GARCIA")).toBe(0);
  });

  it("cuenta una sustitución", () => {
    expect(levenshtein("GARCIA", "GARCIIA")).toBe(1);
  });

  it("maneja strings vacíos", () => {
    expect(levenshtein("", "ABC")).toBe(3);
    expect(levenshtein("ABC", "")).toBe(3);
  });
});

describe("tokenSimilarity", () => {
  it("es 1 para tokens idénticos", () => {
    expect(tokenSimilarity("PEREZ", "PEREZ")).toBe(1);
  });

  it("baja con errores de tipeo pero sigue siendo alta", () => {
    const similarity = tokenSimilarity("MONTEVERDE", "MONTEBERDE");
    expect(similarity).toBeGreaterThan(0.8);
    expect(similarity).toBeLessThan(1);
  });

  it("es baja para palabras muy distintas", () => {
    expect(tokenSimilarity("PEREZ", "QUISPE")).toBeLessThan(0.5);
  });
});

describe("evaluateMatch", () => {
  const ENTRY_TOKENS = tokenize(normalizeName("Gonzalo Eduardo Monteverde Bussalleu"));

  it("hace match con un nombre y los dos apellidos exactos", () => {
    const result = evaluateMatch(["GONZALO"], ["MONTEVERDE", "BUSSALLEU"], ENTRY_TOKENS);
    expect(result.isMatch).toBe(true);
    expect(result.overallSimilarity).toBe(1);
  });

  it("hace match tolerando un error de tipeo dentro del umbral", () => {
    // "Bussalleu" escrito "Bussaleu" (falta una L): un solo error de tipeo.
    const result = evaluateMatch(["GONZALO"], ["MONTEVERDE", "BUSSALEU"], ENTRY_TOKENS);
    expect(result.isMatch).toBe(true);
  });

  it("NO hace match si solo coincide un apellido común, sin el otro", () => {
    // Alguien con un solo apellido "Monteverde" pero sin "Bussalleu" (ej. Monteverde Rivas).
    const result = evaluateMatch(["GONZALO"], ["MONTEVERDE", "RIVAS"], ENTRY_TOKENS);
    expect(result.isMatch).toBe(false);
  });

  it("NO hace match si solo coincide un nombre de pila común, sin apellidos", () => {
    // Caso explícito del enunciado: "Gonzalo" solo (nombre común) nunca debe generar alerta.
    const result = evaluateMatch(["GONZALO"], ["RAMIREZ", "TORRES"], ENTRY_TOKENS);
    expect(result.isMatch).toBe(false);
  });

  it("NO hace match si no calza ningún nombre de pila, aunque calcen los apellidos", () => {
    const result = evaluateMatch(["PEDRO"], ["MONTEVERDE", "BUSSALLEU"], ENTRY_TOKENS);
    expect(result.isMatch).toBe(false);
  });

  it("respeta el umbral de similitud por token: un error de tipeo grande no cuenta como match", () => {
    const strictThresholds = { tokenSimilarity: 0.95, overallSimilarity: 0.95 };
    const result = evaluateMatch(["GONZALO"], ["MONTEVERDE", "BUSALEU"], ENTRY_TOKENS, strictThresholds);
    expect(result.isMatch).toBe(false);
  });

  it("respeta el umbral de similitud global, incluso si los tokens individuales califican", () => {
    const veryStrictOverall = { tokenSimilarity: 0.5, overallSimilarity: 0.999 };
    const result = evaluateMatch(["GONZALO"], ["MONTEVERDE", "BUSALEU"], ENTRY_TOKENS, veryStrictOverall);
    expect(result.isMatch).toBe(false);
  });

  it("no revienta con arreglos vacíos", () => {
    expect(evaluateMatch([], ["MONTEVERDE"], ENTRY_TOKENS).isMatch).toBe(false);
    expect(evaluateMatch(["GONZALO"], [], ENTRY_TOKENS).isMatch).toBe(false);
    expect(evaluateMatch(["GONZALO"], ["MONTEVERDE"], []).isMatch).toBe(false);
  });

  it("es una función pura: mismos argumentos, mismo resultado, sin efectos secundarios", () => {
    // No bloquea ni decide nada por sí sola -- eso es responsabilidad del
    // Edge Function (que además solo un admin puede revertir, vía RLS).
    // Esta prueba documenta y verifica esa propiedad: es determinista.
    const a = evaluateMatch(["GONZALO"], ["MONTEVERDE", "BUSSALLEU"], ENTRY_TOKENS, DEFAULT_THRESHOLDS);
    const b = evaluateMatch(["GONZALO"], ["MONTEVERDE", "BUSSALLEU"], ENTRY_TOKENS, DEFAULT_THRESHOLDS);
    expect(a).toEqual(b);
  });
});
