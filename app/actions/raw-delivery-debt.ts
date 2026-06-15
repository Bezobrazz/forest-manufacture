"use server";

import { getRawRepayments, type RawRepaymentItem } from "@/app/actions";
import { getTrips } from "@/app/trips/actions";
import {
  buildRawDeliveryDebtSummary,
  type RawDeliveryDebtSummary,
} from "@/lib/debts/raw-delivery-debt";

export type RawDeliveryDebtData = RawDeliveryDebtSummary & {
  repayments: RawRepaymentItem[];
};

export async function getRawDeliveryDebt(): Promise<RawDeliveryDebtData> {
  const [trips, repayments] = await Promise.all([
    getTrips(),
    getRawRepayments(),
  ]);

  const rawTrips = trips.filter((trip) => trip.trip_type === "raw");
  let totalCostsUah = 0;
  let bagsCount = 0;

  for (const trip of rawTrips) {
    totalCostsUah += trip.total_costs_uah ?? 0;
    bagsCount += trip.bags_count ?? 0;
  }

  const repaidAmountUah = repayments.reduce((sum, row) => sum + row.amount, 0);

  return {
    ...buildRawDeliveryDebtSummary({
      totalCostsUah,
      repaidAmountUah,
      tripsCount: rawTrips.length,
      bagsCount,
    }),
    repayments,
  };
}
