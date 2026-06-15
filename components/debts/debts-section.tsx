"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import {
  createDebt,
  createDebtRepayment,
  deleteDebt,
  deleteDebtRepayment,
  getDebtsWithRepayments,
} from "@/app/actions/debts";
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
import { cn, formatDate, formatNumberWithUnit } from "@/lib/utils";
import { uk } from "date-fns/locale";
import { toast } from "sonner";

type DebtsSectionProps = {
  isDateInRange: (date: Date) => boolean;
};

const DEBTS_PER_PAGE = 5;
const REPAYMENTS_PER_PAGE = 5;

const DIRECTION_LABELS: Record<DebtDirection, string> = {
  we_owe: "Ми винні",
  owed_to_us: "Нам винні",
};

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
  const [isLoading, setIsLoading] = useState(true);
  const [debtsPage, setDebtsPage] = useState(1);
  const [repaymentsPage, setRepaymentsPage] = useState(1);

  const [isAddDebtOpen, setIsAddDebtOpen] = useState(false);
  const [isAddDebtPending, setIsAddDebtPending] = useState(false);
  const [newCounterparty, setNewCounterparty] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDirection, setNewDirection] = useState<DebtDirection>("we_owe");
  const [newComment, setNewComment] = useState("");
  const [newDebtDate, setNewDebtDate] = useState<Date | undefined>(() => new Date());
  const [newDebtDatePickerOpen, setNewDebtDatePickerOpen] = useState(false);

  const [repaymentDialog, setRepaymentDialog] = useState<{
    isOpen: boolean;
    debt: DebtWithRepayments | null;
  }>({ isOpen: false, debt: null });
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
    repaymentId: number | null;
    amount: number;
  }>({ isOpen: false, repaymentId: null, amount: 0 });
  const [isDeleteRepaymentPending, setIsDeleteRepaymentPending] = useState(false);

  const loadDebts = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await getDebtsWithRepayments();
      setDebts(rows);
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

  const activeDebts = useMemo(
    () => debts.filter((debt) => !debt.is_closed),
    [debts]
  );

  const filteredNewDebts = useMemo(
    () =>
      debts.filter((debt) => isDateInRange(parseDebtDate(debt.debt_date))),
    [debts, isDateInRange]
  );

  const filteredRepayments = useMemo(() => {
    const rows = debts.flatMap((debt) =>
      debt.repayments.map((repayment) => ({
        repayment,
        debt,
      }))
    );
    return rows
      .filter((row) =>
        isDateInRange(parseDebtDate(row.repayment.repayment_date))
      )
      .sort(
        (a, b) =>
          parseDebtDate(b.repayment.repayment_date).getTime() -
          parseDebtDate(a.repayment.repayment_date).getTime()
      );
  }, [debts, isDateInRange]);

  const totalWeOwe = useMemo(
    () =>
      activeDebts
        .filter((debt) => debt.direction === "we_owe")
        .reduce((sum, debt) => sum + debt.remaining_amount, 0),
    [activeDebts]
  );

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
    () =>
      filteredRepayments.reduce(
        (sum, row) => sum + Number(row.repayment.amount),
        0
      ),
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
    setRepaymentDialog({ isOpen: true, debt });
    setRepaymentAmount(debt.remaining_amount.toFixed(2));
    setRepaymentComment("");
    setRepaymentDate(new Date());
  };

  const handleRepayment = async () => {
    if (!repaymentDialog.debt) return;

    const amount = Number(repaymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Помилка", { description: "Вкажіть коректну суму" });
      return;
    }

    setIsRepaymentPending(true);
    try {
      await createDebtRepayment({
        debtId: repaymentDialog.debt.id,
        amount,
        date: repaymentDate?.toISOString(),
        comment: repaymentComment,
      });
      toast.success("Погашення записано");
      setRepaymentDialog({ isOpen: false, debt: null });
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
    if (!deleteRepaymentDialog.repaymentId) return;

    setIsDeleteRepaymentPending(true);
    try {
      await deleteDebtRepayment(deleteRepaymentDialog.repaymentId);
      toast.success("Запис погашення видалено");
      setDeleteRepaymentDialog({
        isOpen: false,
        repaymentId: null,
        amount: 0,
      });
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
        ) : activeDebts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Немає активних боргів
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {paginatedActiveDebts.map((debt) => (
                <Card key={debt.id}>
                  <CardContent className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{debt.counterparty}</span>
                          <Badge variant="secondary">
                            {DIRECTION_LABELS[debt.direction]}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          від {formatDate(debt.debt_date)}
                        </p>
                        <div className="text-lg font-bold">
                          Залишок:{" "}
                          {formatNumberWithUnit(debt.remaining_amount, "₴")}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Загалом {formatNumberWithUnit(debt.amount, "₴")} ·
                          погашено {formatNumberWithUnit(debt.repaid_amount, "₴")}
                        </p>
                        {debt.comment ? (
                          <p className="text-sm text-muted-foreground pt-1">
                            {debt.comment}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => openRepaymentDialog(debt)}
                        >
                          {getRepaymentActionLabel(debt.direction)}
                        </Button>
                        {debt.repayments.length === 0 ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setDeleteDebtDialog({ isOpen: true, debt })
                            }
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        ) : null}
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
              {paginatedRepayments.map(({ repayment, debt }) => (
                <Card key={repayment.id}>
                  <CardContent className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">
                            {formatDate(repayment.repayment_date)}
                          </span>
                          <Badge variant="outline">
                            {DIRECTION_LABELS[debt.direction]}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {debt.counterparty}
                        </p>
                        <div className="text-lg font-bold">
                          {formatNumberWithUnit(Number(repayment.amount), "₴")}
                        </div>
                        {repayment.comment ? (
                          <p className="text-sm text-muted-foreground pt-1">
                            {repayment.comment}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setDeleteRepaymentDialog({
                            isOpen: true,
                            repaymentId: repayment.id,
                            amount: Number(repayment.amount),
                          })
                        }
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
        open={repaymentDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) setRepaymentDialog({ isOpen: false, debt: null });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {repaymentDialog.debt
                ? getRepaymentActionLabel(repaymentDialog.debt.direction)
                : "Погашення"}
            </DialogTitle>
            <DialogDescription>
              {repaymentDialog.debt
                ? `${repaymentDialog.debt.counterparty} · залишок ${formatNumberWithUnit(
                    repaymentDialog.debt.remaining_amount,
                    "₴"
                  )}`
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
              onClick={() => setRepaymentDialog({ isOpen: false, debt: null })}
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
                  {repaymentDialog.debt
                    ? getRepaymentPendingLabel(repaymentDialog.debt.direction)
                    : "Збереження…"}
                </>
              ) : repaymentDialog.debt ? (
                getRepaymentActionLabel(repaymentDialog.debt.direction)
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
            setDeleteRepaymentDialog({
              isOpen: false,
              repaymentId: null,
              amount: 0,
            });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Видалити погашення?</DialogTitle>
            <DialogDescription>
              Запис на {formatNumberWithUnit(deleteRepaymentDialog.amount, "₴")}{" "}
              буде видалено, залишок боргу оновиться.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setDeleteRepaymentDialog({
                  isOpen: false,
                  repaymentId: null,
                  amount: 0,
                })
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
