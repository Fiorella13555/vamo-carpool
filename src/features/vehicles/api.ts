import { supabase } from "../../lib/supabase";
import type { Vehicle } from "../../types/vehicle";

export async function fetchMyVehicle(driverId: string): Promise<Vehicle | null> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("id, driver_id, placa, modelo, color, asientos, created_at, updated_at")
    .eq("driver_id", driverId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export interface UpsertVehicleInput {
  driverId: string;
  placa: string;
  modelo: string;
  color: string;
  asientos: number;
}

export async function upsertVehicle(input: UpsertVehicleInput) {
  const { error } = await supabase
    .from("vehicles")
    .upsert(
      {
        driver_id: input.driverId,
        placa: input.placa.toUpperCase(),
        modelo: input.modelo,
        color: input.color,
        asientos: input.asientos,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "driver_id" },
    );
  if (error) throw error;
}
