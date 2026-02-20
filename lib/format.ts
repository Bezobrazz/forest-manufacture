const DECIMAL_SEP = ".";
const THOUSANDS_SEP = "\u00A0";

function formatWithSep(value: number, decimals: number): string {
  const fixed = value.toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEP);
  return decPart != null ? `${withThousands}${DECIMAL_SEP}${decPart}` : withThousands;
}

export function formatUah(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${formatWithSep(value, 2)} грн`;
}

export function formatKm(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${formatWithSep(value, 2)} км`;
}

export function formatL(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${formatWithSep(value, 2)} л`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${formatWithSep(value, 2)}%`;
}

export function formatNum(value: number | null | undefined, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return formatWithSep(value, decimals);
}

export function parseNumericInput(raw: string, maxDecimals = 2): string {
  const normalized = raw.replace(",", ".");
  const digitsAndDot = normalized.replace(/[^\d.]/g, "");
  const idx = digitsAndDot.indexOf(".");
  if (idx === -1) return digitsAndDot;
  const intPart = digitsAndDot.slice(0, idx) || "0";
  const afterDot = digitsAndDot.slice(idx + 1).replace(/\./g, "");
  const decPart = afterDot.slice(0, maxDecimals);
  return decPart.length > 0 ? `${intPart}.${decPart}` : `${intPart}.`;
}
