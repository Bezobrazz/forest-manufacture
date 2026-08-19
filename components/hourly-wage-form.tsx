"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createHourlyWageExpense } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Clock, DollarSign, Loader2 } from "lucide-react";

const DEFAULT_RATE = 75;
const DEFAULT_DESCRIPTION = (shiftId: number) => `Зміна #${shiftId}, погодинна`;
const DEFAULT_MANUAL_COMMENT = "Вантажні роботи";

const buildShiftExpenseDescription = (shiftId: number, comment: string) =>
  `Зміна #${shiftId}, ${comment}`;

export type HourlyWageExpenseItem = {
  id: number;
  amount: number;
  description: string;
  date: string;
};

type HourlyWageContextValue = {
  shiftId: number;
  shiftOpenedAt: string;
  employeeCount: number;
  expenses: HourlyWageExpenseItem[];
  expensesTotal: number;
  draftAmount: number;
  setDraftAmount: (amount: number) => void;
  addExpense: (expense: HourlyWageExpenseItem) => void;
};

const HourlyWageContext = createContext<HourlyWageContextValue | null>(null);

const useHourlyWage = () => {
  const value = useContext(HourlyWageContext);
  if (!value) {
    throw new Error("HourlyWage components must be used within HourlyWageProvider");
  }
  return value;
};

interface HourlyWageProviderProps {
  shiftId: number;
  shiftOpenedAt: string;
  employeeCount: number;
  initialExpenses: HourlyWageExpenseItem[];
  children: ReactNode;
}

export function HourlyWageProvider({
  shiftId,
  shiftOpenedAt,
  employeeCount,
  initialExpenses,
  children,
}: HourlyWageProviderProps) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [draftAmount, setDraftAmount] = useState(0);

  useEffect(() => {
    setExpenses(initialExpenses);
  }, [initialExpenses]);

  const expensesTotal = expenses.reduce((sum, item) => sum + item.amount, 0);

  const addExpense = (expense: HourlyWageExpenseItem) => {
    setExpenses((prev) => {
      if (prev.some((item) => item.id === expense.id)) {
        return prev;
      }
      return [expense, ...prev];
    });
    setDraftAmount(0);
  };

  return (
    <HourlyWageContext.Provider
      value={{
        shiftId,
        shiftOpenedAt,
        employeeCount,
        expenses,
        expensesTotal,
        draftAmount,
        setDraftAmount,
        addExpense,
      }}
    >
      {children}
    </HourlyWageContext.Provider>
  );
}

interface ShiftWageSummaryCardProps {
  totalWages: number;
  employeeCount: number;
  shiftStatus: string;
  hasProduction: boolean;
  children?: ReactNode;
}

export function ShiftWageSummaryCard({
  totalWages,
  employeeCount,
  shiftStatus,
  hasProduction,
  children,
}: ShiftWageSummaryCardProps) {
  const { expenses, expensesTotal, draftAmount } = useHourlyWage();
  const hourlyTotal = expensesTotal + draftAmount;
  const totalCompensation = totalWages + hourlyTotal;
  const totalCompensationPerEmployee =
    employeeCount > 0 ? totalCompensation / employeeCount : 0;

  const isVisible =
    shiftStatus === "active" ||
    hasProduction ||
    expenses.length > 0 ||
    draftAmount > 0;

  if (!isVisible) {
    return null;
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          <span>Заробітна плата за зміну</span>
        </CardTitle>
        <CardDescription>
          Розрахунок виплат за продукцію та погодинні витрати. Погодинна сума
          оновлюється під час заповнення, зміну закривати не потрібно.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">
                Винагорода за продукцію
              </div>
              <div className="text-2xl font-bold">
                {totalWages.toFixed(2)} грн
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">
                Додаткові витрати (З.П. Погодинна)
              </div>
              <div className="text-2xl font-bold">
                {hourlyTotal.toFixed(2)} грн
              </div>
              {draftAmount > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  Збережено {expensesTotal.toFixed(2)} грн + поточний розрахунок{" "}
                  {draftAmount.toFixed(2)} грн
                </div>
              )}
            </div>

            {employeeCount > 0 && (
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">
                  Разом до виплати
                </div>
                <div className="text-2xl font-bold">
                  {totalCompensation.toFixed(2)} грн
                </div>
              </div>
            )}

            {employeeCount > 0 && (
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">
                  На одного працівника ({employeeCount} осіб), разом
                </div>
                <div className="text-2xl font-bold">
                  {totalCompensationPerEmployee.toFixed(2)} грн
                </div>
              </div>
            )}
          </div>

          {(expenses.length > 0 || draftAmount > 0) && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">
                Додаткові витрати (З.П. Погодинна)
              </h4>
              <div className="space-y-2">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="text-sm text-muted-foreground">
                      {expense.description || "Без коментаря"}
                    </div>
                    <div className="font-medium">
                      {expense.amount.toFixed(2)} грн
                    </div>
                  </div>
                ))}
                {draftAmount > 0 && (
                  <div className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="text-sm text-muted-foreground">
                      Поточний розрахунок (ще не збережено)
                    </div>
                    <div className="font-medium">{draftAmount.toFixed(2)} грн</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {children}
        </div>
      </CardContent>
    </Card>
  );
}

