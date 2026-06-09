"use client";

import { useState } from "react";
import { createEmployee } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type EmployeeFormProps = {
  isManager?: boolean;
};

export function EmployeeForm({ isManager = false }: EmployeeFormProps) {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();
  const formId = isManager ? "manager-form" : "employee-form";
  const entityLabel = isManager ? "керівника" : "працівника";

  async function handleSubmit(formData: FormData) {
    setIsPending(true);

    try {
      const result = await createEmployee(formData);

      if (result.success) {
        toast.success(`${isManager ? "Керівника" : "Працівника"} додано`, {
          description: `Нового ${entityLabel} успішно додано до системи`,
        });

        const form = document.getElementById(formId) as HTMLFormElement;
        form.reset();

        router.refresh();
      } else {
        toast.error("Помилка", {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error("Помилка", {
        description: `Сталася помилка при додаванні ${entityLabel}`,
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form id={formId} action={handleSubmit} className="space-y-4">
      <input type="hidden" name="is_manager" value={String(isManager)} />
      <div className="space-y-2">
        <Label htmlFor={`${formId}-name`}>
          {isManager ? "Ім'я керівника" : "Ім'я працівника"}
        </Label>
        <Input id={`${formId}-name`} name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${formId}-position`}>Посада</Label>
        <Input id={`${formId}-position`} name="position" />
      </div>
      {isManager && (
        <div className="space-y-2">
          <Label htmlFor={`${formId}-salary`}>Оклад</Label>
          <Input
            id={`${formId}-salary`}
            name="salary"
            type="number"
            min="0"
            step="0.01"
            required
          />
        </div>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending
          ? "Додавання..."
          : isManager
            ? "Додати керівника"
            : "Додати працівника"}
      </Button>
    </form>
  );
}
