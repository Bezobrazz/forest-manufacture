import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  getLastUsedVehicleId,
  getSupplierDeliveryBagsCountForDate,
} from "@/app/trips/actions";
import { getVehicles } from "@/app/vehicles/actions";
import { FieldTripForm } from "@/components/m/field-trip-form";
import { dateToYYYYMMDD } from "@/lib/utils";

export default async function MiniAppTripPage() {
  const today = dateToYYYYMMDD(new Date());
  const [vehicles, lastVehicleId, bagsHint] = await Promise.all([
    getVehicles(),
    getLastUsedVehicleId(),
    getSupplierDeliveryBagsCountForDate(today),
  ]);

  return (
    <div className="space-y-4 p-4 pt-6">
      <Link
        href="/m"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Поїздка — сировина</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Паливо, податки й амортизація підставляються з транспорту
        </p>
      </div>
      <FieldTripForm
        vehicles={vehicles}
        lastVehicleId={lastVehicleId}
        initialBagsCount={bagsHint}
      />
    </div>
  );
}
