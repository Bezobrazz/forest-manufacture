"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  getDubrovytsiaBalanceEntries,
  type DubrovytsiaBalanceEntry,
} from "@/app/actions/dubrovytsia-balance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatNumberWithUnit } from "@/lib/utils";
import { toast } from "sonner";

export function DubrovytsiaBalanceSection() {
  const [entries, setEntries] = useState<DubrovytsiaBalanceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Операції з банківської виписки, відправлені на Дубровицю
        </p>
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
            Поки немає записів. Відправте транзакцію з вкладки «Банківські
            транзакції».
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const isCredit = entry.transaction_type === "C";
            return (
              <Card key={entry.id}>
                <CardContent className="py-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
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
                    {entry.telegram_sent ? (
                      <Badge variant="outline">Telegram</Badge>
                    ) : (
                      <Badge variant="outline">без Telegram</Badge>
                    )}
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
    </div>
  );
}
