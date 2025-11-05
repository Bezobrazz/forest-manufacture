"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Перевіряємо, чи користувач вже авторизований
    const checkAuth = async () => {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const redirectTo = searchParams.get("redirectedFrom") || "/";
        router.push(redirectTo);
      } else {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [router, searchParams]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Валідація паролів
    if (password !== confirmPassword) {
      toast.error("Помилка", {
        description: "Паролі не співпадають",
      });
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      toast.error("Помилка", {
        description: "Пароль повинен містити мінімум 6 символів",
      });
      setIsLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            role: 'authenticated', // Встановлюємо роль для проходження CHECK обмеження
          },
        },
      });

      if (error) {
        let errorMessage = error.message;
        let errorTitle = "Помилка реєстрації";
        
        // Перекладаємо помилки на українську
        if (error.message.includes("already registered") || error.message.includes("User already registered")) {
          errorMessage = "Користувач з таким email вже існує";
        } else if (error.message.includes("invalid email")) {
          errorMessage = "Невірний формат email";
        } else if (error.message.includes("Password should be")) {
          errorMessage = "Пароль не відповідає вимогам безпеки";
        } else if (error.message.includes("Database error finding user") || error.message.includes("Failed to send magic link")) {
          errorTitle = "Помилка налаштування системи";
          errorMessage = "Помилка при надсиланні листа підтвердження. Перевірте налаштування автентифікації в Supabase Dashboard або зверніться до адміністратора.";
        } else if (error.message.includes("Database error saving new user")) {
          errorTitle = "Помилка збереження користувача";
          errorMessage = "Помилка при створенні користувача в базі даних. Можливі причини: проблема з confirmation_token, обмеження бази даних або налаштування автентифікації. Зверніться до адміністратора або перевірте логи.";
        } else if (error.message.includes("Email rate limit exceeded")) {
          errorMessage = "Занадто багато спроб. Спробуйте пізніше";
        } else if (error.message.includes("converting NULL to string")) {
          errorTitle = "Помилка бази даних";
          errorMessage = "Проблема з налаштуваннями бази даних. Зверніться до адміністратора для виправлення.";
        }

        toast.error(errorTitle, {
          description: errorMessage,
          duration: 5000,
        });
        console.error("Signup error:", error);
        console.error("Error details:", {
          message: error.message,
          status: error.status,
          name: error.name,
          cause: error.cause,
        });
        
        // Додаткова інформація для діагностики
        if (error.status === 500) {
          console.error("⚠️ ПОМИЛКА 500: Проблема в базі даних Supabase");
          console.error("Перевірте логи в Supabase Dashboard → Logs → Postgres Logs");
          console.error("Виконайте діагностичний скрипт: scripts/check-database-errors.sql");
        }
        return;
      }

      if (data.user) {
        toast.success("Успішна реєстрація", {
          description: "Перевірте вашу пошту для підтвердження облікового запису",
        });

        // Перенаправляємо на сторінку логіну через 2 секунди
        setTimeout(() => {
          router.push("/auth/login");
        }, 2000);
      }
    } catch (error: any) {
      toast.error("Помилка", {
        description: error.message || "Сталася помилка при реєстрації",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Реєстрація
          </CardTitle>
          <CardDescription className="text-center">
            Створіть новий обліковий запис
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSignup}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                placeholder="Мінімум 6 символів"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Підтвердіть пароль</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Введіть пароль ще раз"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={6}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Реєстрація...
                </>
              ) : (
                "Зареєструватися"
              )}
            </Button>
            <div className="text-sm text-center text-muted-foreground">
              Вже маєте обліковий запис?{" "}
              <Link
                href="/auth/login"
                className="text-primary hover:underline font-medium"
              >
                Увійти
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

