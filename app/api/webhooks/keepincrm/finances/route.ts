import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  deleteFundTransferByKeepinPaymentId,
  parseFinanceWebhookPayload,
  upsertFundTransferFromKeepin,
} from "@/lib/crm/keepincrm/sync-fund-transfer";

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

  const parsed = parseFinanceWebhookPayload(body ?? {});
  if (!parsed) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Unsupported finance webhook payload. Expected transfer between configured purse IDs.",
      },
      { status: 400 }
    );
  }

  try {
    const supabase = createServiceRoleClient();

    if (parsed.event === "deleted") {
      const removed = await deleteFundTransferByKeepinPaymentId(
        supabase,
        parsed.keepinPaymentId
      );
      revalidatePath("/expenses");
      return NextResponse.json({
        ok: true,
        action: "deleted",
        keepinPaymentId: parsed.keepinPaymentId,
        removed,
      });
    }

    const row = await upsertFundTransferFromKeepin(supabase, {
      keepinPaymentId: parsed.keepinPaymentId,
      amount: parsed.amount,
      atYmd: parsed.atYmd,
      comment: parsed.comment,
      fromPurseId: parsed.fromPurseId,
      toPurseId: parsed.toPurseId,
      source: "crm",
    });

    revalidatePath("/expenses");
    return NextResponse.json({
      ok: true,
      action: parsed.event,
      keepinPaymentId: parsed.keepinPaymentId,
      id: row?.id ?? null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Finance webhook failed";
    console.error("[webhook keepincrm finances]", body, e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
