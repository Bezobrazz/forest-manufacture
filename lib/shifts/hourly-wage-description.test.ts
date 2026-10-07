import assert from "node:assert/strict";
import test from "node:test";
import {
  buildShiftHourlyWageDescription,
  parseShiftHourlyWageDescription,
} from "@/lib/shifts/hourly-wage-description";

test("build and parse tagged hourly wage descriptions", () => {
  const accounting = buildShiftHourlyWageDescription(12, "accounting", "ніч");
  const manual = buildShiftHourlyWageDescription(12, "manual", "вантаж");
  const loadingCount = buildShiftHourlyWageDescription(
    12,
    "loading_count",
    "підрахунок завантаження"
  );
  const loading = buildShiftHourlyWageDescription(
    12,
    "loading",
    "завантаження кори"
  );

  assert.equal(accounting, "Зміна #12, облік, ніч");
  assert.equal(manual, "Зміна #12, сума, вантаж");
  assert.equal(loadingCount, "Зміна #12, підрахунок, підрахунок завантаження");
  assert.equal(loading, "Зміна #12, завантаження, завантаження кори");
  assert.deepEqual(parseShiftHourlyWageDescription(accounting, 12), {
    kind: "accounting",
    comment: "ніч",
  });
  assert.deepEqual(parseShiftHourlyWageDescription(manual, 12), {
    kind: "manual",
    comment: "вантаж",
  });
  assert.deepEqual(parseShiftHourlyWageDescription(loadingCount, 12), {
    kind: "loading_count",
    comment: "підрахунок завантаження",
  });
  assert.deepEqual(parseShiftHourlyWageDescription(loading, 12), {
    kind: "loading",
    comment: "завантаження кори",
  });
});

test("legacy descriptions stay classified", () => {
  assert.deepEqual(parseShiftHourlyWageDescription("Зміна #4, погодинна", 4), {
    kind: "accounting",
    comment: "погодинна",
  });
  assert.deepEqual(
    parseShiftHourlyWageDescription("Зміна #4, Вантажні роботи", 4),
    { kind: "manual", comment: "Вантажні роботи" }
  );
});
