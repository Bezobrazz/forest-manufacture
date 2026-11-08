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

type PendingKind = "fuel" | "repair" | "maintenance" | null;

function parseNum(value: string): number | null {
  const v = value.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function ExpenseSubmitButton({
  pending,
  disabled,
  label,
}: {
  pending: boolean;
  disabled: boolean;
  label: string;
}) {
  return (
    <Button
      type="submit"
      className="h-11 w-full text-base"
      disabled={disabled}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Збереження…
        </>
      ) : (
        label
      )}
    </Button>
  );
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
  const [pendingKind, setPendingKind] = useState<PendingKind>(null);

  const fuelExpenseSum = useMemo(() => {
    const price = parseNum(fuelExpensePrice);
    const liters = parseNum(fuelExpenseLiters);
    if (price == null || liters == null || price < 0 || liters < 0) return null;
    if (price === 0 && liters === 0) return null;
    return Math.round(price * liters * 100) / 100;
  }, [fuelExpensePrice, fuelExpenseLiters]);

  const anyPending = pendingKind != null;

  function requireSharedFields(): boolean {
    if (!vehicleId) {
      toast.error("Оберіть транспорт");
      return false;
    }
    return true;
  }

  async function handleFuelSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requireSharedFields()) return;

    const price = parseNum(fuelExpensePrice);
    const liters = parseNum(fuelExpenseLiters);
    if (price == null || price <= 0) {
      toast.error("Вкажіть ціну палива за літр");
      return;
    }
    if (liters == null || liters <= 0) {
      toast.error("Вкажіть кількість літрів");
      return;
    }

    setPendingKind("fuel");
    try {
      const result = await createMiniAppExpenses({
        expenseDate: dateToYYYYMMDD(eventDate),
        vehicleId,
        fuelExpensePriceUahPerL: price,
        fuelExpenseLiters: liters,
      });
      if (!result.ok) {
        toast.error("Помилка", { description: result.error });
        return;
      }
      toast.success("Витрати на паливо збережено");
      setFuelExpensePrice("");
      setFuelExpenseLiters("");
      router.refresh();
    } finally {
      setPendingKind(null);
    }
  }

  async function handleRepairSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requireSharedFields()) return;

    const amount = parseNum(repairAmount);
    if (amount == null || amount <= 0) {
      toast.error("Вкажіть суму ремонту");
      return;
    }

    setPendingKind("repair");
    try {
      const result = await createMiniAppExpenses({
        expenseDate: dateToYYYYMMDD(eventDate),
        vehicleId,
        repairAmountUah: amount,
        repairComment: repairComment.trim() || null,
      });
      if (!result.ok) {
        toast.error("Помилка", { description: result.error });
        return;
      }
      toast.success("Витрати на ремонт збережено");
      setRepairAmount("");
      setRepairComment("");
      router.refresh();
    } finally {
      setPendingKind(null);
    }
  }

  async function handleMaintenanceSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requireSharedFields()) return;

    const amount = parseNum(maintenanceAmount);
    if (amount == null || amount <= 0) {
      toast.error("Вкажіть суму обслуговування");
      return;
    }

    setPendingKind("maintenance");
    try {
      const result = await createMiniAppExpenses({
        expenseDate: dateToYYYYMMDD(eventDate),
        vehicleId,
        maintenanceAmountUah: amount,
        maintenanceComment: maintenanceComment.trim() || null,
      });
      if (!result.ok) {
        toast.error("Помилка", { description: result.error });
        return;
      }
      toast.success("Витрати на обслуговування збережено");
      setMaintenanceAmount("");
      setMaintenanceComment("");
      router.refresh();
    } finally {
      setPendingKind(null);
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
    <div className="space-y-4">
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
            locked={anyPending}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Транспорт *</Label>
          <Select
            value={vehicleId}
            onValueChange={setVehicleId}
            disabled={anyPending}
          >
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
      </section>

      <form onSubmit={handleFuelSubmit} className="space-y-3">
        <FieldFuelExpenseFields
          price={fuelExpensePrice}
          liters={fuelExpenseLiters}
          sum={fuelExpenseSum}
          onPriceChange={setFuelExpensePrice}
          onLitersChange={setFuelExpenseLiters}
          showOptionalHint={false}
        />
        <ExpenseSubmitButton
          pending={pendingKind === "fuel"}
          disabled={anyPending}
          label="Зберегти витрати на паливо"
        />
      </form>

      <form onSubmit={handleRepairSubmit} className="space-y-3">
        <FieldAmountExpenseFields
          title="Витрати на ремонт"
          amountId="repair_amount"
          commentId="repair_comment"
          amount={repairAmount}
          comment={repairComment}
          onAmountChange={setRepairAmount}
          onCommentChange={setRepairComment}
          showOptionalHint={false}
        />
        <ExpenseSubmitButton
          pending={pendingKind === "repair"}
          disabled={anyPending}
          label="Зберегти витрати на ремонт"
        />
      </form>

      <form onSubmit={handleMaintenanceSubmit} className="space-y-3">
        <FieldAmountExpenseFields
          title="Витрати на обслуговування"
          amountId="maintenance_amount"
          commentId="maintenance_comment"
          amount={maintenanceAmount}
          comment={maintenanceComment}
          onAmountChange={setMaintenanceAmount}
          onCommentChange={setMaintenanceComment}
          showOptionalHint={false}
        />
        <ExpenseSubmitButton
          pending={pendingKind === "maintenance"}
          disabled={anyPending}
          label="Зберегти витрати на обслуговування"
        />
      </form>
    </div>
  );
}
