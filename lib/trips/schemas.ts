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
    trip_start_date: z.string().min(1, "Вкажіть дату початку поїздки"),
    trip_end_date: z.string().min(1, "Вкажіть дату кінця поїздки"),
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
    driver_pay_mode: z.enum(["per_trip", "per_day", "percent_of_freight"]).default("per_trip"),
    driver_pay_uah: optionalNum(),
    driver_pay_uah_per_day: optionalNum(),
    driver_pay_percent_of_freight: optionalNum(),
    extra_costs_uah: optionalNum(),
    bags_count: z.preprocess((v) => {
      if (v === "" || v === undefined || v === null) return null;
      const n = Number(v);
      return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
    }, z.number().int().min(1).nullable()),
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
  )
  .refine(
    (data) => {
      if (!data.trip_start_date || !data.trip_end_date) return true;
      return data.trip_end_date >= data.trip_start_date;
    },
    { message: "Дата кінця не може бути раніше за дату початку", path: ["trip_end_date"] }
  )
  .refine(
    (data) => {
      if (data.trip_type !== "raw") return true;
      const bags = data.bags_count;
      return bags != null && bags >= 1;
    },
    { message: "Вкажіть кількість мішків для поїздки типу «Сировина»", path: ["bags_count"] }
  );

export type TripFormValues = z.infer<typeof tripFormSchema>;
