import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRawDeliveryDebtByVehicle,
  buildRawDeliveryDebtSummary,
} from "./raw-delivery-debt";

describe("buildRawDeliveryDebtByVehicle", () => {
  it("splits remaining debt by vehicle and tracks unallocated repayments", () => {
    const result = buildRawDeliveryDebtByVehicle({
      trips: [
        {
          vehicle_id: "truck",
          vehicle_name: "Рено Магнум",
          total_costs_uah: 1000,
        },
        {
          vehicle_id: "van",
          vehicle_name: "Рено Мастер",
          total_costs_uah: 400,
        },
      ],
      repayments: [
        { vehicle_id: "truck", amount: 300 },
        { vehicle_id: null, amount: 150 },
      ],
      vehicleNames: {
        truck: "Рено Магнум",
        van: "Рено Мастер",
      },
    });

    assert.equal(result.vehicles.length, 2);
    assert.equal(result.vehicles[0]?.vehicleName, "Рено Магнум");
    assert.equal(result.vehicles[0]?.remainingAmountUah, 700);
    assert.equal(result.vehicles[1]?.vehicleName, "Рено Мастер");
    assert.equal(result.vehicles[1]?.remainingAmountUah, 400);
    assert.equal(result.unallocatedRepaidUah, 150);
  });
});

describe("buildRawDeliveryDebtSummary", () => {
  it("keeps global remaining unchanged", () => {
    const summary = buildRawDeliveryDebtSummary({
      totalCostsUah: 1400,
      repaidAmountUah: 450,
      tripsCount: 2,
      bagsCount: 10,
    });
    assert.equal(summary.remainingAmountUah, 950);
    assert.equal(summary.isClosed, false);
  });
});
