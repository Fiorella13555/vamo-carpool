import { useEffect, useRef, useState } from "react";
import { TEST_MODE } from "../../lib/testMode";

export type GeolocationErrorKind = "denied" | "unavailable" | "timeout" | "unsupported";

export interface GeolocationReading {
  lat: number;
  lng: number;
  accuracyM: number;
  recordedAt: string;
}

export interface ManualPosition {
  lat: number;
  lng: number;
}

// Descarta lecturas con precisión muy baja (iPhone en interiores/con mala
// señal puede dar accuracy de cientos de metros); nos quedamos con la
// última lectura buena en vez de mostrar un punto que salta por el mapa.
const MAX_ACCURACY_M = 100;

// watchPosition dispara más seguido de lo que necesitamos (a veces cada
// 1-2s); limitamos a ~5s para no saturar Realtime/la base de datos.
const MIN_INTERVAL_MS = 5000;

export interface UseGeolocationResult {
  reading: GeolocationReading | null;
  error: GeolocationErrorKind | null;
  /** true mientras se espera la primera lectura (ni éxito ni error todavía). */
  waiting: boolean;
}

// Envuelve navigator.geolocation.watchPosition con alta precisión, filtro de
// precisión y throttle a ~5s. En modo prueba (VITE_TEST_MODE=true), ignora
// el GPS real y usa manualPosition tal cual la fije la persona en la UI.
export function useGeolocation(active: boolean, manualPosition?: ManualPosition | null): UseGeolocationResult {
  const [reading, setReading] = useState<GeolocationReading | null>(null);
  const [error, setError] = useState<GeolocationErrorKind | null>(null);
  const lastEmitAt = useRef(0);

  useEffect(() => {
    if (!active) {
      setReading(null);
      setError(null);
      return;
    }

    if (TEST_MODE) {
      if (manualPosition) {
        setError(null);
        setReading({ ...manualPosition, accuracyM: 0, recordedAt: new Date().toISOString() });
      } else {
        setReading(null);
      }
      return;
    }

    if (!("geolocation" in navigator)) {
      setError("unsupported");
      return;
    }

    setError(null);
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos.coords.accuracy > MAX_ACCURACY_M) return;

        const now = Date.now();
        if (now - lastEmitAt.current < MIN_INTERVAL_MS) return;
        lastEmitAt.current = now;

        setError(null);
        setReading({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
          recordedAt: new Date(pos.timestamp).toISOString(),
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setError("denied");
        else if (err.code === err.TIMEOUT) setError("timeout");
        else setError("unavailable");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, manualPosition?.lat, manualPosition?.lng]);

  return { reading, error, waiting: active && !reading && !error };
}
