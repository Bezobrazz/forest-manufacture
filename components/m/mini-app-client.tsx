"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { FieldDeliveryForm } from "@/components/m/field-delivery-form";
import { FieldOperationsPanel } from "@/components/m/field-operations-panel";
import { FieldOrdersPanel } from "@/components/m/field-orders-panel";
import { FieldWarehousePanel } from "@/components/m/field-warehouse-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Vehicle } from "@/app/vehicles/actions";
import type { Supplier } from "@/lib/types";

export const MINI_APP_TABS = [
  "entry",
  "operations",
  "warehouse",
  "orders",
] as const;
export type MiniAppTab = (typeof MINI_APP_TABS)[number];

const TAB_META: Record<
  MiniAppTab,
  { label: string; title: string; description: string }
> = {
  entry: {
    label: "Внесення",
    title: "Польове внесення",
    description: "Закупівля і поїздка сировини одним збереженням",
  },
  operations: {
    label: "Операції",
    title: "Операції",
    description: "Закупівлі та поїздки, внесені через Mini App",
  },
  warehouse: {
    label: "Склад",
    title: "Склад",
    description: "Залишки виготовленої продукції",
  },
  orders: {
    label: "Замовлення",
    title: "Замовлення",
    description: "Черга відвантаження",
  },
};

function isMiniAppTab(value: string | null): value is MiniAppTab {
  return !!value && (MINI_APP_TABS as readonly string[]).includes(value);
}

function readTabFromLocation(): MiniAppTab {
  if (typeof window === "undefined") return "entry";
  const raw = new URLSearchParams(window.location.search).get("tab");
  return isMiniAppTab(raw) ? raw : "entry";
}

type Props = {
  accessName: string;
  suppliers: Supplier[];
  warehouseId: string;
  productId: string;
  packingProductId: string;
  vehicles: Vehicle[];
  lastVehicleId: string | null;
  formReady: boolean;
  formError: string | null;
};

export function MiniAppClient({
  accessName,
  suppliers,
  warehouseId,
  productId,
  packingProductId,
  vehicles,
  lastVehicleId,
  formReady,
  formError,
}: Props) {
  const pathname = usePathname();
  const [tab, setTab] = useState<MiniAppTab>("entry");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setTab(readTabFromLocation());

    const onPopState = () => {
      setTab(readTabFromLocation());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleTabChange = (value: string) => {
    if (!isMiniAppTab(value)) return;
    setTab(value);
    setMenuOpen(false);

    const params = new URLSearchParams(window.location.search);
    if (value === "entry") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  };

  const current = TAB_META[tab];

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{current.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {current.description}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0 touch-manipulation gap-2 px-3 text-base"
          onClick={() => setMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
          Меню
        </Button>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
        <TabsContent value="entry" className="mt-0 space-y-4">
          {!formReady ? (
            <p className="text-sm text-destructive">
              {formError ?? "Немає даних для форми. Зверніться до офісу."}
            </p>
          ) : (
            <FieldDeliveryForm
              accessName={accessName}
              suppliers={suppliers}
              warehouseId={warehouseId}
              productId={productId}
              packingProductId={packingProductId}
              vehicles={vehicles}
              lastVehicleId={lastVehicleId}
            />
          )}
        </TabsContent>

        <TabsContent value="operations" className="mt-0 space-y-4">
          <FieldOperationsPanel active={tab === "operations"} />
        </TabsContent>

        <TabsContent value="warehouse" className="mt-0 space-y-4">
          <FieldWarehousePanel active={tab === "warehouse"} />
        </TabsContent>

        <TabsContent value="orders" className="mt-0 space-y-4">
          <FieldOrdersPanel active={tab === "orders"} />
        </TabsContent>
      </Tabs>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent
          className={cn(
            "fixed inset-0 left-0 top-0 z-50 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-0 p-0 shadow-none",
            "data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100",
            "data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0",
            "data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0"
          )}
        >
          <DialogHeader className="space-y-1 border-b px-4 pb-4 pt-6 pr-12 text-left">
            <DialogTitle className="text-2xl">Меню</DialogTitle>
            <DialogDescription>
              Оберіть розділ Mini App
            </DialogDescription>
          </DialogHeader>

          <nav className="flex flex-1 flex-col gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {MINI_APP_TABS.map((value) => {
              const meta = TAB_META[value];
              const selected = value === tab;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleTabChange(value)}
                  className={cn(
                    "flex min-h-14 touch-manipulation flex-col items-start justify-center rounded-xl border px-4 py-3 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-muted/60"
                  )}
                >
                  <span className="text-lg font-semibold">{meta.label}</span>
                  <span
                    className={cn(
                      "text-sm",
                      selected
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground"
                    )}
                  >
                    {meta.description}
                  </span>
                </button>
              );
            })}
          </nav>
        </DialogContent>
      </Dialog>
    </>
  );
}
