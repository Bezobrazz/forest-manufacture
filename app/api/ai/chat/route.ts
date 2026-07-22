import { streamText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { loadAnalyticsSnapshot } from "@/lib/ai/load-snapshot";
import { chatModel } from "@/lib/ai/models";
import {
  formatSnapshotForPrompt,
  PRODUCTION_ANALYST_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";
import { requireAiAccess } from "@/lib/ai/require-ai-access";

export const runtime = "nodejs";
export const maxDuration = 60;

const chatBodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      })
    )
    .min(1)
    .max(40),
  periodStart: z.string(),
  periodEnd: z.string(),
  periodLabel: z.string(),
  monthlyTaxesUah: z.number().optional(),
  monthlyElectricityUah: z.number().optional(),
  includeManagementSalaryInCost: z.boolean().optional(),
  latestPackingBagPriceUah: z.number().optional(),
});

export async function POST(request: Request) {
  const access = await requireAiAccess();
  if (!access.ok) return access.response;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 503 }
    );
  }

  const rate = checkAiRateLimit(access.user.id, "chat");
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Забагато запитів. Спробуйте трохи пізніше." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = chatBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid chat body" },
      { status: 400 }
    );
  }

  const loaded = await loadAnalyticsSnapshot({
    periodStart: parsed.data.periodStart,
    periodEnd: parsed.data.periodEnd,
    periodLabel: parsed.data.periodLabel,
    monthlyTaxesUah: parsed.data.monthlyTaxesUah,
    monthlyElectricityUah: parsed.data.monthlyElectricityUah,
    includeManagementSalaryInCost: parsed.data.includeManagementSalaryInCost,
    latestPackingBagPriceUah: parsed.data.latestPackingBagPriceUah,
  });

  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: 400 });
  }

  try {
    const result = streamText({
      model: chatModel,
      system: `${PRODUCTION_ANALYST_SYSTEM_PROMPT}\n\nПоточний snapshot за період «${loaded.snapshot.period.label}»:\n${formatSnapshotForPrompt(loaded.snapshot)}`,
      messages: parsed.data.messages,
      temperature: 0.4,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("POST /api/ai/chat:", error);
    return NextResponse.json(
      { error: "Не вдалося отримати відповідь асистента." },
      { status: 502 }
    );
  }
}
