import { supabase } from "../../lib/supabase";

export interface PendingAlert {
  id: string;
  profile_id: string;
  entry_id: string;
  similitud: number;
  creado_en: string;
  profile: { nombres: string; apellidos: string; dni: string } | null;
  entry: { nombre_original: string } | null;
}

// Protegido por RLS (security_alerts_select_admin / profiles_select_admin /
// watchlist_entries_select_admin, ver la migración de Fase 7): si quien
// llama no es admin, estas queries devuelven vacío, no un error -- por eso
// AdminRoute además bloquea la ruta en el cliente.
export async function fetchPendingAlerts(): Promise<PendingAlert[]> {
  const { data: alerts, error } = await supabase
    .from("security_alerts")
    .select("id, profile_id, entry_id, similitud, creado_en")
    .eq("estado", "pendiente")
    .order("creado_en", { ascending: true });
  if (error) throw error;
  if (!alerts || alerts.length === 0) return [];

  const profileIds = [...new Set(alerts.map((a) => a.profile_id))];
  const entryIds = [...new Set(alerts.map((a) => a.entry_id))];

  const [{ data: profiles, error: profilesError }, { data: entries, error: entriesError }] = await Promise.all([
    supabase.from("profiles").select("id, nombres, apellidos, dni").in("id", profileIds),
    supabase.from("watchlist_entries").select("id, nombre_original").in("id", entryIds),
  ]);
  if (profilesError) throw profilesError;
  if (entriesError) throw entriesError;

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const entryById = new Map((entries ?? []).map((e) => [e.id, e]));

  return alerts.map((a) => ({
    ...a,
    profile: profileById.get(a.profile_id) ?? null,
    entry: entryById.get(a.entry_id) ?? null,
  }));
}

export type AlertResolution = "descartada" | "confirmada";

export interface ResolveAlertInput {
  alertId: string;
  profileId: string;
  resolution: AlertResolution;
  motivo: string;
  adminId: string;
}

export async function resolveAlert(input: ResolveAlertInput) {
  const { error: alertError } = await supabase
    .from("security_alerts")
    .update({
      estado: input.resolution,
      motivo: input.motivo,
      revisado_por: input.adminId,
      revisado_en: new Date().toISOString(),
    })
    .eq("id", input.alertId);
  if (alertError) throw alertError;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ watchlist_status: input.resolution === "confirmada" ? "confirmed_match" : "cleared_by_admin" })
    .eq("id", input.profileId);
  if (profileError) throw profileError;
}
