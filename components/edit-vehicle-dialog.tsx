"use client";

import { VehicleForm } from "@/components/vehicle-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Vehicle } from "@/app/vehicles/actions";

interface EditVehicleDialogProps {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVehicleUpdated?: () => void | Promise<void>;
}

export function EditVehicleDialog({
  vehicle,
  open,
  onOpenChange,
  onVehicleUpdated,
}: EditVehicleDialogProps) {
  const handleUpdated = async () => {
    onOpenChange(false);
    if (onVehicleUpdated) await onVehicleUpdated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Редагувати транспорт</DialogTitle>
          <DialogDescription>
            {vehicle?.name
              ? `Змініть дані для «${vehicle.name}»`
              : "Назва, тип та дефолтні значення"}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {vehicle && (
            <VehicleForm
              vehicleId={vehicle.id}
              initialData={vehicle}
              onVehicleUpdated={handleUpdated}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
