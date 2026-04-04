export type ParseProductionFormResult =
  | { ok: true; shiftId: number; productId: number; quantity: number }
  | { ok: false; error: string };

export function parseProductionFormData(
  formData: FormData
): ParseProductionFormResult {
  const shiftId = Number.parseInt(formData.get("shift_id") as string, 10);
  const productId = Number.parseInt(formData.get("product_id") as string, 10);
  const quantity = Number.parseFloat(formData.get("quantity") as string);

  if (!shiftId || !productId || Number.isNaN(quantity)) {
    return {
      ok: false,
      error: "Необхідно вказати зміну, продукт та кількість",
    };
  }

  return { ok: true, shiftId, productId, quantity };
}
