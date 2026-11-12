import { LocationSearch, FitJourney } from "../../components/LocationSearch";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { APIProvider, Map, AdvancedMarker, Polyline, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Car } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { isInLima } from "../../lib/geo";
import type { LatLng } from "../../lib/geo";
import { createTrip } from "./api";
import { fetchMyVehicle } from "../vehicles/api";
import type { Vehicle } from "../../types/vehicle";
import { isWatchlistClear } from "../../types/profile";
import { BottomSheet, Button, EmptyState, Input, StatusScreen } from "../../components/ui";

const LIMA_CENTER = { lat: -12.09, lng: -77.02 };

type PickMode = "origin" | "destination" | null;

function PublishTripForm() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const routesLibrary = useMapsLibrary("routes");

  const routeVersion = useRef(0);
  const [vehicle, setVehicle] = useState<Vehicle | null | undefined>(undefined);
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [route, setRoute] = useState<LatLng[] | null>(null);
  const [pickMode, setPickMode] = useState<PickMode>(null);
  const [seatPrice, setSeatPrice] = useState("");
  const [routeSeconds, setRouteSeconds] = useState<number | null>(null);
  const [avenida, setAvenida] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [seatsTotal, setSeatsTotal] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    fetchMyVehicle(profile.id).then(setVehicle);
  }, [profile]);

  function handleMapClick(latLng: LatLng) {
    if (!pickMode) return;
    if (!isInLima(latLng)) {
      setError("Ese punto está fuera de Lima Metropolitana. El servicio solo funciona en Lima.");
      return;
    }
    setError(null);
    routeVersion.current++;
    setRoute(null);
    if (pickMode === "origin") setOrigin(latLng);
    else setDestination(latLng);
    setPickMode(null);
  }

  async function handleCalculateRoute() {
    if (!origin || !destination || !routesLibrary) return;
    setError(null);
    const version = routeVersion.current;
    setCalculatingRoute(true);
    try {
      // google.maps.DirectionsService es la API legacy, ya no habilitada en
      // proyectos nuevos de Google Cloud; Route.computeRoutes es su
      // reemplazo (misma librería "routes", clase distinta).
      const result = await routesLibrary.Route.computeRoutes({
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
        fields: ["path", "durationMillis"],
      });
      const path = result.routes?.[0]?.path?.map((p) => ({ lat: p.lat, lng: p.lng }));
      if (!path || path.length < 2) {
        setError("No se pudo calcular una ruta entre esos dos puntos.");
        return;
      }
      if (version === routeVersion.current) {setRoute(path);setRouteSeconds((result.routes?.[0]?.durationMillis ?? 0)/1000 || null);}
    } catch {
      setError("No se pudo calcular la ruta. Intenta con otros puntos.");
    } finally {
      setCalculatingRoute(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!origin || !destination) {
      setError("Selecciona el origen y destino, buscando una dirección o usando el mapa.");
      return;
    }
    if (!route || !routeSeconds) {
      setError("Calcula la ruta antes de publicar el viaje.");
      return;
    }
    if (!avenida.trim()) {
      setError("Indica la avenida principal de la ruta.");
      return;
    }
    if (!departureTime) {
      setError("Indica la hora de salida.");
      return;
    }
    if (new Date(departureTime).getTime() <= Date.now()) {
      setError("La hora de salida debe ser en el futuro.");
      return;
    }
    if (!Number.isFinite(Number(seatPrice)) || seatPrice === "" || Number(seatPrice)<0 || Number(seatPrice)>9999) {setError("Define un aporte válido en soles para el recorrido completo.");return;}
    if (!profile) return;

    setSubmitting(true);
    try {
      const tripId = await createTrip({
        seatPrice:Number(seatPrice), routeDurationSeconds:routeSeconds,
        driverId: profile.id,
        origin,
        destination,
        route,
        avenida: avenida.trim(),
        departureTime: new Date(departureTime).toISOString(),
        seatsTotal,
      });
      navigate(`/viaje/${tripId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al publicar el viaje.");
    } finally {
      setSubmitting(false);
    }
  }

  if (profile && !isWatchlistClear(profile.watchlist_status)) {
    return (
      <StatusScreen
        icon={Car}
        title="Estamos verificando tu información"
        description="Te avisaremos apenas termine. Mientras tanto no puedes publicar viajes."
      />
    );
  }

  if (vehicle === undefined) return <p className="p-6 text-text-secondary">Cargando...</p>;

  if (vehicle === null) {
    return (
      <div className="safe-x mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center bg-bg-page">
        <EmptyState
          icon={Car}
          title="Todavía no registraste tu vehículo"
          description="Necesitas registrarlo (placa, modelo, color y asientos) antes de publicar un viaje."
          action={
            <Button onClick={() => navigate("/conductor/vehiculo")} className="mt-3">
              Registrar mi vehículo
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="relative h-dvh overflow-hidden bg-bg-page">
      <Map
        mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID"}
        defaultCenter={LIMA_CENTER}
        defaultZoom={12}
        disableDefaultUI
        className="h-full w-full"
        onClick={(e) => e.detail.latLng && handleMapClick(e.detail.latLng)}
      >
        <FitJourney origin={origin} destination={destination}/>
        {origin && <AdvancedMarker position={origin} title="Origen" />}
        {destination && <AdvancedMarker position={destination} title="Destino" />}
        {route && <Polyline path={route} strokeColor="#1D4ED8" strokeWeight={4} />}
      </Map>

      <BottomSheet className={`flex flex-col gap-3 px-4 pb-4 ${pickMode ? "!max-h-[25dvh]" : ""}`}>
        <div>
          <h1 className="text-lg font-extrabold text-text-primary">Publicar viaje</h1>
          <p className="text-sm text-text-secondary">
            Busca tu origen y destino o selecciónalos en el mapa. Ambos deben estar dentro de Lima Metropolitana.
          </p>
        </div>

        {pickMode && <p role="status" className="text-sm font-bold text-text-primary">Toca el mapa para elegir {pickMode === "origin" ? "el origen" : "el destino"}. <button type="button" onClick={()=>setPickMode(null)}>Cancelar</button></p>}
        <LocationSearch label="Origen" point={origin} onSelect={point=>{routeVersion.current++;setOrigin(point);setRoute(null);setPickMode(null);}} onClear={()=>{routeVersion.current++;setOrigin(null);setRoute(null);}} onMap={()=>setPickMode("origin")}/>
        <LocationSearch label="Destino" point={destination} onSelect={point=>{routeVersion.current++;setDestination(point);setRoute(null);setPickMode(null);}} onClear={()=>{routeVersion.current++;setDestination(null);setRoute(null);}} onMap={()=>setPickMode("destination")}/>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleCalculateRoute}
            disabled={!origin || !destination || calculatingRoute}
            loading={calculatingRoute}
          >
            Calcular ruta
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Aporte por asiento para la ruta completa (S/)" type="number" min={0} max={9999} step="0.01" required value={seatPrice} onChange={e=>setSeatPrice(e.target.value)} placeholder="Ej. 6.00"/>
          <p className="text-xs text-text-secondary">Cada pasajero verá el aporte proporcional al tramo que comparte. No se cambia tu recorrido para recogerlo.</p>
          <Input
            label="Avenida principal"
            value={avenida}
            onChange={(e) => setAvenida(e.target.value)}
            placeholder="Av. Javier Prado"
          />
          <Input
            label="Hora de salida"
            type="datetime-local"
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
          />
          <Input
            label="Asientos disponibles"
            type="number"
            min={1}
            max={6}
            value={seatsTotal}
            onChange={(e) => setSeatsTotal(Number(e.target.value))}
          />

          {error && <p className="rounded-sm bg-error-soft px-3 py-2 text-sm font-medium text-error">{error}</p>}

          <Button type="submit" loading={submitting}>
            Publicar viaje
          </Button>
        </form>
      </BottomSheet>
    </div>
  );
}

export function PublishTripPage() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  return (
    <APIProvider apiKey={apiKey}>
      <PublishTripForm />
    </APIProvider>
  );
}
