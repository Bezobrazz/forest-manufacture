"use server";

import { createServerSupabaseClient, getServerUser } from "@/lib/supabase/server-auth";
import {
  calculateTripMetrics,
  type TripInput,
} from "@/lib/trips/calc";

export type CreateTripPayload = Omit<TripInput, "user_id" | "id"> & {
  user_id?: string;
};

export async function getTrips(): Promise<
  Array<{
    id: string;
    name: string | null;
    trip_date: string;
    vehicle_id: string;
    distance_km: number | null;
    profit_uah: number | null;
    roi_percent: number | null;
  }>
> {
  const supabase = await createServerSupabaseClient();
  const user = await getServerUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("trips")
    .select("id, name, trip_date, vehicle_id, distance_km, profit_uah, roi_percent")
    .eq("user_id", user.id)
    .order("trip_date", { ascending: false });
  if (error) {
    console.error("Error fetching trips:", error);
    return [];
  }
  return (data ?? []) as Array<{
    id: string;
    name: string | null;
    trip_date: string;
    vehicle_id: string;
    distance_km: number | null;
    profit_uah: number | null;
    roi_percent: number | null;
  }>;
}

export async function createTrip(
  payload: CreateTripPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServerSupabaseClient();
  const user = await getServerUser();

  if (!user) {
    return { ok: false, error: "Необхідно авторизуватися" };
  }

  const input: TripInput = {
    ...payload,
    user_id: user.id,
  };

  let metrics;
  try {
    metrics = calculateTripMetrics(input);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Помилка валідації поїздки",
    };
  }

  const row = {
    user_id: user.id,
    vehicle_id: payload.vehicle_id,
    name: payload.name?.trim() ?? null,
    trip_date: payload.trip_date,
    start_odometer_km: payload.start_odometer_km ?? null,
    end_odometer_km: payload.end_odometer_km ?? null,
    fuel_consumption_l_per_100km: payload.fuel_consumption_l_per_100km ?? null,
    fuel_price_uah_per_l: payload.fuel_price_uah_per_l ?? null,
    depreciation_uah_per_km: payload.depreciation_uah_per_km ?? null,
    days_count: (payload.days_count ?? 0) < 1 ? 1 : (payload.days_count ?? 1),
    daily_taxes_uah: payload.daily_taxes_uah ?? 150,
    freight_uah: payload.freight_uah ?? 0,
    driver_pay_mode: payload.driver_pay_mode ?? "per_trip",
    driver_pay_uah: payload.driver_pay_uah ?? 0,
    driver_pay_uah_per_day: payload.driver_pay_uah_per_day ?? 0,
    extra_costs_uah: payload.extra_costs_uah ?? 0,
    notes: payload.notes ?? null,
    distance_km: metrics.distance_km,
    fuel_used_l: metrics.fuel_used_l,
    fuel_cost_uah: metrics.fuel_cost_uah,
    depreciation_cost_uah: metrics.depreciation_cost_uah,
    taxes_cost_uah: metrics.taxes_cost_uah,
    driver_cost_uah: metrics.driver_cost_uah,
    total_costs_uah: metrics.total_costs_uah,
    profit_uah: metrics.profit_uah,
    profit_per_km_uah: metrics.profit_per_km_uah,
    roi_percent: metrics.roi_percent,
  };

  const { error } = await supabase.from("trips").insert(row);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function updateTrip(
  tripId: string,
  payload: CreateTripPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServerSupabaseClient();
  const user = await getServerUser();

  if (!user) {
    return { ok: false, error: "Необхідно авторизуватися" };
  }

  const input: TripInput = {
    ...payload,
    user_id: user.id,
  };

  let metrics;
  try {
    metrics = calculateTripMetrics(input);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Помилка валідації поїздки",
    };
  }

  const row = {
    vehicle_id: payload.vehicle_id,
    name: payload.name?.trim() ?? null,
    trip_date: payload.trip_date,
    start_odometer_km: payload.start_odometer_km ?? null,
    end_odometer_km: payload.end_odometer_km ?? null,
    fuel_consumption_l_per_100km: payload.fuel_consumption_l_per_100km ?? null,
    fuel_price_uah_per_l: payload.fuel_price_uah_per_l ?? null,
    depreciation_uah_per_km: payload.depreciation_uah_per_km ?? null,
    days_count: (payload.days_count ?? 0) < 1 ? 1 : (payload.days_count ?? 1),
    daily_taxes_uah: payload.daily_taxes_uah ?? 150,
    freight_uah: payload.freight_uah ?? 0,
    driver_pay_mode: payload.driver_pay_mode ?? "per_trip",
    driver_pay_uah: payload.driver_pay_uah ?? 0,
    driver_pay_uah_per_day: payload.driver_pay_uah_per_day ?? 0,
    extra_costs_uah: payload.extra_costs_uah ?? 0,
    notes: payload.notes ?? null,
    distance_km: metrics.distance_km,
    fuel_used_l: metrics.fuel_used_l,
    fuel_cost_uah: metrics.fuel_cost_uah,
    depreciation_cost_uah: metrics.depreciation_cost_uah,
    taxes_cost_uah: metrics.taxes_cost_uah,
    driver_cost_uah: metrics.driver_cost_uah,
    total_costs_uah: metrics.total_costs_uah,
    profit_uah: metrics.profit_uah,
    profit_per_km_uah: metrics.profit_per_km_uah,
    roi_percent: metrics.roi_percent,
  };

  const { error } = await supabase
    .from("trips")
    .update(row)
    .eq("id", tripId)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function deleteTrip(
  tripId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServerSupabaseClient();
  const user = await getServerUser();

  if (!user) {
    return { ok: false, error: "Необхідно авторизуватися" };
  }

  const { error } = await supabase.from("trips").delete().eq("id", tripId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
