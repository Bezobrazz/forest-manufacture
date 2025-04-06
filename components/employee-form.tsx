"use client";

import { useState } from "react";
import { createEmployee } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function EmployeeForm() {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setIsPending(true);

    try {
      const result = await createEmployee(formData);

      if (result.success) {
        toast.success("Працівника додано", {
          description: "Нового працівника успішно додано до системи",
        });

        // Очищаємо форму
        const form = document.getElementById(
          "employee-form"
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
        description: "Сталася помилка при додаванні працівника",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form id="employee-form" action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Ім'я працівника</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="position">Посада</Label>
        <Input id="position" name="position" />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Додавання..." : "Додати працівника"}
      </Button>
    </form>
  );
}
