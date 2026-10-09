"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { getBankTransactions } from "@/app/actions/bank-transactions";
import { submitBankTransactionToDubrovytsia } from "@/app/actions/dubrovytsia-balance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  BankAccountBalance,
  BankTransaction,
  PrivatAccount,
} from "@/lib/bank/privatbank/types";
import { cn, dateToYYYYMMDD, formatDate, formatNumberWithUnit } from "@/lib/utils";
import { toast } from "sonner";

type BankTransactionsSectionProps = {
  startDate: Date;
  endDate: Date;
};

const TX_PER_PAGE = 10;
const ALL_ACCOUNTS = "__all__";

const COMMENT_TAGS = [
  "Гроші на сировину",
  "Гроші на заробітну плату",
] as const;

function defaultAmountComment(amount: number): string {
  return formatNumberWithUnit(amount, "₴");
}

function commentWithTag(tag: string, amount: number): string {
  return `${tag}\n${defaultAmountComment(amount)}`;
}

export function BankTransactionsSection({
  startDate,
  endDate,
}: BankTransactionsSectionProps) {
  const startYmd = dateToYYYYMMDD(startDate);
  const endYmd = dateToYYYYMMDD(endDate);

  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [balances, setBalances] = useState<BankAccountBalance[]>([]);
  const [accounts, setAccounts] = useState<PrivatAccount[]>([]);
  const [accountFilter, setAccountFilter] = useState<string>(ALL_ACCOUNTS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMovementOpen, setIsMovementOpen] = useState(false);

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getBankTransactions({
        startYmd,
        endYmd,
        accountIban:
          accountFilter === ALL_ACCOUNTS ? null : accountFilter,
      });

      if (result.accounts.length > 0) {
        setAccounts(result.accounts);
      }
      setBalances(result.balances);

      if (!result.ok) {
        setTransactions([]);
        setError(result.error);
        toast.error("Банк", { description: result.error });
        return;
      }

      setTransactions(result.transactions);
    } catch (err) {
      console.error("loadBankTransactions:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Не вдалося завантажити транзакції";
      setTransactions([]);
      setBalances([]);
      setError(message);
      toast.error("Помилка", { description: message });
    } finally {
      setIsLoading(false);
    }
  }, [startYmd, endYmd, accountFilter]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    setCurrentPage(1);
  }, [startYmd, endYmd, accountFilter, transactions.length]);

  const totals = useMemo(() => {
    let incoming = 0;
    let outgoing = 0;
    for (const tx of transactions) {
      if (tx.type === "C") incoming += tx.amountUah;
      else outgoing += tx.amountUah;
    }
    return {
      incoming: Math.round(incoming * 100) / 100,
      outgoing: Math.round(outgoing * 100) / 100,
      net: Math.round((incoming - outgoing) * 100) / 100,
    };
  }, [transactions]);

  const accountBalanceTotal = useMemo(() => {
    const sum = balances.reduce((acc, row) => acc + row.balance, 0);
    return Math.round(sum * 100) / 100;
  }, [balances]);

  const balanceAsOfLabel = useMemo(() => {
    const dates = balances
      .map((row) => row.asOfDate)
      .filter((value): value is string => Boolean(value))
      .sort();
    if (dates.length === 0) return null;
    const latest = dates[dates.length - 1];
    return formatDate(`${latest}T12:00:00`);
  }, [balances]);

  const totalPages = Math.max(1, Math.ceil(transactions.length / TX_PER_PAGE));
  const paginated = transactions.slice(
    (currentPage - 1) * TX_PER_PAGE,
    currentPage * TX_PER_PAGE
  );

  const periodLabel =
    startYmd === endYmd
      ? formatDate(startDate.toISOString())
      : `${formatDate(startDate.toISOString())} – ${formatDate(endDate.toISOString())}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            ПриватБанк · виписка за {periodLabel}
          </p>
          {accounts.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {accounts.map((a) => a.label).join(" · ")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {accounts.length > 1 ? (
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Рахунок" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ACCOUNTS}>Усі рахунки</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.iban} value={account.iban}>
                    {account.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <Button
            variant="outline"
            onClick={() => void loadTransactions()}
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
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Залишок на рахунку
          </CardTitle>
        </CardHeader>
        <CardContent>
          {balances.length === 0 && isLoading ? (
            <div className="flex items-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Завантаження…
            </div>
          ) : balances.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Залишок недоступний
            </p>
          ) : (
            <div className="space-y-1">
              <div className="text-3xl font-bold">
                {formatNumberWithUnit(accountBalanceTotal, "₴")}
              </div>
              <p className="text-xs text-muted-foreground">
                Дані з ПриватБанку
                {balanceAsOfLabel ? ` · станом на ${balanceAsOfLabel}` : ""}
                {balances.length > 1
                  ? ` · ${balances.length} рахунки`
                  : balances[0]?.accountLabel
                    ? ` · ${balances[0].accountLabel}`
                    : ""}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Desktop: завжди видно */}
      <div className="hidden md:grid gap-4 md:grid-cols-3">
        <MovementSummaryCards
          incoming={totals.incoming}
          outgoing={totals.outgoing}
          net={totals.net}
          transactionsCount={transactions.length}
        />
      </div>

      {/* Mobile: згорнуто за тонкою кнопкою */}
      <Collapsible
        open={isMovementOpen}
        onOpenChange={setIsMovementOpen}
        className="md:hidden space-y-2"
      >
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-8 w-full justify-between px-3 text-xs font-medium text-muted-foreground"
            aria-expanded={isMovementOpen}
          >
            <span>
              {isMovementOpen
                ? "Сховати рух коштів"
                : "Показати рух коштів за період"}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 transition-transform",
                isMovementOpen && "rotate-180"
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2">
          <div className="grid gap-2">
            <MovementSummaryCards
              incoming={totals.incoming}
              outgoing={totals.outgoing}
              net={totals.net}
              transactionsCount={transactions.length}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Завантаження банківських транзакцій…
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {error}
          </CardContent>
        </Card>
      ) : transactions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Немає операцій за обраний період.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((tx) => (
              <TransactionCard key={tx.id} tx={tx} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Показано {paginated.length} з {transactions.length}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MovementSummaryCards({
  incoming,
  outgoing,
  net,
  transactionsCount,
}: {
  incoming: number;
  outgoing: number;
  net: number;
  transactionsCount: number;
}) {
  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Надходження
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-700">
            +{formatNumberWithUnit(incoming, "₴")}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Списання
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-700">
            −{formatNumberWithUnit(outgoing, "₴")}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Баланс руху
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {net >= 0 ? "+" : "−"}
            {formatNumberWithUnit(Math.abs(net), "₴")}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {transactionsCount} операцій за період
          </p>
        </CardContent>
      </Card>
    </>
  );
}

function TransactionCard({ tx }: { tx: BankTransaction }) {
  const isCredit = tx.type === "C";
  const amountComment = defaultAmountComment(tx.amountUah);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [comment, setComment] = useState(amountComment);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenChange = (open: boolean) => {
    if (isSubmitting && open) return;
    setIsDialogOpen(open);
    if (open) {
      setComment(amountComment);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await submitBankTransactionToDubrovytsia({
        bankTransactionId: tx.id,
        amount: tx.amountUah,
        currency: tx.currency || "UAH",
        transactionType: tx.type,
        transactionDate: tx.date,
        counterpartName: tx.counterpartName,
        purpose: tx.purpose,
        comment,
        accountIban: tx.accountIban,
        accountLabel: tx.accountLabel,
      });

      if (!result.ok) {
        toast.error("Не відправлено", { description: result.error });
        return;
      }

      toast.success("Додано до балансу Дубровиця", {
        description: result.telegramSent
          ? "Повідомлення надіслано в Telegram"
          : "Запис збережено, але Telegram не надіслано",
      });
      setIsDialogOpen(false);
    } catch (error) {
      console.error("submitBankTransactionToDubrovytsia:", error);
      toast.error("Помилка", {
        description:
          error instanceof Error ? error.message : "Не вдалося відправити",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="flex items-stretch gap-0">
            <div className="min-w-0 flex-1 space-y-1 p-4 pr-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {formatDate(`${tx.date}T12:00:00`)}
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
              </div>

              {tx.accountLabel ? (
                <Badge variant="outline" className="max-w-full truncate">
                  <Building2 className="mr-1 h-3 w-3 shrink-0" />
                  {tx.accountLabel}
                </Badge>
              ) : null}

              {tx.counterpartName ? (
                <p className="text-sm font-medium truncate">
                  {tx.counterpartName}
                </p>
              ) : null}

              {tx.purpose ? (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {tx.purpose}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {tx.documentNumber ? <span>№ {tx.documentNumber}</span> : null}
                {tx.counterpartEdrpou ? (
                  <span>ЄДРПОУ {tx.counterpartEdrpou}</span>
                ) : null}
                {tx.currency && tx.currency !== "UAH" ? (
                  <span>{tx.currency}</span>
                ) : null}
              </div>

              <div
                className={`pt-2 text-lg font-bold ${
                  isCredit ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {isCredit ? "+" : "−"}
                {formatNumberWithUnit(tx.amountUah, "₴")}
              </div>
            </div>

            <div className="flex w-[4.5rem] shrink-0 border-l p-2 sm:w-24">
              <Button
                type="button"
                variant="outline"
                aria-label="Обробити транзакцію"
                className="h-full min-h-[7.5rem] w-full rounded-md"
                onClick={() => handleOpenChange(true)}
              >
                <ArrowRight className="h-7 w-7 sm:h-8 sm:w-8" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>На баланс Дубровиця</DialogTitle>
            <DialogDescription>
              {formatDate(`${tx.date}T12:00:00`)} ·{" "}
              {isCredit ? "+" : "−"}
              {formatNumberWithUnit(tx.amountUah, "₴")}
              {tx.counterpartName ? ` · ${tx.counterpartName}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {COMMENT_TAGS.map((tag) => {
                const tagged = commentWithTag(tag, tx.amountUah);
                const isActive = comment === tagged;
                return (
                  <Button
                    key={tag}
                    type="button"
                    size="sm"
                    variant={isActive ? "default" : "outline"}
                    disabled={isSubmitting}
                    onClick={() => setComment(tagged)}
                  >
                    {tag}
                  </Button>
                );
              })}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`bank-tx-comment-${tx.id}`}>Коментар</Label>
              <Textarea
                id={`bank-tx-comment-${tx.id}`}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Сума підставляється автоматично"
                rows={3}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Скасувати
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting || !comment.trim()}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Відправлення…
                </>
              ) : (
                "Відправити"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
