import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTripsCsv,
  buildTripsExportFilename,
  CSV_DELIMITER,
  escapeCsvCell,
  formatExportNumber,
  filterTripsForExport,
  type TripExportRow,
} from "./export";

test("formatExportNumber uses comma decimal for Excel uk-UA", () => {
  assert.equal(formatExportNumber(1500), "1500");
  assert.equal(formatExportNumber(17.65), "17,65");
  assert.equal(formatExportNumber(1.5), "1,5");
});

test("escapeCsvCell escapes delimiter semicolons and quotes", () => {
  assert.equal(escapeCsvCell("a;b"), '"a;b"');
  assert.equal(escapeCsvCell("a,b"), "a,b");
  assert.equal(escapeCsvCell('say "hi"'), '"say ""hi"""');
  assert.equal(escapeCsvCell("line\nbreak"), '"line\nbreak"');
});

test("escapeCsvCell leaves plain text unchanged", () => {
  assert.equal(escapeCsvCell("plain"), "plain");
});

test("filterTripsForExport filters by trip type and profit status", () => {
  const base = {
    id: "1",
    user_id: "u",
    vehicle_id: "v",
    name: "Test",
    trip_date: "2026-03-01",
    trip_start_date: "2026-03-01",
    trip_end_date: "2026-03-02",
    trip_type: "commerce",
    start_odometer_km: 0,
    end_odometer_km: 100,
    fuel_consumption_l_per_100km: 10,
    fuel_price_uah_per_l: 50,
    depreciation_uah_per_km: 1,
    days_count: 1,
    daily_taxes_uah: 150,
    freight_uah: 1000,
    driver_pay_mode: "per_trip",
    driver_pay_uah: 100,
    driver_pay_uah_per_day: 0,
    driver_pay_percent_of_freight: null,
    extra_costs_uah: 0,
    bags_count: null,
    notes: null,
    distance_km: 100,
    fuel_used_l: 10,
    fuel_cost_uah: 500,
    depreciation_cost_uah: 100,
    taxes_cost_uah: 150,
    driver_cost_uah: 100,
    total_costs_uah: 850,
    profit_uah: 150,
    profit_per_km_uah: 1.5,
    roi_percent: 17.65,
    vehicle: { name: "Van" },
  } satisfies TripExportRow;

  const rows = filterTripsForExport([base], {
    tripType: "commerce",
    statusFilter: "profit",
  });
  assert.equal(rows.length, 1);

  const none = filterTripsForExport([base], {
    tripType: "raw",
    statusFilter: "",
  });
  assert.equal(none.length, 0);
});

test("buildTripsCsv uses semicolon delimiter", () => {
  const csv = buildTripsCsv([]);
  assert.ok(csv.startsWith(`ID${CSV_DELIMITER}`));
});

test("buildTripsExportFilename for all period omits year", () => {
  assert.equal(
    buildTripsExportFilename("commerce", "all", 2026),
    "reyisy-komeriya-uves.csv",
  );
});
