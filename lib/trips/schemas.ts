import { z } from "zod";

function optionalNum() {
  return z.preprocess((v) => {
    if (v === "" || v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }, z.number().min(0).nullable());
}

export const tripFormSchema = z
  .object({
    name: z.string().min(1, "Вкажіть назву поїздки").max(500).transform((s) => s.trim()),
    trip_date: z.string().min(1, "Вкажіть дату поїздки"),
    vehicle_id: z.string().min(1, "Оберіть транспорт"),
    trip_type: z.enum(["raw", "commerce"], {
      required_error: "Оберіть тип поїздки",
      invalid_type_error: "Оберіть тип поїздки",
    }),
    start_odometer_km: optionalNum(),
    end_odometer_km: optionalNum(),
    fuel_consumption_l_per_100km: optionalNum(),
    fuel_price_uah_per_l: optionalNum(),
    depreciation_uah_per_km: optionalNum(),
    days_count: z.preprocess((v) => {
      if (v === "" || v === undefined || v === null) return 1;
      const n = Number(v);
      return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
    }, z.number().int().min(1)),
    daily_taxes_uah: optionalNum(),
    freight_uah: optionalNum(),
    driver_pay_mode: z.enum(["per_trip", "per_day"]).default("per_trip"),
    driver_pay_uah: optionalNum(),
    driver_pay_uah_per_day: optionalNum(),
    extra_costs_uah: optionalNum(),
    notes: z
      .string()
      .max(2000)
      .optional()
      .nullable()
      .transform((s) => (s?.trim() || null) ?? null),
  })
  .refine(
    (data) => {
      const start = data.start_odometer_km ?? 0;
      const end = data.end_odometer_km ?? 0;
      return end >= start;
    },
    { message: "Кінець пробігу не може бути меншим за початок", path: ["end_odometer_km"] }
  );

export type TripFormValues = z.infer<typeof tripFormSchema>;
