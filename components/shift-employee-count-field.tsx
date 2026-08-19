"use client";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  SHIFT_EMPLOYEE_COUNT_OPTIONS,
  shiftEmployeeCountLabel,
} from "@/lib/shifts/employee-count";
import { cn } from "@/lib/utils";

interface ShiftEmployeeCountFieldProps {
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
  name?: string;
}

export function ShiftEmployeeCountField({
  value,
  onChange,
  disabled = false,
  name = "employee-count",
}: ShiftEmployeeCountFieldProps) {
  return (
    <RadioGroup
      value={value ? String(value) : undefined}
      onValueChange={(nextValue) => onChange(Number(nextValue))}
      disabled={disabled}
      className="flex flex-col gap-2"
    >
      {SHIFT_EMPLOYEE_COUNT_OPTIONS.map((count) => {
        const optionId = `${name}-${count}`;
        const isSelected = value === count;

        return (
          <label
            key={count}
            htmlFor={optionId}
            className={cn(
              "flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors active:bg-accent md:min-h-12",
              isSelected
                ? "border-primary bg-primary/5"
                : "border-input hover:bg-muted/50",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            <RadioGroupItem
              id={optionId}
              value={String(count)}
              className="h-5 w-5 shrink-0"
              disabled={disabled}
            />
            <span className="min-w-0 flex-1 text-base leading-snug">
              {shiftEmployeeCountLabel(count)}
            </span>
          </label>
        );
      })}
    </RadioGroup>
  );
}
