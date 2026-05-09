import { syncKeepinOrdersWithSupabase } from "@/lib/crm/keepincrm/reconcile";
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
    const { upserted, removed } = await syncKeepinOrdersWithSupabase(supabase);
    return Response.json({ ok: true, upserted, removed });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    console.error("[cron sync-keepincrm]", e);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
