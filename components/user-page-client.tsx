"use client";

import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Mail, Shield, Calendar } from "lucide-react";
import { TelegramLinkCard } from "@/components/telegram-link-card";
import { MiniAppAccessManager } from "@/components/mini-app-access-manager";
import type { MiniAppAccessListItem } from "@/app/actions/mini-app-access";
import { useQueryTab } from "@/hooks/use-query-tab";
import type { UserRole } from "@/lib/auth/roles";

const USER_PAGE_TABS = ["profile", "mini-app"] as const;

function getRoleLabel(role: string | null): string {
  switch (role) {
    case "owner":
      return "Власник";
    case "admin":
      return "Адміністратор";
    case "worker":
      return "Працівник";
    default:
      return "Невідома роль";
  }
}

function getRoleVariant(role: string | null): "default" | "secondary" | "outline" {
  switch (role) {
    case "owner":
      return "default";
    case "admin":
      return "secondary";
    case "worker":
      return "outline";
    default:
      return "outline";
  }
}

type Props = {
  email: string | null;
  userId: string;
  role: UserRole | null;
  createdAtLabel: string | null;
  telegramLinked: boolean;
  telegramId: number | null;
  canManageMiniApp: boolean;
  miniAppAccesses: MiniAppAccessListItem[];
};

function UserPageTabs({
  email,
  userId,
  role,
  createdAtLabel,
  telegramLinked,
  telegramId,
  canManageMiniApp,
  miniAppAccesses,
}: Props) {
  const allowedTabs = canManageMiniApp
    ? USER_PAGE_TABS
    : (["profile"] as const);
  const [tab, setTab] = useQueryTab(allowedTabs, "profile");

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as (typeof allowedTabs)[number])}
      className="w-full"
    >
      {canManageMiniApp ? (
        <TabsList className="mb-4 grid w-full grid-cols-2">
          <TabsTrigger value="profile">Профіль</TabsTrigger>
          <TabsTrigger value="mini-app">Доступи Mini App</TabsTrigger>
        </TabsList>
      ) : null}

      <TabsContent value="profile" className="mt-0">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-full">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Мій профіль</CardTitle>
                <CardDescription>
                  Інформація про ваш обліковий запис
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Email
                  </div>
                  <div className="text-base">{email || "Невідомо"}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Роль
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getRoleVariant(role)}>
                      {getRoleLabel(role)}
                    </Badge>
                  </div>
                </div>
              </div>

              {createdAtLabel ? (
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      Дата реєстрації
                    </div>
                    <div className="text-base">{createdAtLabel}</div>
                  </div>
                </div>
              ) : null}

              <div className="flex items-start gap-3">
                <div className="h-5 w-5 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    ID користувача
                  </div>
                  <div className="font-mono text-sm text-muted-foreground break-all">
                    {userId}
                  </div>
                </div>
              </div>

              <TelegramLinkCard
                linked={telegramLinked}
                telegramId={telegramId}
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {canManageMiniApp ? (
        <TabsContent value="mini-app" className="mt-0 space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Доступи Mini App</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Робітники без логіна ERP: створіть доступ, згенеруйте код і
              надішліть у Telegram. При звільненні — заблокуйте.
            </p>
          </div>
          <MiniAppAccessManager initialItems={miniAppAccesses} />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}

export function UserPageClient(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-muted-foreground">Завантаження…</div>
      }
    >
      <UserPageTabs {...props} />
    </Suspense>
  );
}
