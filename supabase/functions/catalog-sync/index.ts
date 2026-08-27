import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    if (request.headers.get("apikey") !== serviceRoleKey) {
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
          const formats = tagsForGroup(manga.attributes.tags, "format");
          return {
            mangadex_id: manga.id,
            title,
            author: relationshipName(relationships, "author") || "Auteur inconnu",
            artist: relationshipName(relationships, "artist"),
            description: text(manga.attributes.description) || null,
            cover_image: coverUrl(manga.id, relationships),
            status: manga.attributes.status || "ongoing",
            genre: tagsForGroup(manga.attributes.tags, "genre"),
            manga_type: formats[0] || "manga",
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
      const { error } = await supabase.from("mangas").upsert(rows, { onConflict: "mangadex_id" });
      if (error) return response(500, { error: "Écriture du catalogue impossible", detail: error.message });

      return response(200, { synced: rows.length, synced_at: syncedAt });
    } catch {
      return response(502, { error: "Synchronisation MangaDex impossible" });
    }
  },
};
