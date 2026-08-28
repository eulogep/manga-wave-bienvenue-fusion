import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_URL = "https://manga-wave-bienvenue-fusion.vercel.app";
const SOURCE_IDS = new Set(["mangadex", "comick", "originmanga", "crunchyscan", "mangafire", "asurascans"]);

type QueueMessage = {
  msg_id: number;
  read_ct: number;
  message: { type?: string; source?: string };
};

type SourceHealth = {
  sourceId: string;
  circuit: "closed" | "open" | "half-open";
  score: number;
  requestCount: number;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  averageLatencyMs: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  retryAt: string | null;
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const value = error as { message?: string; details?: string; hint?: string; code?: string };
    return [value.message, value.details, value.hint, value.code].filter(Boolean).join(" | ") || JSON.stringify(error);
  }
  return String(error);
}

function hasServiceRole(request: Request): boolean {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const encodedPayload = token?.split(".")[1];
  if (!encodedPayload) return false;
  try {
    const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

async function refreshSourceHealth(supabase: ReturnType<typeof createClient>): Promise<void> {
  try {
    const response = await fetch(`${APP_URL}/api/extract/health`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return;
    const payload = await response.json() as { sources?: SourceHealth[] };
    const rows = (payload.sources || []).map((item) => ({
      source_id: item.sourceId,
      circuit_state: item.circuit,
      score: item.score,
      average_latency_ms: item.averageLatencyMs,
      request_count: item.requestCount,
      success_count: item.successCount,
      failure_count: item.failureCount,
      consecutive_failures: item.consecutiveFailures,
      last_success_at: item.lastSuccessAt,
      last_failure_at: item.lastFailureAt,
      last_error: item.lastError,
      retry_at: item.retryAt,
      updated_at: new Date().toISOString(),
    }));
    if (rows.length > 0) await supabase.from("source_health").upsert(rows, { onConflict: "source_id" });
  } catch {
    // Health persistence must never prevent the queue from progressing.
  }
}

async function processMessage(
  supabase: ReturnType<typeof createClient>,
  queued: QueueMessage,
): Promise<{ source: string; status: string; items: number; error?: string }> {
  const source = queued.message?.source || "";
  const jobType = queued.message?.type || "SYNC_SOURCE";
  if (!SOURCE_IDS.has(source)) {
    await supabase.rpc("complete_source_sync", { message_id: queued.msg_id, archive_message: true });
    return { source, status: "archived", items: 0, error: "Source inconnue" };
  }

  const { data: run, error: runError } = await supabase
    .from("source_sync_runs")
    .insert({
      queue_message_id: queued.msg_id,
      source_id: source,
      job_type: jobType,
      attempt: queued.read_ct,
    })
    .select("id")
    .single();
  if (runError) throw runError;

  try {
    const response = await fetch(`${APP_URL}/api/extract/popular/${encodeURIComponent(source)}?page=1`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(65_000),
    });
    const payload = await response.json().catch(() => null) as { results?: unknown[]; error?: string } | null;
    if (!response.ok) throw new Error(payload?.error || `Extracteur ${source}: HTTP ${response.status}`);
    const results = payload?.results || [];
    if (results.length === 0) throw new Error(`${source} n'a retourné aucun manga populaire.`);

    const { data: synced, error: syncError } = await supabase.rpc("upsert_source_catalog", {
      requested_source_id: source,
      items: results,
    });
    if (syncError) throw syncError;

    await supabase.from("source_sync_runs").update({
      status: "succeeded",
      items_synced: Number(synced || 0),
      finished_at: new Date().toISOString(),
    }).eq("id", run.id);
    await supabase.rpc("complete_source_sync", { message_id: queued.msg_id, archive_message: false });
    await supabase.rpc("enqueue_source_sync", {
      job: { type: "SYNC_SOURCE", source },
      delay_seconds: 15 * 60,
    });
    await refreshSourceHealth(supabase);
    return { source, status: "succeeded", items: Number(synced || 0) };
  } catch (error: unknown) {
    const message = errorMessage(error);
    await supabase.from("source_sync_runs").update({
      status: "failed",
      error_message: message,
      finished_at: new Date().toISOString(),
    }).eq("id", run.id);

    if (queued.read_ct >= 3) {
      await supabase.rpc("complete_source_sync", { message_id: queued.msg_id, archive_message: true });
      await supabase.rpc("enqueue_source_sync", {
        job: { type: "SYNC_SOURCE", source },
        delay_seconds: 30 * 60,
      });
    }
    await refreshSourceHealth(supabase);
    return { source, status: "failed", items: 0, error: message };
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return jsonResponse(405, { error: "Méthode non autorisée" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse(500, { error: "Configuration Supabase absente" });
  if (!hasServiceRole(request)) {
    return jsonResponse(401, { error: "Authentification serveur requise" });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = await request.json().catch(() => ({})) as { batchSize?: number };
  const batchSize = Math.min(Math.max(Number(body.batchSize) || 2, 1), 3);
  const { data, error } = await supabase.rpc("dequeue_source_sync", {
    batch_size: batchSize,
    visibility_seconds: 150,
  });
  if (error) return jsonResponse(500, { error: error.message });

  const messages = (data || []) as QueueMessage[];
  const results = await Promise.all(messages.map((message) => processMessage(supabase, message)));
  return jsonResponse(200, { processed: results.length, results });
});
