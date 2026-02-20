"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { VehicleForm } from "@/components/vehicle-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Car } from "lucide-react";

export default function NewVehiclePage() {
  const router = useRouter();

  const handleVehicleAdded = () => {
    router.push("/vehicles");
  };

  return (
    <div className="container py-6 space-y-6">
      <div>
        <Link
          href="/vehicles"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Назад до транспорту</span>
        </Link>
        <div className="flex items-center gap-2">
          <Car className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Додати транспорт</h1>
        </div>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Новий транспорт</CardTitle>
          <CardDescription>
            Назва, тип та дефолтні значення для поїздок (їх можна змінити пізніше)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VehicleForm onVehicleAdded={handleVehicleAdded} />
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => router.push("/vehicles")}
          >
            Скасувати
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
