// Parsing y deduplicación puros para el importador del watchlist
// (scripts/import-watchlist.ts). Separados del script principal (que sí
// habla con Supabase) para poder testearlos con Vitest sin tocar una base
// de datos real -- mismo criterio que el resto del proyecto: lo puro se
// testea, lo que toca la base de datos se verifica a mano (ver CLAUDE.md).

export interface ParsedRow {
  nombreOriginal: string;
}

// Formato del CSV real (y del de ejemplo): una columna de índice sin
// nombre y una columna "Buscados" con el nombre completo. Líneas que
// empiezan con "#" se ignoran (permite marcar un archivo como ficticio con
// un comentario en la primera línea). La primera línea de datos (no
// comentario) es el encabezado y se descarta.
export function parseCsv(content: string): ParsedRow[] {
  const lines = content.split(/\r?\n/);
  const rows: ParsedRow[] = [];
  let headerSeen = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    if (!headerSeen) {
      headerSeen = true;
      continue;
    }
    const commaIndex = line.indexOf(",");
    if (commaIndex === -1) continue;
    const nombreOriginal = line.slice(commaIndex + 1).trim();
    if (nombreOriginal) rows.push({ nombreOriginal });
  }

  return rows;
}

export interface DedupeResult<T> {
  unique: T[];
  duplicateCount: number;
}

// Elimina duplicados EXACTOS (misma clave) dentro de un mismo archivo,
// conservando la primera aparición. Los duplicados entre corridas distintas
// del script los filtra el `unique` de watchlist_entries.nombre_normalizado
// en la base de datos (on conflict do nothing), no esta función.
export function dedupeExactByKey<T>(items: T[], keyFn: (item: T) => string): DedupeResult<T> {
  const seen = new Set<string>();
  const unique: T[] = [];
  let duplicateCount = 0;

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      duplicateCount++;
      continue;
    }
    seen.add(key);
    unique.push(item);
  }

  return { unique, duplicateCount };
}
