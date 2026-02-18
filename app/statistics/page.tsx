"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  getProductionStats,
  getShifts,
  getProducts,
  getProductCategories,
} from "@/app/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  BarChart,
  Package,
  PieChart,
  TrendingUp,
} from "lucide-react";
import type { ShiftWithDetails, Product, ProductCategory } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  dateToYYYYMMDD,
  formatNumber,
  formatNumberWithUnit,
  getDateRangeForPeriod,
  formatPercentage,
} from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type PeriodFilter = "year" | "month" | "week";

export default function StatisticsPage() {
  const [period, setPeriod] = useState<PeriodFilter>("year");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [productionStats, setProductionStats] = useState<{
    totalProduction: number;
    productionByCategory: Record<string, number>;
  }>({
    totalProduction: 0,
    productionByCategory: {},
  });
  const [shifts, setShifts] = useState<ShiftWithDetails[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showMonthlyChart, setShowMonthlyChart] = useState(false);
  const [showAverageChart, setShowAverageChart] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [stats, shiftsData, productsData, categoriesData] =
          await Promise.all([
            getProductionStats(period, selectedYear),
            getShifts(),
            getProducts(),
            getProductCategories(),
          ]);

        setProductionStats(stats);
        setProducts(productsData || []);
        setCategories(categoriesData || []);

        const completedShifts = (shiftsData || []).filter(
          (shift) => shift.status === "completed"
        ) as ShiftWithDetails[];
        setShifts(completedShifts);
      } catch (error) {
        console.error("Помилка при завантаженні даних:", error);
        setProductionStats({ totalProduction: 0, productionByCategory: {} });
        setProducts([]);
        setCategories([]);
        setShifts([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [period, selectedYear]);

  const { totalProduction, productionByCategory } = productionStats;

  const categoryColors: Record<string, string> = {
    "Без категорії": "hsl(var(--muted))",
  };

  categories.forEach((category, index) => {
    const hues = [200, 150, 100, 50, 300, 250, 350];
    categoryColors[category.name] = `hsl(${
      hues[index % hues.length]
    }, 70%, 50%)`;
  });

  const categoryPercentages: Record<string, number> = {};
  Object.entries(productionByCategory).forEach(([category, amount]) => {
    categoryPercentages[category] =
      totalProduction > 0 ? (amount / totalProduction) * 100 : 0;
  });

  const sortedCategories = Object.entries(productionByCategory).sort(
    (a, b) => b[1] - a[1]
  );

  const { startDate: periodStart, endDate: periodEnd } = useMemo(
    () => getDateRangeForPeriod(period, selectedYear),
    [period, selectedYear]
  );
  const periodStartStr = dateToYYYYMMDD(periodStart);
  const periodEndStr = dateToYYYYMMDD(periodEnd);

  const shiftsInPeriod = useMemo(() => {
    return shifts.filter((shift) => {
      if (shift.status !== "completed") return false;
      const d = shift.shift_date
        ? String(shift.shift_date).slice(0, 10)
        : "";
      return d >= periodStartStr && d <= periodEndStr;
    });
  }, [shifts, periodStartStr, periodEndStr]);

  const shiftsWithProduction = shiftsInPeriod.length;
  const averageProductionPerShift =
    shiftsWithProduction > 0 ? totalProduction / shiftsWithProduction : 0;

  const periodLabel = useMemo(() => {
    if (period === "year") return `Рік ${selectedYear}`;
    if (period === "month") {
      const monthNames = [
        "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
        "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень",
      ];
      return `${monthNames[new Date().getMonth()]} ${selectedYear}`;
    }
    return "Поточний тиждень";
  }, [period, selectedYear]);

  // Функція для отримання назв місяців українською
  const getMonthName = (monthIndex: number): string => {
    const months = [
      "Січень",
      "Лютий",
      "Березень",
      "Квітень",
      "Травень",
      "Червень",
      "Липень",
      "Серпень",
      "Вересень",
      "Жовтень",
      "Листопад",
      "Грудень",
    ];
    return months[monthIndex];
  };

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    shifts.forEach((shift) => {
      if (shift.shift_date) {
        const year = new Date(shift.shift_date).getFullYear();
        years.add(year);
      }
    });
    const currentYear = new Date().getFullYear();
    if (!years.has(currentYear)) {
      years.add(currentYear);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [shifts]);

  const monthlyProductionData = useMemo(() => {
    const monthlyData: Record<string, number> = {};

    for (let month = 0; month < 12; month++) {
      const monthKey = `${selectedYear}-${String(month + 1).padStart(2, "0")}`;
      monthlyData[monthKey] = 0;
    }

    shifts.forEach((shift) => {
      if (shift.status === "completed" && shift.production) {
        const shiftDate = new Date(shift.shift_date);
        const year = shiftDate.getFullYear();
        const month = shiftDate.getMonth() + 1;
        const monthKey = `${year}-${String(month).padStart(2, "0")}`;

        // Підраховуємо загальну кількість продукції за зміну
        let shiftTotal = 0;
        shift.production.forEach((item) => {
          shiftTotal += item.quantity;
        });

        if (year === selectedYear) {
          monthlyData[monthKey] = (monthlyData[monthKey] || 0) + shiftTotal;
        }
      }
    });

    return Object.entries(monthlyData)
      .map(([key, value]) => {
        const [year, month] = key.split("-");
        return {
          month: getMonthName(parseInt(month) - 1),
          production: value,
          monthIndex: parseInt(month) - 1,
        };
      })
      .sort((a, b) => a.monthIndex - b.monthIndex);
  }, [shifts, selectedYear]);

  const monthlyAverageProductionData = useMemo(() => {
    const monthlyData: Record<string, { total: number; shiftsCount: number }> =
      {};

    for (let month = 0; month < 12; month++) {
      const monthKey = `${selectedYear}-${String(month + 1).padStart(2, "0")}`;
      monthlyData[monthKey] = { total: 0, shiftsCount: 0 };
    }

    shifts.forEach((shift) => {
      if (shift.status === "completed" && shift.production) {
        const shiftDate = new Date(shift.shift_date);
        const year = shiftDate.getFullYear();
        const month = shiftDate.getMonth() + 1;
        const monthKey = `${year}-${String(month).padStart(2, "0")}`;

        // Підраховуємо загальну кількість продукції за зміну
        let shiftTotal = 0;
        shift.production.forEach((item) => {
          shiftTotal += item.quantity;
        });

        if (year === selectedYear) {
          monthlyData[monthKey].total =
            (monthlyData[monthKey].total || 0) + shiftTotal;
          monthlyData[monthKey].shiftsCount =
            (monthlyData[monthKey].shiftsCount || 0) + 1;
        }
      }
    });

    return Object.entries(monthlyData)
      .map(([key, data]) => {
        const [year, month] = key.split("-");
        const average =
          data.shiftsCount > 0 ? data.total / data.shiftsCount : 0;
        return {
          month: getMonthName(parseInt(month) - 1),
          average: average,
          monthIndex: parseInt(month) - 1,
        };
      })
      .sort((a, b) => a.monthIndex - b.monthIndex);
  }, [shifts, selectedYear]);

  if (isLoading) {
    return (
      <div className="container py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="grid gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Статистика виробництва</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Аналіз виробленої продукції за період: {periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(parseInt(value))}
          >
            <SelectTrigger className="w-[100px] sm:w-[120px]">
              <SelectValue placeholder="Рік" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={period === "year" ? "default" : "outline"}
            onClick={() => setPeriod("year")}
            className="text-xs sm:text-sm px-2 sm:px-4"
          >
            Рік
          </Button>
          <Button
            variant={period === "month" ? "default" : "outline"}
            onClick={() => setPeriod("month")}
            className="text-xs sm:text-sm px-2 sm:px-4"
          >
            Місяць
          </Button>
          <Button
            variant={period === "week" ? "default" : "outline"}
            onClick={() => setPeriod("week")}
            className="text-xs sm:text-sm px-2 sm:px-4"
          >
            Тиждень
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <span>Загальне виробництво</span>
            </CardTitle>
            <CardDescription>
              Загальна кількість виробленої продукції
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold mb-4">
              {formatNumberWithUnit(totalProduction, "шт")}
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowMonthlyChart(!showMonthlyChart)}
            >
              Детальніше
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5 text-primary" />
              <span>Завершені зміни</span>
            </CardTitle>
            <CardDescription>
              Кількість завершених змін з виробництвом
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">
              {formatNumber(shiftsWithProduction)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>Середнє виробництво</span>
            </CardTitle>
            <CardDescription>
              Середня кількість продукції на зміну
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold mb-4">
              {formatNumberWithUnit(averageProductionPerShift, "шт", {
                maximumFractionDigits: 1,
              })}
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowAverageChart(!showAverageChart)}
            >
              Детальніше
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Картка з помісячним графіком */}
      {showMonthlyChart && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>Помісячний графік виробництва</span>
            </CardTitle>
            <CardDescription>
              Динаміка виробленої продукції по місяцях {selectedYear} року
            </CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyProductionData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Немає даних про виробництво
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyProductionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    label={{
                      value: "Кількість (шт)",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <Tooltip
                    formatter={(value: number) =>
                      formatNumberWithUnit(value, "шт")
                    }
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="production"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Картка з графіком середнього виробництва */}
      {showAverageChart && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>Помісячний графік середнього виробництва</span>
            </CardTitle>
            <CardDescription>
              Динаміка середньої кількості продукції на зміну по місяцях {selectedYear} року
            </CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyAverageProductionData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Немає даних про виробництво
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyAverageProductionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    label={{
                      value: "Середнє (шт/зміну)",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <Tooltip
                    formatter={(value: number) =>
                      formatNumberWithUnit(value, "шт", {
                        maximumFractionDigits: 1,
                      })
                    }
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="average"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              <span>Розподіл за категоріями</span>
            </CardTitle>
            <CardDescription>
              Відсоткове співвідношення виробленої продукції за категоріями
            </CardDescription>
          </CardHeader>
          <CardContent>
            {totalProduction === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Немає даних про виробництво
              </div>
            ) : (
              <div className="space-y-4">
                {/* Візуалізація у вигляді горизонтальних смуг */}
                <div className="h-8 w-full bg-muted rounded-full overflow-hidden flex">
                  {sortedCategories.map(([category, amount], index) => {
                    const percentage = categoryPercentages[category];
                    const color =
                      categoryColors[category] || "hsl(var(--primary))";
                    return (
                      <div
                        key={category}
                        className="h-full"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: color,
                          transition: "width 1s ease-in-out",
                        }}
                        title={`${category}: ${formatNumberWithUnit(
                          amount,
                          "шт"
                        )} (${formatPercentage(percentage, 1)})`}
                      ></div>
                    );
                  })}
                </div>

                {/* Легенда */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                  {sortedCategories.map(([category, amount]) => {
                    const percentage = categoryPercentages[category];
                    const color =
                      categoryColors[category] || "hsl(var(--primary))";
                    return (
                      <div key={category} className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-sm"
                          style={{ backgroundColor: color }}
                        ></div>
                        <div className="flex-1 flex justify-between items-center">
                          <span className="font-medium">{category}</span>
                          <span className="text-sm text-muted-foreground">
                            {formatNumberWithUnit(amount, "шт")} (
                            {formatPercentage(percentage, 1)})
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5 text-primary" />
              <span>Деталі по категоріях</span>
            </CardTitle>
            <CardDescription>
              Кількість виробленої продукції за категоріями
            </CardDescription>
          </CardHeader>
          <CardContent>
            {totalProduction === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Немає даних про виробництво
              </div>
            ) : (
              <div className="space-y-4">
                {sortedCategories.map(([category, amount]) => {
                  const percentage = categoryPercentages[category];
                  const color =
                    categoryColors[category] || "hsl(var(--primary))";
                  return (
                    <div key={category} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{category}</span>
                        <span className="text-sm font-medium">
                          {formatNumberWithUnit(amount, "шт")}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: color,
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <span>Деталі виробництва</span>
          </CardTitle>
          <CardDescription>
            Детальна інформація про вироблену продукцію
          </CardDescription>
        </CardHeader>
        <CardContent>
          {totalProduction === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Немає даних про виробництво
            </div>
          ) : (
            <div className="space-y-6">
              {/* Створюємо графік для кожної категорії */}
              {sortedCategories
                .map(([category, totalAmount]) => {
                  const categoryProducts = products.filter(
                    (product) =>
                      (category === "Без категорії" && !product.category_id) ||
                      product.category?.name === category
                  );

                  const productStats = categoryProducts.map((product) => {
                    let productTotal = 0;

                    shiftsInPeriod.forEach((shift) => {
                      if (shift.production) {
                        const productionItem = shift.production.find(
                          (item) => item.product_id === product.id
                        );
                        if (productionItem) {
                          productTotal += productionItem.quantity;
                        }
                      }
                    });

                    return {
                      product,
                      total: productTotal,
                      percentage:
                        totalProduction > 0
                          ? (productTotal / totalProduction) * 100
                          : 0,
                    };
                  });

                  const sortedProducts = productStats
                    .filter((stat) => stat.total > 0)
                    .sort((a, b) => b.total - a.total);

                  if (sortedProducts.length === 0) return null;

                  const maxValue = Math.max(
                    ...sortedProducts.map((p) => p.total)
                  );

                  return (
                    <div key={category} className="pt-4">
                      <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-sm"
                          style={{
                            backgroundColor:
                              categoryColors[category] || "hsl(var(--primary))",
                          }}
                        ></div>
                        {category}
                      </h3>

                      <div className="space-y-3">
                        {sortedProducts.map(
                          ({ product, total, percentage }) => (
                            <div key={product.id} className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span
                                  className="font-medium truncate max-w-[60%]"
                                  title={product.name}
                                >
                                  {product.name}
                                </span>
                                <span className="text-sm font-medium">
                                  {formatNumberWithUnit(total, "шт")}{" "}
                                  <span className="text-muted-foreground">
                                    ({formatPercentage(percentage, 1)})
                                  </span>
                                </span>
                              </div>
                              <div className="relative h-8 bg-muted rounded-md overflow-hidden">
                                <div
                                  className="absolute top-0 left-0 h-full rounded-md transition-all duration-500 ease-in-out flex items-center justify-between px-2"
                                  style={{
                                    width: `${Math.max(
                                      (total / maxValue) * 100,
                                      10
                                    )}%`,
                                    backgroundColor:
                                      categoryColors[category] ||
                                      "hsl(var(--primary))",
                                  }}
                                >
                                  <span className="text-xs font-medium text-white whitespace-nowrap overflow-hidden text-ellipsis">
                                    {formatNumber(total)}{" "}
                                    <span className="opacity-80">
                                      ({formatPercentage(percentage, 1)})
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  );
                })
                .filter(Boolean)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
