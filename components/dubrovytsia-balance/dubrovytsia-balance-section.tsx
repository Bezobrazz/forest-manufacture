"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  createDubrovytsiaBalanceEntry,
  deleteDubrovytsiaBalanceEntry,
  getDubrovytsiaBalanceEntries,
  updateDubrovytsiaBalanceEntry,
  type DubrovytsiaBalanceEntry,
} from "@/app/actions/dubrovytsia-balance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  cn,
  dateToYYYYMMDD,
  formatDate,
  formatNumberWithUnit,
} from "@/lib/utils";
import { uk } from "date-fns/locale";
import { toast } from "sonner";

type EntryFormState = {
  amount: string;
  comment: string;
  counterpartName: string;
  transactionType: "C" | "D";
  transactionDate: Date | undefined;
};

const emptyForm = (): EntryFormState => ({
  amount: "",
  comment: "",
  counterpartName: "",
  transactionType: "D",
  transactionDate: new Date(),
});

function entryToForm(entry: DubrovytsiaBalanceEntry): EntryFormState {
  const [y, m, d] = entry.transaction_date.split("-").map(Number);
  return {
    amount: String(Number(entry.amount)),
    comment: entry.comment,
    counterpartName: entry.counterpart_name ?? "",
    transactionType: entry.transaction_type,
    transactionDate:
      Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)
        ? new Date(y, m - 1, d)
        : new Date(),
  };
}

