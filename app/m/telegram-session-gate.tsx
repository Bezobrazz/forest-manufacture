"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        initData: string;
      };
    };
  }
}

type Props = {
  hasAccessSession: boolean;
  children: React.ReactNode;
};

export function TelegramSessionGate({ hasAccessSession, children }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "denied">(
    hasAccessSession ? "ready" : "loading"
  );
  const [deniedMessage, setDeniedMessage] = useState(
    "Telegram не прив’язано. Зверніться до адміністратора за кодом доступу."
  );

  useEffect(() => {
    if (hasAccessSession) setStatus("ready");
  }, [hasAccessSession]);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.ready();
    tg?.expand();

    const initData = tg?.initData?.trim() ?? "";

    if (!initData) {
      setStatus(hasAccessSession ? "ready" : "denied");
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/telegram/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });
        if (cancelled) return;
        if (!response.ok) {
          let message = deniedMessage;
          try {
            const body = (await response.json()) as { message?: string };
            if (body.message) message = body.message;
          } catch {
            /* ignore */
          }
          setDeniedMessage(message);
          setStatus(hasAccessSession ? "ready" : "denied");
          return;
        }
        router.refresh();
        window.setTimeout(() => {
          if (!cancelled) setStatus("ready");
        }, 400);
      } catch {
        if (!cancelled) {
          setStatus(hasAccessSession ? "ready" : "denied");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deniedMessage, hasAccessSession, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p>Підключення до Telegram…</p>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="mx-auto max-w-md space-y-3 px-4 py-10 text-center">
        <h1 className="text-xl font-semibold">Немає доступу</h1>
        <p className="text-sm text-muted-foreground">{deniedMessage}</p>
        <p className="text-sm text-muted-foreground">
          Адміністратор створює доступ у ERP і дає команду{" "}
          <span className="font-mono">/start КОД</span> для бота.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
