export type ParsedKeepinAgreement = {
  crm_id: string;
  crm_created_at_iso: string;
  keepin_stage_id: number | string | null;
  crm_status: string | null;
  notes: string | null;
  customerCrmId: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  lines: { quantity: number; title: string; sku: string | null }[];
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function firstPhone(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") return v[0].trim();
  return null;
}

export function unwrapAgreementPayload(root: Record<string, unknown>): Record<string, unknown> {
  const inner = root.agreement ?? root.data ?? root.item;
  const rec = asRecord(inner);
  return rec ?? root;
}

function parseJobs(raw: Record<string, unknown>): ParsedKeepinAgreement["lines"] {
  const jobs = raw.jobs ?? raw.jobs_attributes;
  if (!Array.isArray(jobs)) return [];

  const lines: ParsedKeepinAgreement["lines"] = [];

  for (const j of jobs) {
    const job = asRecord(j);
    if (!job) continue;
    const amount = Number(job.amount ?? job.quantity ?? job.count ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const title =
      typeof job.title === "string" && job.title.trim()
        ? job.title.trim()
        : "";
    const pa = asRecord(job.product_attributes);
    const paTitle =
      typeof pa?.title === "string" && pa.title.trim()
        ? pa.title.trim()
        : "";
    const name = title || paTitle || "Товар без назви";
    const skuRaw = pa?.sku;
    const sku =
      skuRaw !== undefined && skuRaw !== null ? String(skuRaw).trim() || null : null;
    lines.push({ quantity: amount, title: name, sku });
  }

  return lines;
}

/** Нормалізує відповідь GET /agreements або /agreements/:id до внутрішньої моделі. */
export function parseKeepinAgreement(root: Record<string, unknown>): ParsedKeepinAgreement | null {
  const raw = unwrapAgreementPayload(root);

  const idRaw = raw.id ?? raw.agreement_id;
  if (idRaw === undefined || idRaw === null) return null;
  const crm_id = String(idRaw);

  const created =
    (typeof raw.created_at === "string" && raw.created_at) ||
    (typeof raw.created === "string" && raw.created) ||
    new Date().toISOString();

  const stage = asRecord(raw.stage);
  const stageId = raw.stage_id ?? stage?.id ?? null;
  const stageName =
    typeof stage?.name === "string"
      ? stage.name
      : typeof raw.stage_name === "string"
        ? raw.stage_name
        : null;

  const client = asRecord(raw.client) ?? asRecord(raw.customer);
  const clientIdRaw =
    client?.id ?? raw.client_id ?? raw.main_client_id ?? raw.customer_id;
  const customerCrmId =
    clientIdRaw !== undefined && clientIdRaw !== null
      ? String(clientIdRaw)
      : `agreement:${crm_id}`;

  const person =
    typeof client?.person === "string"
      ? client.person.trim()
      : typeof client?.fullname === "string"
        ? client.fullname.trim()
        : "";
  const company =
    typeof client?.company === "string" ? client.company.trim() : "";

  const customerName =
    person || company || (typeof raw.title === "string" ? raw.title.trim() : "") || "Клієнт";

  const email =
    typeof client?.email === "string" && client.email.includes("@")
      ? client.email.trim()
      : null;

  const phone = firstPhone(client?.phones ?? client?.phone);

  const notes =
    typeof raw.comment === "string"
      ? raw.comment
      : typeof raw.note === "string"
        ? raw.note
        : null;

  return {
    crm_id,
    crm_created_at_iso: created,
    keepin_stage_id: stageId as number | string | null,
    crm_status: stageName ?? (stageId != null ? String(stageId) : null),
    notes,
    customerCrmId,
    customerName,
    customerPhone: phone,
    customerEmail: email,
    lines: parseJobs(raw),
  };
}

/** Значення `KEEPINCRM_ACTIVE_STAGE_IDS` (через кому). Якщо порожньо — всі проходять фільтр. */
export function parseStageIdAllowlist(): Set<string> | null {
  const raw = process.env.KEEPINCRM_ACTIVE_STAGE_IDS?.trim();
  if (!raw) return null;
  const set = new Set<string>();
  for (const part of raw.split(",")) {
    const t = part.trim();
    if (t.length > 0) set.add(t);
  }
  return set.size > 0 ? set : null;
}

export function isAgreementInActiveStages(parsed: ParsedKeepinAgreement): boolean {
  const allow = parseStageIdAllowlist();
  if (!allow) return true;
  if (parsed.keepin_stage_id === null || parsed.keepin_stage_id === undefined)
    return false;
  const sid = String(parsed.keepin_stage_id);
  return allow.has(sid);
}

export function normalizeProductKey(name: string): string {
  return name.trim().toLowerCase();
}
