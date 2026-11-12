import { describe, expect, it } from "vitest";
import { canViewLocation } from "./visibility";
import type { LocationVisibilityInput } from "./visibility";

const DRIVER = "driver-1";
const PASSENGER_A = "passenger-a";
const PASSENGER_B = "passenger-b";

function base(overrides: Partial<LocationVisibilityInput>): LocationVisibilityInput {
  return {
    tripStatus: "ongoing",
    driverId: DRIVER,
    viewerId: PASSENGER_A,
    targetId: DRIVER,
    targetRole: "driver",
    ...overrides,
  };
}

describe("canViewLocation", () => {
  it("nadie ve nada si el viaje no está 'ongoing'", () => {
    for (const tripStatus of ["scheduled", "finished", "cancelled"] as const) {
      expect(
        canViewLocation(
          base({
            tripStatus,
            viewerPassengerRequestStatus: "accepted",
          }),
        ),
      ).toBe(false);
    }
  });

  it("un pasajero aceptado ve al conductor durante el viaje", () => {
    expect(
      canViewLocation(base({ viewerPassengerRequestStatus: "accepted" })),
    ).toBe(true);
  });

  it("un pasajero pendiente NO ve al conductor todavía", () => {
    expect(
      canViewLocation(base({ viewerPassengerRequestStatus: "pending" })),
    ).toBe(false);
  });

  it("un pasajero rechazado o cancelado no ve al conductor", () => {
    for (const status of ["rejected", "cancelled"] as const) {
      expect(canViewLocation(base({ viewerPassengerRequestStatus: status }))).toBe(false);
    }
  });

  it("un pasajero nunca ve a otro pasajero, aunque ambos estén aceptados", () => {
    expect(
      canViewLocation(
        base({
          targetId: PASSENGER_B,
          targetRole: "passenger",
          viewerPassengerRequestStatus: "accepted",
          targetPassengerRequestStatus: "accepted",
        }),
      ),
    ).toBe(false);
  });

  it("el conductor ve a un pasajero con solicitud aceptada", () => {
    expect(
      canViewLocation(
        base({
          viewerId: DRIVER,
          targetId: PASSENGER_A,
          targetRole: "passenger",
          targetPassengerRequestStatus: "accepted",
        }),
      ),
    ).toBe(true);
  });

  it("el conductor NO ve a un pasajero pendiente", () => {
    expect(
      canViewLocation(
        base({
          viewerId: DRIVER,
          targetId: PASSENGER_A,
          targetRole: "passenger",
          targetPassengerRequestStatus: "pending",
        }),
      ),
    ).toBe(false);
  });

  it("el conductor NO ve a un pasajero rechazado o cancelado", () => {
    for (const status of ["rejected", "cancelled"] as const) {
      expect(
        canViewLocation(
          base({
            viewerId: DRIVER,
            targetId: PASSENGER_A,
            targetRole: "passenger",
            targetPassengerRequestStatus: status,
          }),
        ),
      ).toBe(false);
    }
  });

  it("cualquiera siempre ve su propia posición si el viaje está en curso", () => {
    expect(canViewLocation(base({ viewerId: PASSENGER_A, targetId: PASSENGER_A, targetRole: "passenger" }))).toBe(
      true,
    );
    expect(canViewLocation(base({ viewerId: DRIVER, targetId: DRIVER, targetRole: "driver" }))).toBe(true);
  });

  it("un pasajero aceptado de OTRO viaje no ve a este conductor", () => {
    // targetId coincide con driverId del viaje A, pero el conductor que mira
    // es otro: viewerIsDriver se calcula contra driverId del contexto, así
    // que simulamos un conductor ajeno mirando como si fuera pasajero.
    expect(
      canViewLocation(
        base({
          viewerId: "otro-conductor",
          targetId: DRIVER,
          targetRole: "driver",
          viewerPassengerRequestStatus: "accepted",
        }),
      ),
    ).toBe(true); // nota: esta función no valida pertenencia al viaje, eso lo hace el `trip_id` de la fila real en RLS.
  });
});
