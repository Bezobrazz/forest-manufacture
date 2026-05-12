// app/shifts/[id]/page.tsx
// Додайте наступний код на початку компонента, щоб відключити кешування даних
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getEmployees,
  getHourlyWageExpensesForShift,
  getProducts,
  getShiftDetails,
  updateShiftProductionReward,
} from "@/app/actions";
import { AddEmployeeToShift } from "@/components/add-employee-to-shift";
import { CompleteShiftButton } from "@/components/complete-shift-button";
import { DeleteShiftButton } from "@/components/delete-shift-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";
import {
  Box,
  Calendar,
  CalendarDays,
  Car,
  CheckSquare,
  Clock,
  DollarSign,
  MapPin,
  Menu,
  PieChart,
  Plus,
  ShoppingCart,
  Truck,
  User,
  Users,
  Package,
  Boxes,
} from "lucide-react";
import { RemoveEmployeeButton } from "@/components/remove-employee-button";
import { ProductionItemsForm } from "@/components/production-items-form";
import { HourlyWageForm } from "@/components/hourly-wage-form";
import { EditShiftOpenedDate } from "@/components/edit-shift-opened-date";
import { PreviousPageButton } from "@/components/previous-page-button";
import { getUserWithRole } from "@/lib/auth/get-user-role";
import type { ShiftWithDetails } from "@/lib/types";

interface ShiftPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ShiftPage({ params }: ShiftPageProps) {
  const { id } = await params;
  const shiftId = Number.parseInt(id);

  if (isNaN(shiftId)) {
    notFound();
  }

  const shift = await getShiftDetails(shiftId);

  if (!shift) {
    notFound();
  }

  // Отримуємо роль користувача для перевірки доступу до редагування
  const { role } = await getUserWithRole();
  const isOwner = role === "owner";

  // Додаємо логування для перевірки даних зміни
  console.log(
    `Rendering shift details for ID ${shiftId}:`,
    JSON.stringify({
      id: shift.id,
      status: shift.status,
      created_at: shift.created_at,
      completed_at: shift.completed_at,
      employees_count: shift.employees?.length || 0,
      production_count: shift.production?.length || 0,
    })
  );

  const employees = await getEmployees();
  const products = await getProducts();
  const hourlyWageExpenses = await getHourlyWageExpensesForShift(shift.id);

  // Отримуємо ID працівників, які вже додані до зміни
  const existingEmployeeIds = shift.employees.map((e) => e.employee_id);

  // Підрахунок загальної кількості виробленої продукції по категоріям
  const productionByCategory: Record<string, number> = {};
  let totalProduction = 0;

  if (shift.production && shift.production.length > 0) {
    shift.production.forEach((item) => {
      const categoryName = item.product.category?.name || "Без категорії";
      if (!productionByCategory[categoryName]) {
        productionByCategory[categoryName] = 0;
      }
      productionByCategory[categoryName] += item.quantity;
      totalProduction += item.quantity;
    });
  }

  // Підрахунок заробітної плати на основі винагороди за продукцію
  const wagesByProduct: Array<{
    productId: number;
    productName: string;
    quantity: number;
    reward: number;
    rewardOverride: number | null;
    effectiveReward: number;
    total: number;
  }> = [];

  let totalWages = 0;

  if (shift.production && shift.production.length > 0) {
    shift.production.forEach((item) => {
      const baseReward = Number(item.product.reward ?? 0);
      const rewardOverride = item.reward_override;
      const effectiveReward = Number(rewardOverride ?? baseReward);
      const productWage = item.quantity * effectiveReward;
      totalWages += productWage;

      wagesByProduct.push({
        productId: item.product_id,
        productName: item.product.name,
        quantity: item.quantity,
        reward: baseReward,
        rewardOverride,
        effectiveReward,
        total: productWage,
      });
    });
  }

  // Додаємо логування для перевірки розрахунку заробітної плати
  console.log(`Wage calculation for shift ID ${shiftId}:`, {
    totalWages,
    wagesByProductCount: wagesByProduct.length,
    totalProduction,
  });

  // Сортуємо за загальною сумою винагороди (від більшої до меншої)
  wagesByProduct.sort((a, b) => b.total - a.total);

