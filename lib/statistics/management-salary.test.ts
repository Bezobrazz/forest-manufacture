import test from "node:test";
import assert from "node:assert";
import type { Employee } from "@/lib/types";
import {
  prorateMonthlyAmountForDateRange,
  sumManagerMonthlySalaries,
} from "./management-salary";

const makeEmployee = (
  overrides: Partial<Employee> & Pick<Employee, "id" | "name">
): Employee => ({
  position: null,
  is_manager: false,
  salary: null,
  created_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

test("sumManagerMonthlySalaries: sums only managers with positive salary", () => {
  const employees: Employee[] = [
    makeEmployee({ id: 1, name: "Worker", salary: 10000 }),
    makeEmployee({ id: 2, name: "Manager A", is_manager: true, salary: 30000 }),
    makeEmployee({ id: 3, name: "Manager B", is_manager: true, salary: 25000 }),
    makeEmployee({ id: 4, name: "Manager C", is_manager: true, salary: null }),
  ];

  assert.strictEqual(sumManagerMonthlySalaries(employees), 55000);
});

test("sumManagerMonthlySalaries: empty list returns 0", () => {
  assert.strictEqual(sumManagerMonthlySalaries([]), 0);
});

test("prorateMonthlyAmountForDateRange: full month", () => {
  const result = prorateMonthlyAmountForDateRange(
    60000,
    "2026-06-01",
    "2026-06-30"
  );
  assert.strictEqual(result, 60000);
});

test("prorateMonthlyAmountForDateRange: partial week in June", () => {
  const result = prorateMonthlyAmountForDateRange(
    60000,
    "2026-06-01",
    "2026-06-07"
  );
  assert.strictEqual(result, 60000 * (7 / 30));
});

test("prorateMonthlyAmountForDateRange: range across two months", () => {
  const result = prorateMonthlyAmountForDateRange(
    60000,
    "2026-06-15",
    "2026-07-15"
  );
  const expected =
    60000 * (16 / 30) + // June 15–30
    60000 * (15 / 31); // July 1–15
  assert.ok(Math.abs(result - expected) < 0.01);
});

test("prorateMonthlyAmountForDateRange: full year", () => {
  const result = prorateMonthlyAmountForDateRange(
    60000,
    "2026-01-01",
    "2026-12-31"
  );
  assert.strictEqual(result, 60000 * 12);
});

test("prorateMonthlyAmountForDateRange: zero or invalid amount", () => {
  assert.strictEqual(
    prorateMonthlyAmountForDateRange(0, "2026-06-01", "2026-06-30"),
    0
  );
  assert.strictEqual(
    prorateMonthlyAmountForDateRange(-100, "2026-06-01", "2026-06-30"),
    0
  );
});

test("prorateMonthlyAmountForDateRange: inverted range returns 0", () => {
  assert.strictEqual(
    prorateMonthlyAmountForDateRange(60000, "2026-06-30", "2026-06-01"),
    0
  );
});
