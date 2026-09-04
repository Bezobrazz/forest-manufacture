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
  isAuthenticated: boolean;
  children: React.ReactNode;
};

export function TelegramSessionGate({ isAuthenticated, children }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "unlinked">(
    isAuthenticated ? "ready" : "loading"
  );

  useEffect(() => {
    if (isAuthenticated) {
      setStatus("ready");
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.ready();
    tg?.expand();

    const initData = tg?.initData?.trim() ?? "";

    if (!initData) {
      setStatus(isAuthenticated ? "ready" : "unlinked");
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
          setStatus(isAuthenticated ? "ready" : "unlinked");
          return;
        }
        router.refresh();
        window.setTimeout(() => {
          if (!cancelled) {
            setStatus((prev) => (prev === "unlinked" ? prev : "ready"));
          }
        }, 800);
      } catch {
        if (!cancelled && !isAuthenticated) {
          setStatus("unlinked");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p>Підключення до Telegram…</p>
      </div>
    );
  }

  if (status === "unlinked") {
    return (
      <div className="mx-auto max-w-md space-y-3 px-4 py-10 text-center">
        <h1 className="text-xl font-semibold">Немає доступу</h1>
        <p className="text-sm text-muted-foreground">
          Telegram не прив’язано до облікового запису. Зверніться до
          адміністратора: у профілі ERP згенеруйте код і надішліть боту{" "}
          <span className="font-mono">/start КОД</span>.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
