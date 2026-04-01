import { z } from "zod";

export const packingBagPurchaseSchema = z.object({
  purchase_date: z.string().min(1, "Вкажіть дату покупки"),
  quantity: z.preprocess((value) => Number(value), z.number().positive("Кількість має бути більшою за 0")),
  price_uah: z.preprocess((value) => Number(value), z.number().min(0, "Ціна не може бути від'ємною")),
});

export type PackingBagPurchaseInput = z.infer<typeof packingBagPurchaseSchema>;
