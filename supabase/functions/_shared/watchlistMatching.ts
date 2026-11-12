// Lógica de normalización y comparación de nombres contra la lista de
// requisitoriados. Módulo puro (sin imports de Node ni de Deno) para poder
// reutilizarlo tal cual desde dos runtimes distintos:
//   - scripts/import-watchlist.ts (Node, vía tsx) al importar el CSV.
//   - supabase/functions/screen-watchlist/index.ts (Deno) al tamizar un
//     usuario.
// Una sola fuente de verdad: si el criterio de normalización cambiara aquí,
// cambia a la vez para lo que se guarda en watchlist_entries y para lo que
// se compara en el tamizado. Se testea con Vitest (watchlistMatching.test.ts,
// mismo archivo que cualquier otro .ts del repo, sin configuración extra).

// Mayúsculas, sin tildes/diacríticos, sin puntuación suelta (deja letras,
// números y espacios), espacios múltiples colapsados a uno solo, sin
// espacios al inicio/final.
export function normalizeName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita diacríticos (tildes, diéresis)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ") // puntuación suelta -> espacio
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(normalized: string): string[] {
  if (!normalized) return [];
  return normalized.split(" ").filter((t) => t.length > 0);
}

// Distancia de edición clásica (inserción/eliminación/sustitución), O(n*m).
// Nombres son cortos (pocas decenas de caracteres), no hace falta nada más
// sofisticado para ~100 entradas.
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // eliminación
        curr[j - 1] + 1, // inserción
        prev[j - 1] + cost, // sustitución
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

// 1.0 = idénticos, 0.0 = completamente distintos. Tolera errores de tipeo
// (ej. "GARCIA" vs "GARCIIA") sin exigir coincidencia exacta de texto.
export function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

export interface MatchThresholds {
  /** Similitud mínima para que UN token del usuario cuente como "encontrado" en la entrada. */
  tokenSimilarity: number;
  /** Similitud global mínima (promedio de las mejores coincidencias usadas) para generar alerta. */
  overallSimilarity: number;
}

export const DEFAULT_THRESHOLDS: MatchThresholds = {
  tokenSimilarity: 0.84,
  overallSimilarity: 0.8,
};

export interface MatchResult {
  isMatch: boolean;
  overallSimilarity: number;
  matchedNombreToken: string | null;
  matchedApellidoTokens: string[];
}

// Para un token del usuario, el mejor token de la entrada (y su similitud).
function bestMatch(userToken: string, entryTokens: string[]): { token: string; similarity: number } | null {
  let best: { token: string; similarity: number } | null = null;
  for (const entryToken of entryTokens) {
    const similarity = tokenSimilarity(userToken, entryToken);
    if (!best || similarity > best.similarity) best = { token: entryToken, similarity };
  }
  return best;
}

// Pura: solo calcula, nunca decide qué hacer con el resultado (eso es
// responsabilidad del Edge Function, que es el único lugar que escribe en
// la base de datos). Exige coincidencia en AL MENOS un token de `nombres`
// y en TODOS los tokens de `apellidos` -- que solo calce un nombre de pila
// común (sin apellido) nunca genera match, ni tampoco un solo apellido sin
// el otro.
export function evaluateMatch(
  nombresTokens: string[],
  apellidosTokens: string[],
  entryTokens: string[],
  thresholds: MatchThresholds = DEFAULT_THRESHOLDS,
): MatchResult {
  if (nombresTokens.length === 0 || apellidosTokens.length === 0 || entryTokens.length === 0) {
    return { isMatch: false, overallSimilarity: 0, matchedNombreToken: null, matchedApellidoTokens: [] };
  }

  const nombreMatches = nombresTokens
    .map((t) => ({ token: t, best: bestMatch(t, entryTokens) }))
    .filter((m) => m.best && m.best.similarity >= thresholds.tokenSimilarity);

  const apellidoMatches = apellidosTokens.map((t) => ({ token: t, best: bestMatch(t, entryTokens) }));
  const allApellidosMatched = apellidoMatches.every((m) => m.best && m.best.similarity >= thresholds.tokenSimilarity);

  if (nombreMatches.length === 0 || !allApellidosMatched) {
    return { isMatch: false, overallSimilarity: 0, matchedNombreToken: null, matchedApellidoTokens: [] };
  }

  // Similitud global: el mejor nombre que calzó + todos los apellidos (que ya sabemos que calzaron todos).
  const bestNombre = nombreMatches.reduce((a, b) => (b.best!.similarity > a.best!.similarity ? b : a));
  const usedSimilarities = [bestNombre.best!.similarity, ...apellidoMatches.map((m) => m.best!.similarity)];
  const overallSimilarity = usedSimilarities.reduce((sum, s) => sum + s, 0) / usedSimilarities.length;

  return {
    isMatch: overallSimilarity >= thresholds.overallSimilarity,
    overallSimilarity,
    matchedNombreToken: bestNombre.token,
    matchedApellidoTokens: apellidoMatches.map((m) => m.token),
  };
}
