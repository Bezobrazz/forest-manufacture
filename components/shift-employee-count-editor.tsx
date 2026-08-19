"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateShiftEmployeeCount } from "@/app/actions";
import { ShiftEmployeeCountField } from "@/components/shift-employee-count-field";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ShiftEmployeeCountEditorProps {
  shiftId: number;
  value: number;
}

export function ShiftEmployeeCountEditor({
  shiftId,
  value,
}: ShiftEmployeeCountEditorProps) {
  const router = useRouter();
  const [count, setCount] = useState<number | null>(value > 0 ? value : null);
  const [isPending, setIsPending] = useState(false);

  async function handleChange(nextCount: number) {
    const previous = count;
    setCount(nextCount);
    setIsPending(true);

    try {
      const result = await updateShiftEmployeeCount(shiftId, nextCount);
      if (result.success) {
        router.refresh();
        return;
      }

      setCount(previous);
      toast.error(result.error);
    } catch {
      setCount(previous);
      toast.error("Не вдалося оновити кількість працівників");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <ShiftEmployeeCountField
        value={count}
        onChange={handleChange}
        disabled={isPending}
        name={`shift-${shiftId}-employee-count`}
      />
      {isPending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Збереження…
        </p>
      )}
    </div>
  );
}
