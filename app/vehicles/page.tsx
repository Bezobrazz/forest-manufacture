"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { getVehicles, type Vehicle } from "@/app/vehicles/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Car } from "lucide-react";
import { AddVehicleDialog } from "@/components/add-vehicle-dialog";
import { DatabaseError } from "@/components/database-error";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-56 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 py-3 border-b last:border-0"
              >
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const typeLabel: Record<string, string> = {
  van: "Фургон",
  truck: "Вантажівка",
};

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [databaseError, setDatabaseError] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    setDatabaseError(false);
    try {
      const data = await getVehicles();
      setVehicles(data);
    } catch (err: unknown) {
      console.error("Помилка при завантаженні транспорту:", err);
      if (
        err &&
        typeof err === "object" &&
        "message" in err &&
        (String((err as { message?: string }).message).includes("Supabase") ||
          String((err as { message?: string }).message).includes("credentials"))
      ) {
        setDatabaseError(true);
      } else {
        setError("Не вдалося завантажити дані. Спробуйте пізніше.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="container py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Назад</span>
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <Car className="h-5 w-5 sm:h-6 sm:w-6" />
              <h1 className="text-2xl sm:text-3xl font-bold">Транспорт</h1>
            </div>
            <Badge variant="secondary" className="text-sm w-fit">
              {vehicles.length}{" "}
              {vehicles.length === 1
                ? "транспорт"
                : vehicles.length < 5
                  ? "транспорти"
                  : "транспортів"}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base hidden sm:block">
            Список транспортних засобів для поїздок
          </p>
        </div>
        <AddVehicleDialog onVehicleAdded={loadData} />
      </div>

      {databaseError ? (
        <div className="py-8">
          <DatabaseError onRetry={loadData} />
        </div>
      ) : isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {error}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Список транспорту</CardTitle>
            <CardDescription>
              {vehicles.length === 0
                ? "Немає транспортних засобів"
                : `Показано ${vehicles.length} ${vehicles.length === 1 ? "транспорт" : vehicles.length < 5 ? "транспорти" : "транспортів"}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {vehicles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Додайте перший транспорт за допомогою кнопки вище
              </div>
            ) : (
              <div className="space-y-0 divide-y">
                {vehicles.map((v) => (
                  <div
                    key={v.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"
                  >
                    <div className="flex items-center gap-3">
                      <Car className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <span className="font-medium">{v.name}</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {typeLabel[v.type] ?? v.type}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {v.default_fuel_consumption_l_per_100km != null && (
                        <span>
                          {v.default_fuel_consumption_l_per_100km} л/100 км
                        </span>
                      )}
                      {v.default_depreciation_uah_per_km != null && (
                        <span>
                          {v.default_depreciation_uah_per_km} грн/км
                        </span>
                      )}
                      {v.default_daily_taxes_uah != null && (
                        <span>{v.default_daily_taxes_uah} грн/день</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
