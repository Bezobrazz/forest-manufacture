import { revalidatePath } from "next/cache";
import { reconcileFundTransfersWithKeepin } from "@/lib/crm/keepincrm/sync-fund-transfer";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  const xCronSecret = request.headers.get("x-cron-secret");

  return bearer === secret || xCronSecret === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceRoleClient();
    const result = await reconcileFundTransfersWithKeepin(supabase);
    revalidatePath("/expenses");
    return Response.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Reconcile failed";
    console.error("[cron reconcile-fund-transfers]", e);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
