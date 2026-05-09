import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { syncSingleKeepinAgreement } from "@/lib/crm/keepincrm/reconcile";

function webhookAuthorized(request: NextRequest, body: Record<string, unknown> | null) {
  const secret = process.env.KEEPINCRM_WEBHOOK_SECRET?.trim();
  if (!secret) return false;

  const qp = request.nextUrl.searchParams.get("token");
  if (qp === secret) return true;

  const hdr = request.headers.get("x-keepin-webhook-token");
  if (hdr === secret) return true;

  if (body?.webhook_secret != null && String(body.webhook_secret) === secret) {
    return true;
  }

  return false;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** Витягує ID угоди з тіла, яке задається в тригері KeepinCRM вручну. */
function extractAgreementIdFromWebhookBody(body: unknown): string | null {
  const root = asRecord(body);
  if (!root) return null;

  const direct =
    root.agreement_id ?? root.agreementId ?? root.deal_id ?? root.DealId ?? root.id;
  if (direct !== undefined && direct !== null && String(direct).trim() !== "") {
    return String(direct).trim();
  }

  const inner = asRecord(root.agreement) ?? asRecord(root.deal);
  const nested = inner?.id;
  if (nested !== undefined && nested !== null) {
    return String(nested).trim();
  }

  return null;
}

export async function POST(request: NextRequest) {
  if (!process.env.KEEPINCRM_WEBHOOK_SECRET?.trim()) {
    return NextResponse.json(
      { ok: false, error: "KEEPINCRM_WEBHOOK_SECRET not configured" },
      { status: 503 }
    );
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = null;
  }

  if (!webhookAuthorized(request, body)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const agreementId = extractAgreementIdFromWebhookBody(body ?? {});
  if (!agreementId) {
    return NextResponse.json(
      { ok: false, error: "Could not resolve agreement id from webhook body" },
      { status: 400 }
    );
  }

  try {
    const supabase = createServiceRoleClient();
    const result = await syncSingleKeepinAgreement(supabase, agreementId);
    revalidatePath("/shipments");
    return NextResponse.json({ ok: true, agreementId, result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Webhook sync failed";
    console.error("[webhook keepincrm]", agreementId, e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
