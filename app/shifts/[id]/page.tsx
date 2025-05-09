// app/shifts/[id]/page.tsx
// Додайте наступний код на початку компонента, щоб відключити кешування даних
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { getEmployees, getProducts, getShiftDetails } from "@/app/actions";
import { AddEmployeeToShift } from "@/components/add-employee-to-shift";
import { CompleteShiftButton } from "@/components/complete-shift-button";
import { DeleteShiftButton } from "@/components/delete-shift-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDateTime } from "@/lib/utils";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Package,
  DollarSign,
} from "lucide-react";
import { RemoveEmployeeButton } from "@/components/remove-employee-button";
import { ProductionItemsForm } from "@/components/production-items-form";
import type { ShiftWithDetails } from "@/lib/types";

interface ShiftPageProps {
  params: {
    id: string;
  };
}

export default async function ShiftPage({ params }: ShiftPageProps) {
  const shiftId = Number.parseInt(params.id);

  if (isNaN(shiftId)) {
    notFound();
  }

  const shift = await getShiftDetails(shiftId);

  if (!shift) {
    notFound();
  }

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
    total: number;
  }> = [];

  let totalWages = 0;

  if (shift.production && shift.production.length > 0) {
    shift.production.forEach((item) => {
      if (item.product.reward && item.product.reward > 0) {
        const productWage = item.quantity * item.product.reward;
        totalWages += productWage;

        wagesByProduct.push({
          productId: item.product_id,
          productName: item.product.name,
          quantity: item.quantity,
          reward: item.product.reward,
          total: productWage,
        });
      }
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
  const wagePerEmployee = employeeCount > 0 ? totalWages / employeeCount : 0;

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
                        {formatDateTime(shift.created_at || shift.shift_date)}
                      </span>
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
        {shift.production && shift.production.length > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span>Заробітна плата за продукцію</span>
              </CardTitle>
              <CardDescription>
                Розрахунок заробітної плати на основі винагороди за продукцію
              </CardDescription>
            </CardHeader>
            <CardContent>
              {wagesByProduct.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Немає даних про винагороду за продукцію. Встановіть винагороду
                  для продуктів у розділі "Продукція".
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-muted p-4 rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">
                        Загальна сума винагороди
                      </div>
                      <div className="text-2xl font-bold">
                        {totalWages.toFixed(2)} грн
                      </div>
                    </div>

                    {employeeCount > 0 && (
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">
                          На одного працівника ({employeeCount} осіб)
                        </div>
                        <div className="text-2xl font-bold">
                          {wagePerEmployee.toFixed(2)} грн
                        </div>
                      </div>
                    )}
                  </div>

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
                            <div className="text-sm text-muted-foreground">
                              {item.quantity} шт × {item.reward.toFixed(2)} грн
                            </div>
                          </div>
                          <div className="font-medium">
                            {item.total.toFixed(2)} грн
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
              {totalProduction > 0 && (
                <Badge variant="outline" className="ml-2 text-base font-normal">
                  Всього: {totalProduction} шт
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Кількість виробленої продукції на цій зміні
            </CardDescription>
            {totalProduction > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
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
            )}
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
