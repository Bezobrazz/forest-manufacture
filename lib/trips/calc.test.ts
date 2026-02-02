import test from "node:test";
import assert from "node:assert";
import { calculateTripMetrics, type TripInput } from "./calc";

const baseInput: TripInput = {
  user_id: "u1",
  vehicle_id: "v1",
  trip_date: "2025-02-02",
  trip_type: "raw",
  start_odometer_km: 0,
  end_odometer_km: 100,
  fuel_consumption_l_per_100km: 10,
  fuel_price_uah_per_l: 50,
  depreciation_uah_per_km: 2,
  days_count: 1,
  daily_taxes_uah: 150,
  freight_uah: 10000,
  driver_pay_mode: "per_trip",
  driver_pay_uah: 500,
  extra_costs_uah: 0,
};

test("calculateTripMetrics: нормальний рейс", () => {
  const m = calculateTripMetrics(baseInput);

  assert.strictEqual(m.distance_km, 100);
  assert.strictEqual(m.fuel_used_l, 10);
  assert.strictEqual(m.fuel_cost_uah, 500);
  assert.strictEqual(m.depreciation_cost_uah, 200);
  assert.strictEqual(m.taxes_cost_uah, 150);
  assert.strictEqual(m.driver_cost_uah, 500);
  assert.strictEqual(m.total_costs_uah, 1350);
  assert.strictEqual(m.profit_uah, 8650);
  assert.strictEqual(m.profit_per_km_uah, 86.5);
  assert.ok(m.roi_percent > 0);
  assert.strictEqual(m.status, "profit");
});

test("calculateTripMetrics: distance = 0", () => {
  const input: TripInput = {
    ...baseInput,
    start_odometer_km: 100,
    end_odometer_km: 100,
  };
  const m = calculateTripMetrics(input);

  assert.strictEqual(m.distance_km, 0);
  assert.strictEqual(m.fuel_used_l, 0);
  assert.strictEqual(m.fuel_cost_uah, 0);
  assert.strictEqual(m.depreciation_cost_uah, 0);
  assert.strictEqual(m.profit_per_km_uah, 0);
  assert.strictEqual(m.taxes_cost_uah, 150);
  assert.strictEqual(m.driver_cost_uah, 500);
  assert.strictEqual(m.total_costs_uah, 650);
  assert.strictEqual(m.profit_uah, 9350);
  assert.ok(m.roi_percent > 0);
  assert.strictEqual(m.status, "profit");
});

test("calculateTripMetrics: end < start (error)", () => {
  const input: TripInput = {
    ...baseInput,
    start_odometer_km: 200,
    end_odometer_km: 100,
  };

  assert.throws(
    () => calculateTripMetrics(input),
    /end_odometer_km cannot be less than start_odometer_km/
  );
});

test("calculateTripMetrics: driver per_day з days_count", () => {
  const input: TripInput = {
    ...baseInput,
    driver_pay_mode: "per_day",
    driver_pay_uah: 0,
    driver_pay_uah_per_day: 800,
    days_count: 3,
  };
  const m = calculateTripMetrics(input);

  assert.strictEqual(m.driver_cost_uah, 2400);
  assert.strictEqual(m.taxes_cost_uah, 450);
});

test("calculateTripMetrics: totalCosts = 0 (roi = 0)", () => {
  const input: TripInput = {
    ...baseInput,
    fuel_consumption_l_per_100km: 0,
    fuel_price_uah_per_l: 0,
    depreciation_uah_per_km: 0,
    days_count: 1,
    daily_taxes_uah: 0,
    driver_pay_uah: 0,
    driver_pay_uah_per_day: 0,
    extra_costs_uah: 0,
  };
  const m = calculateTripMetrics(input);

  assert.strictEqual(m.total_costs_uah, 0);
  assert.strictEqual(m.roi_percent, 0);
  assert.strictEqual(m.profit_uah, 10000);
  assert.strictEqual(m.status, "profit");
});

test("calculateTripMetrics: округлення та форматування — усі числа до 2 знаків", () => {
  const input: TripInput = {
    ...baseInput,
    start_odometer_km: 0,
    end_odometer_km: 33.333,
    fuel_consumption_l_per_100km: 7.777,
    fuel_price_uah_per_l: 49.99,
    depreciation_uah_per_km: 1.111,
    days_count: 2,
    daily_taxes_uah: 100.555,
    driver_pay_uah_per_day: 666.666,
    driver_pay_mode: "per_day",
    driver_pay_uah: 0,
    freight_uah: 5000,
    extra_costs_uah: 10.004,
  };
  const m = calculateTripMetrics(input);

  assert.strictEqual(m.distance_km, 33.33);
  assert.strictEqual(m.taxes_cost_uah, 201.11);
  assert.strictEqual(m.driver_cost_uah, 1333.33);

  const allNums = [
    m.distance_km,
    m.fuel_used_l,
    m.fuel_cost_uah,
    m.depreciation_cost_uah,
    m.taxes_cost_uah,
    m.driver_cost_uah,
    m.total_costs_uah,
    m.profit_uah,
    m.profit_per_km_uah,
    m.roi_percent,
  ];
  for (const n of allNums) {
    const decimals = (n.toString().split(".")[1] ?? "").length;
    assert.ok(decimals <= 2, `Expected at most 2 decimals, got ${n}`);
  }
});
