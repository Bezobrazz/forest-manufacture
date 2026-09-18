"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  blockMiniAppAccess,
  createMiniAppAccess,
  createMiniAppInviteCode,
  unblockMiniAppAccess,
  type MiniAppAccessListItem,
} from "@/app/actions/mini-app-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRouter } from "next/navigation";

function statusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Активний";
    case "blocked":
      return "Заблоковано";
    default:
      return "Очікує";
  }
}

function statusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "blocked":
      return "destructive";
    default:
      return "outline";
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(iso));
}

export function MiniAppAccessManager({
  initialItems,
}: {
  initialItems: MiniAppAccessListItem[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});

  async function handleCreate() {
    setCreating(true);
    try {
      const result = await createMiniAppAccess(name);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setName("");
      toast.success("Доступ створено");
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  async function handleCode(accessId: string) {
    setBusyId(accessId);
    try {
      const result = await createMiniAppInviteCode(accessId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCodes((prev) => ({ ...prev, [accessId]: result.code }));
      toast.success("Код згенеровано (10 хв)");
    } finally {
      setBusyId(null);
    }
  }

  async function handleBlock(accessId: string) {
    setBusyId(accessId);
    try {
      const result = await blockMiniAppAccess(accessId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Доступ заблоковано");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnblock(accessId: string) {
    setBusyId(accessId);
    try {
      const result = await unblockMiniAppAccess(accessId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Доступ розблоковано");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <label className="text-sm text-muted-foreground" htmlFor="access_name">
            Новий доступ (імʼя робітника)
          </label>
          <Input
            id="access_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Водій Петро"
            className="h-11"
          />
        </div>
        <Button
          type="button"
          disabled={creating || !name.trim()}
          aria-busy={creating}
          onClick={() => void handleCreate()}
        >
          {creating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Створення…
            </>
          ) : (
            "Створити"
          )}
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Імʼя</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Telegram</TableHead>
              <TableHead>Привʼязка</TableHead>
              <TableHead>Видав</TableHead>
              <TableHead className="text-right">Дії</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Ще немає доступів
                </TableCell>
              </TableRow>
            ) : (
              initialItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.display_name}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(item.status)}>
                      {statusLabel(item.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.telegram_id != null ? (
                      <div>
                        <div className="font-mono text-xs">{item.telegram_id}</div>
                        {item.telegram_username ? (
                          <div className="text-muted-foreground">
                            @{item.telegram_username}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{formatDate(item.linked_at)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.creator_email ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-2">
                      {codes[item.id] ? (
                        <code className="rounded bg-muted px-2 py-1 text-xs">
                          /start {codes[item.id]}
                        </code>
                      ) : null}
                      <div className="flex flex-wrap justify-end gap-2">
                        {item.status !== "blocked" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busyId === item.id}
                            aria-busy={busyId === item.id}
                            onClick={() => void handleCode(item.id)}
                          >
                            {busyId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Код"
                            )}
                          </Button>
                        ) : null}
                        {item.status === "blocked" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busyId === item.id}
                            onClick={() => void handleUnblock(item.id)}
                          >
                            Розблокувати
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={busyId === item.id}
                            onClick={() => void handleBlock(item.id)}
                          >
                            Блок
                          </Button>
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
