// Importa un CSV de nombres requisitoriados a watchlist_batches +
// watchlist_entries. Captura única, no scraping, no se repite desde la
// app -- se corre a mano cuando haga falta.
//
// Uso:
//   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/import-watchlist.ts \
//     --file data/watchlist_snapshot.csv \
//     --source "Captura pública, <sitio>, <fecha>" \
//     --captured-at 2026-10-27
//
// Idempotente: watchlist_entries.nombre_normalizado es UNIQUE en la base de
// datos (ver supabase/migrations/20261027190000_watchlist_screening.sql) e
// insertamos con on-conflict-do-nothing -- correrlo dos veces con el mismo
// archivo no duplica entradas (sí crea un segundo registro en
// watchlist_batches, para dejar constancia de que se intentó de nuevo, pero
// con 0 entradas nuevas).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { normalizeName, tokenize } from "../supabase/functions/_shared/watchlistMatching";
import { dedupeExactByKey, parseCsv } from "./watchlistImport/parse";

interface Args {
  file: string;
  source: string;
  capturedAt: string;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string) => {
    const idx = argv.indexOf(flag);
    return idx === -1 ? undefined : argv[idx + 1];
  };

  const file = get("--file") ?? "data/watchlist_snapshot.csv";
  const source = get("--source");
  const capturedAt = get("--captured-at") ?? new Date().toISOString().slice(0, 10);

  if (!source) {
    throw new Error('Falta --source "descripción de dónde salió este CSV" (va a watchlist_batches.fuente).');
  }

  return { file, source, capturedAt };
}

async function main() {
  const { file, source, capturedAt } = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.SUPABASE_URL ?? readViteSupabaseUrlFallback();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) {
    throw new Error("Falta SUPABASE_URL (o VITE_SUPABASE_URL en .env.local como fallback).");
  }
  if (!serviceRoleKey) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY. Cópiala de Supabase -> Project Settings -> API (service_role, secreta) " +
        "y expórtala en tu shell antes de correr este script -- nunca la guardes en un archivo del repo.",
    );
  }

  const content = readFileSync(file, "utf-8");
  const rows = parseCsv(content);
  const withNormalized = rows.map((r) => ({
    nombre_original: r.nombreOriginal,
    nombre_normalizado: normalizeName(r.nombreOriginal),
    tokens: tokenize(normalizeName(r.nombreOriginal)),
  }));
  const { unique, duplicateCount } = dedupeExactByKey(withNormalized, (r) => r.nombre_normalizado);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: batch, error: batchError } = await supabase
    .from("watchlist_batches")
    .insert({ fuente: source, fecha_captura: capturedAt, cantidad_registros: unique.length })
    .select("id")
    .single();
  if (batchError || !batch) {
    throw new Error(`No se pudo crear el lote: ${batchError?.message}`);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("watchlist_entries")
    .upsert(
      unique.map((r) => ({ ...r, batch_id: batch.id })),
      { onConflict: "nombre_normalizado", ignoreDuplicates: true },
    )
    .select("id");
  if (insertError) {
    throw new Error(`No se pudieron insertar las entradas: ${insertError.message}`);
  }

  const insertedCount = inserted?.length ?? 0;
  const alreadyExistedCount = unique.length - insertedCount;

  // Nunca se loguea ningún nombre completo, solo conteos.
  console.log("Importación de watchlist completada:");
  console.log(`  Registros leídos del CSV:        ${rows.length}`);
  console.log(`  Duplicados exactos en el archivo: ${duplicateCount}`);
  console.log(`  Ya existían (corridas previas):   ${alreadyExistedCount}`);
  console.log(`  Importados ahora:                 ${insertedCount}`);
  console.log(`  Lote: ${batch.id} (fuente="${source}", captura=${capturedAt})`);
}

function readViteSupabaseUrlFallback(): string | undefined {
  try {
    const content = readFileSync(".env.local", "utf-8");
    const match = content.match(/^VITE_SUPABASE_URL=(.+)$/m);
    return match?.[1]?.trim();
  } catch {
    return undefined;
  }
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
