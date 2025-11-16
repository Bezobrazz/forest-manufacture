"use client";

import { useState } from "react";
import { SupplierForm } from "@/components/supplier-form";
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

interface AddSupplierDialogProps {
  onSupplierAdded?: () => Promise<void>;
}

export function AddSupplierDialog({ onSupplierAdded }: AddSupplierDialogProps) {
  const [open, setOpen] = useState(false);

  const handleSupplierAdded = async () => {
    setOpen(false);
    if (onSupplierAdded) {
      await onSupplierAdded();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Додати постачальника</span>
          <span className="sm:hidden">Додати</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Додати нового постачальника</DialogTitle>
          <DialogDescription>
            Заповніть інформацію про постачальника. Поля з позначкою * є
            обов'язковими.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <SupplierForm onSupplierAdded={handleSupplierAdded} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

