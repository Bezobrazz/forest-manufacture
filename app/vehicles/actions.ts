"use server";

import { createServerSupabaseClient, getServerUser } from "@/lib/supabase/server-auth";
import type { VehicleType } from "@/lib/trips/calc";
import { vehicleFormSchema } from "@/lib/vehicles/schemas";

export type Vehicle = {
  id: string;
  user_id: string;
  name: string;
  type: VehicleType;
  default_fuel_consumption_l_per_100km: number | null;
  default_depreciation_uah_per_km: number | null;
  default_daily_taxes_uah: number | null;
  created_at: string;
};

export async function getVehicles(): Promise<Vehicle[]> {
  const supabase = await createServerSupabaseClient();
  const user = await getServerUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("vehicles")
    .select("id, user_id, name, type, default_fuel_consumption_l_per_100km, default_depreciation_uah_per_km, default_daily_taxes_uah, created_at")
    .eq("user_id", user.id)
    .order("name");

  if (error) {
    console.error("Error fetching vehicles:", error);
    return [];
  }

  return (data ?? []) as Vehicle[];
}

export type CreateVehiclePayload = {
  name: string;
  type: VehicleType;
  default_fuel_consumption_l_per_100km?: number | null;
  default_depreciation_uah_per_km?: number | null;
  default_daily_taxes_uah?: number | null;
};

export async function createVehicle(
  payload: CreateVehiclePayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServerSupabaseClient();
  const user = await getServerUser();

  if (!user) {
    return { ok: false, error: "Необхідно авторизуватися" };
  }

  const parsed = vehicleFormSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg =
      first.name?.[0] ?? first.type?.[0] ?? parsed.error.message;
    return { ok: false, error: msg };
  }

  const d = parsed.data;
  const { error } = await supabase.from("vehicles").insert({
    user_id: user.id,
    name: d.name,
    type: d.type,
    default_fuel_consumption_l_per_100km:
      d.default_fuel_consumption_l_per_100km ?? null,
    default_depreciation_uah_per_km:
      d.default_depreciation_uah_per_km ?? null,
    default_daily_taxes_uah: d.default_daily_taxes_uah ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
