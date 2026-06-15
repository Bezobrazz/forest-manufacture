"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { createRawCostRepayment, deleteExpense } from "@/app/actions";
import {
  createDebt,
  createDebtRepayment,
  deleteDebt,
  deleteDebtRepayment,
  getDebtsWithRepayments,
  updateDebt,
} from "@/app/actions/debts";
import {
  getRawDeliveryDebt,
  type RawDeliveryDebtData,
} from "@/app/actions/raw-delivery-debt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { DebtDirection, DebtWithRepayments } from "@/lib/debts/types";
import {
  convertDebtAmountToUah,
  DEBT_CURRENCIES,
  DEBT_CURRENCY_LABELS,
  formatDebtCurrencyAmount,
  getDebtOriginalAmount,
  getDebtRepaidOriginal,
  getDebtRemainingOriginal,
  type DebtCurrency,
} from "@/lib/debts/currency";
import { RAW_DELIVERY_DEBT_TITLE } from "@/lib/debts/raw-delivery-debt";
import { cn, dateToYYYYMMDD, formatDate, formatNumberWithUnit } from "@/lib/utils";
import { uk } from "date-fns/locale";
import { toast } from "sonner";

type DebtsSectionProps = {
  isDateInRange: (date: Date) => boolean;
};

const DEBTS_PER_PAGE = 5;
const REPAYMENTS_PER_PAGE = 5;

type RepaymentHistoryItem =
  | {
      kind: "debt";
      id: number;
      date: string;
      amount: number;
      comment: string | null;
      debt: DebtWithRepayments;
    }
  | {
      kind: "raw-delivery";
      id: number;
      date: string;
      amount: number;
      comment: string | null;
    };

type RepaymentTarget =
  | { kind: "debt"; debt: DebtWithRepayments }
  | { kind: "raw-delivery"; remainingAmount: number };

type DeleteRepaymentTarget = {
  kind: "debt" | "raw-delivery";
  repaymentId: number;
  amount: number;
};

const DIRECTION_LABELS: Record<DebtDirection, string> = {
  we_owe: "Ми винні",
  owed_to_us: "Нам винні",
};

type DebtExchangeRates = Record<
  Exclude<DebtCurrency, "UAH">,
  { rate: number; exchangeDate: string | null }
>;

function parseDebtDate(value: string): Date {
  if (!value) return new Date();
  if (value.includes("T")) return new Date(value);
  return new Date(`${value}T12:00:00`);
}

function getRepaymentActionLabel(direction: DebtDirection): string {
  return direction === "we_owe" ? "Повернути" : "Отримати";
}

function getRepaymentPendingLabel(direction: DebtDirection): string {
  return direction === "we_owe" ? "Повернення…" : "Отримання…";
}

