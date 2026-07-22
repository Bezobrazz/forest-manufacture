import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { productionInsightSchema } from "@/lib/ai/insights-schema";
import { loadAnalyticsSnapshot } from "@/lib/ai/load-snapshot";
import { insightsModel } from "@/lib/ai/models";
import {
  formatSnapshotForPrompt,
  INSIGHTS_USER_PROMPT,
  PRODUCTION_ANALYST_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";
import { requireAiAccess } from "@/lib/ai/require-ai-access";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const access = await requireAiAccess();
  if (!access.ok) return access.response;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 503 }
    );
  }

  const rate = checkAiRateLimit(access.user.id, "insights");
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

  const loaded = await loadAnalyticsSnapshot(body);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: 400 });
  }

  try {
    const { object } = await generateObject({
      model: insightsModel,
      schema: productionInsightSchema,
      system: PRODUCTION_ANALYST_SYSTEM_PROMPT,
      prompt: `${INSIGHTS_USER_PROMPT}\n\nSnapshot:\n${formatSnapshotForPrompt(loaded.snapshot)}`,
      temperature: 0.3,
    });

    return NextResponse.json({
      insights: object.insights,
      period: loaded.snapshot.period,
    });
  } catch (error) {
    console.error("POST /api/ai/insights:", error);
    return NextResponse.json(
      { error: "Не вдалося згенерувати інсайти. Спробуйте ще раз." },
      { status: 502 }
    );
  }
}
