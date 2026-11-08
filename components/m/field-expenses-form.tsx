"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createMiniAppExpenses } from "@/app/m/actions";
import type { Vehicle } from "@/app/vehicles/actions";
import { FieldAmountExpenseFields } from "@/components/m/field-amount-expense-fields";
import { FieldFuelExpenseFields } from "@/components/m/field-fuel-expense-fields";
import { TripDateField } from "@/components/trip-date-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dateToYYYYMMDD } from "@/lib/utils";

type Props = {
  accessName: string;
  vehicles: Vehicle[];
  lastVehicleId: string | null;
};

function parseNum(value: string): number | null {
  const v = value.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function FieldExpensesForm({
  accessName,
  vehicles,
  lastVehicleId,
}: Props) {
  const router = useRouter();
  const defaultVehicleId =
    lastVehicleId && vehicles.some((v) => v.id === lastVehicleId)
      ? lastVehicleId
      : (vehicles[0]?.id ?? "");

  const [eventDate, setEventDate] = useState(() => new Date());
  const [dateOpen, setDateOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState(defaultVehicleId);
  const [fuelExpensePrice, setFuelExpensePrice] = useState("");
  const [fuelExpenseLiters, setFuelExpenseLiters] = useState("");
  const [repairAmount, setRepairAmount] = useState("");
  const [repairComment, setRepairComment] = useState("");
  const [maintenanceAmount, setMaintenanceAmount] = useState("");
  const [maintenanceComment, setMaintenanceComment] = useState("");
  const [pending, setPending] = useState(false);

  const fuelExpenseSum = useMemo(() => {
    const price = parseNum(fuelExpensePrice);
    const liters = parseNum(fuelExpenseLiters);
    if (price == null || liters == null || price < 0 || liters < 0) return null;
    if (price === 0 && liters === 0) return null;
    return Math.round(price * liters * 100) / 100;
  }, [fuelExpensePrice, fuelExpenseLiters]);

  function resetForm() {
    setFuelExpensePrice("");
    setFuelExpenseLiters("");
    setRepairAmount("");
    setRepairComment("");
    setMaintenanceAmount("");
    setMaintenanceComment("");
    setVehicleId(defaultVehicleId);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!vehicleId) {
      toast.error("Оберіть транспорт");
      return;
    }

    const parsedFuelPrice = parseNum(fuelExpensePrice);
    const parsedFuelLiters = parseNum(fuelExpenseLiters);
    const hasFuelPrice =
      fuelExpensePrice.trim() !== "" &&
      parsedFuelPrice != null &&
      parsedFuelPrice > 0;
    const hasFuelLiters =
      fuelExpenseLiters.trim() !== "" &&
      parsedFuelLiters != null &&
      parsedFuelLiters > 0;

    if (
      fuelExpensePrice.trim() &&
      (parsedFuelPrice == null || parsedFuelPrice < 0)
    ) {
      toast.error("Вкажіть коректну ціну палива за літр");
      return;
    }
    if (
      fuelExpenseLiters.trim() &&
      (parsedFuelLiters == null || parsedFuelLiters < 0)
    ) {
      toast.error("Вкажіть коректну кількість літрів");
      return;
    }
    if (hasFuelPrice !== hasFuelLiters) {
      toast.error(
        "Для витрат на паливо вкажіть і ціну за літр, і кількість літрів"
      );
      return;
    }

    const parsedRepairAmount = parseNum(repairAmount);
    if (
      repairAmount.trim() &&
      (parsedRepairAmount == null || parsedRepairAmount < 0)
    ) {
      toast.error("Вкажіть коректну суму ремонту");
      return;
    }

    const parsedMaintenanceAmount = parseNum(maintenanceAmount);
    if (
      maintenanceAmount.trim() &&
      (parsedMaintenanceAmount == null || parsedMaintenanceAmount < 0)
    ) {
      toast.error("Вкажіть коректну суму обслуговування");
      return;
    }

    const hasFuel = hasFuelPrice && hasFuelLiters;
    const hasRepair =
      parsedRepairAmount != null && parsedRepairAmount > 0;
    const hasMaintenance =
      parsedMaintenanceAmount != null && parsedMaintenanceAmount > 0;

    if (!hasFuel && !hasRepair && !hasMaintenance) {
      toast.error(
        "Вкажіть хоча б одні витрати: паливо, ремонт або обслуговування"
      );
      return;
    }

    setPending(true);
    try {
      const result = await createMiniAppExpenses({
        expenseDate: dateToYYYYMMDD(eventDate),
        vehicleId,
        fuelExpensePriceUahPerL: hasFuel ? parsedFuelPrice : null,
        fuelExpenseLiters: hasFuel ? parsedFuelLiters : null,
        repairAmountUah: hasRepair ? parsedRepairAmount : null,
        repairComment: repairComment.trim() || null,
        maintenanceAmountUah: hasMaintenance
          ? parsedMaintenanceAmount
          : null,
        maintenanceComment: maintenanceComment.trim() || null,
      });
      if (!result.ok) {
        toast.error("Помилка", { description: result.error });
        return;
      }
      toast.success(
        result.savedCount > 1
          ? `Збережено ${result.savedCount} витрати`
          : "Витрати збережено"
      );
      resetForm();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (vehicles.length === 0) {
    return (
      <p className="text-sm text-destructive">
        Немає транспорту в автопарку. Додайте авто в ERP, потім повторіть.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Ви входите як{" "}
        <span className="font-semibold text-foreground">{accessName}</span>
      </p>

      <section className="space-y-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
        <div className="space-y-1.5">
          <TripDateField
            id="expense_date"
            label="Дата *"
            date={eventDate}
            onSelect={setEventDate}
            open={dateOpen}
            onOpenChange={setDateOpen}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Транспорт *</Label>
          <Select value={vehicleId} onValueChange={setVehicleId}>
            <SelectTrigger className="h-11 text-base">
              <SelectValue placeholder="Оберіть транспорт" />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((vehicle) => (
                <SelectItem key={vehicle.id} value={vehicle.id}>
                  {vehicle.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <FieldFuelExpenseFields
          price={fuelExpensePrice}
          liters={fuelExpenseLiters}
          sum={fuelExpenseSum}
          onPriceChange={setFuelExpensePrice}
          onLitersChange={setFuelExpenseLiters}
        />

        <FieldAmountExpenseFields
          title="Витрати на ремонт"
          amountId="repair_amount"
          commentId="repair_comment"
          amount={repairAmount}
          comment={repairComment}
          onAmountChange={setRepairAmount}
          onCommentChange={setRepairComment}
        />

        <FieldAmountExpenseFields
          title="Витрати на обслуговування"
          amountId="maintenance_amount"
          commentId="maintenance_comment"
          amount={maintenanceAmount}
          comment={maintenanceComment}
          onAmountChange={setMaintenanceAmount}
          onCommentChange={setMaintenanceComment}
        />
      </section>

      <Button
        type="submit"
        className="h-12 w-full text-base"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Збереження…
          </>
        ) : (
          "Зберегти витрати"
        )}
      </Button>
    </form>
  );
}
