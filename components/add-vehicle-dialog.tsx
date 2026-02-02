"use client";

import { useState } from "react";
import { VehicleForm } from "@/components/vehicle-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface AddVehicleDialogProps {
  onVehicleAdded?: () => void | Promise<void>;
}

export function AddVehicleDialog({ onVehicleAdded }: AddVehicleDialogProps) {
  const [open, setOpen] = useState(false);

  const handleVehicleAdded = async () => {
    setOpen(false);
    if (onVehicleAdded) {
      await onVehicleAdded();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Додати транспорт</span>
          <span className="sm:hidden">Додати</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Додати транспорт</DialogTitle>
          <DialogDescription>
            Назва, тип та дефолтні значення для поїздок (їх можна змінити пізніше)
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <VehicleForm onVehicleAdded={handleVehicleAdded} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
