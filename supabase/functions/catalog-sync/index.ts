import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  canonicalTypeFromCountry,
  countryFromMangaDexLanguage,
} from "../_shared/canonical-metadata.ts";

type LocalizedText = Record<string, string>;

type MangaDexRelationship = {
  id: string;
  type: string;
  attributes?: { name?: string; fileName?: string };
};

type MangaDexTag = {
  attributes?: { group?: string; name?: LocalizedText };
};

type MangaDexManga = {
  id: string;
  attributes: {
    title: LocalizedText;
    description: LocalizedText;
    originalLanguage?: string;
    status: "ongoing" | "completed" | "hiatus" | "cancelled";
    contentRating?: string;
    updatedAt?: string;
    tags?: MangaDexTag[];
  };
  relationships?: MangaDexRelationship[];
};

type MangaDexResponse = { data?: MangaDexManga[] };

type CatalogRow = {
  mangadex_id: string;
  title: string;
  author: string;
  artist: string | null;
  description: string | null;
  cover_image: string | null;
  status: "ongoing" | "completed" | "hiatus" | "cancelled";
  genre: string[];
  manga_type: string | null;
  content_rating: string | null;
  source_updated_at: string | null;
  last_synced_at: string;
};

const MANGADEX_API = "https://api.mangadex.org/manga";
const PROXY_URL = "https://ilmsomiaqthhfyvgqnsp.supabase.co/functions/v1/mangadex-proxy";
const FUNCTION_NAME = "catalog-sync";

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function text(value?: LocalizedText): string {
  if (!value) return "";
  for (const locale of ["fr", "en", "ja-ro", "ja"]) {
    const candidate = value[locale];
    if (candidate?.trim()) return candidate.trim();
  }
  return Object.values(value).find((candidate) => candidate?.trim())?.trim() || "";
}

function relationshipName(relationships: MangaDexRelationship[], type: string): string | null {
  return relationships.find((relationship) => relationship.type === type)?.attributes?.name?.trim() || null;
}

function coverUrl(mangaId: string, relationships: MangaDexRelationship[]): string | null {
  const fileName = relationships.find((relationship) => relationship.type === "cover_art")?.attributes?.fileName;
  return fileName ? `${PROXY_URL}/cover/${encodeURIComponent(mangaId)}/${encodeURIComponent(fileName)}.256.jpg` : null;
}

function tagsForGroup(tags: MangaDexTag[] | undefined, group: string): string[] {
  return (tags || [])
    .filter((tag) => tag.attributes?.group === group)
    .map((tag) => text(tag.attributes?.name))
    .filter(Boolean);
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
  const marker = `/functions/v1/${FUNCTION_NAME}`;
  const index = url.pathname.indexOf(marker);
  return index === -1 ? null : url.pathname.slice(index + marker.length) || "/";
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

    const query = new URLSearchParams({
      limit: "100",
      "order[followedCount]": "desc",
    });
    for (const value of ["fr"]) query.append("availableTranslatedLanguage[]", value);
    for (const value of ["cover_art", "author", "artist"]) query.append("includes[]", value);
    for (const value of ["safe", "suggestive"]) query.append("contentRating[]", value);

    try {
      const upstream = await fetch(`${MANGADEX_API}?${query}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "MangaWave/0.1 (contact: github.com/eulogep/manga-wave-bienvenue-fusion)",
        },
      });
      if (!upstream.ok) return response(502, { error: "MangaDex indisponible", status: upstream.status });

      const payload = (await upstream.json()) as MangaDexResponse;
      const syncedAt = new Date().toISOString();
      const rows: CatalogRow[] = (payload.data || [])
        .map((manga) => {
          const relationships = manga.relationships || [];
          const title = text(manga.attributes.title);
          if (!manga.id || !title) return null;
          const country = countryFromMangaDexLanguage(manga.attributes.originalLanguage);
          return {
            mangadex_id: manga.id,
            title,
            author: relationshipName(relationships, "author") || "Auteur inconnu",
            artist: relationshipName(relationships, "artist"),
            description: text(manga.attributes.description) || null,
            cover_image: coverUrl(manga.id, relationships),
            status: manga.attributes.status || "ongoing",
            genre: tagsForGroup(manga.attributes.tags, "genre"),
            manga_type: canonicalTypeFromCountry(country),
            content_rating: manga.attributes.contentRating || null,
            source_updated_at: manga.attributes.updatedAt || null,
            last_synced_at: syncedAt,
          };
        })
        .filter((row): row is CatalogRow => row !== null);

      if (!rows.length) return response(502, { error: "MangaDex n’a renvoyé aucun titre exploitable" });

      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      // Existing enrichment belongs to the reviewed metadata pipeline. Sync never
      // overwrites aliases/type/provenance for existing canonical identities.
      const { data: existing, error: readError } = await supabase.from("mangas")
        .select("mangadex_id").in("mangadex_id", rows.map((row) => row.mangadex_id));
      if (readError) return response(500, { error: "Lecture du catalogue impossible" });
      const knownIds = new Set((existing || []).map((row) => row.mangadex_id));
      for (const row of rows) {
        const { manga_type, ...refresh } = row;
        const result = knownIds.has(row.mangadex_id)
          ? await supabase.from("mangas").update(refresh).eq("mangadex_id", row.mangadex_id)
          : await supabase.from("mangas").upsert({ ...refresh, manga_type }, { onConflict: "mangadex_id", ignoreDuplicates: true });
        if (result.error) return response(500, { error: "Écriture du catalogue impossible", detail: result.error.message });
      }

      return response(200, { synced: rows.length, synced_at: syncedAt });
    } catch {
      return response(502, { error: "Synchronisation MangaDex impossible" });
    }
  },
};
