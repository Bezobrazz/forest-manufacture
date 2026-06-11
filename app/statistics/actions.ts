"use server";

import { getLatestPackingBagPriceUah } from "@/app/packing-bags/actions";
import { getTrips } from "@/app/trips/actions";
import { createServerClient } from "@/lib/supabase/server";
import type {
  Employee,
  Product,
  ProductCategory,
  ShiftWithDetails,
} from "@/lib/types";

export type StatisticsPageData = {
  shifts: ShiftWithDetails[];
  products: Product[];
  categories: ProductCategory[];
  expenses: Array<{
    amount: number;
    date: string;
    category?: { name?: string | null } | null;
  }>;
  supplierDeliveries: Array<{
    quantity: number;
    price_per_unit: number | null;
    created_at: string;
  }>;
  trips: Awaited<ReturnType<typeof getTrips>>;
  employees: Employee[];
  latestPackingBagPriceUah: number;
};

export async function getStatisticsPageData(): Promise<StatisticsPageData> {
  const empty: StatisticsPageData = {
    shifts: [],
    products: [],
    categories: [],
    expenses: [],
    supplierDeliveries: [],
    trips: [],
    employees: [],
    latestPackingBagPriceUah: 0,
  };

  try {
    const supabase = await createServerClient();

    const [
      shiftsResult,
      productsResult,
      categoriesResult,
      expensesResult,
      deliveriesResult,
      employeesResult,
      latestPackingBagPriceUah,
      trips,
    ] = await Promise.all([
      supabase
        .from("shifts")
        .select(
          `
          id,
          shift_date,
          status,
          production:production(quantity, product_id)
        `
        )
        .eq("status", "completed")
        .order("shift_date", { ascending: false }),
      supabase
        .from("products")
        .select("id, name, reward, category:product_categories(id, name)")
        .or("product_type.eq.finished,product_type.is.null")
        .order("name"),
      supabase.from("product_categories").select("id, name").order("name"),
      supabase
        .from("expenses")
        .select("amount, date, category:expense_categories(name)")
        .order("date", { ascending: false }),
      supabase
        .from("supplier_deliveries")
        .select("quantity, price_per_unit, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("employees").select("is_manager, salary"),
      getLatestPackingBagPriceUah(),
      getTrips(),
    ]);

    if (shiftsResult.error) {
      console.error("getStatisticsPageData shifts:", shiftsResult.error);
    }
    if (productsResult.error) {
      console.error("getStatisticsPageData products:", productsResult.error);
    }
    if (categoriesResult.error) {
      console.error("getStatisticsPageData categories:", categoriesResult.error);
    }
    if (expensesResult.error) {
      console.error("getStatisticsPageData expenses:", expensesResult.error);
    }
    if (deliveriesResult.error) {
      console.error(
        "getStatisticsPageData supplier deliveries:",
        deliveriesResult.error
      );
    }
    if (employeesResult.error) {
      console.error("getStatisticsPageData employees:", employeesResult.error);
    }

    return {
      shifts: (shiftsResult.data ?? []) as ShiftWithDetails[],
      products: (productsResult.data ?? []) as Product[],
      categories: (categoriesResult.data ?? []) as ProductCategory[],
      expenses: (expensesResult.data ?? []) as StatisticsPageData["expenses"],
      supplierDeliveries: (deliveriesResult.data ??
        []) as StatisticsPageData["supplierDeliveries"],
      trips: trips ?? [],
      employees: (employeesResult.data ?? []) as Employee[],
      latestPackingBagPriceUah,
    };
  } catch (error) {
    console.error("Error in getStatisticsPageData:", error);
    return empty;
  }
}
