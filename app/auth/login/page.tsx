"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSupabaseClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        // Використовуємо window.location для уникнення конфліктів
        window.location.href = redirectTo;
      } else {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error("Помилка авторизації", {
          description:
            error.message === "Invalid login credentials"
              ? "Невірний email або пароль"
              : error.message,
        });
        return;
      }

      if (data.user) {
        // Очікуємо, поки сесія збережеться в cookies
        // Перевіряємо, що сесія дійсно збережена
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Перевіряємо, що сесія збережена
        const {
          data: { session: checkSession },
        } = await supabase.auth.getSession();
        if (!checkSession) {
          // Якщо сесія не збережена, чекаємо ще трохи
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        const redirectTo = searchParams.get("redirectedFrom") || "/";

        // Показуємо повідомлення перед перенаправленням
        toast.success("Успішний вхід", {
          description: "Ви успішно авторизувалися",
        });

        // Використовуємо router.push з refresh для оновлення сесії
        router.push(redirectTo);
        router.refresh();
      }
    } catch (error: any) {
      toast.error("Помилка", {
        description: error.message || "Сталася помилка при вході",
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
            Вхід в систему
          </CardTitle>
          <CardDescription className="text-center">
            Введіть ваш email та пароль для входу
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
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
                placeholder="Введіть пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Вхід...
                </>
              ) : (
                "Увійти"
              )}
            </Button>
            <div className="text-sm text-center text-muted-foreground">
              Немає облікового запису?{" "}
              <Link
                href="/auth/signup"
                className="text-primary hover:underline font-medium"
              >
                Зареєструватися
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
