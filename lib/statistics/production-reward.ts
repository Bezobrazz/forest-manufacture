export type ProductionRewardLine = {
  quantity?: number | null;
  product_id?: number | null;
  reward_override?: number | null;
  product?: { reward?: number | null } | null;
};

export type ShiftForProductionReward = {
  status?: string | null;
  shift_date?: string | null;
  production?: ProductionRewardLine[] | null;
};

export const rewardPerUnitForProductionLine = (
  item: ProductionRewardLine,
  productRewardById?: Map<number, number>
): number => {
  if (item.reward_override != null && Number.isFinite(Number(item.reward_override))) {
    return Number(item.reward_override);
  }
  if (item.product?.reward != null && Number.isFinite(Number(item.product.reward))) {
    return Number(item.product.reward);
  }
  if (productRewardById && item.product_id != null) {
    return productRewardById.get(Number(item.product_id)) ?? 0;
  }
  return 0;
};

export const sumProductionRewardMetrics = (
  shifts: ShiftForProductionReward[],
  startDay: string,
  endDay: string,
  options?: {
    toDayKey?: (value?: string | null) => string;
    isDayInRange?: (day: string, start: string, end: string) => boolean;
    productRewardById?: Map<number, number>;
  }
): { totalRewardUah: number; totalBags: number; averagePerBag: number } => {
  const toDayKey =
    options?.toDayKey ??
    ((value?: string | null) => (value ? String(value).slice(0, 10) : ""));
  const isDayInRange =
    options?.isDayInRange ??
    ((day: string, start: string, end: string) =>
      Boolean(day) && day >= start && day <= end);

  let totalRewardUah = 0;
  let totalBags = 0;

  for (const shift of shifts) {
    if (shift.status !== "completed") continue;
    const day = toDayKey(shift.shift_date);
    if (!isDayInRange(day, startDay, endDay)) continue;

    for (const item of shift.production ?? []) {
      const quantity = Number(item.quantity ?? 0);
      if (!Number.isFinite(quantity) || quantity <= 0) continue;
      const rewardPerUnit = rewardPerUnitForProductionLine(
        item,
        options?.productRewardById
      );
      totalBags += quantity;
      totalRewardUah += quantity * rewardPerUnit;
    }
  }

  return {
    totalRewardUah,
    totalBags,
    averagePerBag: totalBags > 0 ? totalRewardUah / totalBags : 0,
  };
};
