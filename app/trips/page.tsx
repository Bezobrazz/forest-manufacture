"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { getTrips } from "@/app/trips/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Trip = Awaited<ReturnType<typeof getTrips>>[number];

function formatDate(s: string) {
  const d = new Date(s + "Z");
  return d.toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getTrips().then((data) => {
      setTrips(data);
      setIsLoading(false);
    });
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
          <div className="flex items-center gap-2">
            <MapPin className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Поїздки</h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Список поїздок та прибутковість
          </p>
        </div>
        <Button asChild>
          <Link href="/trips/new" className="gap-2">
            <Plus className="h-4 w-4" />
            Нова поїздка
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : trips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="mb-4">Немає поїздок</p>
            <Button asChild>
              <Link href="/trips/new" className="gap-2">
                <Plus className="h-4 w-4" />
                Додати поїздку
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Список поїздок</CardTitle>
            <CardDescription>
              Показано {trips.length} {trips.length === 1 ? "поїздку" : trips.length < 5 ? "поїздки" : "поїздок"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {trips.map((t) => (
                <li key={t.id} className="py-3 first:pt-0">
                  <Link
                    href={`/trips/${t.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 hover:underline"
                  >
                    <span className="font-medium">
                      {t.name?.trim() || formatDate(t.trip_date)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {t.name?.trim() ? `${formatDate(t.trip_date)} · ` : ""}
                      {t.distance_km != null ? `${t.distance_km} км` : "—"} ·{" "}
                      {t.profit_uah != null ? `${t.profit_uah} грн` : "—"}
                      {t.roi_percent != null && ` · ROI ${t.roi_percent}%`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
