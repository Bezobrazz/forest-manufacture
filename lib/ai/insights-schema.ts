import { z } from "zod";

export const productionInsightSchema = z.object({
  insights: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        severity: z.enum(["info", "warning", "critical"]),
        finding: z.string().min(1).max(500),
        recommendation: z.string().min(1).max(500),
        relatedMetrics: z.array(z.string().max(80)).max(6).default([]),
      })
    )
    .min(1)
    .max(5),
});

export type ProductionInsightsResult = z.infer<typeof productionInsightSchema>;
export type ProductionInsight = ProductionInsightsResult["insights"][number];
