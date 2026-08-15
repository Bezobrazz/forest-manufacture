export type SupplierDeliveryPayableInput = {
  quantity: number;
  pricePerUnit: number | null | undefined;
  actualPaid: number | null | undefined;
};

/**
 * Сума до сплати / для CRM: actual_paid, якщо задано; інакше quantity * price_per_unit.
 */
export const resolveSupplierDeliveryPayableAmount = (
  input: SupplierDeliveryPayableInput,
): number => {
  const paid = input.actualPaid;
  if (paid != null && Number.isFinite(paid) && paid >= 0) {
    return Math.round(paid * 100) / 100;
  }

  const price = input.pricePerUnit;
  if (price != null && Number.isFinite(price)) {
    return Math.round(Number(input.quantity) * price * 100) / 100;
  }

  return 0;
};

export const parseOptionalAmount = (raw: FormDataEntryValue | null): number | null => {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
};
