import { NextResponse } from "next/server";
import { getUserWithRole } from "@/lib/auth/get-user-role";
import { canUseAiAssistant } from "@/lib/ai/access";

export async function requireAiAccess() {
  const { user, role } = await getUserWithRole();

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!canUseAiAssistant(role)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Forbidden: AI analytics is available only for owners and admins" },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, user, role };
}
