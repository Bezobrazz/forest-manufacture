"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  createHourlyWageExpense,
  updateHourlyWageExpenseComment,
  updateShiftLoadingRates,
} from "@/app/actions";
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
import { Clock, DollarSign, Loader2, Minus, Package, Pencil, Plus } from "lucide-react";
import {
  buildShiftHourlyWageDescription,
  parseShiftHourlyWageDescription,
  type HourlyWageKind,
} from "@/lib/shifts/hourly-wage-description";
import {
  DEFAULT_SHIFT_LOADING_RATES,
  type ShiftLoadingRates,
} from "@/lib/shifts/loading-rates";

const DEFAULT_RATE = 75;
const DEFAULT_MANUAL_COMMENT = "Вантажні роботи";

const KIND_PLACEHOLDER: Record<HourlyWageKind, string> = {
  accounting: "погодинна",
  manual: "Вантажні роботи",
  loading_count: "підрахунок завантаження",
  loading: "завантаження кори",
};

const KIND_EMPTY_MESSAGE: Record<HourlyWageKind, string> = {
  accounting: "Погодинний облік ще не збережено",
  manual: "Суму витрат ще не збережено",
  loading_count: "Витрату за підрахунок завантаження ще не збережено",
  loading: "Витрату за завантаження кори ще не збережено",
};

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
  loadingRates: ShiftLoadingRates;
  setLoadingRates: (rates: ShiftLoadingRates) => void;
  expenses: HourlyWageExpenseItem[];
  expensesTotal: number;
  draftAccountingAmount: number;
  draftManualAmount: number;
  draftLoadingCountAmount: number;
  draftLoadingAmount: number;
  setDraftAccountingAmount: (amount: number) => void;
  setDraftManualAmount: (amount: number) => void;
  setDraftLoadingCountAmount: (amount: number) => void;
  setDraftLoadingAmount: (amount: number) => void;
  addExpense: (expense: HourlyWageExpenseItem) => void;
  updateExpense: (expense: HourlyWageExpenseItem) => void;
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
  initialLoadingRates?: ShiftLoadingRates;
  initialExpenses: HourlyWageExpenseItem[];
  children: ReactNode;
}

export function HourlyWageProvider({
  shiftId,
  shiftOpenedAt,
  employeeCount,
  initialLoadingRates = DEFAULT_SHIFT_LOADING_RATES,
  initialExpenses,
  children,
}: HourlyWageProviderProps) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [loadingRates, setLoadingRates] = useState(initialLoadingRates);
  const [draftAccountingAmount, setDraftAccountingAmount] = useState(0);
  const [draftManualAmount, setDraftManualAmount] = useState(0);
  const [draftLoadingCountAmount, setDraftLoadingCountAmount] = useState(0);
  const [draftLoadingAmount, setDraftLoadingAmount] = useState(0);

  useEffect(() => {
    setExpenses(initialExpenses);
  }, [initialExpenses]);

  useEffect(() => {
    setLoadingRates(initialLoadingRates);
  }, [initialLoadingRates]);

  const expensesTotal = expenses.reduce((sum, item) => sum + item.amount, 0);

  const addExpense = (expense: HourlyWageExpenseItem) => {
    setExpenses((prev) => {
      if (prev.some((item) => item.id === expense.id)) {
        return prev;
      }
      return [expense, ...prev];
    });
  };

  const updateExpense = (expense: HourlyWageExpenseItem) => {
    setExpenses((prev) =>
      prev.map((item) => (item.id === expense.id ? expense : item))
    );
  };

  return (
    <HourlyWageContext.Provider
      value={{
        shiftId,
        shiftOpenedAt,
        employeeCount,
        loadingRates,
        setLoadingRates,
        expenses,
        expensesTotal,
        draftAccountingAmount,
        draftManualAmount,
        draftLoadingCountAmount,
        draftLoadingAmount,
        setDraftAccountingAmount,
        setDraftManualAmount,
        setDraftLoadingCountAmount,
        setDraftLoadingAmount,
        addExpense,
        updateExpense,
      }}
    >
      {children}
    </HourlyWageContext.Provider>
  );
}

