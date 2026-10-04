"use client";

import { Suspense } from "react";
import { FieldDeliveryForm } from "@/components/m/field-delivery-form";
import { FieldOperationsPanel } from "@/components/m/field-operations-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryTab } from "@/hooks/use-query-tab";
import type { Vehicle } from "@/app/vehicles/actions";
import type { Supplier } from "@/lib/types";

export const MINI_APP_TABS = ["entry", "operations"] as const;
export type MiniAppTab = (typeof MINI_APP_TABS)[number];

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

function MiniAppTabs({
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
  const [tab, setTab] = useQueryTab(MINI_APP_TABS, "entry");

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as MiniAppTab)}
      className="space-y-4"
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="entry">Внесення</TabsTrigger>
        <TabsTrigger value="operations">Операції</TabsTrigger>
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
            Усі закупівлі, внесені через Mini App
          </p>
        </div>
        <FieldOperationsPanel active={tab === "operations"} />
      </TabsContent>
    </Tabs>
  );
}

export function MiniAppClient(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="space-y-2 p-4 pt-6 text-center text-sm text-muted-foreground">
          Завантаження…
        </div>
      }
    >
      <MiniAppTabs {...props} />
    </Suspense>
  );
}
