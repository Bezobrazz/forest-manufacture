"use client";

import { useState, useEffect } from "react";
import type { SupplierAdvanceTransaction, Supplier } from "@/lib/types";
import {
  updateSupplierAdvanceTransaction,
  getSuppliers,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { Pencil, Calendar as CalendarIcon, Search, Banknote } from "lucide-react";
import { cn, formatDate, dateToYYYYMMDD } from "@/lib/utils";
import { uk } from "date-fns/locale";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

interface EditSupplierAdvanceDialogProps {
  advance: SupplierAdvanceTransaction;
  suppliers: Supplier[];
  onAdvanceUpdated?: () => void;
}

export function EditSupplierAdvanceDialog({
  advance,
  suppliers,
  onAdvanceUpdated,
}: EditSupplierAdvanceDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState("");
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);

  const [supplierId, setSupplierId] = useState(advance.supplier_id.toString());
  const [amount, setAmount] = useState(
    advance.amount != null
      ? (Math.round(Number(advance.amount) * 100) / 100).toString()
      : "",
  );
  const [date, setDate] = useState<Date>(
    advance.created_at ? new Date(advance.created_at) : new Date(),
  );

  useEffect(() => {
    if (open) {
      setSupplierId(advance.supplier_id.toString());
      setAmount(
        advance.amount != null
          ? (Math.round(Number(advance.amount) * 100) / 100).toString()
          : "",
      );
      setDate(advance.created_at ? new Date(advance.created_at) : new Date());
    }
  }, [open, advance]);

  const filteredSuppliers = suppliers.filter((s) => {
    if (!supplierSearchQuery.trim()) return true;
    const q = supplierSearchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) || s.phone?.toLowerCase().includes(q)
    );
  });

  const selectedSupplier = suppliers.find((s) => s.id === Number(supplierId));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Введіть коректну суму авансу");
      return;
    }
    if (!supplierId) {
      toast.error("Оберіть постачальника");
      return;
    }

    setIsPending(true);
    try {
      const formData = new FormData();
      formData.append("advance_id", advance.id.toString());
      formData.append("supplier_id", supplierId);
      formData.append("amount", amount);
      formData.append("date", dateToYYYYMMDD(date));

      const result = await updateSupplierAdvanceTransaction(formData);

      if (result.success) {
        toast.success("Аванс оновлено");
        setOpen(false);
        if (onAdvanceUpdated) {
          await onAdvanceUpdated();
        }
      } else {
        toast.error(result.error || "Помилка оновлення авансу");
      }
    } catch (error) {
      console.error("Помилка оновлення авансу:", error);
      toast.error("Сталася помилка при оновленні авансу");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Редагувати</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Редагувати аванс</DialogTitle>
          <DialogDescription>
            Змініть дані операції авансу
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Постачальник *</Label>
            <Popover
              open={supplierPopoverOpen}
              onOpenChange={setSupplierPopoverOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {selectedSupplier?.name || "Оберіть постачальника"}
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0">
                <div className="p-2">
                  <Input
                    placeholder="Пошук постачальника..."
                    value={supplierSearchQuery}
                    onChange={(e) => setSupplierSearchQuery(e.target.value)}
                    className="mb-2"
                  />
                  <div className="max-h-[200px] overflow-auto">
                    {filteredSuppliers.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 p-2 hover:bg-accent cursor-pointer rounded-sm"
                        onClick={() => {
                          setSupplierId(s.id.toString());
                          setSupplierPopoverOpen(false);
                        }}
                      >
                        <Banknote className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium">{s.name}</div>
                          {s.phone && (
                            <div className="text-xs text-muted-foreground">
                              {s.phone}
                            </div>
                          )}
                        </div>
                        {supplierId === s.id.toString() && (
                          <span className="text-primary">✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-advance-amount">Сума (₴) *</Label>
            <Input
              id="edit-advance-amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Дата</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? formatDate(date.toISOString()) : "Оберіть дату"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  locale={uk}
                />
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Скасувати
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Збереження..." : "Зберегти"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
