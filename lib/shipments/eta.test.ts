import test from "node:test";
import assert from "node:assert";
import { calculateForecast } from "./eta";
import type { CrmOrderWithDetails } from "@/lib/types";

const baseOrder = (over: Partial<CrmOrderWithDetails>): CrmOrderWithDetails => ({
  id: 1,
  crm_id: "k1",
  customer_id: 1,
  crm_status: "active",
  crm_created_at: "2026-01-01T00:00:00.000Z",
  queue_rank: 0,
  notes: null,
  synced_at: "2026-01-01T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
  customer: {
    id: 1,
    crm_id: "c1",
    name: "Клієнт",
    phone: null,
    email: null,
    synced_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
  },
  items: [],
  ...over,
});

test("ready order fully covered by stock", () => {
  const queue = [
    baseOrder({
      items: [
        {
          id: 1,
          order_id: 1,
          product_id: 10,
          crm_product_ref: "Пилки",
          quantity: 5,
          created_at: "2026-01-01",
        },
      ],
    }),
  ];
  const f = calculateForecast({
    queue,
    inventory: { 10: 100 },
    avgDailyProduction: { 10: 10 },
    today: new Date("2026-05-09T12:00:00.000Z"),
  });
  assert.strictEqual(f.length, 1);
  assert.strictEqual(f[0].isReady, true);
  assert.strictEqual(f[0].etaDate, "2026-05-09");
  assert.strictEqual(f[0].missing.length, 0);
});

test("order waits on production avg 10/day need 25 from 0 stock → +3 days", () => {
  const queue = [
    baseOrder({
      items: [
        {
          id: 1,
          order_id: 1,
          product_id: 10,
          crm_product_ref: "Товар А",
          quantity: 25,
          created_at: "2026-01-01",
        },
      ],
    }),
  ];
  const f = calculateForecast({
    queue,
    inventory: { 10: 0 },
    avgDailyProduction: { 10: 10 },
    today: new Date("2026-05-01T12:00:00.000Z"),
  });
  assert.strictEqual(f[0].etaDate, "2026-05-04");
  assert.strictEqual(f[0].isReady, false);
});

test("FIFO: second order pushed after first consumes stock", () => {
  const q = [
    baseOrder({
      id: 1,
      crm_id: "a",
      crm_created_at: "2026-05-01T10:00:00.000Z",
      items: [
        {
          id: 1,
          order_id: 1,
          product_id: 10,
          crm_product_ref: "Товар",
          quantity: 80,
          created_at: "2026-01-01",
        },
      ],
    }),
    baseOrder({
      id: 2,
      crm_id: "b",
      crm_created_at: "2026-05-02T10:00:00.000Z",
      items: [
        {
          id: 2,
          order_id: 2,
          product_id: 10,
          crm_product_ref: "Товар",
          quantity: 80,
          created_at: "2026-01-01",
        },
      ],
    }),
  ];
  const f = calculateForecast({
    queue: q,
    inventory: { 10: 100 },
    avgDailyProduction: { 10: 10 },
    today: new Date("2026-05-10T12:00:00.000Z"),
  });

  assert.strictEqual(f[0].etaDate, "2026-05-10");
  assert.strictEqual(f[1].etaDate, "2026-05-16");
});

test("avgDaily 0 yields null ETA and missing entry", () => {
  const queue = [
    baseOrder({
      items: [
        {
          id: 1,
          order_id: 1,
          product_id: 10,
          crm_product_ref: "Товар",
          quantity: 5,
          created_at: "2026-01-01",
        },
      ],
    }),
  ];
  const f = calculateForecast({
    queue,
    inventory: { 10: 0 },
    avgDailyProduction: {},
    today: new Date("2026-05-01T12:00:00.000Z"),
  });
  assert.strictEqual(f[0].etaDate, null);
  assert.ok(f[0].missing.some((m) => m.productId === 10));
});

test("unmapped product blocks ETA", () => {
  const queue = [
    baseOrder({
      items: [
        {
          id: 1,
          order_id: 1,
          product_id: null,
          crm_product_ref: "Невідомо",
          quantity: 1,
          created_at: "2026-01-01",
        },
      ],
    }),
  ];
  const f = calculateForecast({
    queue,
    inventory: {},
    avgDailyProduction: {},
    today: new Date("2026-05-01T12:00:00.000Z"),
  });
  assert.strictEqual(f[0].etaDate, null);
  assert.ok(f[0].missing.some((m) => m.productId === 0));
});
