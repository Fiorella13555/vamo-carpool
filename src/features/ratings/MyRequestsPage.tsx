import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ClipboardList, Clock } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { fetchMyRequests } from "../trips/api";
import type { PickupRequestWithTrip } from "../trips/api";
import { fetchRatingsGiven } from "./api";
import { RatingForm } from "./RatingForm";
import { Card, Chip, EmptyState } from "../../components/ui";

import {isRequestActive,requestLabel} from '../trips/lifecycle';

const REQUEST_STATUS_TONE: Record<string, "info" | "success" | "error" | "neutral"> = {
  pending: "info",
  accepted: "success",
  rejected: "error",
  cancelled: "neutral",
};

export function MyRequestsPage() {
  const { profile } = useAuth();
  const [section,setSection]=useState<'active'|'history'>('active');
  const [requests, setRequests] = useState<PickupRequestWithTrip[]>([]);
  const [ratedTripIds, setRatedTripIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData(background = false) {
    if (!profile) return;
    if (!background) setLoading(true);
    setError(null);
    try {
      const myRequests = await fetchMyRequests(profile.id);
      const finishedTripIds = myRequests
        .filter((r) => r.status === "accepted" && r.trip?.status === "finished")
        .map((r) => r.trip_id);
      const ratingsGiven = await fetchRatingsGiven(profile.id, finishedTripIds);
      setRequests(myRequests);
      setRatedTripIds(new Set(ratingsGiven.map((r) => r.trip_id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar tus solicitudes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    const refresh = () => { void loadData(true); };
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const visibleRequests=requests.filter(req=>isRequestActive(req)===(section==='active'));
  if (loading) return <p className="p-6 text-text-secondary">Cargando tus solicitudes...</p>;

  return (
    <div className="safe-x mx-auto min-h-dvh max-w-md bg-bg-page pb-28 pt-6">
      <h1 className="mb-4 text-xl font-extrabold text-text-primary">Mis solicitudes</h1>
      {error && <p className="mb-4 rounded-sm bg-error-soft px-3 py-2 text-sm font-medium text-error">{error}</p>}

      <div role="group" aria-label="Lista de solicitudes" className="mb-4 flex gap-2">{(['active','history'] as const).map(value=><button key={value} aria-pressed={section===value} onClick={()=>setSection(value)} className={`min-h-11 rounded-lg border px-4 font-bold ${section===value?'bg-accent-500 text-navy-900':'bg-bg-surface text-text-primary'}`}>{value==='active'?'Activos':'Historial'} ({requests.filter(r=>isRequestActive(r)===(value==='active')).length})</button>)}</div>
      {visibleRequests.length === 0 && (
        <EmptyState icon={ClipboardList} title={section==='active'?'No tienes solicitudes activas':'Todavía no hay viajes en tu historial'} />
      )}

      <div className="flex flex-col gap-4">
        {visibleRequests.map((req) => (
          <Card key={req.id} className="flex flex-col gap-2">
            <Link to={`/viaje/${req.trip_id}`} className="min-h-11 rounded-lg bg-accent-500 p-3 text-center font-bold text-navy-900">{section==='active'?'Abrir mi viaje y seguimiento':'Ver detalle en el historial'}</Link>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-bold text-text-primary">{req.trip?.avenida ?? "Viaje"}</h2>
                {req.trip && (
                  <p className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {new Date(req.trip.departure_time).toLocaleString("es-PE")}
                  </p>
                )}
              </div>
              <Chip tone={REQUEST_STATUS_TONE[req.status] ?? "neutral"}>
                {requestLabel(req)}
              </Chip>
            </div>
            <p className="text-sm text-text-secondary">
              Conductor: {req.driver?.nombre_pila ?? "—"} · Viaje: {req.trip?.status ?? "—"}
            </p>



            {req.status === "accepted" && req.journey_stage === "completed" &&
              req.trip?.status === "finished" &&
              profile &&
              req.driver &&
              (ratedTripIds.has(req.trip_id) ? (
                <p className="text-sm text-text-secondary">Ya calificaste a {req.driver.nombre_pila}.</p>
              ) : (
                <RatingForm
                  tripId={req.trip_id}
                  raterId={profile.id}
                  ratedId={req.driver.id}
                  ratedName={req.driver.nombre_pila}
                  onSubmitted={() => loadData()}
                />
              ))}
          </Card>
        ))}
      </div>
    </div>
  );
}
