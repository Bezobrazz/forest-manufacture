"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  getFundTransfers,
  pullFundTransfersFromKeepin,
} from "@/app/actions/fund-transfers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getFundTransferDisplayComment,
  getFundTransferRouteLabel,
} from "@/lib/crm/keepincrm/fund-transfer-config";
import type { FundTransfer } from "@/lib/types";
import { formatDate, formatNumberWithUnit } from "@/lib/utils";
import { toast } from "sonner";

type FundTransfersSectionProps = {
  isDateInRange: (date: Date) => boolean;
};

const TRANSFERS_PER_PAGE = 5;

function parseTransferDate(value: string): Date {
  if (!value) return new Date();
  if (value.includes("T")) return new Date(value);
  return new Date(`${value}T12:00:00`);
}

export function FundTransfersSection({ isDateInRange }: FundTransfersSectionProps) {
  const routeLabel = getFundTransferRouteLabel();
  const [transfers, setTransfers] = useState<FundTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const loadTransfers = useCallback(async () => {
    setIsLoading(true);
    try {
      await pullFundTransfersFromKeepin();
      const rows = await getFundTransfers();
      setTransfers(rows);
    } catch (error) {
      console.error("loadTransfers:", error);
      toast.error("Помилка", {
        description: "Не вдалося завантажити переміщення коштів з KeepinCRM",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTransfers();
  }, [loadTransfers]);

  const filteredTransfers = useMemo(
    () =>
      transfers.filter((transfer) =>
        isDateInRange(parseTransferDate(transfer.transferred_at))
      ),
    [transfers, isDateInRange]
  );

  const totalAmount = useMemo(
    () => filteredTransfers.reduce((sum, row) => sum + Number(row.amount), 0),
    [filteredTransfers]
  );

  const totalPages = Math.max(1, Math.ceil(filteredTransfers.length / TRANSFERS_PER_PAGE));
  const paginatedTransfers = filteredTransfers.slice(
    (currentPage - 1) * TRANSFERS_PER_PAGE,
    currentPage * TRANSFERS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredTransfers.length]);

  return (
    <div className="space-y-4 mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Переміщення коштів</h2>
          <p className="text-sm text-muted-foreground">
            {routeLabel} · дані з KeepinCRM
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void loadTransfers()}
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Оновлення…
            </>
          ) : (
            "Оновити з CRM"
          )}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Переміщення коштів</CardTitle>
          <p className="text-sm text-muted-foreground">{routeLabel}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-2xl font-bold">
              {formatNumberWithUnit(totalAmount, "₴")}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredTransfers.length} переміщень за період
            </p>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Завантаження переміщень…
          </CardContent>
        </Card>
      ) : filteredTransfers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Немає переміщень за обраний період. Створіть transfer у KeepinCRM між
            цими гаманцями.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {paginatedTransfers.map((transfer) => {
              const displayComment = getFundTransferDisplayComment(transfer.comment);
              return (
                <Card key={transfer.id}>
                  <CardContent className="py-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {formatDate(transfer.transferred_at)}
                        </span>
                        <Badge variant="secondary">CRM</Badge>
                      </div>
                      <div className="text-lg font-bold">
                        {formatNumberWithUnit(Number(transfer.amount), "₴")}
                      </div>
                      {displayComment && (
                        <p className="text-sm text-muted-foreground">{displayComment}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Показано {paginatedTransfers.length} з {filteredTransfers.length}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
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
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
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
