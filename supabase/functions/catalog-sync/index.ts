import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildMangaDexQuery,
  chooseIdentityToAttach,
  chunk,
  mergeCatalogRows,
  parseSyncPlan,
  splitCatalogWrites,
  toCatalogRow,
  type CatalogRow,
  type MangaDexManga,
} from "../_shared/mangadex-catalog.ts";

type MangaDexResponse = { data?: MangaDexManga[]; total?: number };

const MANGADEX_API = "https://api.mangadex.org/manga";
const PROXY_URL = "https://ilmsomiaqthhfyvgqnsp.supabase.co/functions/v1/mangadex-proxy";
const FUNCTION_NAME = "catalog-sync";
// MangaDex allows ~5 requests/second globally; stay well below it.
const PAGE_DELAY_MS = 400;
const WRITE_BATCH_SIZE = 200;
const USER_AGENT = "MangaWave/0.1 (contact: github.com/eulogep/manga-wave-bienvenue-fusion)";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function defaultSecretKey(): string | null {
  const legacyKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacyKey) return legacyKey;

  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}") as Record<string, string>;
    return keys.default || null;
  } catch {
    return null;
  }
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

function functionPath(url: URL): string | null {
  for (const marker of [`/functions/v1/${FUNCTION_NAME}`, `/${FUNCTION_NAME}`]) {
    const index = url.pathname.indexOf(marker);
    if (index !== -1) return url.pathname.slice(index + marker.length) || "/";
  }
  return url.pathname === "/" ? "/" : null;
}

export default {
  async fetch(request: Request) {
    if (request.method !== "POST") return response(405, { error: "POST uniquement" });

    const serviceRoleKey = defaultSecretKey();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!serviceRoleKey || !supabaseUrl) return response(503, { error: "Client administratif indisponible" });
    if (!hasServiceRole(request)) {
      return response(401, { error: "Accès interne requis" });
    }

    const path = functionPath(new URL(request.url));
    if (path !== "/") return response(404, { error: "Chemin invalide" });

    const plan = parseSyncPlan(await request.json().catch(() => ({})));

    try {
      const syncedAt = new Date().toISOString();
      const fetched: CatalogRow[] = [];
      const pagesRead: Record<string, number> = {};
      let requests = 0;
      for (const language of plan.languages) {
        pagesRead[language] = 0;
        for (let page = 0; page < plan.pages; page += 1) {
          if (requests++ > 0) await sleep(PAGE_DELAY_MS);
          const upstream = await fetch(`${MANGADEX_API}?${buildMangaDexQuery(language, page, plan.pageSize)}`, {
            headers: { Accept: "application/json", "User-Agent": USER_AGENT },
          });
          if (!upstream.ok) return response(502, { error: "MangaDex indisponible", status: upstream.status, language, page });
          const payload = (await upstream.json()) as MangaDexResponse;
          const rows = (payload.data || [])
            .map((manga) => toCatalogRow(manga, syncedAt, PROXY_URL))
            .filter((row): row is CatalogRow => row !== null);
          fetched.push(...rows);
          pagesRead[language] += 1;
          // Last page reached: no need to ask for empty offsets.
          if ((payload.data || []).length < plan.pageSize) break;
        }
      }

      const rows = mergeCatalogRows(fetched);
      if (!rows.length) return response(502, { error: "MangaDex n’a renvoyé aucun titre exploitable" });

      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const knownIds = new Set<string>();
      for (const ids of chunk(rows.map((row) => row.mangadex_id), WRITE_BATCH_SIZE)) {
        const { data: existing, error: readError } = await supabase.from("mangas").select("mangadex_id").in("mangadex_id", ids);
        if (readError) return response(500, { error: "Lecture du catalogue impossible" });
        for (const row of existing || []) knownIds.add(row.mangadex_id);
      }

      // Existing enrichment belongs to the reviewed metadata pipeline: known identities
      // only receive refreshable fields, never aliases/type/provenance.
      const { refresh, insert: candidates } = splitCatalogWrites(rows, knownIds);

      // A "new" MangaDex title may already exist from a scan source: attach the
      // MangaDex identity to that row instead of creating a duplicate work.
      const insert: CatalogRow[] = [];
      let attached = 0;
      for (const row of candidates) {
        const { data: matches, error: matchError } = await supabase.rpc("find_canonical_manga", { candidate_title: row.title });
        if (matchError) return response(500, { error: "Rapprochement canonique impossible", detail: matchError.message });
        const ids = (matches || []).map((match: { manga_id: number }) => match.manga_id);
        const { data: existing } = ids.length
          ? await supabase.from("mangas").select("id, mangadex_id, author").in("id", ids)
          : { data: [] };
        const details = new Map((existing || []).map((entry: { id: number; mangadex_id: string | null; author: string | null }) => [entry.id, entry]));
        const targetId = chooseIdentityToAttach(row, (matches || []).map((match: { manga_id: number; confidence: number }) => ({
          manga_id: match.manga_id,
          confidence: Number(match.confidence),
          mangadex_id: details.get(match.manga_id)?.mangadex_id ?? null,
          author: details.get(match.manga_id)?.author ?? null,
        })));
        if (targetId === null) {
          insert.push(row);
          continue;
        }
        const { manga_type: _type, ...fields } = row;
        const result = await supabase.from("mangas").update(fields).eq("id", targetId).is("mangadex_id", null);
        if (result.error) return response(500, { error: "Rattachement canonique impossible", detail: result.error.message });
        attached += 1;
      }
      for (const batch of chunk(refresh, WRITE_BATCH_SIZE)) {
        const result = await supabase.from("mangas").upsert(batch, { onConflict: "mangadex_id" });
        if (result.error) return response(500, { error: "Écriture du catalogue impossible", detail: result.error.message });
      }
      for (const batch of chunk(insert, WRITE_BATCH_SIZE)) {
        const result = await supabase.from("mangas").upsert(batch, { onConflict: "mangadex_id", ignoreDuplicates: true });
        if (result.error) return response(500, { error: "Écriture du catalogue impossible", detail: result.error.message });
      }

      return response(200, {
        synced: rows.length,
        inserted: insert.length,
        attached,
        refreshed: refresh.length,
        pages: pagesRead,
        synced_at: syncedAt,
      });
    } catch {
      return response(502, { error: "Synchronisation MangaDex impossible" });
    }
  },
};
