import { useEffect, useState } from "react";
import type { LiveLocationRow } from "../../types/location";
import { fetchLiveLocations, subscribeToLiveLocations } from "./api";

// Pasado este tiempo sin una lectura nueva, se considera "última posición
// hace X seg" en vez de una posición fresca (GPS sin señal, app en segundo
// plano, o conexión perdida: ver useOnlineStatus para distinguir el caso
// "soy yo el que perdió la conexión").
export const STALE_AFTER_MS = 15000;

export interface UseLiveLocationViewersResult {
  points: LiveLocationRow[];
  /** Date.now() recalculado cada segundo, para recalcular "hace X seg" sin esperar un nuevo evento. */
  now: number;
}

// Trae el estado inicial de live_locations para un viaje y se suscribe a
// los cambios por Realtime. RLS decide qué filas llegan (ver
// supabase/migrations/20261022170000_live_locations.sql): un pasajero
// aceptado solo recibe la fila del conductor, el conductor solo recibe las
// de sus pasajeros aceptados.
export function useLiveLocationViewers(tripId: string | null): UseLiveLocationViewersResult {
  const [points, setPoints] = useState<Map<string, LiveLocationRow>>(new Map());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!tripId) {
      setPoints(new Map());
      return;
    }

    let active = true;
    let busy = false;
    let dirty = false;
    setPoints(new Map());
    async function refresh() {
      if (!active) return;
      if (busy) { dirty = true; return; }
      busy = true;
      try {
        const rows = await fetchLiveLocations(tripId!);
        if (active) setPoints(new Map(rows.map(r => [r.user_id, r])));
      } catch {
        // No conservar coordenadas si ya no podemos autorizar su lectura.
        if (active) setPoints(new Map());
      } finally {
        busy = false;
        if (dirty && active) { dirty = false; void refresh(); }
      }
    }
    // Cada evento invalida el estado; la nueva consulta aplica RLS también
    // tras revocaciones. El sondeo cubre DELETE no entregados y reconexiones.
    const unsubscribe = subscribeToLiveLocations(tripId, () => { void refresh(); });
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      unsubscribe();
    };
  }, [tripId]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return { points: Array.from(points.values()), now };
}

export function secondsSince(isoTimestamp: string, now: number): number {
  return Math.max(0, Math.round((now - new Date(isoTimestamp).getTime()) / 1000));
}

export function isStale(isoTimestamp: string, now: number): boolean {
  return now - new Date(isoTimestamp).getTime() > STALE_AFTER_MS;
}
