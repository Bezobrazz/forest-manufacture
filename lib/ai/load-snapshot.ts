import { getStatisticsPageData } from "@/app/statistics/actions";
import {
  analyticsSnapshotInputSchema,
  buildAnalyticsSnapshot,
  enforceSnapshotSize,
  type AnalyticsSnapshot,
  type AnalyticsSnapshotInput,
} from "@/lib/ai/analytics-snapshot";

export async function loadAnalyticsSnapshot(
  rawInput: unknown
): Promise<
  | { ok: true; snapshot: AnalyticsSnapshot; input: AnalyticsSnapshotInput }
  | { ok: false; error: string }
> {
  const parsed = analyticsSnapshotInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid snapshot input",
    };
  }

  if (parsed.data.periodStart > parsed.data.periodEnd) {
    return { ok: false, error: "periodStart must be <= periodEnd" };
  }

  const data = await getStatisticsPageData();
  const snapshot = enforceSnapshotSize(
    buildAnalyticsSnapshot(data, parsed.data)
  );

  return { ok: true, snapshot, input: parsed.data };
}