export function HourlyWageForm() {
  const router = useRouter();
  const {
    shiftId,
    shiftOpenedAt,
    employeeCount,
    setDraftAmount,
    addExpense,
  } = useHourlyWage();
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
  const calculatedAmount = hoursNum * rateNum * employeeCount;
  const manualAmountNum = Number.parseFloat(manualAmount);
  const hasManualDraft =
    !Number.isNaN(manualAmountNum) && manualAmountNum > 0;
  const nextDraftAmount = calculatedAmount > 0 ? calculatedAmount : hasManualDraft ? manualAmountNum : 0;

  useEffect(() => {
    setDraftAmount(nextDraftAmount);
  }, [nextDraftAmount, setDraftAmount]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (calculatedAmount <= 0) {
      toast.error(
        employeeCount === 0
          ? "Додайте працівників на зміну"
          : "Вкажіть кількість годин та ставку"
      );
      return;
    }
    const roundedAmount = Math.round(calculatedAmount * 100) / 100;
    const expenseDescription = buildShiftExpenseDescription(
      shiftId,
      description.trim() || "погодинна"
    );
    setIsSubmitting(true);
    try {
      const result = await createHourlyWageExpense(
        roundedAmount,
        expenseDate,
        expenseDescription,
        shiftId
      );
      if (result.ok) {
        addExpense(result.expense);
        toast.success("Витрату додано до обліку (З.П. Погодинна)");
        setHours("");
        setDescription("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountValue = Number.parseFloat(manualAmount);

    if (Number.isNaN(amountValue) || amountValue <= 0) {
      toast.error("Вкажіть суму більше нуля");
      return;
    }

    const roundedAmount = Math.round(amountValue * 100) / 100;
    const expenseDescription = buildShiftExpenseDescription(
      shiftId,
      manualComment.trim() || DEFAULT_MANUAL_COMMENT
    );
    setIsManualSubmitting(true);
    try {
      const result = await createHourlyWageExpense(
        roundedAmount,
        expenseDate,
        expenseDescription,
        shiftId
      );

      if (result.ok) {
        addExpense(result.expense);
        toast.success("Витрату додано до обліку (З.П. Погодинна)");
        setManualAmount("");
        setManualComment("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsManualSubmitting(false);
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
              disabled={isSubmitting || isManualSubmitting}
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
              disabled={isSubmitting || isManualSubmitting}
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
              disabled={isSubmitting || isManualSubmitting}
            />
          </div>
        </div>
        <div className="bg-muted p-4 rounded-lg space-y-1">
          <div className="text-sm text-muted-foreground">Поточний розрахунок</div>
          <div className="text-2xl font-bold">{calculatedAmount.toFixed(2)} грн</div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0" />
            <span>
              {hoursNum} год × {rateNum} грн/год × {employeeCount}{" "}
              {employeeCount === 1 ? "працівник" : "працівників"}
            </span>
          </div>
        </div>
        {employeeCount === 0 && (hoursNum > 0 || rateNum > 0) && (
          <p className="text-sm text-muted-foreground">
            Додайте працівників на зміну, щоб розрахувати суму
          </p>
        )}
        <Button
          type="submit"
          disabled={calculatedAmount <= 0 || isSubmitting || isManualSubmitting}
          aria-busy={isSubmitting}
          className="w-full sm:w-[340px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Збереження…
            </>
          ) : (
            "Додати до обліку витрат (З.П. Погодинна)"
          )}
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
              disabled={isSubmitting || isManualSubmitting}
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
              disabled={isSubmitting || isManualSubmitting}
            />
          </div>
        </div>
        {hasManualDraft && calculatedAmount <= 0 && (
          <div className="text-sm text-muted-foreground">
            Сума до додавання:{" "}
            <strong className="text-foreground">
              {manualAmountNum.toFixed(2)} грн
            </strong>
          </div>
        )}
        <Button
          type="submit"
          disabled={
            isSubmitting ||
            isManualSubmitting ||
            Number.isNaN(manualAmountNum) ||
            manualAmountNum <= 0
          }
          aria-busy={isManualSubmitting}
          className="w-full sm:w-[340px]"
        >
          {isManualSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Збереження…
            </>
          ) : (
            "Додати суму витрат до З.П. Погодинна"
          )}
        </Button>
      </form>
    </div>
  );
}
