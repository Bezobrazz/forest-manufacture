"use client";

import { useState } from "react";
import { updateEmployee } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type Employee = {
  id: number;
  name: string;
  position: string | null;
};

type EmployeeEditFormProps = {
  employee: Employee;
  isOpen: boolean;
  onClose: () => void;
};

export function EmployeeEditForm({
  employee,
  isOpen,
  onClose,
}: EmployeeEditFormProps) {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setIsPending(true);

    try {
      const result = await updateEmployee(formData);

      if (result.success) {
        toast.success("Працівника оновлено", {
          description: "Дані працівника успішно оновлено",
        });

        // Закриваємо модальне вікно
        onClose();

        // Оновлюємо сторінку
        router.refresh();
      } else {
        toast.error("Помилка", {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error("Помилка", {
        description: "Сталася помилка при оновленні працівника",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Редагувати працівника</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="id" value={employee.id} />
          <div className="space-y-2">
            <Label htmlFor="name">Ім'я працівника</Label>
            <Input
              id="name"
              name="name"
              defaultValue={employee.name}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="position">Посада</Label>
            <Input
              id="position"
              name="position"
              defaultValue={employee.position || ""}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Скасувати
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Оновлення..." : "Оновити"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
