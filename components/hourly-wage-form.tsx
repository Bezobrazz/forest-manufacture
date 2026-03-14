"use client";

import { useState } from "react";
import { createHourlyWageExpense } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Clock } from "lucide-react";

const DEFAULT_RATE = 75;

interface HourlyWageFormProps {
  shiftId: number;
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function HourlyWageForm({ shiftId }: HourlyWageFormProps) {
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState(String(DEFAULT_RATE));
  const [expenseDate, setExpenseDate] = useState(() => toDateString(new Date()));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hoursNum = Number.parseFloat(hours) || 0;
  const rateNum = Number.parseFloat(rate) || 0;
  const amount = hoursNum * rateNum;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (amount <= 0) {
      toast.error("Вкажіть кількість годин та ставку");
      return;
    }
    setIsSubmitting(true);
    const result = await createHourlyWageExpense(
      Math.round(amount * 100) / 100,
      expenseDate,
      `Зміна #${shiftId}, погодинна`
    );
    setIsSubmitting(false);
    if (result.ok) {
      toast.success("Витрату додано до обліку (З/П Погодинна)");
      setHours("");
    } else {
      toast.error(result.error);
    }
  }

  return (
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
        <div className="space-y-2">
          <Label htmlFor="hourly-date">Дата витрати</Label>
          <Input
            id="hourly-date"
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
          />
        </div>
      </div>
      {amount > 0 && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>
            Сума: <strong className="text-foreground">{amount.toFixed(2)} грн</strong>
          </span>
        </div>
      )}
      <Button type="submit" disabled={amount <= 0 || isSubmitting}>
        {isSubmitting ? "Збереження…" : "Додати до обліку витрат (З/П Погодинна)"}
      </Button>
    </form>
  );
}
