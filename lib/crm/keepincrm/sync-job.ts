import type { SupabaseClient } from "@supabase/supabase-js";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { syncKeepinOrdersWithSupabase } from "@/lib/crm/keepincrm/reconcile";

export type KeepinSyncJobStatus = {
  id: string;
  status: "pending" | "running" | "done" | "error";
  total: number;
  processed: number;
  upserted: number;
  removed: number;
  error?: string;
  startedAt: number;
  finishedAt?: number;
};

type KeepinSyncJobRow = {
  id: string;
  status: KeepinSyncJobStatus["status"];
  total: number;
  processed: number;
  upserted: number;
  removed: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
};

function createJobId() {
  return `keepin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function rowToStatus(row: KeepinSyncJobRow): KeepinSyncJobStatus {
  return {
    id: row.id,
    status: row.status,
    total: row.total,
    processed: row.processed,
    upserted: row.upserted,
    removed: row.removed,
    error: row.error ?? undefined,
    startedAt: new Date(row.started_at).getTime(),
    finishedAt: row.finished_at ? new Date(row.finished_at).getTime() : undefined,
  };
}

async function patchKeepinSyncJob(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<{
    status: KeepinSyncJobStatus["status"];
    total: number;
    processed: number;
    upserted: number;
    removed: number;
    error: string | null;
    finished_at: string | null;
  }>
) {
  const { error } = await supabase.from("keepin_sync_jobs").update(patch).eq("id", id);
  if (error) {
    console.error("patchKeepinSyncJob", id, error.message);
  }
}

export async function getKeepinSyncJob(id: string): Promise<KeepinSyncJobStatus | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("keepin_sync_jobs")
    .select(
      "id, status, total, processed, upserted, removed, error, started_at, finished_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getKeepinSyncJob", id, error.message);
    return null;
  }
  if (!data) return null;
  return rowToStatus(data as KeepinSyncJobRow);
}

export async function startKeepinSyncJob(): Promise<KeepinSyncJobStatus> {
  const id = createJobId();
  const supabase = createServiceRoleClient();
  const started_at = new Date().toISOString();

  const { error: insertError } = await supabase.from("keepin_sync_jobs").insert({
    id,
    status: "pending",
    total: 0,
    processed: 0,
    upserted: 0,
    removed: 0,
    started_at,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  void (async () => {
    await patchKeepinSyncJob(supabase, id, { status: "running" });
    try {
      const result = await syncKeepinOrdersWithSupabase(supabase, (p) => {
        void patchKeepinSyncJob(supabase, id, {
          total: p.total,
          processed: p.processed,
        });
      });

      const total =
        (await getKeepinSyncJob(id))?.total ?? 0;
      const finalTotal = total > 0 ? total : result.upserted + result.removed;

      await patchKeepinSyncJob(supabase, id, {
        status: "done",
        total: finalTotal,
        processed: finalTotal,
        upserted: result.upserted,
        removed: result.removed,
        error: null,
        finished_at: new Date().toISOString(),
      });
    } catch (e: unknown) {
      await patchKeepinSyncJob(supabase, id, {
        status: "error",
        error: e instanceof Error ? e.message : "Sync failed",
        finished_at: new Date().toISOString(),
      });
    }
  })();

  const job = await getKeepinSyncJob(id);
  if (!job) {
    throw new Error("Failed to create sync job");
  }
  return job;
}
