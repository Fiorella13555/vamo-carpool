export type Role = "driver" | "passenger";
export type PickupRequestStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type TripStatus = "scheduled" | "ongoing" | "finished" | "cancelled";

export interface LocationVisibilityInput {
  tripStatus: TripStatus;
  driverId: string;
  viewerId: string;
  targetId: string;
  targetRole: Role;
  /** Requerido cuando targetRole === "passenger": el estado de la solicitud de ESE pasajero. */
  targetPassengerRequestStatus?: PickupRequestStatus;
  /** Requerido cuando el viewer es un pasajero (viewerId !== driverId): el estado de SU propia solicitud. */
  viewerPassengerRequestStatus?: PickupRequestStatus;
}

// Espejo en TypeScript de las policies de RLS en
// supabase/migrations/20261022170000_live_locations.sql. Esta función NO es
// el control de acceso real (eso lo hace Postgres, por diseño: ver
// "Decisiones importantes" en CLAUDE.md) — existe para poder testear la
// regla de negocio con Vitest sin una base de datos, igual que
// src/lib/geo.ts espeja point_in_lima(). Si cambias una policy, cambia esto
// también (y viceversa).
//
// Regla: nadie ve nada fuera de un viaje 'ongoing'. Dentro de uno, cada
// usuario siempre ve su propia posición; el conductor ve a cada pasajero con
// solicitud 'accepted' de su viaje; un pasajero con solicitud 'accepted' ve
// solo al conductor de su viaje. Un pasajero nunca ve a otro pasajero, y eso
// sale solo de que ninguna rama cubre ese caso (devuelve false).
export function canViewLocation(input: LocationVisibilityInput): boolean {
  if (input.tripStatus !== "ongoing") return false;
  if (input.viewerId === input.targetId) return true;

  const viewerIsDriver = input.viewerId === input.driverId;

  if (viewerIsDriver) {
    return (
      input.targetRole === "passenger" && input.targetPassengerRequestStatus === "accepted"
    );
  }

  return (
    input.targetRole === "driver" &&
    input.targetId === input.driverId &&
    input.viewerPassengerRequestStatus === "accepted"
  );
}
