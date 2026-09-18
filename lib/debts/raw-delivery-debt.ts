export const RAW_DELIVERY_DEBT_TITLE = "Доставка сировини";

export const RAW_REPAYMENT_CATEGORY_NAME = "Погашення доставки (сировина)";

export const RAW_UNALLOCATED_VEHICLE_LABEL = "Нерозподілені";

export type RawDeliveryDebtSummary = {
  totalCostsUah: number;
  repaidAmountUah: number;
  remainingAmountUah: number;
  tripsCount: number;
  bagsCount: number;
  isClosed: boolean;
};

export type RawVehicleDebtRow = {
  vehicleId: string;
  vehicleName: string;
  totalCostsUah: number;
  repaidAmountUah: number;
  remainingAmountUah: number;
};

export type RawDeliveryDebtByVehicle = {
  vehicles: RawVehicleDebtRow[];
  unallocatedRepaidUah: number;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function buildRawDeliveryDebtSummary(input: {
  totalCostsUah: number;
  repaidAmountUah: number;
  tripsCount: number;
  bagsCount: number;
}): RawDeliveryDebtSummary {
  const totalCostsUah = roundMoney(input.totalCostsUah);
  const repaidAmountUah = roundMoney(input.repaidAmountUah);
  const remainingAmountUah = Math.max(
    0,
    roundMoney(totalCostsUah - repaidAmountUah)
  );

  return {
    totalCostsUah,
    repaidAmountUah,
    remainingAmountUah,
    tripsCount: input.tripsCount,
    bagsCount: input.bagsCount,
    isClosed: remainingAmountUah <= 0 || totalCostsUah <= 0,
  };
}

export function buildRawDeliveryDebtByVehicle(input: {
  trips: Array<{
    vehicle_id: string;
    vehicle_name?: string | null;
    total_costs_uah?: number | null;
  }>;
  repayments: Array<{
    vehicle_id: string | null;
    amount: number;
  }>;
  vehicleNames?: Record<string, string>;
}): RawDeliveryDebtByVehicle {
  const costsByVehicle = new Map<string, number>();
  const namesByVehicle = new Map<string, string>(
    Object.entries(input.vehicleNames ?? {})
  );

  for (const trip of input.trips) {
    const id = trip.vehicle_id;
    if (!id) continue;
    costsByVehicle.set(
      id,
      (costsByVehicle.get(id) ?? 0) + (trip.total_costs_uah ?? 0)
    );
    if (trip.vehicle_name) {
      namesByVehicle.set(id, trip.vehicle_name);
    }
  }

  const repaidByVehicle = new Map<string, number>();
  let unallocatedRepaidUah = 0;

  for (const repayment of input.repayments) {
    if (!repayment.vehicle_id) {
      unallocatedRepaidUah += repayment.amount;
      continue;
    }
    repaidByVehicle.set(
      repayment.vehicle_id,
      (repaidByVehicle.get(repayment.vehicle_id) ?? 0) + repayment.amount
    );
    if (!namesByVehicle.has(repayment.vehicle_id)) {
      namesByVehicle.set(repayment.vehicle_id, repayment.vehicle_id);
    }
  }

  const vehicleIds = new Set([
    ...costsByVehicle.keys(),
    ...repaidByVehicle.keys(),
  ]);

  const vehicles: RawVehicleDebtRow[] = Array.from(vehicleIds)
    .map((vehicleId) => {
      const totalCostsUah = roundMoney(costsByVehicle.get(vehicleId) ?? 0);
      const repaidAmountUah = roundMoney(repaidByVehicle.get(vehicleId) ?? 0);
      return {
        vehicleId,
        vehicleName: namesByVehicle.get(vehicleId) ?? vehicleId,
        totalCostsUah,
        repaidAmountUah,
        remainingAmountUah: roundMoney(totalCostsUah - repaidAmountUah),
      };
    })
    .sort((a, b) => a.vehicleName.localeCompare(b.vehicleName, "uk"));

  return {
    vehicles,
    unallocatedRepaidUah: roundMoney(unallocatedRepaidUah),
  };
}
