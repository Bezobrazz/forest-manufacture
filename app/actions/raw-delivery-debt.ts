"use server";

import { getRawRepayments, type RawRepaymentItem } from "@/app/actions";
import {
  getRawAdditionalDebts,
  type RawAdditionalDebtItem,
} from "@/app/actions/raw-additional-debt";
import { getTrips } from "@/app/trips/actions";
import {
  buildRawDeliveryDebtSummary,
  type RawDeliveryDebtSummary,
} from "@/lib/debts/raw-delivery-debt";

export type RawDeliveryDebtData = RawDeliveryDebtSummary & {
  repayments: RawRepaymentItem[];
  additionalDebts: RawAdditionalDebtItem[];
  additionalDebtsAmountUah: number;
  tripCostsUah: number;
};

export async function getRawDeliveryDebt(): Promise<RawDeliveryDebtData> {
  const [trips, repayments, additionalDebts] = await Promise.all([
    getTrips(),
    getRawRepayments(),
    getRawAdditionalDebts(),
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
  };
}
