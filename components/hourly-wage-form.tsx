"use client";

import { useState } from "react";
import { createHourlyWageExpense } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Clock } from "lucide-react";

const DEFAULT_RATE = 75;
const DEFAULT_DESCRIPTION = (shiftId: number) => `Зміна #${shiftId}, погодинна`;
const DEFAULT_MANUAL_COMMENT = "Вантажні роботи";

const buildShiftExpenseDescription = (shiftId: number, comment: string) =>
  `Зміна #${shiftId}, ${comment}`;

interface HourlyWageFormProps {
  shiftId: number;
  /** Дата відкриття зміни (ISO або YYYY-MM-DD) — використовується як дата витрати */
  shiftOpenedAt: string;
  /** Кількість працівників на зміні — сума множиться на неї */
  employeeCount: number;
}

export function HourlyWageForm({ shiftId, shiftOpenedAt, employeeCount }: HourlyWageFormProps) {
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState(String(DEFAULT_RATE));
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualAmount, setManualAmount] = useState("");
  const [manualComment, setManualComment] = useState("");
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);

  const expenseDate = new Date(shiftOpenedAt).toISOString().slice(0, 10);

  const hoursNum = Number.parseFloat(hours) || 0;
  const rateNum = Number.parseFloat(rate) || 0;
  const amount = hoursNum * rateNum * employeeCount;
  const manualAmountNum = Number.parseFloat(manualAmount);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (amount <= 0) {
      toast.error(
        employeeCount === 0
          ? "Додайте працівників на зміну"
          : "Вкажіть кількість годин та ставку"
      );
      return;
    }
    setIsSubmitting(true);
    const result = await createHourlyWageExpense(
      Math.round(amount * 100) / 100,
      expenseDate,
      buildShiftExpenseDescription(
        shiftId,
        description.trim() || "погодинна"
      )
    );
    setIsSubmitting(false);
    if (result.ok) {
      toast.success("Витрату додано до обліку (З.П. Погодинна)");
      setHours("");
      setDescription("");
    } else {
      toast.error(result.error);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountValue = Number.parseFloat(manualAmount);

    if (Number.isNaN(amountValue) || amountValue <= 0) {
      toast.error("Вкажіть суму більше нуля");
      return;
    }

    setIsManualSubmitting(true);
    const result = await createHourlyWageExpense(
      Math.round(amountValue * 100) / 100,
      expenseDate,
      buildShiftExpenseDescription(
        shiftId,
        manualComment.trim() || DEFAULT_MANUAL_COMMENT
      )
    );
    setIsManualSubmitting(false);

    if (result.ok) {
      toast.success("Витрату додано до обліку (З.П. Погодинна)");
      setManualAmount("");
      setManualComment("");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="hourly-hours">Кількість годин</Label>
            <Input
              id="hourly-hours"
              type="number"
              min="0"
              step="0.5"
              placeholder="0"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hourly-rate">Ставка (грн/год)</Label>
            <Input
              id="hourly-rate"
              type="number"
              min="0"
              step="1"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-1">
            <Label htmlFor="hourly-description">Опис</Label>
            <Input
              id="hourly-description"
              type="text"
              placeholder={DEFAULT_DESCRIPTION(shiftId)}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        {amount > 0 && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              Сума ({employeeCount} {employeeCount === 1 ? "працівник" : "працівників"}):{" "}
              <strong className="text-foreground">{amount.toFixed(2)} грн</strong>
            </span>
          </div>
        )}
        {employeeCount === 0 && (hoursNum > 0 || rateNum > 0) && (
          <p className="text-sm text-muted-foreground">
            Додайте працівників на зміну, щоб розрахувати суму
          </p>
        )}
        <Button
          type="submit"
          disabled={amount <= 0 || isSubmitting}
          className="w-full sm:w-[340px]"
        >
          {isSubmitting ? "Збереження…" : "Додати до обліку витрат (З.П. Погодинна)"}
        </Button>
      </form>

      <form onSubmit={handleManualSubmit} className="space-y-4 border-t pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="hourly-manual-amount">Сума витрат (грн)</Label>
            <Input
              id="hourly-manual-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hourly-manual-comment">Коментар</Label>
            <Input
              id="hourly-manual-comment"
              type="text"
              placeholder="Вантажні роботи"
              value={manualComment}
              onChange={(e) => setManualComment(e.target.value)}
            />
          </div>
        </div>
        <Button
          type="submit"
          disabled={
            isManualSubmitting ||
            Number.isNaN(manualAmountNum) ||
            manualAmountNum <= 0
          }
          className="w-full sm:w-[340px]"
        >
          {isManualSubmitting
            ? "Збереження…"
            : "Додати суму витрат до З.П. Погодинна"}
        </Button>
      </form>
    </div>
  );
}
