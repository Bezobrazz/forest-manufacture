"use client";

import { useState } from "react";
import { createSupplier } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function SupplierForm() {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setIsPending(true);

    try {
      const result = await createSupplier(formData);

      if (result.success) {
        toast.success("Постачальника додано", {
          description: "Нового постачальника успішно додано до системи",
        });

        // Очищаємо форму
        const form = document.getElementById(
          "supplier-form"
        ) as HTMLFormElement;
        form.reset();

        // Оновлюємо сторінку
        router.refresh();
      } else {
        toast.error("Помилка", {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error("Помилка", {
        description: "Сталася помилка при додаванні постачальника",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form id="supplier-form" action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Назва постачальника *</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Телефон</Label>
        <Input id="phone" name="phone" type="tel" placeholder="+380XXXXXXXXX" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Примітки</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Додаткова інформація про постачальника"
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Додавання..." : "Додати постачальника"}
      </Button>
    </form>
  );
}

