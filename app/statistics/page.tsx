"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  getProductionStats,
  getShifts,
  getProducts,
  getProductCategories,
  getExpenses,
  getSupplierDeliveries,
  getBarkShipmentsTotal,
  getBarkShipmentsBreakdown,
  getPackingBagPurchases,
  type BarkShipmentsBreakdown,
  type StatisticsDateRange,
} from "@/app/actions";
import {
  PACKING_BAG_PRODUCT_NAME,
  type PackingBagPurchase,
} from "@/lib/packing-bags/packing-bag-purchase";
import { getTrips } from "@/app/trips/actions";
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
  Calendar as CalendarIcon,
  Package,
  PieChart,
  Truck,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarRangePicker } from "@/components/ui/calendar";
import {
  cn,
  dateToYYYYMMDD,
  formatDate,
  formatNumber,
  formatNumberWithUnit,
  getDateRangeForPeriod,
  formatPercentage,
  inclusiveCalendarDaysBetween,
} from "@/lib/utils";
import { uk } from "date-fns/locale";
import {
  LineChart,
  Line,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type PeriodFilter = "year" | "month" | "week";

type SupplierDeliveryLike = {
  quantity: number;
  price_per_unit: number | null;
  created_at: string;
};

type ExpenseLike = {
  amount: number;
  date: string;
  category?: {
    name?: string | null;
  } | null;
};

type TripLike = {
  trip_type: string | null;
  total_costs_uah: number | null;
  bags_count: number | null;
  trip_start_date: string | null;
  trip_date: string;
};

const priceUahFromLatestPackingBagPurchase = (purchases: PackingBagPurchase[]) => {
  const row = purchases[0];
  if (!row) return 0;
  const n = Number(row.price_uah);
  return Number.isFinite(n) ? n : 0;
};

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
  const [expenses, setExpenses] = useState<ExpenseLike[]>([]);
  const [supplierDeliveries, setSupplierDeliveries] = useState<SupplierDeliveryLike[]>(
    []
  );
  const [trips, setTrips] = useState<TripLike[]>([]);
  const [latestPackingBagPriceUah, setLatestPackingBagPriceUah] = useState(0);
  const [barkShipmentsTotal, setBarkShipmentsTotal] = useState(0);
  const [barkShipmentsDetailOpen, setBarkShipmentsDetailOpen] = useState(false);
  const [barkShipmentsBreakdown, setBarkShipmentsBreakdown] =
    useState<BarkShipmentsBreakdown | null>(null);
  const [barkShipmentsDetailLoading, setBarkShipmentsDetailLoading] =
    useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [monthlyProductionChartOpen, setMonthlyProductionChartOpen] =
    useState(false);
  const [averageProductionChartOpen, setAverageProductionChartOpen] =
    useState(false);
  const [filterDateRange, setFilterDateRange] = useState<{
    from?: Date;
    to?: Date;
  }>({});

  const statsDateRange = useMemo((): StatisticsDateRange | null => {
    if (filterDateRange.from && filterDateRange.to) {
      return {
        start: dateToYYYYMMDD(filterDateRange.from),
        end: dateToYYYYMMDD(filterDateRange.to),
      };
    }
    return null;
  }, [filterDateRange.from, filterDateRange.to]);

  const statsDateRangeKey = statsDateRange
    ? `${statsDateRange.start}_${statsDateRange.end}`
    : "";

  useEffect(() => {
    if (!barkShipmentsDetailOpen) return;
    let cancelled = false;
    setBarkShipmentsBreakdown(null);
    setBarkShipmentsDetailLoading(true);
    (async () => {
      try {
        const data = await getBarkShipmentsBreakdown(
          period,
          selectedYear,
          statsDateRange
        );
        if (!cancelled) {
          setBarkShipmentsBreakdown(data);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setBarkShipmentsBreakdown({
            byProduct: [],
            timeSeries: [],
            chartCaption: "",
            usesMonthlyTimeBuckets: false,
          });
        }
      } finally {
        if (!cancelled) {
          setBarkShipmentsDetailLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [barkShipmentsDetailOpen, period, selectedYear, statsDateRangeKey]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [
          stats,
          shiftsData,
          productsData,
          categoriesData,
          expensesData,
          deliveriesData,
          packingBagPurchasesData,
          tripsData,
          barkShipped,
        ] =
          await Promise.all([
            getProductionStats(period, selectedYear, statsDateRange),
            getShifts(),
            getProducts(),
            getProductCategories(),
            getExpenses(),
            getSupplierDeliveries(),
            getPackingBagPurchases(),
            getTrips(),
            getBarkShipmentsTotal(period, selectedYear, statsDateRange),
          ]);

        setProductionStats(stats);
        setBarkShipmentsTotal(barkShipped?.totalShipped ?? 0);
        setProducts(productsData || []);
        setCategories(categoriesData || []);
        setExpenses((expensesData || []) as ExpenseLike[]);
        setSupplierDeliveries((deliveriesData || []) as SupplierDeliveryLike[]);
        setLatestPackingBagPriceUah(
          priceUahFromLatestPackingBagPurchase(packingBagPurchasesData || [])
        );
        setTrips((tripsData || []) as TripLike[]);

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
        setExpenses([]);
        setSupplierDeliveries([]);
        setLatestPackingBagPriceUah(0);
        setTrips([]);
        setBarkShipmentsTotal(0);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [period, selectedYear, statsDateRangeKey]);

  const { totalProduction, productionByCategory } = productionStats;

  const neutralPalette = [
    "hsl(215, 32%, 48%)",
    "hsl(180, 28%, 44%)",
    "hsl(260, 30%, 52%)",
    "hsl(35, 36%, 48%)",
    "hsl(200, 28%, 42%)",
    "hsl(280, 28%, 50%)",
    "hsl(150, 30%, 46%)",
    "hsl(240, 32%, 50%)",
  ];

  const categoryColors: Record<string, string> = {
    "Без категорії": "hsl(var(--muted))",
  };

  const categoryNames = [
    ...new Set([
      ...categories.map((c) => c.name),
      ...Object.keys(productionByCategory),
    ]),
  ];
  categoryNames.forEach((name, index) => {
    if (!categoryColors[name]) {
      categoryColors[name] =
        neutralPalette[index % neutralPalette.length];
    }
  });

  const categoryPercentages: Record<string, number> = {};
  Object.entries(productionByCategory).forEach(([category, amount]) => {
    categoryPercentages[category] =
      totalProduction > 0 ? (amount / totalProduction) * 100 : 0;
  });

  const sortedCategories = Object.entries(productionByCategory).sort(
    (a, b) => b[1] - a[1]
  );

  const { startDate: periodStart, endDate: periodEnd } = useMemo(() => {
    if (statsDateRange) {
      const [ys, ms, ds] = statsDateRange.start
        .split("-")
        .map((x) => Number.parseInt(x, 10));
      const [ye, me, de] = statsDateRange.end
        .split("-")
        .map((x) => Number.parseInt(x, 10));
      return {
        startDate: new Date(ys, ms - 1, ds, 0, 0, 0, 0),
        endDate: new Date(ye, me - 1, de, 23, 59, 59, 999),
      };
    }
    return getDateRangeForPeriod(period, selectedYear);
  }, [statsDateRange, period, selectedYear]);
  const periodStartStr = dateToYYYYMMDD(periodStart);
  const periodEndStr = dateToYYYYMMDD(periodEnd);

  const previousPeriodRange = useMemo(() => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const rangeDays =
      Math.floor((periodEnd.getTime() - periodStart.getTime()) / DAY_MS) + 1;
    const prevEnd = new Date(periodStart);
    prevEnd.setDate(prevEnd.getDate() - 1);
    prevEnd.setHours(23, 59, 59, 999);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevEnd.getDate() - rangeDays + 1);
    prevStart.setHours(0, 0, 0, 0);
    return { prevStart, prevEnd };
  }, [periodStart, periodEnd]);

  const toDayKey = (value?: string | null): string => {
    if (!value) return "";
    return String(value).slice(0, 10);
  };

  const isDayInRange = (day: string, startDay: string, endDay: string) => {
    if (!day) return false;
    return day >= startDay && day <= endDay;
  };

  const sumRawTripsCostsInRange = (startDay: string, endDay: string) =>
    trips.reduce((sum, trip) => {
      if (trip.trip_type !== "raw") return sum;
      const day = toDayKey(trip.trip_start_date || trip.trip_date);
      if (!isDayInRange(day, startDay, endDay)) return sum;
      return sum + Number(trip.total_costs_uah ?? 0);
    }, 0);

  const sumBagsInRange = (startDay: string, endDay: string) =>
    trips.reduce((sum, trip) => {
      if (trip.trip_type !== "raw") return sum;
      const day = toDayKey(trip.trip_start_date || trip.trip_date);
      if (!isDayInRange(day, startDay, endDay)) return sum;
      return sum + Number(trip.bags_count ?? 0);
    }, 0);

  const sumPurchaseCostsInRange = (startDay: string, endDay: string) =>
    supplierDeliveries.reduce((sum, delivery) => {
      const day = toDayKey(delivery.created_at);
      if (!isDayInRange(day, startDay, endDay)) return sum;
      const amount =
        Number(delivery.quantity ?? 0) * Number(delivery.price_per_unit ?? 0);
      return amount > 0 ? sum + amount : sum;
    }, 0);

  const sumPurchaseBagsInRange = (startDay: string, endDay: string) =>
    supplierDeliveries.reduce((sum, delivery) => {
      const day = toDayKey(delivery.created_at);
      if (!isDayInRange(day, startDay, endDay)) return sum;
      return sum + Number(delivery.quantity ?? 0);
    }, 0);

  const sumHourlyWageCostsInRange = (startDay: string, endDay: string) =>
    expenses.reduce((sum, expense) => {
      const day = toDayKey(expense.date);
      if (!isDayInRange(day, startDay, endDay)) return sum;
      const categoryName = String(expense.category?.name ?? "").trim();
      if (categoryName !== "З.П. Погодинна") return sum;
      return sum + Number(expense.amount ?? 0);
    }, 0);

  const sumProducedQuantityInRange = (startDay: string, endDay: string) =>
    shifts.reduce((sum, shift) => {
      if (shift.status !== "completed") return sum;
      const day = toDayKey(shift.shift_date);
      if (!isDayInRange(day, startDay, endDay)) return sum;
      const producedInShift =
        shift.production?.reduce(
          (acc, item) => acc + Number(item.quantity ?? 0),
          0
        ) ?? 0;
      return sum + producedInShift;
    }, 0);

  const fixedRewardPerBag = useMemo(() => {
    const firstRewardProduct = products.find((product) => Number(product.reward ?? 0) > 0);
    return firstRewardProduct ? Number(firstRewardProduct.reward ?? 0) : 0;
  }, [products]);

  const currentPeriodCostMetrics = useMemo(() => {
    const startDay = periodStartStr;
    const endDay = periodEndStr;

    const purchaseCosts = sumPurchaseCostsInRange(startDay, endDay);
    const purchaseBags = sumPurchaseBagsInRange(startDay, endDay);
    const rawTripCosts = sumRawTripsCostsInRange(startDay, endDay);
    const tripBags = sumBagsInRange(startDay, endDay);
    const hourlyWageCosts = sumHourlyWageCostsInRange(startDay, endDay);
    const producedQuantity = sumProducedQuantityInRange(startDay, endDay);
    const purchaseCostPerBag = purchaseBags > 0 ? purchaseCosts / purchaseBags : null;
    const tripCostPerBag = tripBags > 0 ? rawTripCosts / tripBags : null;
    const hourlyWagePerBag =
      producedQuantity > 0 ? hourlyWageCosts / producedQuantity : 0;
    const packingBagFromLatestTx = latestPackingBagPriceUah;
    const totalCostPerBag =
      purchaseCostPerBag != null && tripCostPerBag != null
        ? purchaseCostPerBag +
          tripCostPerBag +
          fixedRewardPerBag +
          hourlyWagePerBag +
          packingBagFromLatestTx
        : null;

    return {
      purchaseCosts,
      purchaseBags,
      rawTripCosts,
      tripBags,
      producedQuantity,
      hourlyWageCosts,
      purchaseCostPerBag,
      tripCostPerBag,
      fixedRewardPerBag,
      hourlyWagePerBag,
      packingBagFromLatestTx,
      totalCostPerBag,
    };
  }, [
    periodStartStr,
    periodEndStr,
    expenses,
    fixedRewardPerBag,
    supplierDeliveries,
    trips,
    latestPackingBagPriceUah,
    shifts,
  ]);

  const previousPeriodCostMetrics = useMemo(() => {
    const prevStartDay = dateToYYYYMMDD(previousPeriodRange.prevStart);
    const prevEndDay = dateToYYYYMMDD(previousPeriodRange.prevEnd);

    const purchaseCosts = sumPurchaseCostsInRange(prevStartDay, prevEndDay);
    const purchaseBags = sumPurchaseBagsInRange(prevStartDay, prevEndDay);
    const rawTripCosts = sumRawTripsCostsInRange(prevStartDay, prevEndDay);
    const tripBags = sumBagsInRange(prevStartDay, prevEndDay);
    const hourlyWageCosts = sumHourlyWageCostsInRange(prevStartDay, prevEndDay);
    const producedQuantity = sumProducedQuantityInRange(prevStartDay, prevEndDay);
    const purchaseCostPerBag = purchaseBags > 0 ? purchaseCosts / purchaseBags : null;
    const tripCostPerBag = tripBags > 0 ? rawTripCosts / tripBags : null;
    const hourlyWagePerBag =
      producedQuantity > 0 ? hourlyWageCosts / producedQuantity : 0;
    const packingBagFromLatestTx = latestPackingBagPriceUah;
    const totalCostPerBag =
      purchaseCostPerBag != null && tripCostPerBag != null
        ? purchaseCostPerBag +
          tripCostPerBag +
          fixedRewardPerBag +
          hourlyWagePerBag +
          packingBagFromLatestTx
        : null;

    return {
      totalCostPerBag,
    };
  }, [
    previousPeriodRange,
    expenses,
    fixedRewardPerBag,
    supplierDeliveries,
    trips,
    latestPackingBagPriceUah,
    shifts,
  ]);

  const getChangePercent = (current: number | null, previous: number | null) => {
    if (current == null || previous == null || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  const totalDeltaPercent = getChangePercent(
    currentPeriodCostMetrics.totalCostPerBag,
    previousPeriodCostMetrics.totalCostPerBag
  );

  const structureTotal =
    (currentPeriodCostMetrics.purchaseCostPerBag ?? 0) +
    (currentPeriodCostMetrics.tripCostPerBag ?? 0) +
    (currentPeriodCostMetrics.fixedRewardPerBag ?? 0) +
    (currentPeriodCostMetrics.hourlyWagePerBag ?? 0) +
    (currentPeriodCostMetrics.packingBagFromLatestTx ?? 0);
  const structureRows = [
    {
      label: "Середня вартість мішка із закупок",
      value: currentPeriodCostMetrics.purchaseCostPerBag ?? 0,
    },
    {
      label: "Середня вартість мішка з поїздок",
      value: currentPeriodCostMetrics.tripCostPerBag ?? 0,
    },
    {
      label: "Винагорода на мішок (фіксована)",
      value: currentPeriodCostMetrics.fixedRewardPerBag ?? 0,
    },
    {
      label: "Погодинна З.П. на мішок",
      value: currentPeriodCostMetrics.hourlyWagePerBag ?? 0,
    },
    {
      label: `«${PACKING_BAG_PRODUCT_NAME}» (остання закупівля)`,
      value: currentPeriodCostMetrics.packingBagFromLatestTx ?? 0,
    },
  ].map((item) => ({
    ...item,
    percent: structureTotal > 0 ? (item.value / structureTotal) * 100 : 0,
  }));

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
    if (statsDateRange) {
      const fmt = (ymd: string) => {
        const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
        return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
      };
      return `${fmt(statsDateRange.start)} — ${fmt(statsDateRange.end)}`;
    }
    if (period === "year") return `Рік ${selectedYear}`;
    if (period === "month") {
      const monthNames = [
        "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
        "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень",
      ];
      return `${monthNames[new Date().getMonth()]} ${selectedYear}`;
    }
    return "Поточний тиждень";
  }, [period, selectedYear, statsDateRange]);

  const productionChartUsesMonthlyBuckets = useMemo(() => {
    if (!statsDateRange) return true;
    return (
      inclusiveCalendarDaysBetween(statsDateRange.start, statsDateRange.end) > 45
    );
  }, [statsDateRange]);

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
    if (statsDateRange) {
      const { start, end } = statsDateRange;
      const days = inclusiveCalendarDaysBetween(start, end);
      const shiftDay = (shift: ShiftWithDetails) =>
        shift.shift_date ? String(shift.shift_date).slice(0, 10) : "";

      if (days > 45) {
        const monthlyData: Record<string, number> = {};
        const [sy, sm] = start.split("-").map((x) => Number.parseInt(x, 10));
        const [ey, em] = end.split("-").map((x) => Number.parseInt(x, 10));
        let cur = new Date(sy, sm - 1, 1);
        const last = new Date(ey, em - 1, 1);
        while (cur <= last) {
          const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
          monthlyData[key] = 0;
          cur.setMonth(cur.getMonth() + 1);
        }
        shifts.forEach((shift) => {
          if (shift.status !== "completed" || !shift.production) return;
          const sd = shiftDay(shift);
          if (!sd || sd < start || sd > end) return;
          const shiftDate = new Date(shift.shift_date as string);
          const monthKey = `${shiftDate.getFullYear()}-${String(shiftDate.getMonth() + 1).padStart(2, "0")}`;
          if (!(monthKey in monthlyData)) return;
          let shiftTotal = 0;
          shift.production.forEach((item) => {
            shiftTotal += item.quantity;
          });
          monthlyData[monthKey] += shiftTotal;
        });
        return Object.entries(monthlyData)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value], i) => {
            const [, month] = key.split("-");
            const yi = key.slice(0, 4);
            return {
              month: `${getMonthName(Number.parseInt(month, 10) - 1)} ${yi}`,
              production: value,
              monthIndex: i,
            };
          });
      }

      const dailyData: Record<string, number> = {};
      const [sy, sm, sd0] = start.split("-").map((x) => Number.parseInt(x, 10));
      const [ey, em, ed0] = end.split("-").map((x) => Number.parseInt(x, 10));
      let walk = new Date(sy, sm - 1, sd0);
      const endWalk = new Date(ey, em - 1, ed0);
      while (walk <= endWalk) {
        dailyData[dateToYYYYMMDD(walk)] = 0;
        walk.setDate(walk.getDate() + 1);
      }
      shifts.forEach((shift) => {
        if (shift.status !== "completed" || !shift.production) return;
        const sd = shiftDay(shift);
        if (!sd || !(sd in dailyData)) return;
        let shiftTotal = 0;
        shift.production.forEach((item) => {
          shiftTotal += item.quantity;
        });
        dailyData[sd] += shiftTotal;
      });
      return Object.keys(dailyData)
        .sort()
        .map((key, i) => {
          const [y, m, d] = key.split("-").map((x) => Number.parseInt(x, 10));
          const dt = new Date(y, m - 1, d);
          return {
            month: `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}`,
            production: dailyData[key],
            monthIndex: i,
          };
        });
    }

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
        const [, month] = key.split("-");
        return {
          month: getMonthName(parseInt(month) - 1),
          production: value,
          monthIndex: parseInt(month) - 1,
        };
      })
      .sort((a, b) => a.monthIndex - b.monthIndex);
  }, [shifts, selectedYear, statsDateRange]);

  const monthlyAverageProductionData = useMemo(() => {
    if (statsDateRange) {
      const { start, end } = statsDateRange;
      const days = inclusiveCalendarDaysBetween(start, end);
      const shiftDay = (shift: ShiftWithDetails) =>
        shift.shift_date ? String(shift.shift_date).slice(0, 10) : "";

      if (days > 45) {
        const monthlyData: Record<
          string,
          { total: number; shiftsCount: number }
        > = {};
        const [sy, sm] = start.split("-").map((x) => Number.parseInt(x, 10));
        const [ey, em] = end.split("-").map((x) => Number.parseInt(x, 10));
        let cur = new Date(sy, sm - 1, 1);
        const last = new Date(ey, em - 1, 1);
        while (cur <= last) {
          const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
          monthlyData[key] = { total: 0, shiftsCount: 0 };
          cur.setMonth(cur.getMonth() + 1);
        }
        shifts.forEach((shift) => {
          if (shift.status !== "completed" || !shift.production) return;
          const sd = shiftDay(shift);
          if (!sd || sd < start || sd > end) return;
          const shiftDate = new Date(shift.shift_date as string);
          const monthKey = `${shiftDate.getFullYear()}-${String(shiftDate.getMonth() + 1).padStart(2, "0")}`;
          if (!(monthKey in monthlyData)) return;
          let shiftTotal = 0;
          shift.production.forEach((item) => {
            shiftTotal += item.quantity;
          });
          monthlyData[monthKey].total += shiftTotal;
          monthlyData[monthKey].shiftsCount += 1;
        });
        return Object.entries(monthlyData)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, data], i) => ({
            month: `${getMonthName(Number.parseInt(key.split("-")[1], 10) - 1)} ${key.slice(0, 4)}`,
            average:
              data.shiftsCount > 0 ? data.total / data.shiftsCount : 0,
            monthIndex: i,
          }));
      }

      const dailyData: Record<string, { total: number; shiftsCount: number }> =
        {};
      const [sy, sm, sd0] = start.split("-").map((x) => Number.parseInt(x, 10));
      const [ey, em, ed0] = end.split("-").map((x) => Number.parseInt(x, 10));
      let walk = new Date(sy, sm - 1, sd0);
      const endWalk = new Date(ey, em - 1, ed0);
      while (walk <= endWalk) {
        dailyData[dateToYYYYMMDD(walk)] = { total: 0, shiftsCount: 0 };
        walk.setDate(walk.getDate() + 1);
      }
      shifts.forEach((shift) => {
        if (shift.status !== "completed" || !shift.production) return;
        const sd = shiftDay(shift);
        if (!sd || !(sd in dailyData)) return;
        let shiftTotal = 0;
        shift.production.forEach((item) => {
          shiftTotal += item.quantity;
        });
        dailyData[sd].total += shiftTotal;
        dailyData[sd].shiftsCount += 1;
      });
      return Object.keys(dailyData)
        .sort()
        .map((key, i) => {
          const [y, m, d] = key.split("-").map((x) => Number.parseInt(x, 10));
          const dt = new Date(y, m - 1, d);
          return {
            month: `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}`,
            average:
              dailyData[key].shiftsCount > 0
                ? dailyData[key].total / dailyData[key].shiftsCount
                : 0,
            monthIndex: i,
          };
        });
    }

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
        const [, month] = key.split("-");
        const average =
          data.shiftsCount > 0 ? data.total / data.shiftsCount : 0;
        return {
          month: getMonthName(parseInt(month) - 1),
          average: average,
          monthIndex: parseInt(month) - 1,
        };
      })
      .sort((a, b) => a.monthIndex - b.monthIndex);
  }, [shifts, selectedYear, statsDateRange]);

  if (isLoading) {
    return (
      <div className="container py-6">
        <div className="mb-6">
          <Skeleton className="h-4 w-12" />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Skeleton className="h-10 w-[120px]" />
            <Skeleton className="h-9 w-14" />
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-40 mb-2" />
                <Skeleton className="h-4 w-56" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-24 mb-4" />
                {(i === 1 || i === 3 || i === 4) && (
                  <Skeleton className="h-10 w-full" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-full rounded-full mb-4" />
              <div className="space-y-2">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-sm" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-44 mb-2" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="space-y-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-2.5 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40 mb-2" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[1, 2].map((cat) => (
                <div key={cat} className="pt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Skeleton className="h-3 w-3 rounded-sm" />
                    <Skeleton className="h-5 w-28" />
                  </div>
                  <div className="space-y-3">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="space-y-2">
                        <div className="flex justify-between">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                        <Skeleton className="h-8 w-full rounded-md" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
            onValueChange={(value) => {
              setSelectedYear(parseInt(value, 10));
              setFilterDateRange({});
            }}
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
            variant={
              period === "year" && !statsDateRange ? "default" : "outline"
            }
            onClick={() => {
              setPeriod("year");
              setFilterDateRange({});
            }}
            className="text-xs sm:text-sm px-2 sm:px-4"
          >
            Рік
          </Button>
          <Button
            variant={period === "month" ? "default" : "outline"}
            onClick={() => {
              setPeriod("month");
              setFilterDateRange({});
            }}
            className="text-xs sm:text-sm px-2 sm:px-4"
          >
            Місяць
          </Button>
          <Button
            variant={period === "week" ? "default" : "outline"}
            onClick={() => {
              setPeriod("week");
              setFilterDateRange({});
            }}
            className="text-xs sm:text-sm px-2 sm:px-4"
          >
            Тиждень
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={statsDateRange ? "default" : "outline"}
                className={cn(
                  "justify-start text-left font-normal text-xs sm:text-sm px-2 sm:px-4 min-w-[140px] sm:min-w-[180px]",
                  !statsDateRange &&
                    !filterDateRange.from &&
                    "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                {statsDateRange ? (
                  <>
                    {formatDate(
                      `${statsDateRange.start}T12:00:00.000Z`
                    )}{" "}
                    —{" "}
                    {formatDate(`${statsDateRange.end}T12:00:00.000Z`)}
                  </>
                ) : filterDateRange.from ? (
                  <>
                    {formatDate(
                      `${dateToYYYYMMDD(filterDateRange.from)}T12:00:00.000Z`
                    )}{" "}
                    <span className="text-muted-foreground">— …</span>
                  </>
                ) : (
                  <span>Діапазон дат</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarRangePicker
                initialFocus
                mode="range"
                defaultMonth={filterDateRange.from}
                selected={filterDateRange}
                onSelect={(range) => {
                  if (range) {
                    setFilterDateRange({
                      from: range.from,
                      to: range.to,
                    });
                  } else {
                    setFilterDateRange({});
                  }
                }}
                numberOfMonths={2}
                locale={uk}
                weekStartsOn={6}
              />
              <div className="border-t p-2 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setFilterDateRange({})}
                >
                  Скинути діапазон
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4 mb-8">
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
              onClick={() => setMonthlyProductionChartOpen(true)}
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
              onClick={() => setAverageProductionChartOpen(true)}
            >
              Детальніше
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              <span>Відвантажено кори</span>
            </CardTitle>
            <CardDescription>
              Готова продукція з назвою «кора» (без мішків), за датою
              відвантаження зі складу
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold mb-4">
              {formatNumberWithUnit(barkShipmentsTotal, "шт")}
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setBarkShipmentsBreakdown(null);
                setBarkShipmentsDetailOpen(true);
              }}
            >
              Детальніше
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={barkShipmentsDetailOpen}
        onOpenChange={setBarkShipmentsDetailOpen}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Відвантаження кори</DialogTitle>
            <DialogDescription>
              Деталізація за обраний період: {periodLabel}
            </DialogDescription>
          </DialogHeader>

          {barkShipmentsDetailLoading ? (
            <div className="space-y-4 py-2">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-[280px] w-full" />
            </div>
          ) : (
            <div className="space-y-8">
              <div>
                <h3 className="text-sm font-medium mb-3">По фракціях</h3>
                {!barkShipmentsBreakdown?.byProduct.length ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Немає відвантажень кори за цей період
                  </p>
                ) : (
                  <div className="rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left font-medium p-3">
                            Фракція (продукт)
                          </th>
                          <th className="text-right font-medium p-3 w-[120px]">
                            Кількість
                          </th>
                          <th className="text-right font-medium p-3 w-[100px]">
                            Частка
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const totalQty =
                            barkShipmentsBreakdown.byProduct.reduce(
                              (s, r) => s + r.quantity,
                              0
                            );
                          return barkShipmentsBreakdown.byProduct.map(
                            (row) => {
                              const pct =
                                totalQty > 0
                                  ? (row.quantity / totalQty) * 100
                                  : 0;
                              return (
                                <tr
                                  key={row.productName}
                                  className="border-b last:border-0"
                                >
                                  <td className="p-3">{row.productName}</td>
                                  <td className="p-3 text-right tabular-nums">
                                    {formatNumberWithUnit(row.quantity, "шт")}
                                  </td>
                                  <td className="p-3 text-right tabular-nums text-muted-foreground">
                                    {formatPercentage(pct, 1)}
                                  </td>
                                </tr>
                              );
                            }
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-medium mb-1">
                  {barkShipmentsBreakdown?.usesMonthlyTimeBuckets
                    ? "Помісячний графік"
                    : "Графік по днях"}
                </h3>
                {barkShipmentsBreakdown?.chartCaption ? (
                  <p className="text-xs text-muted-foreground mb-3">
                    {barkShipmentsBreakdown.chartCaption}
                  </p>
                ) : null}
                {!barkShipmentsBreakdown?.timeSeries.length ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Немає даних для графіка
                  </p>
                ) : barkShipmentsBreakdown.timeSeries.every(
                    (p) => p.quantity === 0
                  ) ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Усі періоди без відвантажень
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <RechartsBarChart
                      data={barkShipmentsBreakdown.timeSeries}
                      margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        interval={0}
                        angle={
                          barkShipmentsBreakdown?.usesMonthlyTimeBuckets
                            ? 0
                            : -35
                        }
                        textAnchor={
                          barkShipmentsBreakdown?.usesMonthlyTimeBuckets
                            ? "middle"
                            : "end"
                        }
                        height={
                          barkShipmentsBreakdown?.usesMonthlyTimeBuckets
                            ? 32
                            : 56
                        }
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        label={{
                          value: "Шт.",
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
                      <Bar
                        dataKey="quantity"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={
                          barkShipmentsBreakdown?.usesMonthlyTimeBuckets
                            ? 48
                            : 28
                        }
                      />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={monthlyProductionChartOpen}
        onOpenChange={setMonthlyProductionChartOpen}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {productionChartUsesMonthlyBuckets
                ? "Помісячний графік виробництва"
                : "Виробництво по днях"}
            </DialogTitle>
            <DialogDescription>
              {statsDateRange ? (
                productionChartUsesMonthlyBuckets ? (
                  <>
                    Динаміка виробленої продукції по місяцях за період{" "}
                    {periodLabel}
                  </>
                ) : (
                  <>
                    Динаміка виробленої продукції по днях за період{" "}
                    {periodLabel}
                  </>
                )
              ) : (
                <>
                  Динаміка виробленої продукції по місяцях {selectedYear} року
                  (період на сторінці: {periodLabel})
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {monthlyProductionData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Немає даних про виробництво
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyProductionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  angle={productionChartUsesMonthlyBuckets ? 0 : -35}
                  textAnchor={productionChartUsesMonthlyBuckets ? "middle" : "end"}
                  height={productionChartUsesMonthlyBuckets ? 40 : 64}
                  interval={0}
                />
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
        </DialogContent>
      </Dialog>

      <Dialog
        open={averageProductionChartOpen}
        onOpenChange={setAverageProductionChartOpen}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {productionChartUsesMonthlyBuckets
                ? "Помісячний графік середнього виробництва"
                : "Середнє виробництво по днях"}
            </DialogTitle>
            <DialogDescription>
              {statsDateRange ? (
                productionChartUsesMonthlyBuckets ? (
                  <>
                    Динаміка середньої кількості на зміну по місяцях за період{" "}
                    {periodLabel}
                  </>
                ) : (
                  <>
                    Динаміка середньої кількості на зміну по днях за період{" "}
                    {periodLabel}
                  </>
                )
              ) : (
                <>
                  Динаміка середньої кількості продукції на зміну по місяцях{" "}
                  {selectedYear} року (період на сторінці: {periodLabel})
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {monthlyAverageProductionData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Немає даних про виробництво
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyAverageProductionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  angle={productionChartUsesMonthlyBuckets ? 0 : -35}
                  textAnchor={productionChartUsesMonthlyBuckets ? "middle" : "end"}
                  height={productionChartUsesMonthlyBuckets ? 40 : 64}
                  interval={0}
                />
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
        </DialogContent>
      </Dialog>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Собівартість мішка</CardTitle>
          <CardDescription>
            Тимчасова формула: середня вартість мішка із закупок + середня вартість
            мішка з поїздок + фіксована винагорода за мішок + погодинна З.П. на мішок
            (відносно готової продукції) + ціна за шт «{PACKING_BAG_PRODUCT_NAME}» з
            останньої закупівлі.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground mb-1">
                Середня вартість мішка із закупок
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {currentPeriodCostMetrics.purchaseCostPerBag != null
                  ? formatNumberWithUnit(currentPeriodCostMetrics.purchaseCostPerBag, "₴")
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground mb-1">
                Середня вартість мішка з поїздок
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {currentPeriodCostMetrics.tripCostPerBag != null
                  ? formatNumberWithUnit(currentPeriodCostMetrics.tripCostPerBag, "₴")
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground mb-1">
                Підсумкова собівартість мішка
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {currentPeriodCostMetrics.totalCostPerBag != null
                  ? formatNumberWithUnit(currentPeriodCostMetrics.totalCostPerBag, "₴")
                  : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Δ до попер. періоду:{" "}
                {totalDeltaPercent != null ? formatPercentage(totalDeltaPercent, 1) : "—"}
              </p>
            </div>
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex justify-between gap-2 py-2 border-b">
              <span className="text-muted-foreground">Закупки (сума)</span>
              <span className="tabular-nums">
                {formatNumberWithUnit(currentPeriodCostMetrics.purchaseCosts, "₴")}
              </span>
            </div>
            <div className="flex justify-between gap-2 py-2 border-b">
              <span className="text-muted-foreground">К-ть мішків у закупках</span>
              <span className="tabular-nums">
                {formatNumber(currentPeriodCostMetrics.purchaseBags)}
              </span>
            </div>
            <div className="flex justify-between gap-2 py-2 border-b">
              <span className="text-muted-foreground">Поїздки (сума витрат)</span>
              <span className="tabular-nums">
                {formatNumberWithUnit(currentPeriodCostMetrics.rawTripCosts, "₴")}
              </span>
            </div>
            <div className="flex justify-between gap-2 py-2 border-b">
              <span className="text-muted-foreground">К-ть мішків у поїздках</span>
              <span className="tabular-nums">
                {formatNumber(currentPeriodCostMetrics.tripBags)}
              </span>
            </div>
            <div className="flex justify-between gap-2 py-2 border-b">
              <span className="text-muted-foreground">Винагорода на мішок (фіксована)</span>
              <span className="tabular-nums">
                {formatNumberWithUnit(currentPeriodCostMetrics.fixedRewardPerBag, "₴")}
              </span>
            </div>
            <div className="flex justify-between gap-2 py-2 border-b">
              <span className="text-muted-foreground">Погодинна З.П. (сума)</span>
              <span className="tabular-nums">
                {formatNumberWithUnit(currentPeriodCostMetrics.hourlyWageCosts, "₴")}
              </span>
            </div>
            <div className="flex justify-between gap-2 py-2 border-b">
              <span className="text-muted-foreground">
                К-ть готової продукції (база для погодинної З.П.)
              </span>
              <span className="tabular-nums">
                {formatNumber(currentPeriodCostMetrics.producedQuantity)}
              </span>
            </div>
            <div className="flex justify-between gap-2 py-2 border-b">
              <span className="text-muted-foreground">Погодинна З.П. на мішок</span>
              <span className="tabular-nums">
                {formatNumberWithUnit(currentPeriodCostMetrics.hourlyWagePerBag, "₴")}
              </span>
            </div>
            <div className="flex justify-between gap-2 py-2 border-b font-medium">
              <span className="text-muted-foreground">Підсумкова собівартість/мішок</span>
              <span className="tabular-nums">
                {currentPeriodCostMetrics.totalCostPerBag != null
                  ? formatNumberWithUnit(currentPeriodCostMetrics.totalCostPerBag, "₴")
                  : "—"}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-3">
              Структура підсумкової собівартості (за мішок)
            </h3>
            <div className="space-y-3">
              {structureRows.map((row) => (
                <div key={row.label} className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="tabular-nums">
                      {formatNumberWithUnit(row.value, "₴")} (
                      {formatPercentage(row.percent, 1)})
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/80"
                      style={{ width: `${Math.max(row.percent, 0)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

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
