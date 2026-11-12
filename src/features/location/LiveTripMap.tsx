import { useEffect, useRef, useState } from "react";
import { Map, AdvancedMarker, Polyline, useMap } from "@vis.gl/react-google-maps";
import { Radio, ShieldAlert, WifiOff } from "lucide-react";
import type { LatLng } from "../../lib/geo";
import type { LiveLocationRole } from "../../types/location";
import { TEST_MODE } from "../../lib/testMode";
import { useTripLocation } from "./LiveLocationProvider";
import { useLiveLocationViewers, isStale, secondsSince } from "./useLiveLocationViewers";
import { useOnlineStatus } from "./useOnlineStatus";
import { Chip } from "../../components/ui";

interface LiveTripMapProps {
  tripId: string;
  route: LatLng[];
  center: LatLng;
  ownUserId: string;
  ownRole: LiveLocationRole;
  /** true si este usuario debe estar compartiendo su posición ahora mismo (viaje en curso y, si es pasajero, con solicitud aceptada). */
  sharingActive: boolean;
  /** userId -> nombre a mostrar bajo el marcador (para los pasajeros que ve el conductor). */
  labels?: Record<string, string>;
}

const MARKER_COLOR: Record<LiveLocationRole, string> = {
  driver: "#0B2559",
  passenger: "#9B671E",
};

function FitParticipants({ positions, route }: { positions: { user_id: string; lat: number; lng: number }[]; route: LatLng[] }) {
  const map = useMap();
  const fitted = useRef<string | null>(null);
  useEffect(() => {
    if (!map) return;
    const participants = positions.map(p => p.user_id).sort().join(":");
    if (fitted.current === participants) return;
    const coordinates = [...route, ...positions];
    if (!coordinates.length) return;
    const bounds = new google.maps.LatLngBounds();
    for (const point of coordinates) bounds.extend({ lat: point.lat, lng: point.lng });
    map.fitBounds(bounds, 40);
    fitted.current = participants;
  }, [map, positions, route]);
  return null;
}

export function LiveTripMap({
  tripId,
  route,
  center,
  ownUserId,
  ownRole,
  sharingActive,
  labels,
}: LiveTripMapProps) {
  const [manualPosition, setManualPosition] = useState<LatLng | null>(center);
  const { sharing, setManual } = useTripLocation(tripId);
  const { points, now } = useLiveLocationViewers(tripId);
  const online = useOnlineStatus();

  return (
    <div className="flex flex-col gap-2">
      {!online && (
        <p className="flex items-center gap-1.5 rounded-sm bg-error-soft px-2.5 py-2 text-xs font-medium text-error">
          <WifiOff className="size-3.5 shrink-0" aria-hidden="true" />
          Sin conexión a internet. Tu posición no se está enviando.
        </p>
      )}
      {sharingActive && sharing.permissionDenied && (
        <p className="flex items-center gap-1.5 rounded-sm bg-error-soft px-2.5 py-2 text-xs font-medium text-error">
          <ShieldAlert className="size-3.5 shrink-0" aria-hidden="true" />
          No se puede compartir tu ubicación porque el permiso está denegado. En iPhone: Ajustes → Safari →
          Ubicación → Permitir (o Ajustes → Privacidad → Localización → Safari).
        </p>
      )}
      {sharingActive && sharing.noSignal && !sharing.permissionDenied && (
        <p className="rounded-sm bg-warning-soft px-2.5 py-2 text-xs font-medium text-warning">
          Sin señal de GPS por ahora. Reintentando...
        </p>
      )}
      {sharingActive && sharing.sendError && (
        <p role="alert" className="rounded-sm bg-error-soft px-2.5 py-2 text-xs text-error">
          No pudimos enviar tu ubicación. Revisa tu conexión y los permisos del viaje.
        </p>
      )}
      <p className="text-xs text-text-secondary">
        {ownRole === "driver"
          ? "Ves a tus pasajeros confirmados y ellos ven tu ubicación."
          : "Tu conductor ve tu ubicación y tú ves la suya; otros pasajeros no ven dónde estás."}
        {" "}Mantén Vamo abierto y permite el acceso a tu ubicación.
        Al finalizar el viaje se deja de compartir.
      </p>
      {points.filter(p => p.user_id !== ownUserId).length === 0 && (
        <p role="status" className="text-xs text-text-secondary">
          Esperando la ubicación de la otra persona. Debe abrir Vamo y permitir el GPS.
        </p>
      )}
      {sharingActive && !TEST_MODE && (
        <div className="flex items-center gap-2">
          <Chip tone={sharing.sharing ? "success" : "neutral"} icon={<Radio className="size-3.5" aria-hidden="true" />}>
            {sharing.sharing ? "Compartiendo tu ubicación" : "Tu ubicación se compartirá solo durante este viaje"}
          </Chip>
        </div>
      )}
      {sharingActive && TEST_MODE && (
        <p className="text-xs text-text-secondary">
          Modo prueba: haz clic en el mapa para fijar tu ubicación simulada (en vez del GPS real).
        </p>
      )}

      <div className="h-64 w-full overflow-hidden rounded-lg border border-border-subtle">
        <Map
          mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID"}
          defaultCenter={center}
          defaultZoom={13}
          disableDefaultUI
          className="h-full w-full"
          onClick={(e) => {
            if (TEST_MODE && e.detail.latLng) {
              setManualPosition(e.detail.latLng);
              setManual(tripId, e.detail.latLng);
            }
          }}
        >
          <FitParticipants positions={points} route={route} />
          {route.length > 1 && <Polyline path={route} strokeColor="#1D4ED8" strokeWeight={4} />}

          {points.map((p) => {
            const stale = isStale(p.recorded_at, now);
            const label =
              p.user_id === ownUserId ? "Tú" : labels?.[p.user_id] ?? (p.role === "driver" ? "Conductor" : "Pasajero");
            return (
              <AdvancedMarker key={p.user_id} position={{ lat: p.lat, lng: p.lng }} title={label}>
                <div
                  className="whitespace-nowrap rounded-full border-2 border-white px-2 py-0.5 text-xs font-bold text-white shadow-sm"
                  style={{ background: MARKER_COLOR[p.role], opacity: stale ? 0.55 : 1 }}
                >
                  {label}
                  {stale && ` · hace ${secondsSince(p.recorded_at, now)}s`}
                </div>
              </AdvancedMarker>
            );
          })}

          {TEST_MODE && manualPosition && (
            <AdvancedMarker position={manualPosition} title="Tu ubicación simulada (modo prueba)" />
          )}
        </Map>
      </div>
    </div>
  );
}
