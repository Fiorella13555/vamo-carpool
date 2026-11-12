import { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { fetchPendingAlerts, resolveAlert } from "./api";
import type { PendingAlert } from "./api";
import { Button, Card, Chip, EmptyState, GradientHero, Textarea } from "../../components/ui";

function AlertRow({ alert, adminId, onResolved }: { alert: PendingAlert; adminId: string; onResolved: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResolve(resolution: "descartada" | "confirmada") {
    if (!motivo.trim()) {
      setError("Indica un motivo antes de resolver la alerta.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await resolveAlert({ alertId: alert.id, profileId: alert.profile_id, resolution, motivo: motivo.trim(), adminId });
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al resolver la alerta.");
    } finally {
      setSubmitting(false);
    }
  }

  const rows: [string, string][] = [
    ["Usuario", `${alert.profile?.nombres ?? ""} ${alert.profile?.apellidos ?? ""}`.trim() || "—"],
    ["DNI", alert.profile?.dni ?? "—"],
    ["Entrada coincidente", alert.entry?.nombre_original ?? "—"],
    ["Creada", new Date(alert.creado_en).toLocaleString("es-PE")],
  ];

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-text-secondary">Alerta pendiente</span>
        <Chip tone={alert.similitud >= 0.9 ? "error" : "warning"}>{Math.round(alert.similitud * 100)}% similitud</Chip>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="font-semibold text-text-secondary">{label}</dt>
            <dd className="text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>

      <Textarea
        label="Motivo de la decisión"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        rows={2}
      />

      {error && <p className="rounded-sm bg-error-soft px-3 py-2 text-sm font-medium text-error">{error}</p>}

      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => handleResolve("descartada")} disabled={submitting} className="flex-1">
          Descartar (homónimo)
        </Button>
        <Button variant="danger" onClick={() => handleResolve("confirmada")} disabled={submitting} className="flex-1">
          Confirmar
        </Button>
      </div>
    </Card>
  );
}

export function AdminAlertsPage() {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<PendingAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAlerts() {
    setLoading(true);
    setError(null);
    try {
      setAlerts(await fetchPendingAlerts());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar las alertas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts();
  }, []);

  return (
    <div className="min-h-dvh bg-bg-page pb-28">
      <GradientHero className="flex items-center gap-3 py-7">
        <ShieldCheck className="size-7" aria-hidden="true" />
        <div>
          <h1 className="text-lg font-extrabold">Panel de administración</h1>
          <p className="text-sm text-white/80">Alertas de tamizado pendientes</p>
        </div>
      </GradientHero>

      <div className="safe-x mx-auto flex max-w-md flex-col gap-4 pt-6">
        {error && <p className="rounded-sm bg-error-soft px-3 py-2 text-sm font-medium text-error">{error}</p>}

        {loading ? (
          <p className="text-sm text-text-secondary">Cargando...</p>
        ) : alerts.length === 0 ? (
          <EmptyState icon={ShieldOff} title="No hay alertas pendientes" description="Todo está al día." />
        ) : (
          profile &&
          alerts.map((alert) => <AlertRow key={alert.id} alert={alert} adminId={profile.id} onResolved={loadAlerts} />)
        )}
      </div>
    </div>
  );
}
