import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const statuses = new Set(["ongoing", "completed", "hiatus", "cancelled"]);

type ReadingEvent = {
  manga: {
    id: string;
    title: string;
    author?: string;
    artist?: string | null;
    description?: string;
    coverImageUrl?: string | null;
    status?: string;
    genres?: string[];
    contentRating?: string;
    updatedAt?: string;
  };
  chapter: {
    id: string;
    volume?: string | null;
    chapter?: string | null;
    title?: string | null;
    translatedLanguage?: string;
    pageCount?: number;
    readableAt?: string;
  };
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function serviceKey(): string | null {
  const legacyKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacyKey) return legacyKey;

  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}") as Record<string, string>;
    return keys.default || null;
  } catch {
    return null;
  }
}

function validId(value: unknown) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (request.method !== "POST") return json(405, { error: "POST uniquement" });

    const authorization = request.headers.get("Authorization") || "";
    const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : null;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const adminKey = serviceKey();
    if (!accessToken) return json(401, { error: "Connexion requise" });
    if (!supabaseUrl || !adminKey) return json(503, { error: "Service de progression indisponible" });

    let event: ReadingEvent;
    try {
      event = await request.json() as ReadingEvent;
    } catch {
      return json(400, { error: "Corps de requête invalide" });
    }

    if (!validId(event?.manga?.id) || !validId(event?.chapter?.id) || !event.manga.title?.trim()) {
      return json(400, { error: "Métadonnées MangaDex incomplètes" });
    }

    const supabase = createClient(supabaseUrl, adminKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: auth, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !auth.user) return json(401, { error: "Session invalide" });

    const now = new Date().toISOString();
    const mangaStatus = statuses.has(event.manga.status || "") ? event.manga.status! : "ongoing";
    const chapterNumber = Number.parseFloat(event.chapter.chapter || "0");

    const { data: manga, error: mangaError } = await supabase
      .from("mangas")
      .upsert({
        mangadex_id: event.manga.id,
        title: event.manga.title.trim(),
        author: event.manga.author?.trim() || "Auteur inconnu",
        artist: event.manga.artist?.trim() || null,
        description: event.manga.description?.trim() || null,
        cover_image: event.manga.coverImageUrl || null,
        status: mangaStatus,
        genre: event.manga.genres || [],
        manga_type: "manga",
        content_rating: event.manga.contentRating || null,
        source_updated_at: event.manga.updatedAt || null,
        last_synced_at: now,
      }, { onConflict: "mangadex_id" })
      .select("id")
      .single();

    if (mangaError || !manga) return json(500, { error: "Manga local indisponible" });

    const { data: chapter, error: chapterError } = await supabase
      .from("chapters")
      .upsert({
        mangadex_id: event.chapter.id,
        manga_id: manga.id,
        chapter_number: Number.isFinite(chapterNumber) ? chapterNumber : 0,
        volume: event.chapter.volume || null,
        title: event.chapter.title || null,
        translated_language: event.chapter.translatedLanguage || "fr",
        pages_count: Math.max(0, Math.floor(event.chapter.pageCount || 0)) || null,
        release_date: event.chapter.readableAt || null,
      }, { onConflict: "mangadex_id" })
      .select("id, pages_count")
      .single();

    if (chapterError || !chapter) return json(500, { error: "Chapitre local indisponible" });

    const { error: historyError } = await supabase
      .from("user_history")
      .upsert({ user_id: auth.user.id, chapter_id: chapter.id, read_at: now }, { onConflict: "user_id,chapter_id" });
    if (historyError) return json(500, { error: "Historique indisponible" });

    const { error: progressError } = await supabase
      .from("user_progress")
      .upsert({
        user_id: auth.user.id,
        chapter_id: chapter.id,
        page_number: 1,
        total_pages: chapter.pages_count,
        updated_at: now,
      }, { onConflict: "user_id,chapter_id", ignoreDuplicates: true });
    if (progressError) return json(500, { error: "Progression indisponible" });

    return json(200, {
      manga_id: manga.id,
      chapter_id: chapter.id,
      recorded_at: now,
    });
  },
};
