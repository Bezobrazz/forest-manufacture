"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock } from "lucide-react";
import type { Shift } from "@/lib/types";

interface ShiftWagesProps {
  shift: Shift;
  productWages: number;
}

export function ShiftWages({ shift, productWages }: ShiftWagesProps) {
  const [hourlyRate, setHourlyRate] = useState<string>("100");
  const [hoursWorked, setHoursWorked] = useState<string>("");

  // Розрахунок часу між відкриттям і закриттям зміни
  let calculatedHours = 0;
  if (shift.status === "completed" && shift.completed_at && shift.created_at) {
    try {
      const startTime = new Date(shift.created_at).getTime();
      const endTime = new Date(shift.completed_at).getTime();

      // Перевірка на валідність дат
      if (!isNaN(startTime) && !isNaN(endTime) && endTime > startTime) {
        calculatedHours = (endTime - startTime) / (1000 * 60 * 60); // конвертуємо мілісекунди в години

        // Обмеження максимального значення для запобігання помилок
        if (calculatedHours > 24) {
          console.warn(
            `Unusually long shift detected: ${calculatedHours.toFixed(
              2
            )} hours. Capping at 24 hours.`
          );
          calculatedHours = 24;
        }
      } else {
        console.warn(
          `Invalid date values for shift ${shift.id}: start=${shift.created_at}, end=${shift.completed_at}`
        );
      }
    } catch (error) {
      console.error(`Error calculating hours for shift ${shift.id}:`, error);
    }
  }

  // Якщо користувач не ввів години, використовуємо розраховані
  const effectiveHours = hoursWorked
    ? Number.parseFloat(hoursWorked)
    : calculatedHours;

  // Розрахунок погодинної оплати
  const hourlyWages = effectiveHours * Number.parseFloat(hourlyRate || "0");

  // Загальна сума (погодинна + за продукцію)
  const totalWages = hourlyWages + productWages;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <span>Погодинна оплата</span>
        </CardTitle>
        <CardDescription>
          Розрахунок заробітної плати на основі відпрацьованих годин
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hourlyRate">Погодинна ставка (грн/год)</Label>
              <Input
                id="hourlyRate"
                type="number"
                min="0"
                step="0.01"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="Введіть погодинну ставку"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hoursWorked">
                Відпрацьовані години{" "}
                {calculatedHours > 0 &&
                  `(розраховано: ${calculatedHours.toFixed(2)})`}
              </Label>
              <Input
                id="hoursWorked"
                type="number"
                min="0"
                step="0.1"
                value={hoursWorked}
                onChange={(e) => setHoursWorked(e.target.value)}
                placeholder={
                  calculatedHours > 0
                    ? calculatedHours.toFixed(2)
                    : "Введіть кількість годин"
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">
                Погодинна оплата
              </div>
              <div className="text-xl font-bold">
                {hourlyWages.toFixed(2)} грн
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {effectiveHours.toFixed(2)} год ×{" "}
                {Number.parseFloat(hourlyRate || "0").toFixed(2)} грн/год
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">
                Оплата за продукцію
              </div>
              <div className="text-xl font-bold">
                {productWages.toFixed(2)} грн
              </div>
            </div>

            <div className="bg-primary/10 p-4 rounded-lg">
              <div className="text-sm mb-1 font-medium">Загальна сума</div>
              <div className="text-2xl font-bold text-primary">
                {totalWages.toFixed(2)} грн
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