  // Підрахунок заробітної плати на одного працівника (якщо є працівники)
  const employeeCount = shift.employees.length;
  const hourlyWageExpensesTotal = hourlyWageExpenses.reduce(
    (sum, item) => sum + item.amount,
    0
  );
  const totalCompensation = totalWages + hourlyWageExpensesTotal;
  const totalCompensationPerEmployee =
    employeeCount > 0 ? totalCompensation / employeeCount : 0;
  const handleUpdateShiftProductionReward = async (formData: FormData) => {
    "use server";
    await updateShiftProductionReward(formData);
  };

  return (
    <div className="container py-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <PreviousPageButton fallbackHref="/" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              data-quick-actions-trigger="true"
              variant="outline"
              size="sm"
              className="gap-2"
            >
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
            <Link href="/shipments" className="w-full">
              <DropdownMenuItem className="cursor-pointer">
                <CalendarDays className="h-4 w-4 mr-2" />
                <span>Відвантаження</span>
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
            <Link href="/vehicles" className="w-full">
              <DropdownMenuItem className="cursor-pointer">
                <Car className="h-4 w-4 mr-2" />
                <span>Транспорт</span>
              </DropdownMenuItem>
            </Link>
            <Link href="/trips" className="w-full">
              <DropdownMenuItem className="cursor-pointer">
                <MapPin className="h-4 w-4 mr-2" />
                <span>Поїздки</span>
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

      <div className="flex flex-col gap-6">
        <Card
          className="border-l-4"
          style={{
            borderLeftColor:
              shift.status === "active"
                ? "hsl(var(--primary))"
                : "hsl(var(--muted))",
          }}
        >
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-muted">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    Зміна #{shift.id}
                    <Badge
                      variant={
                        shift.status === "active" ? "default" : "secondary"
                      }
                      className="ml-2"
                    >
                      {shift.status === "active" ? "Активна" : "Завершена"}
                    </Badge>
                  </h1>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-primary" />
                      <span>
                        Зміна відкрита:{" "}
                        {formatDateTime(
                          shift.opened_at ||
                            shift.created_at ||
                            shift.shift_date
                        )}
                      </span>
                      {isOwner && <EditShiftOpenedDate shift={shift} />}
                    </div>

                    {shift.status === "completed" && shift.completed_at && (
                      <div className="flex items-center gap-1 sm:ml-4">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>
                          Зміна закрита: {formatDateTime(shift.completed_at)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                {shift.status === "active" && (
                  <CompleteShiftButton shift={shift} />
                )}
                {shift.status === "completed" && (
                  <DeleteShiftButton shift={shift} />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Розділ для заробітної плати за продукцію */}
        {(shift.production && shift.production.length > 0) ||
        hourlyWageExpensesTotal > 0 ? (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span>Заробітна плата за зміну</span>
              </CardTitle>
              <CardDescription>
                Розрахунок виплат за продукцію та погодинні витрати
              </CardDescription>
            </CardHeader>
            <CardContent>
              {wagesByProduct.length === 0 && hourlyWageExpensesTotal === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Немає даних про нарахування за зміну.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-muted p-4 rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">
                        Винагорода за продукцію
                      </div>
                      <div className="text-2xl font-bold">
                        {totalWages.toFixed(2)} грн
                      </div>
                    </div>

                    <div className="bg-muted p-4 rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">
                        Додаткові витрати (З.П. Погодинна)
                      </div>
                      <div className="text-2xl font-bold">
                        {hourlyWageExpensesTotal.toFixed(2)} грн
                      </div>
                    </div>

                    {employeeCount > 0 && (
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">
                          Разом до виплати
                        </div>
                        <div className="text-2xl font-bold">
                          {totalCompensation.toFixed(2)} грн
                        </div>
                      </div>
                    )}

                    {employeeCount > 0 && (
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">
                          На одного працівника ({employeeCount} осіб), разом
                        </div>
                        <div className="text-2xl font-bold">
                          {totalCompensationPerEmployee.toFixed(2)} грн
                        </div>
                      </div>
                    )}
                  </div>

                  {hourlyWageExpenses.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">
                        Додаткові витрати (З.П. Погодинна)
                      </h4>
                      <div className="space-y-2">
                        {hourlyWageExpenses.map((expense) => (
                          <div
                            key={expense.id}
                            className="flex items-center justify-between py-2 border-b last:border-0"
                          >
                            <div className="text-sm text-muted-foreground">
                              {expense.description || "Без коментаря"}
                            </div>
                            <div className="font-medium">
                              {expense.amount.toFixed(2)} грн
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {wagesByProduct.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">
                        Деталі по продукції
                      </h4>
                      <div className="space-y-2">
                        {wagesByProduct.map((item) => (
                          <div
                            key={item.productId}
                            className="flex items-center justify-between py-2 border-b last:border-0"
                          >
                            <div>
                              <div className="font-medium">
                                {item.productName}
                              </div>
                              {shift.status === "active" ? (
                                <form
                                  action={handleUpdateShiftProductionReward}
                                  className="mt-1 flex flex-wrap items-end gap-2"
                                >
                                  <input
                                    type="hidden"
                                    name="shift_id"
                                    value={shift.id}
                                  />
                                  <input
                                    type="hidden"
                                    name="product_id"
                                    value={item.productId}
                                  />
                                  <div className="text-sm text-muted-foreground">
                                    {item.quantity} шт x
                                  </div>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    name="reward_override"
                                    defaultValue={item.effectiveReward.toFixed(2)}
                                    className="h-8 w-28"
                                  />
                                  <Button size="sm" type="submit">
                                    Зберегти
                                  </Button>
                                  <div className="w-full text-xs text-muted-foreground">
                                    Базовий тариф: {item.reward.toFixed(2)} грн
                                    {item.rewardOverride !== null
                                      ? " (застосовано індивідуальний тариф)"
                                      : ""}
                                  </div>
                                </form>
                              ) : (
                                <div className="text-sm text-muted-foreground">
                                  {item.quantity} шт × {item.effectiveReward.toFixed(2)} грн
                                </div>
                              )}
                            </div>
                            <div className="font-medium">
                              {item.total.toFixed(2)} грн
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {shift.status === "completed" && shift.production.length > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Підсумок виробництва</CardTitle>
              <CardDescription>
                Загальна кількість виробленої продукції за категоріями
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                return (
                  <div className="space-y-2">
                    {Object.entries(productionByCategory).map(
                      ([category, total]) => (
                        <div
                          key={category}
                          className="flex items-center justify-between py-2 border-b last:border-0"
                        >
                          <span className="font-medium">{category}</span>
                          <span>{total} шт</span>
                        </div>
                      )
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {shift.notes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Примітки</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{shift.notes}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Облік продукції</span>
              <Badge variant="outline" className="ml-2 text-base font-normal">
                Всього: {totalProduction} шт
              </Badge>
            </CardTitle>
            <CardDescription>
              Кількість виробленої продукції на цій зміні
            </CardDescription>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(productionByCategory).length === 0 ? (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  <span>Категорії відсутні</span>
                </Badge>
              ) : (
                Object.entries(productionByCategory).map(([category, total]) => (
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
                ))
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {shift.production.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Немає даних про вироблену продукцію
              </div>
            ) : (
              <div className="space-y-2">
                {shift.production.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <span>{item.product.name}</span>
                    <span className="font-medium">{item.quantity}</span>
                  </div>
                ))}
              </div>
            )}

            {shift.status === "active" && (
              <>
                <Separator />
                <div className="pt-2">
                  <h4 className="text-sm font-medium mb-2">
                    Облік виробленої продукції
                  </h4>
                  <ProductionItemsForm
                    shift={shift}
                    products={products}
                    existingProduction={shift.production || []}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Розрахунок погодинної роботи
            </CardTitle>
            <CardDescription>
              Кількість годин × ставка (грн/год). Результат додається до обліку витрат — З.П. Погодинна
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HourlyWageForm
              shiftId={shift.id}
              shiftOpenedAt={
                shift.opened_at ||
                shift.created_at ||
                shift.shift_date
              }
              employeeCount={shift.employees.length}
            />
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-1">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Працівники на зміні</CardTitle>
              <CardDescription>
                Працівники, які працюють на цій зміні
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {shift.employees.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Немає працівників на цій зміні
                </div>
              ) : (
                <div className="space-y-2">
                  {shift.employees.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{item.employee.name}</span>
                        {item.employee.position && (
                          <span className="text-sm text-muted-foreground">
                            ({item.employee.position})
                          </span>
                        )}
                      </div>
                      {shift.status === "active" && (
                        <RemoveEmployeeButton
                          shiftId={shift.id}
                          employeeId={item.employee_id}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {shift.status === "active" && (
                <>
                  <Separator />
                  <div className="pt-2">
                    <h4 className="text-sm font-medium mb-2">
                      Додати працівника
                    </h4>
                    <AddEmployeeToShift
                      shift={shift}
                      employees={employees}
                      existingEmployeeIds={existingEmployeeIds}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
