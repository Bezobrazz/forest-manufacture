"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getVehicle, type Vehicle } from "@/app/vehicles/actions";
import { VehicleForm } from "@/components/vehicle-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Car } from "lucide-react";

export default function VehicleEditPage() {
  const params = useParams();
  const router = useRouter();
  const vehicleId = params.id as string;

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vehicleId) return;
    getVehicle(vehicleId).then((v) => {
      setVehicle(v ?? null);
      setLoading(false);
    });
  }, [vehicleId]);

  const handleUpdated = () => {
    router.push("/vehicles");
  };

  if (loading) {
    return (
      <div className="container py-6">
        <p className="text-muted-foreground">Завантаження...</p>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="container py-6 space-y-4">
        <Link
          href="/vehicles"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад до транспорту
        </Link>
        <p className="text-muted-foreground">Транспорт не знайдено.</p>
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-lg space-y-6">
      <div>
        <Link
          href="/vehicles"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад до транспорту
        </Link>
        <div className="flex items-center gap-2 mt-2">
          <Car className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Редагування транспорту</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {vehicle.name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Дані транспорту</CardTitle>
          <CardDescription>
            Змініть поля та збережіть
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VehicleForm
            vehicleId={vehicleId}
            initialData={vehicle}
            onVehicleUpdated={handleUpdated}
          />
        </CardContent>
      </Card>
    </div>
  );
}
