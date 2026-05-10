import { addDays, startOfDay } from "date-fns";
import { dateToYYYYMMDD } from "@/lib/utils";
import type { CrmOrderWithDetails, ShipmentForecast } from "@/lib/types";

export type AvgDailyByProduct = Record<number, number>;

export function calculateForecast(args: {
  queue: CrmOrderWithDetails[];
  inventory: Record<number, number>;
  avgDailyProduction: AvgDailyByProduct;
  today: Date;
}): ShipmentForecast[] {
  const { queue, inventory, avgDailyProduction, today } = args;
  const available: Record<number, number> = { ...inventory };
  const day0 = startOfDay(today);
  const result: ShipmentForecast[] = [];

  for (const order of queue) {
    const missing: { productId: number; needed: number }[] = [];
    let blockNull = false;
    let maxDayOffset = 0;

    for (const item of order.items) {
      const qty = Number(item.quantity);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      const pid = item.product_id;
      if (pid == null) {
        blockNull = true;
        missing.push({ productId: 0, needed: qty });
        continue;
      }

      const avg = avgDailyProduction[pid] ?? 0;
      const avail = available[pid] ?? 0;
      const need = qty - avail;

      if (need <= 0) {
        available[pid] = avail - qty;
        continue;
      }

      if (avg <= 0) {
        blockNull = true;
        missing.push({ productId: pid, needed: need });
        available[pid] = avail - qty;
        continue;
      }

      const daysNeeded = Math.ceil(need / avg);
      if (daysNeeded > maxDayOffset) maxDayOffset = daysNeeded;
      available[pid] = avail - qty;
    }

    const etaDate = blockNull
      ? null
      : dateToYYYYMMDD(addDays(day0, maxDayOffset));

    result.push({
      order,
      etaDate,
      isReady: !blockNull && maxDayOffset === 0,
      missing,
    });
  }

  return result;
}
