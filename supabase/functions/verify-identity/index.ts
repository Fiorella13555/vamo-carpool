// Edge Function: verifica la identidad de un usuario recién registrado.
//
// IdentityVerificationService es la interfaz que separa "qué necesitamos
// verificar" de "cómo lo verificamos". Hoy la implementa
// MockIdentityVerificationService; para producción solo hay que escribir
// una nueva clase que la implemente (llamando a RENIEC y a la consulta de
// antecedentes real) y cambiar la línea que instancia el servicio más abajo.
import { createClient } from "jsr:@supabase/supabase-js@2";

interface DniLookupResult {
  valid: boolean;
}

interface CriminalRecordResult {
  clean: boolean;
}

interface IdentityVerificationService {
  verifyDni(dni: string): Promise<DniLookupResult>;
  checkCriminalRecord(dni: string): Promise<CriminalRecordResult>;
}

// Mock determinista para la demo (sin llamadas externas reales):
//   - DNI que empieza en "00" -> RENIEC no lo encuentra (inválido)
//   - DNI que termina en "9"  -> se encontraron antecedentes
//   - cualquier otro DNI de 8 dígitos -> todo limpio
class MockIdentityVerificationService implements IdentityVerificationService {
  async verifyDni(dni: string): Promise<DniLookupResult> {
    await delay(300);
    return { valid: !dni.startsWith("00") };
  }

  async checkCriminalRecord(dni: string): Promise<CriminalRecordResult> {
    await delay(300);
    return { clean: !dni.endsWith("9") };
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const identityService: IdentityVerificationService = new MockIdentityVerificationService();

// El navegador manda un preflight OPTIONS antes de la llamada real porque
// supabase-js agrega headers custom (Authorization, apikey); sin estos
// headers CORS, el preflight falla y el fetch nunca llega a este código.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Cliente "como el usuario": solo para confirmar quién está llamando.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: "Usuario no autenticado" }, 401);
    }

    // Cliente con service_role: el único que puede escribir verification_status
    // (el cliente normal no tiene permiso de UPDATE en esa columna, ver migración).
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, dni, verification_status")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile) {
      return jsonResponse({ error: "Perfil no encontrado" }, 404);
    }

    if (profile.verification_status === "verified") {
      return jsonResponse({ status: "verified", reason: null });
    }

    const dniResult = await identityService.verifyDni(profile.dni);
    const recordResult = dniResult.valid
      ? await identityService.checkCriminalRecord(profile.dni)
      : { clean: false };

    // Modo prueba: para la validación con personas reales, un DNI real de 8
    // dígitos puede terminar en "9" o lo que sea y el mock lo rechazaría sin
    // razón real. En vez de guardar DNIs reales de los que probarán la app
    // (en código, seed o repo), se activa un secret del Edge Function
    // (`supabase secrets set TEST_MODE_AUTO_VERIFY=true`, nunca committeado)
    // que aprueba automáticamente a cualquiera, sin excepción por DNI.
    const testModeAutoVerify = Deno.env.get("TEST_MODE_AUTO_VERIFY") === "true";

    const newStatus =
      testModeAutoVerify || (dniResult.valid && recordResult.clean) ? "verified" : "rejected";

    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ verification_status: newStatus })
      .eq("id", profile.id);

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }

    return jsonResponse({
      status: newStatus,
      reason:
        newStatus === "verified"
          ? null
          : !dniResult.valid
            ? "dni_not_found"
            : "criminal_record_found",
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