const expensesOfKind = (
  expenses: HourlyWageExpenseItem[],
  shiftId: number,
  kind: HourlyWageKind
) =>
  expenses.filter(
    (expense) => parseShiftHourlyWageDescription(expense.description, shiftId).kind === kind
  );

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
  const {
    shiftId,
    expenses,
    expensesTotal,
    draftAccountingAmount,
    draftManualAmount,
    draftLoadingCountAmount,
    draftLoadingAmount,
  } = useHourlyWage();
  const accountingExpenses = expensesOfKind(expenses, shiftId, "accounting");
  const manualExpenses = expensesOfKind(expenses, shiftId, "manual");
  const loadingCountExpenses = expensesOfKind(expenses, shiftId, "loading_count");
  const loadingExpenses = expensesOfKind(expenses, shiftId, "loading");
  const accountingTotal =
    accountingExpenses.reduce((sum, item) => sum + item.amount, 0) +
    draftAccountingAmount;
  const manualTotal =
    manualExpenses.reduce((sum, item) => sum + item.amount, 0) + draftManualAmount;
  const loadingCountTotal =
    loadingCountExpenses.reduce((sum, item) => sum + item.amount, 0) +
    draftLoadingCountAmount;
  const loadingTotal =
    loadingExpenses.reduce((sum, item) => sum + item.amount, 0) + draftLoadingAmount;
  const hourlyTotal =
    expensesTotal +
    draftAccountingAmount +
    draftManualAmount +
    draftLoadingCountAmount +
    draftLoadingAmount;
  const totalCompensation = totalWages + hourlyTotal;
  const totalCompensationPerEmployee =
    employeeCount > 0 ? totalCompensation / employeeCount : 0;

  const isVisible =
    shiftStatus === "active" ||
    hasProduction ||
    expenses.length > 0 ||
    draftAccountingAmount > 0 ||
    draftManualAmount > 0 ||
    draftLoadingCountAmount > 0 ||
    draftLoadingAmount > 0;

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
                Облік витрат (погодинна)
              </div>
              <div className="text-2xl font-bold">
                {accountingTotal.toFixed(2)} грн
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">
                Сума витрат
              </div>
              <div className="text-2xl font-bold">
                {manualTotal.toFixed(2)} грн
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">
                Підрахунок завантаження
              </div>
              <div className="text-2xl font-bold">
                {loadingCountTotal.toFixed(2)} грн
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">
                Завантаження кори
              </div>
              <div className="text-2xl font-bold">
                {loadingTotal.toFixed(2)} грн
              </div>
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

          {children}
        </div>
      </CardContent>
    </Card>
  );
}

function HourlyWageExpenseRow({
  expense,
  kind,
}: {
  expense: HourlyWageExpenseItem;
  kind: HourlyWageKind;
}) {
  const router = useRouter();
  const { shiftId, updateExpense } = useHourlyWage();
  const parsed = parseShiftHourlyWageDescription(expense.description, shiftId);
  const [isEditing, setIsEditing] = useState(false);
  const [comment, setComment] = useState(parsed.comment);
  const [amount, setAmount] = useState(expense.amount.toFixed(2));
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    const next = parseShiftHourlyWageDescription(expense.description, shiftId);
    setComment(next.comment);
    setAmount(expense.amount.toFixed(2));
  }, [expense.amount, expense.description, shiftId]);

  function resetFields() {
    const next = parseShiftHourlyWageDescription(expense.description, shiftId);
    setComment(next.comment);
    setAmount(expense.amount.toFixed(2));
    setIsEditing(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const amountValue = Number.parseFloat(amount);
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      toast.error("Вкажіть суму більше нуля");
      return;
    }

    setIsPending(true);
    try {
      const result = await updateHourlyWageExpenseComment(
        expense.id,
        shiftId,
        comment,
        Math.round(amountValue * 100) / 100
      );
      if (result.ok) {
        updateExpense(result.expense);
        toast.success("Витрату оновлено");
        setIsEditing(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Не вдалося оновити витрату");
    } finally {
      setIsPending(false);
    }
  }

  if (isEditing) {
    return (
      <form
        onSubmit={handleSave}
        className="grid gap-2 border-b py-3 last:border-0 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
      >
        <div className="space-y-1">
          <Label htmlFor={`hourly-comment-${expense.id}`}>Коментар</Label>
          <Input
            id={`hourly-comment-${expense.id}`}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={KIND_PLACEHOLDER[kind]}
            disabled={isPending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`hourly-amount-${expense.id}`}>Сума, грн</Label>
          <Input
            id={`hourly-amount-${expense.id}`}
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isPending}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetFields}
            disabled={isPending}
          >
            Скасувати
          </Button>
          <Button type="submit" size="sm" disabled={isPending} aria-busy={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Збереження…
              </>
            ) : (
              "Зберегти"
            )}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
      <div className="min-w-0 text-sm text-muted-foreground">
        {parsed.comment || "Без коментаря"}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="font-medium">{expense.amount.toFixed(2)} грн</div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => setIsEditing(true)}
          title="Редагувати витрату"
        >
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Редагувати витрату</span>
        </Button>
      </div>
    </div>
  );
}

