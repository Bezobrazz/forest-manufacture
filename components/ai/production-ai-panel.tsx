"use client";

import { useCallback, useEffect, useState } from "react";
import { ProductionAssistantChat } from "@/components/ai/production-assistant-chat";
import { ProductionInsightsCard } from "@/components/ai/production-insights-card";
import { canUseAiAssistant } from "@/lib/ai/access";
import type { AiPeriodContext } from "@/lib/ai/period-context";
import type { ProductionInsight } from "@/lib/ai/insights-schema";
import type { UserRole } from "@/lib/auth/roles";

type ProductionAiPanelProps = {
  context: AiPeriodContext;
  /** Поки статистика ще завантажується — не смикаємо API. */
  ready: boolean;
};

export function ProductionAiPanel({ context, ready }: ProductionAiPanelProps) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [seedQuestion, setSeedQuestion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/user/role");
        const data = (await response.json().catch(() => ({}))) as {
          role?: UserRole | null;
        };
        if (!cancelled) {
          setRole(data.role ?? null);
        }
      } catch {
        if (!cancelled) setRole(null);
      } finally {
        if (!cancelled) setRoleLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enabled = roleLoaded && canUseAiAssistant(role) && ready;

  const askAboutInsight = useCallback((insight: ProductionInsight) => {
    setSeedQuestion(
      `Поясни детальніше інсайт «${insight.title}».\nВисновок: ${insight.finding}\nРекомендація: ${insight.recommendation}\nЯкі конкретні кроки варто зробити на виробництві?`
    );
    setChatOpen(true);
  }, []);

  if (!roleLoaded || !canUseAiAssistant(role)) {
    return null;
  }

  return (
    <>
      <ProductionInsightsCard
        context={context}
        enabled={enabled}
        onAskAboutInsight={askAboutInsight}
        onOpenChat={() => setChatOpen(true)}
      />
      <ProductionAssistantChat
        open={chatOpen}
        onOpenChange={setChatOpen}
        context={context}
        seedQuestion={seedQuestion}
        onSeedConsumed={() => setSeedQuestion(null)}
      />
    </>
  );
}
