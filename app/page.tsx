"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getActiveShifts,
  getShifts,
  getEmployees,
  getProducts,
  getProductionStats,
  getInventory,
  getActiveTasks,
  getInventoryTransactions,
  getTasks,
  updateTaskStatus,
} from "@/app/actions";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  formatDateTime,
  formatDate,
  formatNumber,
  formatNumberWithUnit,
} from "@/lib/utils";
import {
  Calendar,
  Clock,
  Package,
  Users,
  ArrowRight,
  Plus,
  BarChart,
  PieChart,
  Menu,
  Boxes,
  CheckSquare,
  DollarSign,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DatabaseError } from "@/components/database-error";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ShiftWithDetails,
  Employee,
  Product,
  Inventory,
  Task,
} from "@/lib/types";
import { toast } from "sonner";
import { LogoutButton } from "@/components/auth/logout-button";

type DefaultCards = {
  shifts: boolean;
  employees: boolean;
  products: boolean;
  inventory: boolean;
  expenses: boolean;
};

function LoadingSkeleton() {
  return (
    <div className="container py-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-6 w-96" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>

      <div>
        <Skeleton className="h-8 w-64 mb-4" />
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <Skeleton className="h-10 w-24" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-2" />
                <div className="flex flex-wrap gap-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-6 w-24" />
                  ))}
                </div>
              </div>
            </div>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-6 w-16" />
                </div>
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 p-4 border rounded-lg"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<{
    shifts: ShiftWithDetails[];
    activeShifts: ShiftWithDetails[];
    employees: Employee[];
    products: Product[];
    productionStats: {
      totalProduction: number;
      productionByCategory: Record<string, number>;
    };
    inventory: Inventory[];
    activeTasks: Task[];
  }>({
    shifts: [],
    activeShifts: [],
    employees: [],
    products: [],
    productionStats: { totalProduction: 0, productionByCategory: {} },
    inventory: [],
    activeTasks: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [databaseError, setDatabaseError] = useState(false);

  const defaultCards: DefaultCards = {
    shifts: true,
    employees: true,
    products: true,
    inventory: true,
    expenses: true,
  };
  // Ініціалізація стану з localStorage
  const [visibleCards, setVisibleCards] = useState<DefaultCards>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("visibleCards");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return defaultCards;
        }
      }
    }
    return defaultCards;
  });

  // Оновлення localStorage при зміні стану
  useEffect(() => {
    localStorage.setItem("visibleCards", JSON.stringify(visibleCards));
  }, [visibleCards]);

  const toggleCard = (card: keyof DefaultCards) => {
    setVisibleCards((prev) => ({ ...prev, [card]: !prev[card] }));
  };

  const loadData = async () => {
    setIsLoading(true);
    setDatabaseError(false);

    try {
      const [
        shifts,
        activeShifts,
        employees,
        products,
        productionStats,
        inventory,
        activeTasks,
      ] = await Promise.all([
        getShifts(),
        getActiveShifts(),
        getEmployees(),
        getProducts(),
        getProductionStats(),
        getInventory(),
        getActiveTasks(),
      ]);

      setData({
        shifts,
        activeShifts,
        employees,
        products,
        productionStats,
        inventory,
        activeTasks,
      });
    } catch (err: any) {
      console.error("Помилка при завантаженні даних:", err);

      // Перевіряємо, чи це помилка підключення до бази даних
      if (
        err?.message?.includes("Supabase") ||
        err?.message?.includes("credentials")
      ) {
        setDatabaseError(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Викликаємо getUserWithRole при завантаженні дашборду
    const fetchUserWithRole = async () => {
      try {
        // Отримуємо користувача через клієнтський Supabase клієнт
        const supabase = getSupabaseClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        console.log("getUserWithRole - client getUser:", {
          hasUser: !!user,
          userId: user?.id,
          userEmail: user?.email,
          userError: userError?.message,
        });

        if (userError || !user) {
          console.log("getUserWithRole - no user from client");
          return;
        }

        // Отримуємо роль напряму з бази даних через клієнтський клієнт
        const { data: userData, error: roleError } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single();

        console.log("getUserWithRole - role query:", {
          hasUserData: !!userData,
          role: userData?.role,
          roleError: roleError?.message,
        });

        let role = userData?.role || null;

        // Якщо ролі немає, створюємо запис з роллю за замовчуванням
        if (!role) {
          const defaultRole = "worker";
          const { error: upsertError } = await supabase
            .from("users")
            .upsert(
              {
                id: user.id,
                email: user.email || "",
                role: defaultRole,
              },
              {
                onConflict: "id",
              }
            );

          if (!upsertError) {
            role = defaultRole;
            console.log(`Created/updated user record with role: ${defaultRole}`);
          } else {
            console.error("Error creating/updating user record:", upsertError);
          }
        }

        const result = { user, role };
        console.log("getUserWithRole", result);
      } catch (error) {
        console.error("Помилка при отриманні користувача з роллю:", error);
      }
    };

    fetchUserWithRole();
  }, []);

  // Обмежуємо кількість елементів для відображення на головній сторінці
  const recentShifts = data.shifts.slice(0, 3);
  const activeShiftsCount = data.activeShifts.length;
  const employeesCount = data.employees.length;
  const productsCount = data.products.length;
  const { totalProduction, productionByCategory } = data.productionStats;

  // Підрахунок загальної кількості продукції на складі
  const totalInventory = data.inventory.reduce(
    (total, item) => total + item.quantity,
    0
  );

  if (databaseError) {
    return (
      <div className="container py-12">
        <DatabaseError onRetry={loadData} />
      </div>
    );
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="container py-6">
      <div className="flex flex-wrap items-center gap-4 justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Облік виробництва</h1>
          <p className="text-muted-foreground">
            Керуйте змінами, працівниками та продукцією підприємства
          </p>
        </div>

        <div className="flex items-center gap-2">
          <LogoutButton />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Menu className="h-4 w-4" />
                <span>Швидкі дії</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <Link href="/shifts/new" className="w-full">
                <DropdownMenuItem className="cursor-pointer">
                  <Plus className="h-4 w-4 mr-2" />
                  <span>Створити нову зміну</span>
                </DropdownMenuItem>
              </Link>
              <Link href="/employees" className="w-full">
                <DropdownMenuItem className="cursor-pointer">
                  <Users className="h-4 w-4 mr-2" />
                  <span>Керувати працівниками</span>
                </DropdownMenuItem>
              </Link>
              <Link href="/products" className="w-full">
                <DropdownMenuItem className="cursor-pointer">
                  <Package className="h-4 w-4 mr-2" />
                  <span>Керувати продукцією</span>
                </DropdownMenuItem>
              </Link>
              <Link href="/inventory" className="w-full">
                <DropdownMenuItem className="cursor-pointer">
                  <Boxes className="h-4 w-4 mr-2" />
                  <span>Управління складом</span>
                </DropdownMenuItem>
              </Link>
              <Link href="/tasks" className="w-full">
                <DropdownMenuItem className="cursor-pointer">
                  <CheckSquare className="h-4 w-4 mr-2" />
                  <span>Задачі</span>
                </DropdownMenuItem>
              </Link>
              <Link href="/statistics" className="w-full">
                <DropdownMenuItem className="cursor-pointer">
                  <PieChart className="h-4 w-4 mr-2" />
                  <span>Статистика виробництва</span>
                </DropdownMenuItem>
              </Link>
              <Link href="/expenses" className="w-full">
                <DropdownMenuItem className="cursor-pointer">
                  <DollarSign className="h-4 w-4 mr-2" />
                  <span>Облік витрат</span>
                </DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Кнопка "Показати приховані" */}
      {Object.values(visibleCards).some((v) => !v) && (
        <div className="mb-4 flex justify-end">
          <Button
            variant="secondary"
            onClick={() =>
              setVisibleCards({
                shifts: true,
                employees: true,
                products: true,
                inventory: true,
                expenses: true,
              })
            }
          >
            Показати приховані
          </Button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-4 mb-8">
        {visibleCards.shifts && (
          <Card>
            <CardHeader className="pb-2 relative">
              <button
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                onClick={() => toggleCard("shifts")}
                aria-label={visibleCards.shifts ? "Сховати" : "Показати"}
                type="button"
              >
                {visibleCards.shifts ? (
                  <Eye className="h-5 w-5" />
                ) : (
                  <EyeOff className="h-5 w-5" />
                )}
              </button>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <span>Зміни</span>
              </CardTitle>
              <CardDescription>Кількість активних змін</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatNumber(activeShiftsCount)}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  startTransition(() => {
                    router.push("/shifts");
                  });
                }}
                disabled={isPending}
              >
                <span className="flex-1 min-w-0 truncate">Переглянути зміни</span>
                <ArrowRight className="h-4 w-4 ml-2 flex-shrink-0" />
              </Button>
            </CardFooter>
          </Card>
        )}
        {visibleCards.employees && (
          <Card>
            <CardHeader className="pb-2 relative">
              <button
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                onClick={() => toggleCard("employees")}
                aria-label={visibleCards.employees ? "Сховати" : "Показати"}
                type="button"
              >
                {visibleCards.employees ? (
                  <Eye className="h-5 w-5" />
                ) : (
                  <EyeOff className="h-5 w-5" />
                )}
              </button>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span>Працівники</span>
              </CardTitle>
              <CardDescription>Загальна кількість працівників</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatNumber(employeesCount)}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  startTransition(() => {
                    router.push("/employees");
                  });
                }}
                disabled={isPending}
              >
                <span className="flex-1 min-w-0 truncate">Керувати працівниками</span>
                <ArrowRight className="h-4 w-4 ml-2 flex-shrink-0" />
              </Button>
            </CardFooter>
          </Card>
        )}
        {visibleCards.products && (
          <Card>
            <CardHeader className="pb-2 relative">
              <button
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                onClick={() => toggleCard("products")}
                aria-label={visibleCards.products ? "Сховати" : "Показати"}
                type="button"
              >
                {visibleCards.products ? (
                  <Eye className="h-5 w-5" />
                ) : (
                  <EyeOff className="h-5 w-5" />
                )}
              </button>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <span>Продукція</span>
              </CardTitle>
              <CardDescription>Загальна кількість продуктів</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatNumber(productsCount)}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  startTransition(() => {
                    router.push("/products");
                  });
                }}
                disabled={isPending}
              >
                <span className="flex-1 min-w-0 truncate">Керувати продукцією</span>
                <ArrowRight className="h-4 w-4 ml-2 flex-shrink-0" />
              </Button>
            </CardFooter>
          </Card>
        )}
        {visibleCards.inventory && (
          <Card>
            <CardHeader className="pb-2 relative">
              <button
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                onClick={() => toggleCard("inventory")}
                aria-label={visibleCards.inventory ? "Сховати" : "Показати"}
                type="button"
              >
                {visibleCards.inventory ? (
                  <Eye className="h-5 w-5" />
                ) : (
                  <EyeOff className="h-5 w-5" />
                )}
              </button>
              <CardTitle className="flex items-center gap-2">
                <Boxes className="h-5 w-5 text-primary" />
                <span>Склад</span>
              </CardTitle>
              <CardDescription>Загальна кількість на складі</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatNumberWithUnit(totalInventory, "шт")}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  startTransition(() => {
                    router.push("/inventory");
                  });
                }}
                disabled={isPending}
              >
                <span className="flex-1 min-w-0 truncate">Управління складом</span>
                <ArrowRight className="h-4 w-4 ml-2 flex-shrink-0" />
              </Button>
            </CardFooter>
          </Card>
        )}
        {visibleCards.expenses && (
          <Card>
            <CardHeader className="pb-2 relative">
              <button
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                onClick={() => toggleCard("expenses")}
                aria-label={visibleCards.expenses ? "Сховати" : "Показати"}
                type="button"
              >
                {visibleCards.expenses ? (
                  <Eye className="h-5 w-5" />
                ) : (
                  <EyeOff className="h-5 w-5" />
                )}
              </button>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span>Облік витрат</span>
              </CardTitle>
              <CardDescription>Кількість витрат за тиждень</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatNumber(activeShiftsCount)}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  startTransition(() => {
                    router.push("/expenses");
                  });
                }}
                disabled={isPending}
              >
                <span className="flex-1 min-w-0 truncate">Переглянути витрати</span>
                <ArrowRight className="h-4 w-4 ml-2 flex-shrink-0" />
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Останні зміни</h2>
          <Link href="/shifts">
            <Button variant="ghost" size="sm" className="gap-1">
              <span>Всі зміни</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {recentShifts.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">
                  Немає зареєстрованих змін
                </p>
                <Link href="/shifts/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    <span>Створити зміну</span>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {recentShifts.map((shift) => (
              <Link key={shift.id} href={`/shifts/${shift.id}`}>
                <Card className="h-full hover:bg-muted/50 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        Зміна #{shift.id}
                      </CardTitle>
                      {shift.production &&
                        shift.production.length > 0 &&
                        (() => {
                          // Підрахунок загальної кількості виробленої продукції
                          let totalShiftProduction = 0;
                          shift.production.forEach((item) => {
                            totalShiftProduction += item.quantity;
                          });

                          return (
                            <Badge className="ml-2 text-sm font-normal flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              <span>{totalShiftProduction} шт</span>
                            </Badge>
                          );
                        })()}
                    </div>
                    <CardDescription className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {formatDateTime(shift.created_at || shift.shift_date)}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-2">
                      <Badge
                        variant={
                          shift.status === "active" ? "default" : "secondary"
                        }
                      >
                        {shift.status === "active" ? "Активна" : "Завершена"}
                      </Badge>

                      {shift.status === "completed" && shift.completed_at && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>
                            Завершено: {formatDateTime(shift.completed_at)}
                          </span>
                        </div>
                      )}

                      {shift.production && shift.production.length > 0 && (
                        <div className="mt-1">
                          {(() => {
                            // Підрахунок загальної кількості виробленої продукції по категоріям
                            const productionByCategory: Record<string, number> =
                              {};
                            let totalProduction = 0;

                            shift.production.forEach((item) => {
                              const categoryName =
                                item.product?.category?.name || "Без категорії";
                              if (!productionByCategory[categoryName]) {
                                productionByCategory[categoryName] = 0;
                              }
                              productionByCategory[categoryName] +=
                                item.quantity;
                              totalProduction += item.quantity;
                            });

                            return (
                              <>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {Object.entries(productionByCategory).map(
                                    ([category, total]) => (
                                      <Badge
                                        key={category}
                                        variant="secondary"
                                        className="flex items-center gap-1 text-xs"
                                      >
                                        <Package className="h-2 w-2" />
                                        <span>
                                          {category}: {total} шт
                                        </span>
                                      </Badge>
                                    )
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {shift.notes && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {shift.notes}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* <div className="grid gap-6 md:grid-cols-2 mb-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-primary" />
                  <span>Активні задачі</span>
                </CardTitle>
                <CardDescription>Список активних задач</CardDescription>
              </div>
              <Link href="/tasks">
                <Button variant="outline" size="sm" className="gap-2">
                  <span>Всі задачі</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {data.activeTasks.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Немає активних задач
              </div>
            ) : (
              <div className="space-y-4">
                {data.activeTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-4 p-4 border rounded-lg"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{task.title}</h3>
                        <Badge
                          variant="secondary"
                          className={
                            task.priority === "low"
                              ? "bg-green-500"
                              : task.priority === "medium"
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }
                        >
                          {task.priority === "low"
                            ? "Низький"
                            : task.priority === "medium"
                            ? "Середній"
                            : "Високий"}
                        </Badge>
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground">
                          {task.description}
                        </p>
                      )}
                      {task.due_date && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>Термін: {formatDate(task.due_date)}</span>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const result = await updateTaskStatus(
                          task.id,
                          "completed"
                        );
                        if (result.success) {
                          // Оновлюємо список активних задач
                          const newActiveTasks = await getActiveTasks();
                          setData((prev) => ({
                            ...prev,
                            activeTasks: newActiveTasks,
                          }));
                          toast.success("Успішно", {
                            description: "Задачу завершено",
                          });
                        } else {
                          toast.error("Помилка", {
                            description:
                              result.error || "Не вдалося завершити задачу",
                          });
                        }
                      }}
                    >
                      Завершити
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div> */}

      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Статистика виробництва</h2>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5 text-primary" />
              <span>Загальна кількість виробленої продукції</span>
            </CardTitle>
            <CardDescription>Статистика по всіх змінах</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-4xl font-bold">
                {" "}
                {formatNumberWithUnit(totalProduction, "шт")}
              </div>
              {totalProduction > 0 && (
                <div className="flex-1">
                  <div className="text-sm font-medium mb-2">
                    Розподіл по категоріям:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(productionByCategory).map(
                      ([category, total]) => (
                        <Badge
                          key={category}
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          <Package className="h-3 w-3" />
                          <span>
                            {category}: {formatNumberWithUnit(total, "шт")}
                          </span>
                        </Badge>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              onClick={() => {
                startTransition(() => {
                  router.push("/statistics");
                });
              }}
              disabled={isPending}
            >
              <PieChart className="h-4 w-4" />
              <span>Детальна статистика</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
