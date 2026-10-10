"use server";

import { getRawRepayments, type RawRepaymentItem } from "@/app/actions";
import {
  getRawAdditionalDebts,
  type RawAdditionalDebtItem,
} from "@/app/actions/raw-additional-debt";
import { getTrips } from "@/app/trips/actions";
import { getVehicles } from "@/app/vehicles/actions";
import {
  buildRawDeliveryDebtByVehicle,
  buildRawDeliveryDebtSummary,
  type RawDeliveryDebtByVehicle,
  type RawDeliveryDebtSummary,
} from "@/lib/debts/raw-delivery-debt";

export type RawDeliveryDebtData = RawDeliveryDebtSummary & {
  repayments: RawRepaymentItem[];
  additionalDebts: RawAdditionalDebtItem[];
  additionalDebtsAmountUah: number;
  tripCostsUah: number;
  byVehicle: RawDeliveryDebtByVehicle;
};

export async function getRawDeliveryDebt(): Promise<RawDeliveryDebtData> {
  const [trips, repayments, additionalDebts, vehicles] = await Promise.all([
    getTrips(),
    getRawRepayments(),
    getRawAdditionalDebts(),
    getVehicles(),
  ]);

  const rawTrips = trips.filter((trip) => trip.trip_type === "raw");
  let tripCostsUah = 0;
  let bagsCount = 0;

  for (const trip of rawTrips) {
    tripCostsUah += trip.total_costs_uah ?? 0;
    bagsCount += trip.bags_count ?? 0;
  }

  const additionalDebtsAmountUah = additionalDebts.reduce(
    (sum, row) => sum + row.amount,
    0
  );
  const totalCostsUah = tripCostsUah + additionalDebtsAmountUah;
  const repaidAmountUah = repayments.reduce((sum, row) => sum + row.amount, 0);

  const vehicleNames: Record<string, string> = {};
  for (const vehicle of vehicles) {
    vehicleNames[vehicle.id] = vehicle.name;
  }

  const byVehicle = buildRawDeliveryDebtByVehicle({
    trips: rawTrips.map((trip) => ({
      vehicle_id: trip.vehicle_id,
      vehicle_name: trip.vehicle?.name ?? vehicleNames[trip.vehicle_id] ?? null,
      total_costs_uah: trip.total_costs_uah,
    })),
    repayments: repayments.map((row) => ({
      vehicle_id: row.vehicle_id,
      amount: row.amount,
    })),
    additionalDebts: additionalDebts.map((row) => ({
      vehicle_id: row.vehicle_id,
      vehicle_name: row.vehicle_name,
      amount: row.amount,
    })),
    vehicleNames,
  });

  return {
    ...buildRawDeliveryDebtSummary({
      totalCostsUah,
      repaidAmountUah,
      tripsCount: rawTrips.length,
      bagsCount,
    }),
    repayments,
    additionalDebts,
    additionalDebtsAmountUah,
    tripCostsUah,
    byVehicle,
  };
}
