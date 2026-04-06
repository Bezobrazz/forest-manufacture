import { checkPackingBagLowStockAndNotify } from "@/lib/packing-bags/stock-alert";

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

  const result = await checkPackingBagLowStockAndNotify({ trigger: "morning" });
  return Response.json(result);
}