export function DubrovytsiaBalanceSection() {
  const [entries, setEntries] = useState<DubrovytsiaBalanceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<DubrovytsiaBalanceEntry | null>(
    null
  );
  const [deleteEntry, setDeleteEntry] =
    useState<DubrovytsiaBalanceEntry | null>(null);
  const [form, setForm] = useState<EntryFormState>(emptyForm);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await getDubrovytsiaBalanceEntries();
      setEntries(rows);
    } catch (error) {
      console.error("loadDubrovytsiaBalanceEntries:", error);
      toast.error("Помилка", {
        description:
          error instanceof Error
            ? error.message
            : "Не вдалося завантажити баланс Дубровиця",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const total = useMemo(() => {
    const sum = entries.reduce(
      (acc, row) => acc + (Number(row.amount) || 0),
      0
    );
    return Math.round(sum * 100) / 100;
  }, [entries]);

  const openCreate = () => {
    setForm(emptyForm());
    setIsCreateOpen(true);
  };

  const openEdit = (entry: DubrovytsiaBalanceEntry) => {
    setForm(entryToForm(entry));
    setEditEntry(entry);
  };

  const closeFormDialogs = () => {
    if (isSaving) return;
    setIsCreateOpen(false);
    setEditEntry(null);
    setDatePickerOpen(false);
  };

  const handleSave = async () => {
    if (isSaving) return;
    const amount = Number(form.amount.replace(",", "."));
    if (!form.transactionDate) {
      toast.error("Оберіть дату");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        amount,
        transactionType: form.transactionType,
        transactionDate: dateToYYYYMMDD(form.transactionDate),
        comment: form.comment,
        counterpartName: form.counterpartName.trim() || null,
      };

      const result = editEntry
        ? await updateDubrovytsiaBalanceEntry({ id: editEntry.id, ...payload })
        : await createDubrovytsiaBalanceEntry(payload);

      if (!result.ok) {
        toast.error("Не збережено", { description: result.error });
        return;
      }

      toast.success(editEntry ? "Запис оновлено" : "Запис створено");
      setIsCreateOpen(false);
      setEditEntry(null);
      await loadEntries();
    } catch (error) {
      toast.error("Помилка", {
        description:
          error instanceof Error ? error.message : "Не вдалося зберегти",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteEntry || isDeleting) return;
    setIsDeleting(true);
    try {
      const result = await deleteDubrovytsiaBalanceEntry(deleteEntry.id);
      if (!result.ok) {
        toast.error("Не видалено", { description: result.error });
        return;
      }
      toast.success("Запис видалено");
      setDeleteEntry(null);
      await loadEntries();
    } catch (error) {
      toast.error("Помилка", {
        description:
          error instanceof Error ? error.message : "Не вдалося видалити",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formDialogOpen = isCreateOpen || Boolean(editEntry);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Операції балансу Дубровиця
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void loadEntries()}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Оновлення…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Оновити
              </>
            )}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Додати
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Разом
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {formatNumberWithUnit(total, "₴")}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {entries.length} записів
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Завантаження…
          </CardContent>
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Поки немає записів. Додайте вручну або відправте з вкладки
            «Банківські транзакції».
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const isCredit = entry.transaction_type === "C";
            return (
              <Card key={entry.id}>
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="font-medium">
                        {formatDate(`${entry.transaction_date}T12:00:00`)}
                      </span>
                      <Badge variant={isCredit ? "default" : "secondary"}>
                        {isCredit ? (
                          <span className="inline-flex items-center gap-1">
                            <ArrowDownLeft className="h-3 w-3" />
                            Надходження
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <ArrowUpRight className="h-3 w-3" />
                            Списання
                          </span>
                        )}
                      </Badge>
                      {entry.bank_transaction_id.startsWith("manual-") ? (
                        <Badge variant="outline">Вручну</Badge>
                      ) : entry.telegram_sent ? (
                        <Badge variant="outline">Telegram</Badge>
                      ) : (
                        <Badge variant="outline">Банк</Badge>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Редагувати"
                        onClick={() => openEdit(entry)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Видалити"
                        onClick={() => setDeleteEntry(entry)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div
                    className={`text-lg font-bold ${
                      isCredit ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {isCredit ? "+" : "−"}
                    {formatNumberWithUnit(Number(entry.amount), "₴")}
                  </div>

                  <p className="text-sm whitespace-pre-wrap">{entry.comment}</p>

                  {entry.counterpart_name ? (
                    <p className="text-sm text-muted-foreground">
                      {entry.counterpart_name}
                    </p>
                  ) : null}

                  {entry.account_label ? (
                    <p className="text-xs text-muted-foreground">
                      {entry.account_label}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={formDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeFormDialogs();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editEntry ? "Редагувати запис" : "Новий запис"}
            </DialogTitle>
            <DialogDescription>
              {editEntry
                ? "Оновіть дані балансу Дубровиця"
                : "Додайте операцію до балансу Дубровиця"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Тип</Label>
              <Select
                value={form.transactionType}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    transactionType: value as "C" | "D",
                  }))
                }
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="D">Списання</SelectItem>
                  <SelectItem value="C">Надходження</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Дата</Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSaving}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.transactionDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {form.transactionDate
                      ? formatDate(form.transactionDate.toISOString())
                      : "Оберіть дату"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={form.transactionDate}
                    onSelect={(date) => {
                      setForm((prev) => ({ ...prev, transactionDate: date }));
                      setDatePickerOpen(false);
                    }}
                    locale={uk}
                    weekStartsOn={1}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dubrovytsia-amount">Сума</Label>
              <Input
                id="dubrovytsia-amount"
                type="number"
                inputMode="decimal"
                value={form.amount}
                disabled={isSaving}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, amount: e.target.value }))
                }
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dubrovytsia-comment">Коментар</Label>
              <Textarea
                id="dubrovytsia-comment"
                value={form.comment}
                disabled={isSaving}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, comment: e.target.value }))
                }
                rows={3}
                placeholder="Наприклад: Гроші на сировину"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dubrovytsia-counterpart">Контрагент</Label>
              <Input
                id="dubrovytsia-counterpart"
                value={form.counterpartName}
                disabled={isSaving}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    counterpartName: e.target.value,
                  }))
                }
                placeholder="Необовʼязково"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={closeFormDialogs}
            >
              Скасувати
            </Button>
            <Button
              type="button"
              disabled={isSaving}
              aria-busy={isSaving}
              onClick={() => void handleSave()}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Збереження…
                </>
              ) : editEntry ? (
                "Зберегти"
              ) : (
                "Створити"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteEntry)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteEntry(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Видалити запис?</DialogTitle>
            <DialogDescription>
              {deleteEntry
                ? `${formatDate(`${deleteEntry.transaction_date}T12:00:00`)} · ${formatNumberWithUnit(Number(deleteEntry.amount), "₴")}`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => setDeleteEntry(null)}
            >
              Скасувати
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              aria-busy={isDeleting}
              onClick={() => void handleDelete()}
            >
              {isDeleting ? (
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
