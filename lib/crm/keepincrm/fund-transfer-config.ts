const DEFAULT_FROM_LABEL = "Безготівка";
const DEFAULT_TO_LABEL = "Петрович";

function parseEnvId(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.trunc(id) : null;
}

export function getFundTransferFromPurseId(): number {
  const id = parseEnvId("KEEPINCRM_FUND_TRANSFER_FROM_PURSE_ID");
  if (!id) {
    throw new Error(
      "KEEPINCRM_FUND_TRANSFER_FROM_PURSE_ID не налаштовано (ID гаманця-джерела)"
    );
  }
  return id;
}

export function getFundTransferToPurseId(): number {
  const id = parseEnvId("KEEPINCRM_FUND_TRANSFER_TO_PURSE_ID");
  if (!id) {
    throw new Error(
      "KEEPINCRM_FUND_TRANSFER_TO_PURSE_ID не налаштовано (ID гаманця-отримувача)"
    );
  }
  return id;
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

export function isConfiguredFundTransferPair(
  fromPurseId: number,
  toPurseId: number
): boolean {
  const configured = tryGetFundTransferPurseIds();
  if (!configured) return false;
  return (
    configured.fromPurseId === fromPurseId && configured.toPurseId === toPurseId
  );
}

export function isFundTransferSyncEnabled(): boolean {
  return Boolean(process.env.KEEPINCRM_API_KEY?.trim());
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
