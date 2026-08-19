import assert from "node:assert/strict";
import test from "node:test";
import {
  buildShiftHourlyWageDescription,
  parseShiftHourlyWageDescription,
} from "@/lib/shifts/hourly-wage-description";

test("build and parse tagged hourly wage descriptions", () => {
  const accounting = buildShiftHourlyWageDescription(12, "accounting", "ніч");
  const manual = buildShiftHourlyWageDescription(12, "manual", "вантаж");

  assert.equal(accounting, "Зміна #12, облік, ніч");
  assert.equal(manual, "Зміна #12, сума, вантаж");
  assert.deepEqual(parseShiftHourlyWageDescription(accounting, 12), {
    kind: "accounting",
    comment: "ніч",
  });
  assert.deepEqual(parseShiftHourlyWageDescription(manual, 12), {
    kind: "manual",
    comment: "вантаж",
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
