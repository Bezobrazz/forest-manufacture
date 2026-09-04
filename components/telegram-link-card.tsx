"use client";

import { useState } from "react";
import { Loader2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  createTelegramLinkCode,
  unlinkTelegramAccount,
} from "@/app/actions/telegram-link";

type Props = {
  linked: boolean;
  telegramId: number | null;
};

export function TelegramLinkCard({ linked, telegramId }: Props) {
  const [code, setCode] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [unlinkPending, setUnlinkPending] = useState(false);
  const [isLinked, setIsLinked] = useState(linked);

  async function handleGenerate() {
    setPending(true);
    try {
      const result = await createTelegramLinkCode();
      if (!result.ok) {
        toast.error("Помилка", { description: result.error });
        return;
      }
      setCode(result.code);
      toast.success("Код згенеровано", {
        description: "Дійсний 10 хвилин",
      });
    } finally {
      setPending(false);
    }
  }

  async function handleUnlink() {
    setUnlinkPending(true);
    try {
      const result = await unlinkTelegramAccount();
      if (!result.ok) {
        toast.error("Помилка", { description: result.error });
        return;
      }
      setIsLinked(false);
      setCode(null);
      toast.success("Telegram відв’язано");
    } finally {
      setUnlinkPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground">Telegram</div>
      {isLinked ? (
        <div className="space-y-3">
          <p className="text-base">
            Прив’язано
            {telegramId != null ? (
              <span className="ml-2 font-mono text-sm text-muted-foreground">
                id {telegramId}
              </span>
            ) : null}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={unlinkPending}
            aria-busy={unlinkPending}
            onClick={() => void handleUnlink()}
          >
            {unlinkPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Відв’язування…
              </>
            ) : (
              <>
                <Unlink className="mr-2 h-4 w-4" />
                Відв’язати
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Згенеруйте код і надішліть його боту в Telegram командою{" "}
            <span className="font-mono">/start КОД</span>
          </p>
          {code ? (
            <div className="rounded-md border bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground mb-1">Команда</div>
              <div className="font-mono text-lg tracking-wide">/start {code}</div>
              <div className="text-xs text-muted-foreground mt-2">
                Код дійсний 10 хвилин
              </div>
            </div>
          ) : null}
          <Button
            type="button"
            disabled={pending}
            aria-busy={pending}
            onClick={() => void handleGenerate()}
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Генерація…
              </>
            ) : code ? (
              "Новий код"
            ) : (
              "Прив’язати Telegram"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
