import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Car, Clock } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import {
  fetchMyTrips,
  fetchRequestsForTrips,
} from "./api";
import type { PickupRequestWithPassenger } from "./api";
import type { Trip, TripStatus } from "../../types/trip";
import { TripRatings } from "../ratings/TripRatings";
import { Avatar, Card, Chip, EmptyState } from "../../components/ui";

import {isTripActive} from './lifecycle';

const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  scheduled: "Programado",
  ongoing: "En curso",
  finished: "Finalizado",
  cancelled: "Cancelado",
};
const TRIP_STATUS_TONE: Record<TripStatus, "info" | "success" | "neutral" | "error"> = {
  scheduled: "info",
  ongoing: "success",
  finished: "neutral",
  cancelled: "error",
};

export function MyTripsPage() {
  const { profile } = useAuth();
  const [section,setSection]=useState<'active'|'history'>('active');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [requestsByTrip, setRequestsByTrip] = useState<Map<string, PickupRequestWithPassenger[]>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData(background = false) {
    if (!profile) return;
    if (!background) setLoading(true);
    setError(null);
    try {
      const myTrips = await fetchMyTrips(profile.id);
      const requests = await fetchRequestsForTrips(myTrips.map((t) => t.id));
      const grouped = new Map<string, PickupRequestWithPassenger[]>();
      for (const r of requests) {
        const list = grouped.get(r.trip_id) ?? [];
        list.push(r);
        grouped.set(r.trip_id, list);
      }
      setTrips(myTrips);
      setRequestsByTrip(grouped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar tus viajes.");
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

  const visibleTrips=trips.filter(trip=>isTripActive(trip)===(section==='active'));
  if (loading) return <p className="p-6 text-text-secondary">Cargando tus viajes...</p>;

  return (
    <div className="safe-x mx-auto min-h-dvh max-w-md bg-bg-page pb-28 pt-6">
      <h1 className="mb-4 text-xl font-extrabold text-text-primary">Mis viajes</h1>
      {error && <p className="mb-4 rounded-sm bg-error-soft px-3 py-2 text-sm font-medium text-error">{error}</p>}
      <div role="group" aria-label="Lista de viajes" className="mb-4 flex gap-2">{(['active','history'] as const).map(value=><button key={value} aria-pressed={section===value} onClick={()=>setSection(value)} className={`min-h-11 rounded-lg border px-4 font-bold ${section===value?'bg-accent-500 text-navy-900':'bg-bg-surface text-text-primary'}`}>{value==='active'?'Activos':'Historial'} ({trips.filter(t=>isTripActive(t)===(value==='active')).length})</button>)}</div>
      {visibleTrips.length === 0 && <EmptyState icon={Car} title={section==='active'?'No tienes viajes activos':'Todavía no hay viajes en tu historial'} />}

      <div className="flex flex-col gap-4">
        {visibleTrips.map((trip) => {
          const requests = requestsByTrip.get(trip.id) ?? [];
          const pending = requests.filter((r) => r.status === "pending");
          const accepted = requests.filter((r) => r.status === "accepted");
          return (
            <Card key={trip.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-bold text-text-primary">{trip.avenida}</h2>
                  <p className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {new Date(trip.departure_time).toLocaleString("es-PE")}
                  </p>
                </div>
                <Chip tone={TRIP_STATUS_TONE[trip.status]}>{TRIP_STATUS_LABEL[trip.status]}</Chip>
              </div>

              <p className="text-sm text-text-secondary">
                {trip.seats_available} / {trip.seats_total} asientos libres
              </p>

              <Link to={`/viaje/${trip.id}`} className="min-h-11 rounded-lg bg-accent-500 p-3 text-center font-bold text-navy-900">{section==='active'?'Abrir viaje · solicitudes y seguimiento':'Ver viaje en el historial'}</Link>
              <p className="text-sm text-text-secondary">{pending.length} solicitudes pendientes · {accepted.length} confirmadas</p>

              {accepted.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-text-secondary">
                    Pasajeros confirmados
                  </p>
                  <div className="flex -space-x-2">
                    {accepted.map((r) => (
                      <div key={r.id} title={r.passenger?.nombre_pila ?? "Pasajero"} className="ring-2 ring-bg-surface rounded-full">
                        <Avatar name={r.passenger?.nombre_pila ?? "?"} size={32} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {trip.status === "finished" && <TripRatings tripId={trip.id}/>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
