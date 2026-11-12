// Edge Function: tamiza el nombre del usuario que llama contra la lista de
// requisitoriados (watchlist_entries). Se invoca (a) justo después de
// registrarse y (b) al guardar cambios en nombres/apellidos -- ver
// RegisterPage.tsx y EditProfilePage.tsx. También la dispara AuthContext
// una vez por sesión si watchlist_status todavía es null (cuentas
// existentes antes de este módulo).
//
// Una coincidencia NUNCA bloquea sola: crea una fila en security_alerts y
// deja watchlist_status en 'pending_review'. Solo un administrador (ver
// /admin/alertas) puede sacar la cuenta de revisión -- este Edge Function
// jamás pasa un perfil a 'confirmed_match' ni a 'cleared_by_admin'.
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  DEFAULT_THRESHOLDS,
  evaluateMatch,
  normalizeName,
  tokenize,
} from "../_shared/watchlistMatching.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const TOKEN_THRESHOLD = Number(Deno.env.get("WATCHLIST_TOKEN_THRESHOLD")) || DEFAULT_THRESHOLDS.tokenSimilarity;
const OVERALL_THRESHOLD =
  Number(Deno.env.get("WATCHLIST_OVERALL_THRESHOLD")) || DEFAULT_THRESHOLDS.overallSimilarity;
const THRESHOLDS = { tokenSimilarity: TOKEN_THRESHOLD, overallSimilarity: OVERALL_THRESHOLD };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Falta el header Authorization" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: "Usuario no autenticado" }, 401);
    }

    // service_role: el único cliente que puede leer watchlist_entries
    // (bloqueada por RLS para cualquier usuario normal) y escribir
    // profiles.watchlist_status / security_alerts.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, nombres, apellidos, watchlist_status")
      .eq("id", userData.user.id)
      .single();
    if (profileError || !profile) {
      return jsonResponse({ error: "Perfil no encontrado" }, 404);
    }

    const { data: entries, error: entriesError } = await adminClient
      .from("watchlist_entries")
      .select("id, tokens");
    if (entriesError) {
      return jsonResponse({ error: entriesError.message }, 500);
    }

    const nombresTokens = tokenize(normalizeName(profile.nombres ?? ""));
    const apellidosTokens = tokenize(normalizeName(profile.apellidos ?? ""));

    let bestEntryId: string | null = null;
    let bestSimilarity = 0;
    for (const entry of entries ?? []) {
      const result = evaluateMatch(nombresTokens, apellidosTokens, entry.tokens as string[], THRESHOLDS);
      if (result.isMatch && result.overallSimilarity > bestSimilarity) {
        bestEntryId = entry.id as string;
        bestSimilarity = result.overallSimilarity;
      }
    }

    if (bestEntryId) {
      // Evita duplicar la alerta si ya hay una pendiente exactamente para
      // este par (perfil, entrada) -- puede pasar si se vuelve a invocar
      // sin que el admin haya resuelto la anterior todavía.
      const { data: existingPending } = await adminClient
        .from("security_alerts")
        .select("id")
        .eq("profile_id", profile.id)
        .eq("entry_id", bestEntryId)
        .eq("estado", "pendiente")
        .maybeSingle();

      if (!existingPending) {
        const { error: insertError } = await adminClient.from("security_alerts").insert({
          profile_id: profile.id,
          entry_id: bestEntryId,
          similitud: bestSimilarity,
          estado: "pendiente",
        });
        if (insertError) {
          return jsonResponse({ error: insertError.message }, 500);
        }
      }

      // Una coincidencia nueva siempre vuelve a poner la cuenta en
      // revisión, incluso si un admin ya había descartado una alerta
      // anterior: es evidencia nueva (ej. el usuario editó su nombre).
      const { error: updateError } = await adminClient
        .from("profiles")
        .update({ watchlist_status: "pending_review" })
        .eq("id", profile.id);
      if (updateError) {
        return jsonResponse({ error: updateError.message }, 500);
      }

      return jsonResponse({ status: "pending_review" });
    }

    // Sin coincidencia: solo pasa a 'clear' si todavía no se había
    // tamizado nunca. Si ya estaba 'pending_review' o 'confirmed_match',
    // se queda así -- solo un administrador puede sacarlo de ahí (RLS en
    // security_alerts_update_admin). Si ya estaba 'clear' o
    // 'cleared_by_admin', no hace falta tocar nada.
    if (profile.watchlist_status === null) {
      const { error: updateError } = await adminClient
        .from("profiles")
        .update({ watchlist_status: "clear" })
        .eq("id", profile.id);
      if (updateError) {
        return jsonResponse({ error: updateError.message }, 500);
      }
      return jsonResponse({ status: "clear" });
    }

    return jsonResponse({ status: "unchanged" });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
