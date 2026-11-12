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
import { fetchRatingsGiven } from "../ratings/api";
import { RatingForm } from "../ratings/RatingForm";
import { Avatar, Card, Chip, EmptyState } from "../../components/ui";

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
  const [trips, setTrips] = useState<Trip[]>([]);
  const [requestsByTrip, setRequestsByTrip] = useState<Map<string, PickupRequestWithPassenger[]>>(
    new Map(),
  );
  const [ratedPairs, setRatedPairs] = useState<Set<string>>(new Set());
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
      const finishedTripIds = myTrips.filter((t) => t.status === "finished").map((t) => t.id);
      const ratingsGiven = await fetchRatingsGiven(profile.id, finishedTripIds);
      setTrips(myTrips);
      setRequestsByTrip(grouped);
      setRatedPairs(new Set(ratingsGiven.map((r) => `${r.trip_id}:${r.rated_id}`)));
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

  if (loading) return <p className="p-6 text-text-secondary">Cargando tus viajes...</p>;

  return (
    <div className="safe-x mx-auto min-h-dvh max-w-md bg-bg-page pb-28 pt-6">
      <h1 className="mb-4 text-xl font-extrabold text-text-primary">Mis viajes</h1>
      {error && <p className="mb-4 rounded-sm bg-error-soft px-3 py-2 text-sm font-medium text-error">{error}</p>}
      {trips.length === 0 && <EmptyState icon={Car} title="Todavía no has publicado ningún viaje" />}

      <div className="flex flex-col gap-4">
        {trips.map((trip) => {
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

              <Link to={`/viaje/${trip.id}`} className="min-h-11 rounded-lg bg-accent-500 p-3 text-center font-bold text-navy-900">Abrir viaje · solicitudes, paradas y seguimiento</Link>
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

              {trip.status === "finished" && accepted.length > 0 && profile && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-bold text-text-primary">Calificar pasajeros</h3>
                  {accepted.filter(req=>req.journey_stage==='completed').map((req) =>
                    ratedPairs.has(`${trip.id}:${req.passenger_id}`) ? (
                      <p key={req.id} className="text-sm text-text-secondary">
                        Ya calificaste a {req.passenger?.nombre_pila ?? "este pasajero"}.
                      </p>
                    ) : (
                      <RatingForm
                        key={req.id}
                        tripId={trip.id}
                        raterId={profile.id}
                        ratedId={req.passenger_id}
                        ratedName={req.passenger?.nombre_pila ?? "este pasajero"}
                        onSubmitted={() => loadData()}
                      />
                    ),
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
