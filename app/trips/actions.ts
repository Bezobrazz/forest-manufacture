"use server";

import { createServerSupabaseClient, getServerUser } from "@/lib/supabase/server-auth";
import {
  calculateTripMetrics,
  type TripInput,
} from "@/lib/trips/calc";
import { tripFormSchema } from "@/lib/trips/schemas";

export type CreateTripPayload = Omit<TripInput, "user_id" | "id"> & {
  user_id?: string;
};

export type TripListItem = {
  id: string;
  name: string | null;
  trip_date: string;
  trip_start_date: string | null;
  trip_end_date: string | null;
  trip_type: string | null;
  vehicle_id: string;
  vehicle: { name: string } | null;
  distance_km: number | null;
  freight_uah: number | null;
  fuel_cost_uah: number | null;
  driver_cost_uah: number | null;
  total_costs_uah: number | null;
  profit_uah: number | null;
  profit_per_km_uah: number | null;
  roi_percent: number | null;
};

/** Повертає список рейсів із snapshot-полями (distance_km, total_costs_uah, profit_uah тощо). Звіти та підсумки використовують ці збережені значення без перерахунку на льоту. */
export async function getTrips(): Promise<TripListItem[]> {
  const supabase = await createServerSupabaseClient();
  const user = await getServerUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("trips")
    .select("id, name, trip_date, trip_start_date, trip_end_date, trip_type, vehicle_id, distance_km, freight_uah, fuel_cost_uah, driver_cost_uah, total_costs_uah, profit_uah, profit_per_km_uah, roi_percent, vehicle:vehicles(name)")
    .eq("user_id", user.id)
    .order("trip_start_date", { ascending: false });
  if (error) {
    console.error("Error fetching trips:", error);
    return [];
  }
  return (data ?? []) as TripListItem[];
}

export type TripDetail = {
  id: string;
  user_id: string;
  vehicle_id: string;
  name: string | null;
  trip_date: string;
  trip_start_date: string | null;
  trip_end_date: string | null;
  trip_type: string | null;
  start_odometer_km: number | null;
  end_odometer_km: number | null;
  fuel_consumption_l_per_100km: number | null;
  fuel_price_uah_per_l: number | null;
  depreciation_uah_per_km: number | null;
  days_count: number;
  daily_taxes_uah: number | null;
  freight_uah: number | null;
  driver_pay_mode: string;
  driver_pay_uah: number | null;
  driver_pay_uah_per_day: number | null;
  driver_pay_percent_of_freight: number | null;
  extra_costs_uah: number | null;
  bags_count: number | null;
  notes: string | null;
  distance_km: number | null;
  fuel_used_l: number | null;
  fuel_cost_uah: number | null;
  depreciation_cost_uah: number | null;
  taxes_cost_uah: number | null;
  driver_cost_uah: number | null;
  total_costs_uah: number | null;
  profit_uah: number | null;
  profit_per_km_uah: number | null;
  roi_percent: number | null;
  vehicle: { name: string } | null;
};

export async function getTrip(tripId: string): Promise<TripDetail | null> {
  const supabase = await createServerSupabaseClient();
  const user = await getServerUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("trips")
    .select("*, vehicle:vehicles(name)")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  return data as TripDetail;
}

