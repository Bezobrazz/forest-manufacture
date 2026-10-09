import assert from "node:assert/strict";
import test from "node:test";
import {
  formatKyivDateTime,
  kyivWallTimeToIso,
} from "@/lib/datetime/kyiv";
import { formatDateTime } from "@/lib/utils";

test("kyivWallTimeToIso round-trips wall clock in Europe/Kyiv", () => {
  const summer = kyivWallTimeToIso(2026, 10, 8, 15, 13);
  const winter = kyivWallTimeToIso(2026, 1, 15, 9, 0);

  assert.equal(summer, "2026-10-08T12:13:00.000Z");
  assert.equal(winter, "2026-01-15T07:00:00.000Z");
  assert.equal(formatDateTime(summer), "08.10.2026 15:13");
  assert.equal(formatDateTime(winter), "15.01.2026 09:00");
});

test("formatDateTime shows Kyiv wall time for real open/close instants", () => {
  assert.equal(formatDateTime("2026-10-09T12:13:34.249Z"), "09.10.2026 15:13");
  assert.equal(formatDateTime("2026-10-09T12:14:28.088Z"), "09.10.2026 15:14");
  assert.equal(formatDateTime("2026-10-08T21:30:00.000Z"), "09.10.2026 00:30");
  assert.equal(formatDateTime("2026-10-25T00:30:00.000Z"), "25.10.2026 03:30");
});

test("formatDateTime keeps invalid values unchanged", () => {
  assert.equal(formatDateTime(""), "");
  assert.equal(formatDateTime("not-a-date"), "not-a-date");
  assert.equal(
    formatKyivDateTime(new Date("2026-10-09T12:14:28.088Z")),
    "09.10.2026 15:14",
  );
});
