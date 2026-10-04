"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FieldDeliveryForm } from "@/components/m/field-delivery-form";
import { FieldOperationsPanel } from "@/components/m/field-operations-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Vehicle } from "@/app/vehicles/actions";
import type { Supplier } from "@/lib/types";

export const MINI_APP_TABS = ["entry", "operations"] as const;
export type MiniAppTab = (typeof MINI_APP_TABS)[number];

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

    const params = new URLSearchParams(window.location.search);
    if (value === "entry") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
      <TabsList className="grid h-12 w-full grid-cols-2 p-1">
        <TabsTrigger
          value="entry"
          className="h-10 touch-manipulation text-base"
        >
          Внесення
        </TabsTrigger>
        <TabsTrigger
          value="operations"
          className="h-10 touch-manipulation text-base"
        >
          Операції
        </TabsTrigger>
      </TabsList>

      <TabsContent value="entry" className="mt-0 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Польове внесення</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Закупівля і поїздка сировини одним збереженням
          </p>
        </div>
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
        <div>
          <h1 className="text-2xl font-semibold">Операції</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Закупівлі та поїздки, внесені через Mini App
          </p>
        </div>
        <FieldOperationsPanel active={tab === "operations"} />
      </TabsContent>
    </Tabs>
  );
}
