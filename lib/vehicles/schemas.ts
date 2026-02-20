import { z } from "zod";

function optionalNum() {
  return z.preprocess((v) => {
    if (v === "" || v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }, z.number().min(0).nullable());
}

export const vehicleFormSchema = z.object({
  name: z.string().min(1, "Введіть назву транспорту").max(200).transform((s) => s.trim()),
  type: z.enum(["van", "truck"]),
  default_fuel_consumption_l_per_100km: optionalNum(),
  default_depreciation_uah_per_km: optionalNum(),
  default_daily_taxes_uah: optionalNum(),
});

export type VehicleFormValues = z.infer<typeof vehicleFormSchema>;
