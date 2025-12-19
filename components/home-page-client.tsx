"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  User,
  Truck,
  Box,
  ShoppingCart,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  ShiftWithDetails,
  Task,
} from "@/lib/types";
import { LogoutButton } from "@/components/auth/logout-button";

type DefaultCards = {
  shifts: boolean;
  employees: boolean;
  products: boolean;
  materials: boolean;
  inventory: boolean;
  expenses: boolean;
};

type HomePageData = {
  recentShifts: ShiftWithDetails[];
  activeShiftsCount: number;
  employeesCount: number;
  productsCount: number;
  materialsCount: number;
  totalInventory: number;
  productionStats: {
    totalProduction: number;
    productionByCategory: Record<string, number>;
  };
  activeTasks: Task[];
};

type HomePageClientProps = {
  initialData: HomePageData;
};

export function HomePageClient({ initialData }: HomePageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const defaultCards: DefaultCards = {
    shifts: true,
    employees: true,
    products: true,
    materials: true,
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

  // Сортуємо зміни: спочатку активні, потім завершені
  // Обмежуємо кількість елементів для відображення на головній сторінці
  const sortedShifts = [...initialData.recentShifts].sort((a, b) => {
    // Активні зміни мають бути першими
    if (a.status === "active" && b.status !== "active") return -1;
    if (a.status !== "active" && b.status === "active") return 1;
    // Якщо обидві активні або обидві завершені, сортуємо за датою (новіші першими)
    const dateA = a.opened_at || a.created_at || a.shift_date;
    const dateB = b.opened_at || b.created_at || b.shift_date;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });
  const recentShifts = sortedShifts.slice(0, 3);
  const { totalProduction, productionByCategory } = initialData.productionStats;

  return (
    <div className="container py-6">
      <div className="flex flex-wrap items-center gap-4 justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Облік виробництва</h1>
          <p className="text-muted-foreground">
            Керуйте змінами, працівниками та продукцією підприємства
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/user">
            <Button variant="outline" size="sm" className="gap-2">
              <User className="h-4 w-4" />
              <span>Профіль</span>
            </Button>
          </Link>
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
              <Link href="/materials" className="w-full">
                <DropdownMenuItem className="cursor-pointer">
                  <Box className="h-4 w-4 mr-2" />
                  <span>Керувати матеріалами</span>
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
              <Link href="/suppliers" className="w-full">
                <DropdownMenuItem className="cursor-pointer">
                  <Truck className="h-4 w-4 mr-2" />
                  <span>Постачальники</span>
                </DropdownMenuItem>
              </Link>
              <Link href="/transactions/suppliers" className="w-full">
                <DropdownMenuItem className="cursor-pointer">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  <span>Закупка</span>
                </DropdownMenuItem>
              </Link>
              <Link href="/user" className="w-full">
                <DropdownMenuItem className="cursor-pointer">
                  <User className="h-4 w-4 mr-2" />
                  <span>Мій профіль</span>
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
                materials: true,
                inventory: true,
                expenses: true,
              })
            }
          >
            Показати приховані
          </Button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 mb-8">
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
              <CardDescription className="truncate">
                Кількість активних змін
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatNumber(initialData.activeShiftsCount)}
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
                <span className="flex-1 min-w-0 truncate">
                  Переглянути зміни
                </span>
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
              <CardDescription className="truncate">
                Загальна кількість працівників
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatNumber(initialData.employeesCount)}
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
                <span className="flex-1 min-w-0 truncate">
                  Керувати працівниками
                </span>
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
              <CardDescription className="truncate">
                Загальна кількість продуктів
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatNumber(initialData.productsCount)}
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
                <span className="flex-1 min-w-0 truncate">
                  Керувати продукцією
                </span>
                <ArrowRight className="h-4 w-4 ml-2 flex-shrink-0" />
              </Button>
            </CardFooter>
          </Card>
        )}
        {visibleCards.materials && (
          <Card>
            <CardHeader className="pb-2 relative">
              <button
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                onClick={() => toggleCard("materials")}
                aria-label={visibleCards.materials ? "Сховати" : "Показати"}
                type="button"
              >
                {visibleCards.materials ? (
                  <Eye className="h-5 w-5" />
                ) : (
                  <EyeOff className="h-5 w-5" />
                )}
              </button>
              <CardTitle className="flex items-center gap-2">
                <Box className="h-5 w-5 text-primary" />
                <span>Матеріали</span>
              </CardTitle>
              <CardDescription className="truncate">
                Загальна кількість матеріалів
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatNumber(initialData.materialsCount)}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  startTransition(() => {
                    router.push("/materials");
                  });
                }}
                disabled={isPending}
              >
                <span className="flex-1 min-w-0 truncate">
                  Керувати матеріалами
                </span>
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
              <CardDescription className="truncate">
                Загальна кількість на складі
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatNumberWithUnit(initialData.totalInventory, "шт", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
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
                <span className="flex-1 min-w-0 truncate">
                  Управління складом
                </span>
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
              <CardDescription className="truncate">
                Кількість витрат за тиждень
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatNumber(initialData.activeShiftsCount)}
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
                <span className="flex-1 min-w-0 truncate">
                  Переглянути витрати
                </span>
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
                        {formatDateTime(
                          shift.opened_at ||
                            shift.created_at ||
                            shift.shift_date
                        )}
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
                {formatNumberWithUnit(totalProduction, "шт", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
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
                            {category}: {formatNumberWithUnit(total, "шт", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}
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

