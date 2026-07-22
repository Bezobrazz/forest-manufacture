"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AiPeriodContext } from "@/lib/ai/period-context";
import { cn } from "@/lib/utils";

type ProductionAssistantChatProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: AiPeriodContext;
  seedQuestion?: string | null;
  onSeedConsumed?: () => void;
};

export function ProductionAssistantChat({
  open,
  onOpenChange,
  context,
  seedQuestion,
  onSeedConsumed,
}: ProductionAssistantChatProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
    isLoading,
    error,
    setMessages,
  } = useChat({
    api: "/api/ai/chat",
    body: {
      periodStart: context.periodStart,
      periodEnd: context.periodEnd,
      periodLabel: context.periodLabel,
      monthlyTaxesUah: context.monthlyTaxesUah,
      monthlyElectricityUah: context.monthlyElectricityUah,
      includeManagementSalaryInCost: context.includeManagementSalaryInCost,
      latestPackingBagPriceUah: context.latestPackingBagPriceUah,
    },
  });

  useEffect(() => {
    if (!open || !seedQuestion) return;
    const question = seedQuestion;
    onSeedConsumed?.();
    void append({ role: "user", content: question });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once per open
  }, [open, seedQuestion]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const contextKey = `${context.periodStart}|${context.periodEnd}|${context.periodLabel}`;
  const previousContextKey = useRef(contextKey);
  useEffect(() => {
    if (previousContextKey.current === contextKey) return;
    previousContextKey.current = contextKey;
    setMessages([]);
  }, [contextKey, setMessages]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Асистент аналітики
          </SheetTitle>
          <SheetDescription>
            Відповіді на основі даних за обраний період: {context.periodLabel}.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-md border p-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Запитайте, наприклад: «чому виросла собівартість мішка?» або
                «які рейси збиткові за період?»
              </p>
            ) : null}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "rounded-md px-3 py-2 text-sm whitespace-pre-wrap",
                  message.role === "user"
                    ? "ml-6 bg-primary text-primary-foreground"
                    : "mr-6 bg-muted"
                )}
              >
                {message.content}
              </div>
            ))}

            {isLoading ? (
              <div className="mr-6 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Асистент думає…
              </div>
            ) : null}

            {error ? (
              <p className="text-sm text-destructive">
                {error.message || "Помилка чату"}
              </p>
            ) : null}

            <div ref={bottomRef} />
          </div>

          <form
            className="flex gap-2"
            onSubmit={(event) => {
              handleSubmit(event);
            }}
          >
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Ваше питання…"
              disabled={isLoading}
              aria-label="Повідомлення асистенту"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
