import type { PrivatAccount } from "@/lib/bank/privatbank/types";

const UA_IBAN_RE = /^UA\d{27}$/i;

export function isUaIban(value: string): boolean {
  return UA_IBAN_RE.test(value.replace(/\s/g, ""));
}

/**
 * Формати:
 * - `UA...;Назва`
 * - `UA...,Назва`
 * - `UA...,Назва1;UA...,Назва2`
 */
export function parsePrivatAccounts(raw: string | undefined | null): PrivatAccount[] {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return [];

  const accounts: PrivatAccount[] = [];

  for (const part of trimmed.split(";").map((p) => p.trim()).filter(Boolean)) {
    const commaIdx = part.indexOf(",");
    const head = (commaIdx >= 0 ? part.slice(0, commaIdx) : part).replace(/\s/g, "");
    const labelFromComma = commaIdx >= 0 ? part.slice(commaIdx + 1).trim() : "";

    if (isUaIban(head)) {
      const iban = head.toUpperCase();
      accounts.push({
        iban,
        label: labelFromComma || iban,
      });
      continue;
    }

    // `UA...;Forest_Main` — друга частина після `;` є назвою попереднього рахунку
    if (accounts.length > 0) {
      const prev = accounts[accounts.length - 1];
      if (prev.label === prev.iban) {
        prev.label = part;
      }
    }
  }

  return accounts;
}

export function getPrivatApiCredentials(): { id: string; token: string } {
  const id = process.env.PRIVATBANK_API_ID?.trim() ?? "";
  const token = process.env.PRIVATBANK_API_TOKEN?.trim() ?? "";
  if (!id || !token) {
    throw new Error(
      "Не задано PRIVATBANK_API_ID або PRIVATBANK_API_TOKEN у .env.local"
    );
  }
  return { id, token };
}

export function getConfiguredPrivatAccounts(): PrivatAccount[] {
  const accounts = parsePrivatAccounts(process.env.PRIVATBANK_ACCOUNTS);
  if (accounts.length === 0) {
    throw new Error(
      "Не задано PRIVATBANK_ACCOUNTS (IBAN рахунків) у .env.local"
    );
  }
  return accounts;
}
