"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Info,
  Loader2,
  MessageSquare,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProductionInsight } from "@/lib/ai/insights-schema";
import type { AiPeriodContext } from "@/lib/ai/period-context";
import { cn } from "@/lib/utils";

type ProductionInsightsCardProps = {
  context: AiPeriodContext;
  enabled: boolean;
  onAskAboutInsight?: (insight: ProductionInsight) => void;
  onOpenChat?: () => void;
};

const severityMeta: Record<
  ProductionInsight["severity"],
  { label: string; className: string; Icon: typeof Info }
> = {
  info: {
    label: "Інфо",
    className: "border-transparent bg-secondary text-secondary-foreground",
    Icon: Info,
  },
  warning: {
    label: "Увага",
    className: "border-transparent bg-amber-100 text-amber-900",
    Icon: AlertTriangle,
  },
  critical: {
    label: "Критично",
    className: "border-transparent bg-destructive text-destructive-foreground",
    Icon: AlertTriangle,
  },
};

export function ProductionInsightsCard({
  context,
  enabled,
  onAskAboutInsight,
  onOpenChat,
}: ProductionInsightsCardProps) {
  const [insights, setInsights] = useState<ProductionInsight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedForKey, setLoadedForKey] = useState<string | null>(null);

  const contextKey = [
    context.periodStart,
    context.periodEnd,
    context.periodLabel,
    context.monthlyTaxesUah,
    context.monthlyElectricityUah,
    context.includeManagementSalaryInCost,
    context.latestPackingBagPriceUah,
  ].join("|");

  const loadInsights = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context),
      });
      const data = (await response.json().catch(() => ({}))) as {
        insights?: ProductionInsight[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Не вдалося завантажити інсайти");
      }

      setInsights(data.insights ?? []);
      setLoadedForKey(contextKey);
    } catch (err) {
      setInsights([]);
      setLoadedForKey(contextKey);
      setError(err instanceof Error ? err.message : "Помилка завантаження");
    } finally {
      setIsLoading(false);
    }
  }, [context, contextKey]);

  useEffect(() => {
    if (!enabled) return;
    if (loadedForKey === contextKey) return;
    void loadInsights();
  }, [enabled, contextKey, loadedForKey, loadInsights]);

  if (!enabled) return null;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5" />
              ШІ-інсайти виробництва
            </CardTitle>
            <CardDescription>
              Рекомендації на основі даних за період: {context.periodLabel}.
              Відповіді лише з агрегованого snapshot, без сирих таблиць.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadInsights()}
              disabled={isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Аналіз…
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Оновити
                </>
              )}
            </Button>
            {onOpenChat ? (
              <Button type="button" size="sm" onClick={onOpenChat}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Запитати асистента
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}

        {isLoading && insights.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Готуємо аналіз за обраний період…
          </div>
        ) : null}

        {!isLoading && !error && insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Інсайтів поки немає. Натисніть «Оновити».
          </p>
        ) : null}

        <ul className="space-y-3">
          {insights.map((insight, index) => {
            const meta = severityMeta[insight.severity];
            const Icon = meta.Icon;
            return (
              <li
                key={`${insight.title}-${index}`}
                className="rounded-lg border bg-card p-3"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge className={cn(meta.className)}>
                    <Icon className="mr-1 h-3 w-3" />
                    {meta.label}
                  </Badge>
                  <h3 className="text-sm font-semibold">{insight.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{insight.finding}</p>
                <p className="mt-2 text-sm">
                  <span className="font-medium">Рекомендація: </span>
                  {insight.recommendation}
                </p>
                {insight.relatedMetrics.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {insight.relatedMetrics.map((metric) => (
                      <Badge key={metric} variant="outline" className="font-normal">
                        {metric}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {onAskAboutInsight ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-8 px-2"
                    onClick={() => onAskAboutInsight(insight)}
                  >
                    <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                    Уточнити в чаті
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
