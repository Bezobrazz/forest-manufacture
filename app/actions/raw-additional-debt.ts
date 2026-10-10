"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { dateToYYYYMMDD } from "@/lib/utils";

export type RawAdditionalDebtItem = {
  id: number;
  vehicle_id: string;
  vehicle_name: string | null;
  amount: number;
  date_from: string;
  date_to: string;
  comment: string | null;
  created_at: string;
};

const revalidateDebtPaths = () => {
  revalidatePath("/trips");
  revalidatePath("/expenses");
};

function parseAmount(value: number): number {
  const amount = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Сума має бути більше нуля");
  }
  return amount;
}

function parseYmd(value: string, label: string): string {
  const match = value?.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match?.[1]) {
    throw new Error(`Некоректна ${label}`);
  }
  return match[1];
}

function normalizeComment(comment?: string | null): string | null {
  if (!comment?.trim()) return null;
  return comment.trim().slice(0, 500);
}

function mapRow(row: {
  id: number;
  vehicle_id: string;
  amount: number | string;
  date_from: string;
  date_to: string;
  comment: string | null;
  created_at: string;
  vehicle?:
    | { name: string }
    | { name: string }[]
    | null;
}): RawAdditionalDebtItem {
  const vehicleJoin = row.vehicle;
  const vehicleName = Array.isArray(vehicleJoin)
    ? (vehicleJoin[0]?.name ?? null)
    : (vehicleJoin?.name ?? null);

  return {
    id: row.id,
    vehicle_id: row.vehicle_id,
    vehicle_name: vehicleName,
    amount: Number(row.amount ?? 0),
    date_from: row.date_from,
    date_to: row.date_to,
    comment: row.comment,
    created_at: row.created_at,
  };
}

export async function getRawAdditionalDebts(
  dateFrom?: string,
  dateTo?: string
): Promise<RawAdditionalDebtItem[]> {
  try {
    const supabase = await createServerClient();
    let query = supabase
      .from("raw_additional_debts")
      .select(
        "id, vehicle_id, amount, date_from, date_to, comment, created_at, vehicle:vehicles(name)"
      )
      .order("date_from", { ascending: false })
      .order("id", { ascending: false });

    if (dateFrom) query = query.gte("date_from", dateFrom);
    if (dateTo) query = query.lte("date_from", dateTo);

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching raw additional debts:", error);
      return [];
    }

    return (data ?? []).map((row) => mapRow(row as Parameters<typeof mapRow>[0]));
  } catch (error) {
    console.error("getRawAdditionalDebts:", error);
    return [];
  }
}

type RawAdditionalDebtPayload = {
  vehicleId: string;
  amount: number;
  dateFrom: string;
  dateTo?: string;
  comment?: string;
};

function parseDebtPayload(input: RawAdditionalDebtPayload):
  | {
      ok: true;
      vehicleId: string;
      amount: number;
      dateFrom: string;
      dateTo: string;
      comment: string | null;
    }
  | { ok: false; error: string } {
  const vehicleId = input.vehicleId?.trim();
  if (!vehicleId) {
    return { ok: false, error: "Оберіть транспорт" };
  }

  let amount: number;
  try {
    amount = parseAmount(input.amount);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Некоректна сума",
    };
  }

  let dateFrom: string;
  let dateTo: string;
  try {
    dateFrom = parseYmd(input.dateFrom, "дата");
    dateTo = input.dateTo?.trim()
      ? parseYmd(input.dateTo, "дата кінця")
      : dateFrom;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Некоректна дата",
    };
  }

  if (dateTo < dateFrom) {
    return { ok: false, error: "Дата кінця не може бути раніше дати початку" };
  }

  const todayYmd = dateToYYYYMMDD(new Date());
  if (dateFrom > todayYmd) {
    return { ok: false, error: "Дата не може бути в майбутньому" };
  }

  return {
    ok: true,
    vehicleId,
    amount,
    dateFrom,
    dateTo,
    comment: normalizeComment(input.comment),
  };
}

export async function createRawAdditionalDebt(
  input: RawAdditionalDebtPayload
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  try {
    const parsed = parseDebtPayload(input);
    if (!parsed.ok) return parsed;

    const supabase = await createServerClient();
    const { data: vehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .select("id")
      .eq("id", parsed.vehicleId)
      .maybeSingle();

    if (vehicleError || !vehicle) {
      return { ok: false, error: "Транспорт не знайдено" };
    }

    const { data, error } = await supabase
      .from("raw_additional_debts")
      .insert({
        vehicle_id: parsed.vehicleId,
        amount: parsed.amount,
        date_from: parsed.dateFrom,
        date_to: parsed.dateTo,
        comment: parsed.comment,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating raw additional debt:", error);
      throw error;
    }

    revalidateDebtPaths();
    return { ok: true, id: data.id as number };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Помилка при збереженні боргу";
    return { ok: false, error: message };
  }
}

export async function updateRawAdditionalDebt(
  id: number,
  input: RawAdditionalDebtPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!id || !Number.isFinite(id)) {
      return { ok: false, error: "Некоректний ідентифікатор" };
    }

    const parsed = parseDebtPayload(input);
    if (!parsed.ok) return parsed;

    const supabase = await createServerClient();
    const { data: vehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .select("id")
      .eq("id", parsed.vehicleId)
      .maybeSingle();

    if (vehicleError || !vehicle) {
      return { ok: false, error: "Транспорт не знайдено" };
    }

    const { data, error } = await supabase
      .from("raw_additional_debts")
      .update({
        vehicle_id: parsed.vehicleId,
        amount: parsed.amount,
        date_from: parsed.dateFrom,
        date_to: parsed.dateTo,
        comment: parsed.comment,
      })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Error updating raw additional debt:", error);
      throw error;
    }
    if (!data) {
      return { ok: false, error: "Борг не знайдено" };
    }

    revalidateDebtPaths();
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Помилка при оновленні боргу";
    return { ok: false, error: message };
  }
}

export async function deleteRawAdditionalDebt(
  id: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!id || !Number.isFinite(id)) {
      return { ok: false, error: "Некоректний ідентифікатор" };
    }

    const supabase = await createServerClient();
    const { error } = await supabase
      .from("raw_additional_debts")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting raw additional debt:", error);
      throw error;
    }

    revalidateDebtPaths();
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Помилка при видаленні боргу";
    return { ok: false, error: message };
  }
}