function HourlyWageExpenseList({ kind }: { kind: HourlyWageKind }) {
  const { shiftId, expenses } = useHourlyWage();
  const items = expensesOfKind(expenses, shiftId, kind);

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{KIND_EMPTY_MESSAGE[kind]}</p>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((expense) => (
        <HourlyWageExpenseRow key={expense.id} expense={expense} kind={kind} />
      ))}
    </div>
  );
}

type AccountingRow = {
  id: number;
  hours: string;
  rate: string;
  description: string;
};

const createAccountingRow = (id: number): AccountingRow => ({
  id,
  hours: "",
  rate: String(DEFAULT_RATE),
  description: "",
});

const rowHours = (row: AccountingRow) => Number.parseFloat(row.hours) || 0;
const rowRate = (row: AccountingRow) => Number.parseFloat(row.rate) || 0;
const rowAmount = (row: AccountingRow, employeeCount: number) =>
  rowHours(row) * rowRate(row) * employeeCount;

function HourlyWageAccountingForm() {
  const router = useRouter();
  const {
    shiftId,
    shiftOpenedAt,
    employeeCount,
    setDraftAccountingAmount,
    addExpense,
  } = useHourlyWage();
  const [rows, setRows] = useState<AccountingRow[]>(() => [createAccountingRow(1)]);
  const [nextRowId, setNextRowId] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const expenseDate = new Date(shiftOpenedAt).toISOString().slice(0, 10);
  const calculatedRows = rows.map((row) => ({
    ...row,
    hoursNum: rowHours(row),
    rateNum: rowRate(row),
    amount: rowAmount(row, employeeCount),
  }));
  const calculatedAmount = calculatedRows.reduce((sum, row) => sum + row.amount, 0);
  const rowsToSave = calculatedRows.filter((row) => row.amount > 0);

  useEffect(() => {
    setDraftAccountingAmount(calculatedAmount > 0 ? calculatedAmount : 0);
  }, [calculatedAmount, setDraftAccountingAmount]);

  const updateRow = (id: number, patch: Partial<AccountingRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, createAccountingRow(nextRowId)]);
    setNextRowId((id) => id + 1);
  };

  const removeRow = (id: number) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.id !== id)));
  };

  async function handleSave() {
    if (rowsToSave.length === 0) {
      toast.error(
        employeeCount === 0
          ? "Оберіть кількість працівників на зміні"
          : "Вкажіть кількість годин та ставку"
      );
      return;
    }

    setIsSubmitting(true);
    try {
      let savedCount = 0;
      for (const row of rowsToSave) {
        const result = await createHourlyWageExpense(
          Math.round(row.amount * 100) / 100,
          expenseDate,
          buildShiftHourlyWageDescription(
            shiftId,
            "accounting",
            row.description.trim() || "погодинна"
          ),
          shiftId
        );
        if (result.ok) {
          addExpense(result.expense);
          savedCount += 1;
        } else {
          toast.error(result.error);
          break;
        }
      }

      if (savedCount > 0) {
        toast.success("Облік витрат збережено");
        setRows([createAccountingRow(nextRowId)]);
        setNextRowId((id) => id + 1);
        setDraftAccountingAmount(0);
        router.refresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {rows.map((row, index) => (
          <div
            key={row.id}
            className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-4"
          >
            <div className="space-y-2">
              <Label htmlFor={`hourly-hours-${row.id}`}>Кількість годин</Label>
              <Input
                id={`hourly-hours-${row.id}`}
                type="number"
                min="0"
                step="0.5"
                placeholder="0"
                value={row.hours}
                onChange={(e) => updateRow(row.id, { hours: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`hourly-rate-${row.id}`}>Ставка (грн/год)</Label>
              <Input
                id={`hourly-rate-${row.id}`}
                type="number"
                min="0"
                step="1"
                value={row.rate}
                onChange={(e) => updateRow(row.id, { rate: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`hourly-description-${row.id}`}>Коментар</Label>
              <Input
                id={`hourly-description-${row.id}`}
                type="text"
                placeholder="погодинна"
                value={row.description}
                onChange={(e) =>
                  updateRow(row.id, { description: e.target.value })
                }
                disabled={isSubmitting}
              />
            </div>
            <div className="flex items-end gap-2">
              {rows.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => removeRow(row.id)}
                  disabled={isSubmitting}
                  title="Видалити рядок"
                >
                  <Minus className="h-4 w-4" />
                  <span className="sr-only">Видалити рядок</span>
                </Button>
              )}
              {index === rows.length - 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={addRow}
                  disabled={isSubmitting}
                  title="Додати ставку"
                >
                  <Plus className="h-4 w-4" />
                  <span className="sr-only">Додати ставку</span>
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="bg-muted p-4 rounded-lg space-y-2">
        <div className="text-sm text-muted-foreground">Поточний розрахунок</div>
        <div className="text-2xl font-bold">{calculatedAmount.toFixed(2)} грн</div>
        {calculatedRows.map((row) => (
          <div
            key={row.id}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Clock className="h-4 w-4 shrink-0" />
            <span>
              {row.hoursNum} год × {row.rateNum} грн/год × {employeeCount}{" "}
              {employeeCount === 1 ? "працівник" : "працівників"}
              {rows.length > 1 ? ` = ${row.amount.toFixed(2)} грн` : ""}
            </span>
          </div>
        ))}
      </div>
      <Button
        type="button"
        onClick={handleSave}
        disabled={calculatedAmount <= 0 || isSubmitting}
        aria-busy={isSubmitting}
        className="w-full sm:w-[340px]"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Збереження…
          </>
        ) : (
          "Зберегти облік витрат"
        )}
      </Button>
    </div>
  );
}

function HourlyWageManualForm() {
  const router = useRouter();
  const { shiftId, shiftOpenedAt, setDraftManualAmount, addExpense } =
    useHourlyWage();
  const [manualAmount, setManualAmount] = useState("");
  const [manualComment, setManualComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const expenseDate = new Date(shiftOpenedAt).toISOString().slice(0, 10);
  const manualAmountNum = Number.parseFloat(manualAmount);
  const hasManualDraft = !Number.isNaN(manualAmountNum) && manualAmountNum > 0;

  useEffect(() => {
    setDraftManualAmount(hasManualDraft ? manualAmountNum : 0);
  }, [hasManualDraft, manualAmountNum, setDraftManualAmount]);

  async function handleSave() {
    if (Number.isNaN(manualAmountNum) || manualAmountNum <= 0) {
      toast.error("Вкажіть суму більше нуля");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createHourlyWageExpense(
        Math.round(manualAmountNum * 100) / 100,
        expenseDate,
        buildShiftHourlyWageDescription(
          shiftId,
          "manual",
          manualComment.trim() || DEFAULT_MANUAL_COMMENT
        ),
        shiftId
      );
      if (result.ok) {
        addExpense(result.expense);
        toast.success("Суму витрат збережено");
        setManualAmount("");
        setManualComment("");
        setDraftManualAmount(0);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
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
            disabled={isSubmitting}
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
            disabled={isSubmitting}
          />
        </div>
      </div>
      <Button
        type="button"
        onClick={handleSave}
        disabled={isSubmitting || !hasManualDraft}
        aria-busy={isSubmitting}
        className="w-full sm:w-[340px]"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Збереження…
          </>
        ) : (
          "Зберегти суму витрат"
        )}
      </Button>
    </div>
  );
}

function LoadingBagExpenseForm({
  kind,
}: {
  kind: "loading_count" | "loading";
}) {
  const router = useRouter();
  const {
    shiftId,
    shiftOpenedAt,
    loadingRates,
    setLoadingRates,
    setDraftLoadingCountAmount,
    setDraftLoadingAmount,
    addExpense,
  } = useHourlyWage();

  const isCount = kind === "loading_count";
  const rateKey = isCount ? "loadingCountRateUah" : "productLoadingRateUah";
  const title = isCount ? "Підрахунок завантаження" : "Завантаження кори";
  const setDraftAmount = isCount
    ? setDraftLoadingCountAmount
    : setDraftLoadingAmount;

  const [bags, setBags] = useState("");
  const [rate, setRate] = useState(String(loadingRates[rateKey]));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setRate(String(loadingRates[rateKey]));
  }, [loadingRates, rateKey]);

  const bagsNum = Number.parseFloat(bags);
  const rateNum = Number.parseFloat(rate);
  const hasValidBags = Number.isFinite(bagsNum) && bagsNum > 0;
  const hasValidRate = Number.isFinite(rateNum) && rateNum >= 0;
  const calculatedAmount =
    hasValidBags && hasValidRate
      ? Math.round(bagsNum * rateNum * 100) / 100
      : 0;

  useEffect(() => {
    setDraftAmount(calculatedAmount > 0 ? calculatedAmount : 0);
  }, [calculatedAmount, setDraftAmount]);

  async function handleSave() {
    if (!hasValidBags) {
      toast.error("Вкажіть кількість мішків більше нуля");
      return;
    }
    if (!hasValidRate) {
      toast.error("Вкажіть ставку не менше нуля");
      return;
    }
    if (calculatedAmount <= 0) {
      toast.error("Сума має бути більше нуля");
      return;
    }

    setIsSubmitting(true);
    try {
      const nextRates: ShiftLoadingRates = {
        ...loadingRates,
        [rateKey]: Math.round(rateNum * 100) / 100,
      };
      const ratesResult = await updateShiftLoadingRates(nextRates);
      if (!ratesResult.ok) {
        toast.error(ratesResult.error);
        return;
      }
      setLoadingRates(ratesResult.rates);

      const expenseDate = new Date(shiftOpenedAt).toISOString().slice(0, 10);
      const result = await createHourlyWageExpense(
        calculatedAmount,
        expenseDate,
        buildShiftHourlyWageDescription(
          shiftId,
          kind,
          `${title}, ${bagsNum} міш. × ${nextRates[rateKey]} грн`
        ),
        shiftId,
        kind
      );
      if (result.ok) {
        addExpense(result.expense);
        toast.success(`${title} збережено`);
        setBags("");
        setDraftAmount(0);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`loading-bags-${kind}`}>Кількість мішків</Label>
          <Input
            id={`loading-bags-${kind}`}
            type="number"
            min="0"
            step="1"
            placeholder="0"
            value={bags}
            onChange={(e) => setBags(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`loading-rate-${kind}`}>Ставка (грн/мішок)</Label>
          <Input
            id={`loading-rate-${kind}`}
            type="number"
            min="0"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
      </div>
      <div className="bg-muted p-4 rounded-lg space-y-1">
        <div className="text-sm text-muted-foreground">Поточний розрахунок</div>
        <div className="text-2xl font-bold">
          {calculatedAmount.toFixed(2)} грн
        </div>
        <div className="text-sm text-muted-foreground">
          {(hasValidBags ? bagsNum : 0)} міш. ×{" "}
          {(hasValidRate ? rateNum : 0)} грн/мішок
        </div>
      </div>
      <Button
        type="button"
        onClick={handleSave}
        disabled={calculatedAmount <= 0 || isSubmitting}
        aria-busy={isSubmitting}
        className="w-full sm:w-[340px]"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Збереження…
          </>
        ) : (
          `Зберегти: ${title}`
        )}
      </Button>
    </div>
  );
}

export function HourlyWageSections() {
  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Облік витрат
          </CardTitle>
          <CardDescription>
            Години × ставка × кількість працівників. Окремий запис у З.П. Погодинна.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <HourlyWageAccountingForm />
          <div>
            <h4 className="text-sm font-medium mb-2">Збережений облік</h4>
            <HourlyWageExpenseList kind="accounting" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Сума витрат
          </CardTitle>
          <CardDescription>
            Окрема сума, наприклад за вантажні роботи. Не змішується з погодинним обліком.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <HourlyWageManualForm />
          <div>
            <h4 className="text-sm font-medium mb-2">Збережені суми</h4>
            <HourlyWageExpenseList kind="manual" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Витрати за завантаження
          </CardTitle>
          <CardDescription>
            Підрахунок завантаження («З/П Підрахунок завантаження») та
            завантаження кори («З/П Завантаження кори»): мішки × ставка. Ставки
            зберігаються і підставляються наступного разу.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-6">
            <h4 className="text-sm font-medium">Підрахунок завантаження</h4>
            <LoadingBagExpenseForm kind="loading_count" />
            <div>
              <h5 className="text-sm font-medium mb-2">Збережений підрахунок</h5>
              <HourlyWageExpenseList kind="loading_count" />
            </div>
          </div>
          <div className="space-y-6">
            <h4 className="text-sm font-medium">Завантаження кори</h4>
            <LoadingBagExpenseForm kind="loading" />
            <div>
              <h5 className="text-sm font-medium mb-2">
                Збережене завантаження кори
              </h5>
              <HourlyWageExpenseList kind="loading" />
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
