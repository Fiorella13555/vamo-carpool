import { useEffect, useRef, useState } from "react";
import type { LiveLocationRole } from "../../types/location";
import { upsertLiveLocation } from "./api";
import { useGeolocation } from "./useGeolocation";
import type { ManualPosition } from "./useGeolocation";
import { useWakeLock } from "./useWakeLock";

export interface LiveLocationSharingState {
  sharing: boolean;
  lastSentAt: string | null;
  permissionDenied: boolean;
  noSignal: boolean;
  sendError: boolean;
}

// Comparte la posición propia mientras `active` sea true: pide
// watchPosition (o usa manualPosition en modo prueba), hace upsert en
// live_locations cada ~5s (el throttle real vive en useGeolocation) y pide
// un Wake Lock para que la pantalla no se apague a mitad del viaje.
export function useLiveLocationSharing(
  tripId: string | null,
  userId: string | null,
  role: LiveLocationRole,
  active: boolean,
  manualPosition?: ManualPosition | null,
): LiveLocationSharingState {
  const canShare = active && !!tripId && !!userId;
  const { reading, error } = useGeolocation(canShare, manualPosition);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [sendError, setSendError] = useState(false);
  const sendingRef = useRef(false);

  useWakeLock(canShare);

  useEffect(() => {
    if (!canShare || !reading || !tripId || !userId) return;
    if (sendingRef.current) return;

    sendingRef.current = true;
    upsertLiveLocation({
      tripId,
      userId,
      role,
      lat: reading.lat,
      lng: reading.lng,
      accuracyM: reading.accuracyM,
      recordedAt: reading.recordedAt,
    })
      .then(() => {
        setLastSentAt(reading.recordedAt);
        setSendError(false);
      })
      .catch(() => setSendError(true))
      .finally(() => {
        sendingRef.current = false;
      });
  }, [canShare, reading, tripId, userId, role]);

  return {
    sharing: canShare && !!lastSentAt && !error && !sendError,
    lastSentAt,
    permissionDenied: error === "denied",
    noSignal: error === "unavailable" || error === "timeout" || error === "unsupported",
    sendError,
  };
}
