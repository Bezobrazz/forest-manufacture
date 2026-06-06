/**
 * Виводить ID гаманця та категорії витрат KeepinCRM для .env / секретів.
 *
 *   npx tsx scripts/keepin-payment-ids.ts
 *
 * Читає KEEPINCRM_* з .env.local (якщо є) або з поточного середовища.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_PURSE_NAME = "Петрович";
const DEFAULT_CATEGORY_NAME = "Закупівля Кора Сировина";
const DEFAULT_FUND_TRANSFER_FROM_NAME = "Безготівка";
const DEFAULT_FUND_TRANSFER_TO_NAME = "Петрович";

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

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

type ListItem = { id?: number; name?: string; kind?: string };

async function fetchAllPages(path: string, apiKey: string, baseUrl: string): Promise<ListItem[]> {
  const merged: ListItem[] = [];
  let page = 1;

  while (page <= 50) {
    const url = new URL(`${baseUrl}${path}`);
    url.searchParams.set("page", String(page));

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Auth-Token": apiKey,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
    }

    const data = (await res.json()) as { items?: ListItem[]; pagination?: { total_pages?: number } };
    const chunk = Array.isArray(data.items) ? data.items : [];
    merged.push(...chunk);

    if (!chunk.length) break;
    const totalPages = data.pagination?.total_pages;
    if (typeof totalPages === "number" && page >= totalPages) break;
    page += 1;
  }

  return merged;
}

async function main(): Promise<void> {
  loadEnvLocal();

  const apiKey = process.env.KEEPINCRM_API_KEY?.trim();
  const baseUrl = (process.env.KEEPINCRM_BASE_URL?.trim() || "https://api.keepincrm.com/v1").replace(
    /\/+$/,
    ""
  );

  const purseName =
    process.env.KEEPINCRM_SUPPLIER_EXPENSE_PURSE_NAME?.trim() || DEFAULT_PURSE_NAME;
  const categoryName =
    process.env.KEEPINCRM_SUPPLIER_EXPENSE_CATEGORY_NAME?.trim() || DEFAULT_CATEGORY_NAME;
  const fundTransferFromName =
    process.env.KEEPINCRM_FUND_TRANSFER_FROM_PURSE_LABEL?.trim() ||
    DEFAULT_FUND_TRANSFER_FROM_NAME;
  const fundTransferToName =
    process.env.KEEPINCRM_FUND_TRANSFER_TO_PURSE_LABEL?.trim() ||
    DEFAULT_FUND_TRANSFER_TO_NAME;

  if (!apiKey) {
    console.error("❌ Додайте KEEPINCRM_API_KEY у .env.local або в середовище");
    process.exit(1);
  }

  console.log(`API: ${baseUrl}\n`);

  const purses = await fetchAllPages("/payments/purses", apiKey, baseUrl);
  const categories = await fetchAllPages("/payments/categories", apiKey, baseUrl);

  console.log("=== Гаманці (purses) ===");
  for (const p of purses) {
    if (p.id != null && p.name) console.log(`  ${p.id}\t${p.name}`);
  }

  console.log("\n=== Категорії витрат (kind=credit у KeepinCRM) ===");
  const debitCategories = categories.filter((c) => normalizeName(c.kind ?? "") === "credit");
  for (const c of debitCategories) {
    if (c.id != null && c.name) console.log(`  ${c.id}\t${c.name}`);
  }

  const purseNeedle = normalizeName(purseName);
  const categoryNeedle = normalizeName(categoryName);

  const purse = purses.find((p) => normalizeName(p.name ?? "") === purseNeedle);
  const category = debitCategories.find((c) => normalizeName(c.name ?? "") === categoryNeedle);
  const fundFromPurse = purses.find(
    (p) => normalizeName(p.name ?? "") === normalizeName(fundTransferFromName)
  );
  const fundToPurse = purses.find(
    (p) => normalizeName(p.name ?? "") === normalizeName(fundTransferToName)
  );

  console.log("\n=== Для секретів (.env / Vercel) ===\n");

  if (purse?.id) {
    console.log(`KEEPINCRM_SUPPLIER_EXPENSE_PURSE_ID=${purse.id}`);
    console.log(`# гаманець: ${purse.name}`);
  } else {
    console.log(`# Гаманець «${purseName}» не знайдено — перевірте назву в списку вище`);
  }

  if (category?.id) {
    console.log(`KEEPINCRM_SUPPLIER_EXPENSE_CATEGORY_ID=${category.id}`);
    console.log(`# категорія: ${category.name}`);
  } else {
    console.log(`# Категорію «${categoryName}» не знайдено — перевірте назву в списку вище`);
  }

  console.log("");
  if (fundFromPurse?.id) {
    console.log(`KEEPINCRM_FUND_TRANSFER_FROM_PURSE_ID=${fundFromPurse.id}`);
    console.log(`# ${fundFromPurse.name}`);
  } else {
    console.log(
      `# Гаманець «${fundTransferFromName}» для переміщення не знайдено — перевірте список purses`
    );
  }

  if (fundToPurse?.id) {
    console.log(`KEEPINCRM_FUND_TRANSFER_TO_PURSE_ID=${fundToPurse.id}`);
    console.log(`# ${fundToPurse.name}`);
  } else {
    console.log(
      `# Гаманець «${fundTransferToName}» для переміщення не знайдено — перевірте список purses`
    );
  }

  console.log(
    "\n# Webhook KeepinCRM (Фінанси → тригер → Webhook POST):"
  );
  console.log(
    "# URL: https://<your-domain>/api/webhooks/keepincrm/finances?token=<KEEPINCRM_WEBHOOK_SECRET>"
  );
  console.log(`# Body (приклад):
# {
#   "id": "{{id}}",
#   "kind": "{{kind}}",
#   "amount": "{{amount}}",
#   "at": "{{at}}",
#   "comment": "{{comment}}",
#   "source_purse_id": "{{source_purse.id}}",
#   "target_purse_id": "{{target_purse.id}}",
#   "event": "created"
# }`);
  console.log(
    "# Для update/delete додайте окремі тригери з event=updated/deleted (якщо доступно в CRM)."
  );

  console.log(
    "\n# Опційно (якщо не вказати ID, додаток сам шукає за назвами Петрович / Закупівля Кора Сировина)"
  );

  if (!purse?.id || !category?.id || !fundFromPurse?.id || !fundToPurse?.id) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