export function DebtsSection({ isDateInRange }: DebtsSectionProps) {
  const [debts, setDebts] = useState<DebtWithRepayments[]>([]);
  const [rawDeliveryDebt, setRawDeliveryDebt] =
    useState<RawDeliveryDebtData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [debtsPage, setDebtsPage] = useState(1);
  const [repaymentsPage, setRepaymentsPage] = useState(1);

  const [isAddDebtOpen, setIsAddDebtOpen] = useState(false);
  const [isAddDebtPending, setIsAddDebtPending] = useState(false);
  const [newCounterparty, setNewCounterparty] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCurrency, setNewCurrency] = useState<DebtCurrency>("UAH");
  const [newDirection, setNewDirection] = useState<DebtDirection>("we_owe");
  const [newComment, setNewComment] = useState("");
  const [newDebtDate, setNewDebtDate] = useState<Date | undefined>(() => new Date());
  const [newDebtDatePickerOpen, setNewDebtDatePickerOpen] = useState(false);

  const [repaymentDialog, setRepaymentDialog] = useState<{
    isOpen: boolean;
    target: RepaymentTarget | null;
  }>({ isOpen: false, target: null });
  const [repaymentAmount, setRepaymentAmount] = useState("");
  const [repaymentComment, setRepaymentComment] = useState("");
  const [repaymentDate, setRepaymentDate] = useState<Date | undefined>(() => new Date());
  const [repaymentDatePickerOpen, setRepaymentDatePickerOpen] = useState(false);
  const [isRepaymentPending, setIsRepaymentPending] = useState(false);

  const [deleteDebtDialog, setDeleteDebtDialog] = useState<{
    isOpen: boolean;
    debt: DebtWithRepayments | null;
  }>({ isOpen: false, debt: null });
  const [isDeleteDebtPending, setIsDeleteDebtPending] = useState(false);

  const [deleteRepaymentDialog, setDeleteRepaymentDialog] = useState<{
    isOpen: boolean;
    target: DeleteRepaymentTarget | null;
  }>({ isOpen: false, target: null });
  const [isDeleteRepaymentPending, setIsDeleteRepaymentPending] = useState(false);

  const [editDebtDialog, setEditDebtDialog] = useState<{
    isOpen: boolean;
    debt: DebtWithRepayments | null;
  }>({ isOpen: false, debt: null });
  const [editCounterparty, setEditCounterparty] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCurrency, setEditCurrency] = useState<DebtCurrency>("UAH");
  const [editDirection, setEditDirection] = useState<DebtDirection>("we_owe");
  const [editComment, setEditComment] = useState("");
  const [editDebtDate, setEditDebtDate] = useState<Date | undefined>();
  const [editDebtDatePickerOpen, setEditDebtDatePickerOpen] = useState(false);
  const [isEditDebtPending, setIsEditDebtPending] = useState(false);

  const [exchangeRates, setExchangeRates] = useState<DebtExchangeRates | null>(
    null
  );
  const [isExchangeRatesLoading, setIsExchangeRatesLoading] = useState(false);
  const [exchangeRatesError, setExchangeRatesError] = useState<string | null>(
    null
  );

  const loadExchangeRates = useCallback(async () => {
    setIsExchangeRatesLoading(true);
    setExchangeRatesError(null);
    try {
      const response = await fetch("/api/exchange-rate/nbu");
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        usd?: { rate?: number; exchangeDate?: string | null };
        eur?: { rate?: number; exchangeDate?: string | null };
      };
      if (!response.ok || !data.ok || !data.usd?.rate || !data.eur?.rate) {
        throw new Error(data.error ?? "Не вдалося отримати курси НБУ");
      }
      setExchangeRates({
        USD: {
          rate: data.usd.rate,
          exchangeDate: data.usd.exchangeDate ?? null,
        },
        EUR: {
          rate: data.eur.rate,
          exchangeDate: data.eur.exchangeDate ?? null,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не вдалося отримати курси НБУ";
      setExchangeRatesError(message);
      setExchangeRates(null);
    } finally {
      setIsExchangeRatesLoading(false);
    }
  }, []);

  const loadDebts = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rows, rawDebt] = await Promise.all([
        getDebtsWithRepayments(),
        getRawDeliveryDebt(),
      ]);
      setDebts(rows);
      setRawDeliveryDebt(rawDebt);
    } catch (error) {
      console.error("loadDebts:", error);
      const message =
        error instanceof Error ? error.message : "Не вдалося завантажити борги";
      toast.error("Помилка", { description: message });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDebts();
  }, [loadDebts]);

  useEffect(() => {
    if (!isAddDebtOpen && !editDebtDialog.isOpen) return;
    void loadExchangeRates();
  }, [isAddDebtOpen, editDebtDialog.isOpen, loadExchangeRates]);

  const getCurrencyPreview = (
    amountValue: string,
    currency: DebtCurrency
  ): { amountUah: number; rate: number; exchangeDate: string | null } | null => {
    if (currency === "UAH") return null;
    const amount = Number(amountValue);
    if (!Number.isFinite(amount) || amount <= 0 || !exchangeRates) return null;
    const snapshot = exchangeRates[currency];
    if (!snapshot) return null;
    return {
      amountUah: convertDebtAmountToUah(amount, currency, snapshot.rate),
      rate: snapshot.rate,
      exchangeDate: snapshot.exchangeDate,
    };
  };

  const newAmountPreview = getCurrencyPreview(newAmount, newCurrency);
  const editAmountPreview = getCurrencyPreview(editAmount, editCurrency);

  const activeDebts = useMemo(
    () => debts.filter((debt) => !debt.is_closed),
    [debts]
  );

  const hasRawDeliveryDebtActive = Boolean(
    rawDeliveryDebt &&
      !rawDeliveryDebt.isClosed &&
      rawDeliveryDebt.remainingAmountUah > 0
  );

  const hasActiveDebts = activeDebts.length > 0 || hasRawDeliveryDebtActive;

  const filteredNewDebts = useMemo(
    () =>
      debts.filter((debt) => isDateInRange(parseDebtDate(debt.debt_date))),
    [debts, isDateInRange]
  );

  const filteredRepayments = useMemo(() => {
    const debtRows: RepaymentHistoryItem[] = debts.flatMap((debt) =>
      debt.repayments.map((repayment) => ({
        kind: "debt" as const,
        id: repayment.id,
        date: repayment.repayment_date,
        amount: Number(repayment.amount),
        comment: repayment.comment,
        debt,
      }))
    );

    const rawRows: RepaymentHistoryItem[] = (rawDeliveryDebt?.repayments ?? []).map(
      (repayment) => ({
        kind: "raw-delivery" as const,
        id: repayment.id,
        date: repayment.date,
        amount: repayment.amount,
        comment: repayment.description.trim() || null,
      })
    );

    return [...debtRows, ...rawRows]
      .filter((row) => isDateInRange(parseDebtDate(row.date)))
      .sort(
        (a, b) =>
          parseDebtDate(b.date).getTime() - parseDebtDate(a.date).getTime()
      );
  }, [debts, rawDeliveryDebt, isDateInRange]);

  const totalWeOwe = useMemo(() => {
    const manualWeOwe = activeDebts
      .filter((debt) => debt.direction === "we_owe")
      .reduce((sum, debt) => sum + debt.remaining_amount, 0);
    const rawRemaining = hasRawDeliveryDebtActive
      ? (rawDeliveryDebt?.remainingAmountUah ?? 0)
      : 0;
    return manualWeOwe + rawRemaining;
  }, [activeDebts, hasRawDeliveryDebtActive, rawDeliveryDebt]);

  const totalOwedToUs = useMemo(
    () =>
      activeDebts
        .filter((debt) => debt.direction === "owed_to_us")
        .reduce((sum, debt) => sum + debt.remaining_amount, 0),
    [activeDebts]
  );

  const periodNewDebtsTotal = useMemo(
    () => filteredNewDebts.reduce((sum, debt) => sum + debt.amount, 0),
    [filteredNewDebts]
  );

  const periodRepaymentsTotal = useMemo(
    () => filteredRepayments.reduce((sum, row) => sum + row.amount, 0),
    [filteredRepayments]
  );

  const activeDebtsPages = Math.max(
    1,
    Math.ceil(activeDebts.length / DEBTS_PER_PAGE)
  );
  const paginatedActiveDebts = activeDebts.slice(
    (debtsPage - 1) * DEBTS_PER_PAGE,
    debtsPage * DEBTS_PER_PAGE
  );

  const repaymentsPages = Math.max(
    1,
    Math.ceil(filteredRepayments.length / REPAYMENTS_PER_PAGE)
  );
  const paginatedRepayments = filteredRepayments.slice(
    (repaymentsPage - 1) * REPAYMENTS_PER_PAGE,
    repaymentsPage * REPAYMENTS_PER_PAGE
  );

  useEffect(() => {
    setDebtsPage(1);
  }, [activeDebts.length]);

  useEffect(() => {
    setRepaymentsPage(1);
  }, [filteredRepayments.length]);

  const resetAddDebtForm = () => {
    setNewCounterparty("");
    setNewAmount("");
    setNewCurrency("UAH");
    setNewDirection("we_owe");
    setNewComment("");
    setNewDebtDate(new Date());
  };

  const handleAddDebt = async () => {
    const amount = Number(newAmount);
    if (!newCounterparty.trim()) {
      toast.error("Помилка", { description: "Вкажіть контрагента" });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Помилка", { description: "Вкажіть коректну суму" });
      return;
    }

    setIsAddDebtPending(true);
    try {
      await createDebt({
        counterparty: newCounterparty,
        amount,
        currency: newCurrency,
        direction: newDirection,
        date: newDebtDate?.toISOString(),
        comment: newComment,
      });
      toast.success("Борг додано");
      resetAddDebtForm();
      setIsAddDebtOpen(false);
      await loadDebts();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не вдалося додати борг";
      toast.error("Помилка", { description: message });
    } finally {
      setIsAddDebtPending(false);
    }
  };

  const openRepaymentDialog = (debt: DebtWithRepayments) => {
    setRepaymentDialog({
      isOpen: true,
      target: { kind: "debt", debt },
    });
    setRepaymentAmount(debt.remaining_amount.toFixed(2));
    setRepaymentComment("");
    setRepaymentDate(new Date());
  };

  const openRawDeliveryRepaymentDialog = () => {
    if (!rawDeliveryDebt) return;
    setRepaymentDialog({
      isOpen: true,
      target: {
        kind: "raw-delivery",
        remainingAmount: rawDeliveryDebt.remainingAmountUah,
      },
    });
    setRepaymentAmount(rawDeliveryDebt.remainingAmountUah.toFixed(2));
    setRepaymentComment("");
    setRepaymentDate(new Date());
  };

  const openEditDebtDialog = (debt: DebtWithRepayments) => {
    setEditDebtDialog({ isOpen: true, debt });
    setEditCounterparty(debt.counterparty);
    setEditAmount(String(getDebtOriginalAmount(debt)));
    setEditCurrency(debt.currency);
    setEditDirection(debt.direction);
    setEditComment(debt.comment ?? "");
    setEditDebtDate(parseDebtDate(debt.debt_date));
  };

  const handleEditDebt = async () => {
    if (!editDebtDialog.debt) return;

    const amount = Number(editAmount);
    if (!editCounterparty.trim()) {
      toast.error("Помилка", { description: "Вкажіть контрагента" });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Помилка", { description: "Вкажіть коректну суму" });
      return;
    }

    setIsEditDebtPending(true);
    try {
      await updateDebt({
        id: editDebtDialog.debt.id,
        counterparty: editCounterparty,
        amount,
        currency: editCurrency,
        direction: editDirection,
        date: editDebtDate?.toISOString(),
        comment: editComment,
      });
      toast.success("Борг оновлено");
      setEditDebtDialog({ isOpen: false, debt: null });
      await loadDebts();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не вдалося оновити борг";
      toast.error("Помилка", { description: message });
    } finally {
      setIsEditDebtPending(false);
    }
  };

  const handleRepayment = async () => {
    if (!repaymentDialog.target) return;

    const amount = Number(repaymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Помилка", { description: "Вкажіть коректну суму" });
      return;
    }

    const remainingAmount =
      repaymentDialog.target.kind === "debt"
        ? repaymentDialog.target.debt.remaining_amount
        : repaymentDialog.target.remainingAmount;

    if (amount > remainingAmount) {
      toast.error("Помилка", {
        description: `Сума перевищує залишок (${remainingAmount.toFixed(2)} ₴)`,
      });
      return;
    }

    setIsRepaymentPending(true);
    try {
      if (repaymentDialog.target.kind === "debt") {
        await createDebtRepayment({
          debtId: repaymentDialog.target.debt.id,
          amount,
          date: repaymentDate?.toISOString(),
          comment: repaymentComment,
        });
      } else {
        if (!repaymentDate) {
          toast.error("Помилка", { description: "Оберіть дату" });
          return;
        }
        const result = await createRawCostRepayment(
          dateToYYYYMMDD(repaymentDate),
          amount,
          repaymentComment
        );
        if (!result.ok) {
          toast.error("Помилка", { description: result.error });
          return;
        }
      }

      toast.success("Погашення записано");
      setRepaymentDialog({ isOpen: false, target: null });
      await loadDebts();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не вдалося записати погашення";
      toast.error("Помилка", { description: message });
    } finally {
      setIsRepaymentPending(false);
    }
  };

  const handleDeleteDebt = async () => {
    if (!deleteDebtDialog.debt) return;

    setIsDeleteDebtPending(true);
    try {
      await deleteDebt(deleteDebtDialog.debt.id);
      toast.success("Борг видалено");
      setDeleteDebtDialog({ isOpen: false, debt: null });
      await loadDebts();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не вдалося видалити борг";
      toast.error("Помилка", { description: message });
    } finally {
      setIsDeleteDebtPending(false);
    }
  };

  const handleDeleteRepayment = async () => {
    if (!deleteRepaymentDialog.target) return;

    setIsDeleteRepaymentPending(true);
    try {
      if (deleteRepaymentDialog.target.kind === "debt") {
        await deleteDebtRepayment(deleteRepaymentDialog.target.repaymentId);
      } else {
        await deleteExpense(deleteRepaymentDialog.target.repaymentId);
      }
      toast.success("Запис погашення видалено");
      setDeleteRepaymentDialog({ isOpen: false, target: null });
      await loadDebts();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Не вдалося видалити погашення";
      toast.error("Помилка", { description: message });
    } finally {
      setIsDeleteRepaymentPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Облік боргів та їх погашення
        </p>
        <Button onClick={() => setIsAddDebtOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Додати борг
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Ми винні</CardTitle>
            <p className="text-sm text-muted-foreground">Активні борги</p>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumberWithUnit(totalWeOwe, "₴")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Нам винні</CardTitle>
            <p className="text-sm text-muted-foreground">Активні борги</p>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumberWithUnit(totalOwedToUs, "₴")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Нові борги</CardTitle>
            <p className="text-sm text-muted-foreground">За обраний період</p>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumberWithUnit(periodNewDebtsTotal, "₴")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {filteredNewDebts.length} записів
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Погашення</CardTitle>
            <p className="text-sm text-muted-foreground">За обраний період</p>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumberWithUnit(periodRepaymentsTotal, "₴")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {filteredRepayments.length} записів
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Активні борги</h2>
        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Завантаження боргів…
            </CardContent>
          </Card>
        ) : !hasActiveDebts ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Немає активних боргів
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {hasRawDeliveryDebtActive && rawDeliveryDebt ? (
                <Card>
                  <CardContent className="py-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">
                              {RAW_DELIVERY_DEBT_TITLE}
                            </span>
                            <Badge variant="secondary">Ми винні</Badge>
                            <Badge variant="outline">Поїздки</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {rawDeliveryDebt.tripsCount} рейсів ·{" "}
                            {rawDeliveryDebt.bagsCount} мішків
                          </p>
                          <div className="text-lg font-bold">
                            Залишок:{" "}
                            {formatNumberWithUnit(
                              rawDeliveryDebt.remainingAmountUah,
                              "₴"
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Загалом{" "}
                            {formatNumberWithUnit(
                              rawDeliveryDebt.totalCostsUah,
                              "₴"
                            )}{" "}
                            · погашено{" "}
                            {formatNumberWithUnit(
                              rawDeliveryDebt.repaidAmountUah,
                              "₴"
                            )}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="shrink-0"
                          onClick={openRawDeliveryRepaymentDialog}
                        >
                          Повернути
                        </Button>
                      </div>
                      <div className="flex items-start justify-between gap-2 sm:gap-3">
                        <p className="text-sm text-muted-foreground min-w-0 flex-1 break-words">
                          Витрати на рейси сировини.{" "}
                          <Link
                            href="/trips"
                            className="text-foreground underline-offset-4 hover:underline"
                          >
                            Відкрити поїздки
                          </Link>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
              {paginatedActiveDebts.map((debt) => (
                <Card key={debt.id}>
                  <CardContent className="py-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{debt.counterparty}</span>
                            <Badge variant="secondary">
                              {DIRECTION_LABELS[debt.direction]}
                            </Badge>
                            {debt.currency !== "UAH" ? (
                              <Badge variant="outline">{debt.currency}</Badge>
                            ) : null}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            від {formatDate(debt.debt_date)}
                          </p>
                          <div className="text-lg font-bold">
                            Залишок:{" "}
                            {formatNumberWithUnit(debt.remaining_amount, "₴")}
                          </div>
                          {debt.currency !== "UAH" ? (
                            <p className="text-sm text-muted-foreground">
                              {formatDebtCurrencyAmount(
                                getDebtRemainingOriginal(debt),
                                debt.currency
                              )}{" "}
                              · курс {debt.exchange_rate.toFixed(2)} ₴
                            </p>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            Загалом{" "}
                            {debt.currency === "UAH"
                              ? formatNumberWithUnit(debt.amount, "₴")
                              : formatDebtCurrencyAmount(
                                  getDebtOriginalAmount(debt),
                                  debt.currency
                                )}{" "}
                            · погашено{" "}
                            {debt.currency === "UAH"
                              ? formatNumberWithUnit(debt.repaid_amount, "₴")
                              : formatDebtCurrencyAmount(
                                  getDebtRepaidOriginal(debt),
                                  debt.currency
                                )}
                            {debt.currency !== "UAH"
                              ? ` (${formatNumberWithUnit(debt.repaid_amount, "₴")})`
                              : null}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="shrink-0"
                          onClick={() => openRepaymentDialog(debt)}
                        >
                          {getRepaymentActionLabel(debt.direction)}
                        </Button>
                      </div>
                      <div className="flex items-start justify-between gap-2 sm:gap-3">
                        {debt.comment ? (
                          <p className="text-sm text-muted-foreground min-w-0 flex-1 break-words">
                            {debt.comment}
                          </p>
                        ) : (
                          <span className="flex-1" aria-hidden />
                        )}
                        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 sm:h-9 sm:w-9"
                            onClick={() => openEditDebtDialog(debt)}
                            aria-label="Редагувати борг"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {debt.repayments.length === 0 ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 sm:h-9 sm:w-9"
                              onClick={() =>
                                setDeleteDebtDialog({ isOpen: true, debt })
                              }
                              aria-label="Видалити борг"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {activeDebtsPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Показано {paginatedActiveDebts.length} з {activeDebts.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDebtsPage((page) => Math.max(1, page - 1))}
                    disabled={debtsPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    {debtsPage} / {activeDebtsPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDebtsPage((page) =>
                        Math.min(activeDebtsPages, page + 1)
                      )
                    }
                    disabled={debtsPage === activeDebtsPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Історія погашень</h2>
        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Завантаження…
            </CardContent>
          </Card>
        ) : filteredRepayments.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Немає погашень за обраний період
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {paginatedRepayments.map((item) => (
                <Card key={`${item.kind}-${item.id}`}>
                  <CardContent className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">
                            {formatDate(item.date)}
                          </span>
                          {item.kind === "raw-delivery" ? (
                            <Badge variant="outline">Доставка сировини</Badge>
                          ) : (
                            <Badge variant="outline">
                              {DIRECTION_LABELS[item.debt.direction]}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {item.kind === "raw-delivery"
                            ? RAW_DELIVERY_DEBT_TITLE
                            : item.debt.counterparty}
                        </p>
                        <div className="text-lg font-bold">
                          {formatNumberWithUnit(item.amount, "₴")}
                        </div>
                        {item.comment ? (
                          <p className="text-sm text-muted-foreground pt-1 break-words">
                            {item.comment}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() =>
                          setDeleteRepaymentDialog({
                            isOpen: true,
                            target: {
                              kind: item.kind,
                              repaymentId: item.id,
                              amount: item.amount,
                            },
                          })
                        }
                        aria-label="Видалити погашення"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {repaymentsPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Показано {paginatedRepayments.length} з{" "}
                  {filteredRepayments.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setRepaymentsPage((page) => Math.max(1, page - 1))
                    }
                    disabled={repaymentsPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    {repaymentsPage} / {repaymentsPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setRepaymentsPage((page) =>
                        Math.min(repaymentsPages, page + 1)
                      )
                    }
                    disabled={repaymentsPage === repaymentsPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog
        open={isAddDebtOpen}
        onOpenChange={(open) => {
          setIsAddDebtOpen(open);
          if (!open) resetAddDebtForm();
          if (open) setNewDebtDate(new Date());
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новий борг</DialogTitle>
            <DialogDescription>
              Зафіксуйте борг — ми винні або нам винні
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="debt-counterparty">Контрагент</Label>
              <Input
                id="debt-counterparty"
                value={newCounterparty}
                onChange={(e) => setNewCounterparty(e.target.value)}
                placeholder="Ім'я або назва"
              />
            </div>
            <div className="space-y-2">
              <Label>Тип боргу</Label>
              <Select
                value={newDirection}
                onValueChange={(value) =>
                  setNewDirection(value as DebtDirection)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="we_owe">Ми винні</SelectItem>
                  <SelectItem value="owed_to_us">Нам винні</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Дата</Label>
              <Popover
                open={newDebtDatePickerOpen}
                onOpenChange={setNewDebtDatePickerOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !newDebtDate && "text-muted-foreground"
                    )}
                  >
                    {newDebtDate ? formatDate(newDebtDate.toISOString()) : "Оберіть дату"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={newDebtDate}
                    onSelect={(date) => {
                      setNewDebtDate(date);
                      setNewDebtDatePickerOpen(false);
                    }}
                    locale={uk}
                    weekStartsOn={1}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Валюта</Label>
              <Select
                value={newCurrency}
                onValueChange={(value) => setNewCurrency(value as DebtCurrency)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEBT_CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {DEBT_CURRENCY_LABELS[currency]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-amount">Сума</Label>
              <Input
                id="debt-amount"
                type="number"
                min="0"
                step="0.01"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="0.00"
              />
              {newCurrency !== "UAH" ? (
                <div className="text-xs text-muted-foreground space-y-1">
                  {isExchangeRatesLoading ? (
                    <p>Завантаження курсу НБУ…</p>
                  ) : exchangeRatesError ? (
                    <p className="text-destructive">{exchangeRatesError}</p>
                  ) : newAmountPreview ? (
                    <p>
                      ≈ {formatNumberWithUnit(newAmountPreview.amountUah, "₴")} (курс
                      НБУ {newAmountPreview.rate.toFixed(2)} ₴/
                      {newCurrency === "USD" ? "$" : "€"}
                      {newAmountPreview.exchangeDate
                        ? ` · ${newAmountPreview.exchangeDate}`
                        : ""}
                      )
                    </p>
                  ) : (
                    <p>Вкажіть суму для перерахунку в гривню</p>
                  )}
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-comment">Коментар</Label>
              <Textarea
                id="debt-comment"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={2}
                placeholder="Необов'язково"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDebtOpen(false)}
              disabled={isAddDebtPending}
            >
              Скасувати
            </Button>
            <Button
              onClick={() => void handleAddDebt()}
              disabled={isAddDebtPending}
              aria-busy={isAddDebtPending}
            >
              {isAddDebtPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Створення…
                </>
              ) : (
                "Додати"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editDebtDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) setEditDebtDialog({ isOpen: false, debt: null });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редагувати борг</DialogTitle>
            <DialogDescription>
              {editDebtDialog.debt && editDebtDialog.debt.repaid_amount > 0
                ? `Погашено ${formatNumberWithUnit(
                    editDebtDialog.debt.repaid_amount,
                    "₴"
                  )} — сума не може бути меншою`
                : "Змініть дані боргу"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-debt-counterparty">Контрагент</Label>
              <Input
                id="edit-debt-counterparty"
                value={editCounterparty}
                onChange={(e) => setEditCounterparty(e.target.value)}
                placeholder="Ім'я або назва"
              />
            </div>
            <div className="space-y-2">
              <Label>Тип боргу</Label>
              <Select
                value={editDirection}
                onValueChange={(value) =>
                  setEditDirection(value as DebtDirection)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="we_owe">Ми винні</SelectItem>
                  <SelectItem value="owed_to_us">Нам винні</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Дата</Label>
              <Popover
                open={editDebtDatePickerOpen}
                onOpenChange={setEditDebtDatePickerOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !editDebtDate && "text-muted-foreground"
                    )}
                  >
                    {editDebtDate
                      ? formatDate(editDebtDate.toISOString())
                      : "Оберіть дату"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={editDebtDate}
                    onSelect={(date) => {
                      setEditDebtDate(date);
                      setEditDebtDatePickerOpen(false);
                    }}
                    locale={uk}
                    weekStartsOn={1}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Валюта</Label>
              <Select
                value={editCurrency}
                onValueChange={(value) => setEditCurrency(value as DebtCurrency)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEBT_CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {DEBT_CURRENCY_LABELS[currency]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-debt-amount">Сума</Label>
              <Input
                id="edit-debt-amount"
                type="number"
                min="0"
                step="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                placeholder="0.00"
              />
              {editCurrency !== "UAH" ? (
                <div className="text-xs text-muted-foreground space-y-1">
                  {isExchangeRatesLoading ? (
                    <p>Завантаження курсу НБУ…</p>
                  ) : exchangeRatesError ? (
                    <p className="text-destructive">{exchangeRatesError}</p>
                  ) : editAmountPreview ? (
                    <p>
                      ≈ {formatNumberWithUnit(editAmountPreview.amountUah, "₴")} (курс
                      НБУ {editAmountPreview.rate.toFixed(2)} ₴/
                      {editCurrency === "USD" ? "$" : "€"}
                      {editAmountPreview.exchangeDate
                        ? ` · ${editAmountPreview.exchangeDate}`
                        : ""}
                      )
                    </p>
                  ) : (
                    <p>Вкажіть суму для перерахунку в гривню</p>
                  )}
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-debt-comment">Коментар</Label>
              <Textarea
                id="edit-debt-comment"
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                rows={2}
                placeholder="Необов'язково"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDebtDialog({ isOpen: false, debt: null })}
              disabled={isEditDebtPending}
            >
              Скасувати
            </Button>
            <Button
              onClick={() => void handleEditDebt()}
              disabled={isEditDebtPending}
              aria-busy={isEditDebtPending}
            >
              {isEditDebtPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Збереження…
                </>
              ) : (
                "Зберегти"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={repaymentDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) setRepaymentDialog({ isOpen: false, target: null });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {repaymentDialog.target?.kind === "raw-delivery"
                ? "Повернути"
                : repaymentDialog.target?.kind === "debt"
                  ? getRepaymentActionLabel(repaymentDialog.target.debt.direction)
                  : "Погашення"}
            </DialogTitle>
            <DialogDescription>
              {repaymentDialog.target?.kind === "raw-delivery"
                ? `${RAW_DELIVERY_DEBT_TITLE} · залишок ${formatNumberWithUnit(
                    repaymentDialog.target.remainingAmount,
                    "₴"
                  )}`
                : repaymentDialog.target?.kind === "debt"
                  ? `${repaymentDialog.target.debt.counterparty} · залишок ${formatNumberWithUnit(
                      repaymentDialog.target.debt.remaining_amount,
                      "₴"
                    )}${
                      repaymentDialog.target.debt.currency !== "UAH"
                        ? ` (${formatDebtCurrencyAmount(
                            getDebtRemainingOriginal(
                              repaymentDialog.target.debt
                            ),
                            repaymentDialog.target.debt.currency
                          )})`
                        : ""
                    }`
                  : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Дата</Label>
              <Popover
                open={repaymentDatePickerOpen}
                onOpenChange={setRepaymentDatePickerOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !repaymentDate && "text-muted-foreground"
                    )}
                  >
                    {repaymentDate
                      ? formatDate(repaymentDate.toISOString())
                      : "Оберіть дату"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={repaymentDate}
                    onSelect={(date) => {
                      setRepaymentDate(date);
                      setRepaymentDatePickerOpen(false);
                    }}
                    locale={uk}
                    weekStartsOn={1}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="repayment-amount">Сума</Label>
              <Input
                id="repayment-amount"
                type="number"
                min="0"
                step="0.01"
                value={repaymentAmount}
                onChange={(e) => setRepaymentAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repayment-comment">Коментар</Label>
              <Textarea
                id="repayment-comment"
                value={repaymentComment}
                onChange={(e) => setRepaymentComment(e.target.value)}
                rows={2}
                placeholder="Необов'язково"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRepaymentDialog({ isOpen: false, target: null })}
              disabled={isRepaymentPending}
            >
              Скасувати
            </Button>
            <Button
              onClick={() => void handleRepayment()}
              disabled={isRepaymentPending}
              aria-busy={isRepaymentPending}
            >
              {isRepaymentPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {repaymentDialog.target?.kind === "debt"
                    ? getRepaymentPendingLabel(
                        repaymentDialog.target.debt.direction
                      )
                    : "Повернення…"}
                </>
              ) : repaymentDialog.target?.kind === "raw-delivery" ? (
                "Повернути"
              ) : repaymentDialog.target?.kind === "debt" ? (
                getRepaymentActionLabel(repaymentDialog.target.debt.direction)
              ) : (
                "Зберегти"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteDebtDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) setDeleteDebtDialog({ isOpen: false, debt: null });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Видалити борг?</DialogTitle>
            <DialogDescription>
              {deleteDebtDialog.debt
                ? `Борг «${deleteDebtDialog.debt.counterparty}» на ${formatNumberWithUnit(
                    deleteDebtDialog.debt.amount,
                    "₴"
                  )} буде видалено безповоротно.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDebtDialog({ isOpen: false, debt: null })}
              disabled={isDeleteDebtPending}
            >
              Скасувати
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteDebt()}
              disabled={isDeleteDebtPending}
              aria-busy={isDeleteDebtPending}
            >
              {isDeleteDebtPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Видалення…
                </>
              ) : (
                "Видалити"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteRepaymentDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteRepaymentDialog({ isOpen: false, target: null });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Видалити погашення?</DialogTitle>
            <DialogDescription>
              Запис на{" "}
              {formatNumberWithUnit(
                deleteRepaymentDialog.target?.amount ?? 0,
                "₴"
              )}{" "}
              буде видалено, залишок боргу оновиться.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setDeleteRepaymentDialog({ isOpen: false, target: null })
              }
              disabled={isDeleteRepaymentPending}
            >
              Скасувати
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteRepayment()}
              disabled={isDeleteRepaymentPending}
              aria-busy={isDeleteRepaymentPending}
            >
              {isDeleteRepaymentPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Видалення…
                </>
              ) : (
                "Видалити"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
