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

const jobs = new Map<string, KeepinSyncJobStatus>();

function createJobId() {
  return `keepin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getKeepinSyncJob(id: string): KeepinSyncJobStatus | null {
  return jobs.get(id) ?? null;
}

export function startKeepinSyncJob(): KeepinSyncJobStatus {
  const id = createJobId();
  const job: KeepinSyncJobStatus = {
    id,
    status: "pending",
    total: 0,
    processed: 0,
    upserted: 0,
    removed: 0,
    startedAt: Date.now(),
  };
  jobs.set(id, job);

  void (async () => {
    job.status = "running";
    try {
      const supabase = createServiceRoleClient();
      const result = await syncKeepinOrdersWithSupabase(supabase, (p) => {
        job.total = p.total;
        job.processed = p.processed;
      });
      job.upserted = result.upserted;
      job.removed = result.removed;
      if (job.total === 0) {
        job.total = result.upserted + result.removed;
      }
      job.processed = Math.max(job.processed, job.total);
      job.status = "done";
      job.finishedAt = Date.now();
    } catch (e: unknown) {
      job.status = "error";
      job.error = e instanceof Error ? e.message : "Sync failed";
      job.finishedAt = Date.now();
    }
  })();

  return job;
}
