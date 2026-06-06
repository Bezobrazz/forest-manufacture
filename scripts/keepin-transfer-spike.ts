/**
 * Документує результати API spike для переміщень KeepinCRM.
 * Запуск: npx tsx scripts/keepin-transfer-spike.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function loadEnvLocal(): void {
  for (const file of [".env.local", ".env"]) {
    const path = join(process.cwd(), file);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const apiKey = process.env.KEEPINCRM_API_KEY?.trim();
  const baseUrl = (process.env.KEEPINCRM_BASE_URL?.trim() || "https://api.keepincrm.com/v1").replace(
    /\/+$/,
    ""
  );

  if (!apiKey) {
    console.error("❌ KEEPINCRM_API_KEY не задано");
    process.exit(1);
  }

  console.log("KeepinCRM fund transfer API spike\n");

  const pursesRes = await fetch(`${baseUrl}/payments/purses?page=1`, {
    headers: { Accept: "application/json", "X-Auth-Token": apiKey },
  });
  const pursesData = (await pursesRes.json()) as { items?: { id?: number; name?: string }[] };
  const bezgotivka = pursesData.items?.find((p) => p.name === "Безготівка");
  const petrovich = pursesData.items?.find((p) => p.name === "Петрович");
  console.log("Purse IDs:", {
    bezgotivka: bezgotivka?.id ?? null,
    petrovich: petrovich?.id ?? null,
  });

  const listRes = await fetch(`${baseUrl}/payments?page=1`, {
    headers: { Accept: "application/json", "X-Auth-Token": apiKey },
  });
  const listData = (await listRes.json()) as { items?: { kind?: string; purse?: { id?: number } }[] };
  const transfer = listData.items?.find((item) => item.kind === "transfer");
  console.log("\nSample transfer list item keys:", transfer ? Object.keys(transfer) : "none");
  console.log("Sample transfer:", transfer ?? null);

  const postBody = {
    amount: 1,
    kind: "transfer",
    purse_id: petrovich?.id ?? 7,
    source_purse_id: bezgotivka?.id ?? 1,
    at: new Date().toISOString().slice(0, 10),
    comment: "API spike test (do not use in prod)",
    planned: false,
    currency: "UAH",
  };

  const postRes = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Auth-Token": apiKey,
    },
    body: JSON.stringify(postBody),
  });
  console.log("\nPOST /payments (transfer):", postRes.status, (await postRes.text()).slice(0, 300));

  if (transfer && typeof (transfer as { id?: number }).id === "number") {
    const id = (transfer as { id: number }).id;
    for (const method of ["GET", "PATCH", "DELETE"] as const) {
      const res = await fetch(`${baseUrl}/payments/${id}`, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Auth-Token": apiKey,
        },
        body: method === "GET" ? undefined : JSON.stringify({ amount: 1 }),
      });
      console.log(`${method} /payments/${id}:`, res.status);
    }
  }

  console.log(`
Висновки:
- У списку GET /payments переміщення мають kind=transfer; purse.id зазвичай = гаманець-отримувач.
- GET/PATCH/DELETE /payments/:id повертають 404 (операції по ID недоступні).
- POST /payments з kind=transfer потребує source purse; поле source_purse_id у JSON поки не приймається API.
- CRM → app: основний канал — webhook /api/webhooks/keepincrm/finances з source_purse_id + target_purse_id.
- Добовий reconcile: /api/cron/reconcile-fund-transfers і pullFundTransfersFromKeepin підтягують transfer з GET /payments (purse.id = toPurseId).
`);
}

main().catch((error) => {
  console.error("❌", error instanceof Error ? error.message : error);
  process.exit(1);
});
