import Link from "next/link";
import { requireAuth } from "@/lib/auth/require-role";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User, Mail, Shield, Calendar } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server-auth";

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

export default async function UserPage() {
  // Перевірка авторизації
  const { user, role } = await requireAuth();

  // Отримуємо додаткову інформацію про користувача з бази даних
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase
    .from("users")
    .select("created_at")
    .eq("id", user.id)
    .single();

  const createdAt = userData?.created_at
    ? new Date(userData.created_at)
    : user.created_at
    ? new Date(user.created_at)
    : null;

  const formatDate = (date: Date | null): string => {
    if (!date) return "Невідомо";
    return new Intl.DateTimeFormat("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }).format(date);
  };

  return (
    <div className="container py-6">
      <div className="mb-6">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Назад</span>
        </Link>
      </div>

      <div className="max-w-2xl mx-auto">
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
                  <div className="text-base">{user.email || "Невідомо"}</div>
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

              {createdAt && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      Дата реєстрації
                    </div>
                    <div className="text-base">{formatDate(createdAt)}</div>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className="h-5 w-5 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    ID користувача
                  </div>
                  <div className="text-base font-mono text-sm text-muted-foreground break-all">
                    {user.id}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

