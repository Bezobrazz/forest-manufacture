export const RAW_DELIVERY_DEBT_TITLE = "Доставка сировини";

export const RAW_REPAYMENT_CATEGORY_NAME = "Погашення доставки (сировина)";

export type RawDeliveryDebtSummary = {
  totalCostsUah: number;
  repaidAmountUah: number;
  remainingAmountUah: number;
  tripsCount: number;
  bagsCount: number;
  isClosed: boolean;
};

export function buildRawDeliveryDebtSummary(input: {
  totalCostsUah: number;
  repaidAmountUah: number;
  tripsCount: number;
  bagsCount: number;
}): RawDeliveryDebtSummary {
  const totalCostsUah = Math.round(input.totalCostsUah * 100) / 100;
  const repaidAmountUah = Math.round(input.repaidAmountUah * 100) / 100;
  const remainingAmountUah = Math.max(
    0,
    Math.round((totalCostsUah - repaidAmountUah) * 100) / 100
  );

  return {
    totalCostsUah,
    repaidAmountUah,
    remainingAmountUah,
    tripsCount: input.tripsCount,
    bagsCount: input.bagsCount,
    isClosed: remainingAmountUah <= 0 || totalCostsUah <= 0,
  };
}
