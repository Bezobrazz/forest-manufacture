import { fetchAllKeepinPurses } from "@/lib/crm/keepincrm/payments";

const DEFAULT_FROM_LABEL = "Безготівка";
const DEFAULT_TO_LABEL = "Петрович";

function normalizeLookupName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseEnvId(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.trunc(id) : null;
}

export function getFundTransferFromPurseLabel(): string {
  return (
    process.env.KEEPINCRM_FUND_TRANSFER_FROM_PURSE_LABEL?.trim() ||
    DEFAULT_FROM_LABEL
  );
}

export function getFundTransferToPurseLabel(): string {
  return (
    process.env.KEEPINCRM_FUND_TRANSFER_TO_PURSE_LABEL?.trim() || DEFAULT_TO_LABEL
  );
}

export function getFundTransferRouteLabel(): string {
  return `${getFundTransferFromPurseLabel()} → ${getFundTransferToPurseLabel()}`;
}

export function tryGetFundTransferPurseIds(): {
  fromPurseId: number;
  toPurseId: number;
} | null {
  const fromPurseId = parseEnvId("KEEPINCRM_FUND_TRANSFER_FROM_PURSE_ID");
  const toPurseId = parseEnvId("KEEPINCRM_FUND_TRANSFER_TO_PURSE_ID");
  if (!fromPurseId || !toPurseId) return null;
  return { fromPurseId, toPurseId };
}

let cachedResolvedPurseIds: { fromPurseId: number; toPurseId: number } | null | undefined;

/** ID з env або пошук за назвами гаманців у KeepinCRM. */
export async function resolveFundTransferPurseIds(): Promise<{
  fromPurseId: number;
  toPurseId: number;
}> {
  const fromEnv = tryGetFundTransferPurseIds();
  if (fromEnv) {
    cachedResolvedPurseIds = fromEnv;
    return fromEnv;
  }

  if (cachedResolvedPurseIds !== undefined) {
    if (cachedResolvedPurseIds === null) {
      throw new Error(
        `KeepinCRM: не знайдено гаманці «${getFundTransferFromPurseLabel()}» → «${getFundTransferToPurseLabel()}».`
      );
    }
    return cachedResolvedPurseIds;
  }

  const fromName = normalizeLookupName(getFundTransferFromPurseLabel());
  const toName = normalizeLookupName(getFundTransferToPurseLabel());
  const purses = await fetchAllKeepinPurses();
  const fromMatch = purses.find((p) => normalizeLookupName(p.name) === fromName);
  const toMatch = purses.find((p) => normalizeLookupName(p.name) === toName);

  if (!fromMatch || !toMatch) {
    cachedResolvedPurseIds = null;
    throw new Error(
      `KeepinCRM: не знайдено гаманці «${getFundTransferFromPurseLabel()}» та «${getFundTransferToPurseLabel()}». Додайте KEEPINCRM_FUND_TRANSFER_FROM_PURSE_ID=1 та KEEPINCRM_FUND_TRANSFER_TO_PURSE_ID=7 на Vercel.`
    );
  }

  cachedResolvedPurseIds = {
    fromPurseId: fromMatch.id,
    toPurseId: toMatch.id,
  };
  return cachedResolvedPurseIds;
}

export async function getFundTransferFromPurseId(): Promise<number> {
  const { fromPurseId } = await resolveFundTransferPurseIds();
  return fromPurseId;
}

export async function getFundTransferToPurseId(): Promise<number> {
  const { toPurseId } = await resolveFundTransferPurseIds();
  return toPurseId;
}

export function isConfiguredFundTransferPair(
  fromPurseId: number,
  toPurseId: number,
  configured?: { fromPurseId: number; toPurseId: number }
): boolean {
  const pair = configured ?? tryGetFundTransferPurseIds() ?? cachedResolvedPurseIds ?? null;
  if (!pair) return false;
  return pair.fromPurseId === fromPurseId && pair.toPurseId === toPurseId;
}

export function isFundTransferSyncEnabled(): boolean {
  return Boolean(process.env.KEEPINCRM_API_KEY?.trim());
}

export function getFundTransferPullConfigError(): string | null {
  if (!isFundTransferSyncEnabled()) {
    return "KEEPINCRM_API_KEY не налаштовано на сервері (перевірте env на Vercel Production)";
  }
  return null;
}

/** App → CRM push (POST/PATCH/DELETE transfer). За замовчуванням вимкнено: API KeepinCRM не приймає transfer. */
export function isFundTransferPushEnabled(): boolean {
  const raw = process.env.KEEPINCRM_FUND_TRANSFER_PUSH_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

export const FUND_TRANSFER_APP_COMMENT_PREFIX = "Переміщення коштів #";

export function buildFundTransferAppComment(localId: number, comment?: string | null): string {
  const trimmed = comment?.trim();
  const base = `${FUND_TRANSFER_APP_COMMENT_PREFIX}${localId}`;
  return trimmed ? `${base}: ${trimmed}` : base;
}

export function parseFundTransferAppComment(comment: string | null | undefined): {
  localId: number | null;
  userComment: string | null;
} {
  if (!comment?.trim()) return { localId: null, userComment: null };
  const match = comment.trim().match(/^Переміщення коштів #(\d+)(?::\s*(.*))?$/);
  if (!match) return { localId: null, userComment: comment.trim() };
  return {
    localId: Number(match[1]),
    userComment: match[2]?.trim() || null,
  };
}

export function getFundTransferDisplayComment(
  comment: string | null | undefined
): string | null {
  return parseFundTransferAppComment(comment).userComment;
}