export async function createTrip(
  payload: CreateTripPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServerSupabaseClient();
  const user = await getServerUser();

  if (!user) {
    return { ok: false, error: "Необхідно авторизуватися" };
  }

  const parsed = tripFormSchema.safeParse({
    name: payload.name ?? "",
    trip_start_date: payload.trip_start_date ?? "",
    trip_end_date: payload.trip_end_date ?? "",
    vehicle_id: payload.vehicle_id,
    trip_type: payload.trip_type ?? "raw",
    start_odometer_km: payload.start_odometer_km,
    end_odometer_km: payload.end_odometer_km,
    fuel_consumption_l_per_100km: payload.fuel_consumption_l_per_100km,
    fuel_price_uah_per_l: payload.fuel_price_uah_per_l,
    depreciation_uah_per_km: payload.depreciation_uah_per_km,
    days_count: payload.days_count,
    daily_taxes_uah: payload.daily_taxes_uah,
    freight_uah: payload.freight_uah,
    driver_pay_mode: payload.driver_pay_mode ?? "per_trip",
    driver_pay_uah: payload.driver_pay_uah,
    driver_pay_uah_per_day: payload.driver_pay_uah_per_day,
    driver_pay_percent_of_freight: payload.driver_pay_percent_of_freight,
    extra_costs_uah: payload.extra_costs_uah,
    bags_count: payload.bags_count,
    notes: payload.notes,
  });

  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg =
      first.bags_count?.[0] ??
      first.end_odometer_km?.[0] ??
      first.name?.[0] ??
      first.trip_start_date?.[0] ??
      first.trip_end_date?.[0] ??
      first.vehicle_id?.[0] ??
      first.trip_type?.[0] ??
      parsed.error.message;
    return { ok: false, error: msg };
  }

  const input: TripInput = {
    ...parsed.data,
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

  const d = parsed.data;
  const row = {
    user_id: user.id,
    vehicle_id: d.vehicle_id,
    name: d.name ?? null,
    trip_date: d.trip_start_date,
    trip_start_date: d.trip_start_date,
    trip_end_date: d.trip_end_date,
    trip_type: d.trip_type,
    start_odometer_km: d.start_odometer_km ?? null,
    end_odometer_km: d.end_odometer_km ?? null,
    fuel_consumption_l_per_100km: d.fuel_consumption_l_per_100km ?? null,
    fuel_price_uah_per_l: d.fuel_price_uah_per_l ?? null,
    depreciation_uah_per_km: d.depreciation_uah_per_km ?? null,
    days_count: d.days_count,
    daily_taxes_uah: d.daily_taxes_uah ?? 150,
    freight_uah: d.freight_uah ?? 0,
    driver_pay_mode: d.driver_pay_mode,
    driver_pay_uah: d.driver_pay_uah ?? 0,
    driver_pay_uah_per_day: d.driver_pay_uah_per_day ?? 0,
    driver_pay_percent_of_freight: d.driver_pay_percent_of_freight ?? null,
    extra_costs_uah: d.extra_costs_uah ?? 0,
    bags_count: d.bags_count ?? null,
    notes: d.notes ?? null,
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

  const parsed = tripFormSchema.safeParse({
    name: payload.name ?? "",
    trip_start_date: payload.trip_start_date ?? "",
    trip_end_date: payload.trip_end_date ?? "",
    vehicle_id: payload.vehicle_id,
    trip_type: payload.trip_type ?? "raw",
    start_odometer_km: payload.start_odometer_km,
    end_odometer_km: payload.end_odometer_km,
    fuel_consumption_l_per_100km: payload.fuel_consumption_l_per_100km,
    fuel_price_uah_per_l: payload.fuel_price_uah_per_l,
    depreciation_uah_per_km: payload.depreciation_uah_per_km,
    days_count: payload.days_count,
    daily_taxes_uah: payload.daily_taxes_uah,
    freight_uah: payload.freight_uah,
    driver_pay_mode: payload.driver_pay_mode ?? "per_trip",
    driver_pay_uah: payload.driver_pay_uah,
    driver_pay_uah_per_day: payload.driver_pay_uah_per_day,
    driver_pay_percent_of_freight: payload.driver_pay_percent_of_freight,
    extra_costs_uah: payload.extra_costs_uah,
    bags_count: payload.bags_count,
    notes: payload.notes,
  });

  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg =
      first.bags_count?.[0] ??
      first.end_odometer_km?.[0] ??
      first.name?.[0] ??
      first.trip_start_date?.[0] ??
      first.trip_end_date?.[0] ??
      first.vehicle_id?.[0] ??
      first.trip_type?.[0] ??
      parsed.error.message;
    return { ok: false, error: msg };
  }

  const d = parsed.data;
  const input: TripInput = {
    ...d,
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
    vehicle_id: d.vehicle_id,
    name: d.name ?? null,
    trip_date: d.trip_start_date,
    trip_start_date: d.trip_start_date,
    trip_end_date: d.trip_end_date,
    trip_type: d.trip_type,
    start_odometer_km: d.start_odometer_km ?? null,
    end_odometer_km: d.end_odometer_km ?? null,
    fuel_consumption_l_per_100km: d.fuel_consumption_l_per_100km ?? null,
    fuel_price_uah_per_l: d.fuel_price_uah_per_l ?? null,
    depreciation_uah_per_km: d.depreciation_uah_per_km ?? null,
    days_count: d.days_count,
    daily_taxes_uah: d.daily_taxes_uah ?? 150,
    freight_uah: d.freight_uah ?? 0,
    driver_pay_mode: d.driver_pay_mode,
    driver_pay_uah: d.driver_pay_uah ?? 0,
    driver_pay_uah_per_day: d.driver_pay_uah_per_day ?? 0,
    driver_pay_percent_of_freight: d.driver_pay_percent_of_freight ?? null,
    extra_costs_uah: d.extra_costs_uah ?? 0,
    bags_count: d.bags_count ?? null,
    notes: d.notes ?? null,
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
