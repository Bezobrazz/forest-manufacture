"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getActiveShifts,
  getShifts,
  getEmployees,
  getProducts,
  getProductionStats,
  getInventory,
  getActiveTasks,
} from "@/app/actions";
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
import { formatDateTime, formatDate } from "@/lib/utils";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DatabaseError } from "@/components/database-error";
import type {
  ShiftWithDetails,
  Employee,
  Product,
  Inventory,
  Task,
} from "@/lib/types";

export default function HomePage() {
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
    return (
      <div className="container py-12 text-center">
        <div className="inline-block animate-spin h-8 w-8 border-4 border-current border-t-transparent rounded-full mb-4"></div>
        <p>Завантаження даних...</p>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Облік виробництва</h1>
          <p className="text-muted-foreground">
            Керуйте змінами, працівниками та продукцією підприємства
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
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
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-6 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <span>Активні зміни</span>
            </CardTitle>
            <CardDescription>Кількість активних змін</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeShiftsCount}</div>
          </CardContent>
          <CardFooter>
            <Link href="/shifts" className="w-full">
              <Button variant="outline" className="w-full">
                <span>Переглянути зміни</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span>Працівники</span>
            </CardTitle>
            <CardDescription>Загальна кількість працівників</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{employeesCount}</div>
          </CardContent>
          <CardFooter>
            <Link href="/employees" className="w-full">
              <Button variant="outline" className="w-full">
                <span>Керувати працівниками</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <span>Продукція</span>
            </CardTitle>
            <CardDescription>Загальна кількість продуктів</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{productsCount}</div>
          </CardContent>
          <CardFooter>
            <Link href="/products" className="w-full">
              <Button variant="outline" className="w-full">
                <span>Керувати продукцією</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary" />
              <span>Склад</span>
            </CardTitle>
            <CardDescription>Загальна кількість на складі</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalInventory} шт</div>
          </CardContent>
          <CardFooter>
            <Link href="/inventory" className="w-full">
              <Button variant="outline" className="w-full">
                <span>Управління складом</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              <span>Активні задачі</span>
            </CardTitle>
            <CardDescription>Кількість активних задач</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.activeTasks.length}</div>
          </CardContent>
          <CardFooter>
            <Link href="/tasks" className="w-full">
              <Button variant="outline" className="w-full">
                <span>Переглянути задачі</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardFooter>
        </Card>
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
              <div className="text-4xl font-bold">{totalProduction} шт</div>
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
                            {category}: {total} шт
                          </span>
                        </Badge>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
            <Link href="/statistics">
              <Button
                variant="outline"
                className="w-full flex items-center justify-center gap-2"
              >
                <PieChart className="h-4 w-4" />
                <span>Детальна статистика</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              <span>Активні задачі</span>
            </CardTitle>
            <CardDescription>Список активних задач</CardDescription>
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
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
