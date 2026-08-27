export type MangaDexStatus = 'ongoing' | 'completed' | 'hiatus' | 'cancelled';

type LocalizedText = Record<string, string>;

type MangaDexRelationship = {
  id: string;
  type: 'author' | 'artist' | 'cover_art' | string;
  attributes?: {
    name?: string;
    fileName?: string;
  };
};

type MangaDexTag = {
  id: string;
  attributes: {
    name: LocalizedText;
    group: 'content' | 'format' | 'genre' | 'theme' | string;
  };
};

type MangaDexMangaAttributes = {
  title: LocalizedText;
  altTitles: LocalizedText[];
  description: LocalizedText;
  status: MangaDexStatus;
  year: number | null;
  contentRating: string;
  lastVolume: string | null;
  lastChapter: string | null;
  latestUploadedChapter: string | null;
  updatedAt: string;
  tags: MangaDexTag[];
};

type MangaDexMangaResource = {
  id: string;
  type: 'manga';
  attributes: MangaDexMangaAttributes;
  relationships: MangaDexRelationship[];
};

type MangaDexCollectionResponse = {
  result: 'ok';
  response: 'collection';
  data: MangaDexMangaResource[];
  limit: number;
  offset: number;
  total: number;
};

type MangaDexEntityResponse = {
  result: 'ok';
  response: 'entity';
  data: MangaDexMangaResource;
};

export type MangaDexManga = {
  id: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  author: string;
  artist: string | null;
  status: MangaDexStatus;
  genres: string[];
  themes: string[];
  year: number | null;
  contentRating: string;
  lastChapter: string | null;
  updatedAt: string;
  externalUrl: string;
};

export type MangaDexOrder =
  | 'followedCount'
  | 'latestUploadedChapter'
  | 'createdAt'
  | 'updatedAt'
  | 'relevance';

export type MangaDexSearchOptions = {
  title?: string;
  limit?: number;
  offset?: number;
  order?: MangaDexOrder;
  status?: MangaDexStatus;
  translatedLanguage?: string;
};

const SUPABASE_MANGADEX_PROXY_URL =
  'https://yuebnijezlpyolmwfylx.supabase.co/functions/v1/mangadex-proxy';
const API_PROXY_URL = normaliseBaseUrl(
  import.meta.env.VITE_MANGADEX_API_PROXY_URL ||
    (import.meta.env.DEV ? '/api/mangadex' : SUPABASE_MANGADEX_PROXY_URL),
);
const COVER_PROXY_URL = normaliseBaseUrl(
  import.meta.env.VITE_MANGADEX_COVER_PROXY_URL ||
    (import.meta.env.DEV ? '/mangadex-covers' : SUPABASE_MANGADEX_PROXY_URL),
);
const REQUEST_TIMEOUT_MS = 12_000;

export class MangaDexApiError extends Error {
  public readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'MangaDexApiError';
    this.status = status;
  }
}

function normaliseBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

function pickLocalizedText(value?: LocalizedText): string {
  if (!value) return '';

  return (
    value.fr ||
    value.en ||
    value['ja-ro'] ||
    value.ja ||
    Object.values(value).find((text) => Boolean(text?.trim())) ||
    ''
  );
}

function extractRelationshipName(
  relationships: MangaDexRelationship[],
  relationshipType: 'author' | 'artist',
): string | null {
  return (
    relationships.find((relationship) => relationship.type === relationshipType)
      ?.attributes?.name || null
  );
}

function createCoverUrl(mangaId: string, fileName: string): string {
  return `${COVER_PROXY_URL}/cover/${encodeURIComponent(mangaId)}/${encodeURIComponent(fileName)}.256.jpg`;
}

function mapManga(resource: MangaDexMangaResource): MangaDexManga {
  const coverFileName = resource.relationships.find(
    (relationship) => relationship.type === 'cover_art',
  )?.attributes?.fileName;
  const attributes = resource.attributes;

  return {
    id: resource.id,
    title: pickLocalizedText(attributes.title),
    description: pickLocalizedText(attributes.description),
    coverImageUrl: coverFileName ? createCoverUrl(resource.id, coverFileName) : null,
    author: extractRelationshipName(resource.relationships, 'author') || 'Auteur inconnu',
    artist: extractRelationshipName(resource.relationships, 'artist'),
    status: attributes.status,
    genres: attributes.tags
      .filter((tag) => tag.attributes.group === 'genre')
      .map((tag) => pickLocalizedText(tag.attributes.name))
      .filter(Boolean),
    themes: attributes.tags
      .filter((tag) => tag.attributes.group === 'theme')
      .map((tag) => pickLocalizedText(tag.attributes.name))
      .filter(Boolean),
    year: attributes.year,
    contentRating: attributes.contentRating,
    lastChapter: attributes.lastChapter || attributes.latestUploadedChapter,
    updatedAt: attributes.updatedAt,
    externalUrl: `https://mangadex.org/title/${resource.id}`,
  };
}

async function request<T>(path: string, parameters?: URLSearchParams): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const query = parameters?.toString();
  const url = `${API_PROXY_URL}${path}${query ? `?${query}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      const retryHint = response.status === 429 ? ' Réessayez dans quelques instants.' : '';
      throw new MangaDexApiError(
        `MangaDex a renvoyé une erreur ${response.status}.${retryHint}`,
        response.status,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof MangaDexApiError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new MangaDexApiError('La requête MangaDex a expiré.');
    }

    throw new MangaDexApiError('Impossible de joindre le catalogue MangaDex.');
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function buildMangaQuery(options: MangaDexSearchOptions): URLSearchParams {
  const parameters = new URLSearchParams();
  const limit = Math.min(Math.max(options.limit || 24, 1), 100);

  parameters.set('limit', String(limit));
  parameters.set('offset', String(Math.max(options.offset || 0, 0)));
  parameters.append('includes[]', 'cover_art');
  parameters.append('includes[]', 'author');
  parameters.append('includes[]', 'artist');
  parameters.append('contentRating[]', 'safe');
  parameters.append('contentRating[]', 'suggestive');
  parameters.append('contentRating[]', 'erotica');

  if (options.title?.trim()) parameters.set('title', options.title.trim());
  if (options.status) parameters.append('status[]', options.status);
  if (options.translatedLanguage) {
    parameters.append('availableTranslatedLanguage[]', options.translatedLanguage);
  }
  if (options.order) parameters.set(`order[${options.order}]`, 'desc');

  return parameters;
}

export async function searchManga(
  options: MangaDexSearchOptions = {},
): Promise<{ mangas: MangaDexManga[]; total: number }> {
  const response = await request<MangaDexCollectionResponse>('/manga', buildMangaQuery(options));

  return {
    mangas: response.data.map(mapManga),
    total: response.total,
  };
}

export async function getPopularManga(limit = 24): Promise<MangaDexManga[]> {
  const response = await searchManga({
    limit,
    order: 'followedCount',
    translatedLanguage: 'fr',
  });

  return response.mangas;
}

export async function getMangaById(id: string): Promise<MangaDexManga> {
  const parameters = new URLSearchParams();
  parameters.append('includes[]', 'cover_art');
  parameters.append('includes[]', 'author');
  parameters.append('includes[]', 'artist');

  const response = await request<MangaDexEntityResponse>(
    `/manga/${encodeURIComponent(id)}`,
    parameters,
  );

  return mapManga(response.data);
}


type MangaDexChapterAttributes = {
  volume: string | null;
  chapter: string | null;
  title: string | null;
  translatedLanguage: string;
  externalUrl: string | null;
  isUnavailable: boolean;
  publishAt: string;
  readableAt: string;
  updatedAt: string;
  pages: number;
};

type MangaDexChapterResource = {
  id: string;
  type: 'chapter';
  attributes: MangaDexChapterAttributes;
  relationships: MangaDexRelationship[];
};

type MangaDexChapterCollectionResponse = {
  result: 'ok';
  response: 'collection';
  data: MangaDexChapterResource[];
  limit: number;
  offset: number;
  total: number;
};

export type MangaDexChapter = {
  id: string;
  volume: string | null;
  chapter: string | null;
  title: string | null;
  translatedLanguage: string;
  scanlationGroups: string[];
  pageCount: number;
  readableAt: string;
  isUnavailable: boolean;
  externalUrl: string | null;
  mangaDexUrl: string;
};

export type MangaDexChapterOptions = {
  limit?: number;
  offset?: number;
  translatedLanguage?: string;
};

function mapChapter(resource: MangaDexChapterResource): MangaDexChapter {
  const scanlationGroups = resource.relationships
    .filter((relationship) => relationship.type === 'scanlation_group')
    .map((relationship) => relationship.attributes?.name)
    .filter((name): name is string => Boolean(name));

  return {
    id: resource.id,
    volume: resource.attributes.volume,
    chapter: resource.attributes.chapter,
    title: resource.attributes.title,
    translatedLanguage: resource.attributes.translatedLanguage,
    scanlationGroups,
    pageCount: resource.attributes.pages,
    readableAt: resource.attributes.readableAt,
    isUnavailable: resource.attributes.isUnavailable,
    externalUrl: resource.attributes.externalUrl,
    mangaDexUrl: `https://mangadex.org/chapter/${resource.id}`,
  };
}

export async function getMangaChapters(
  mangaId: string,
  options: MangaDexChapterOptions = {},
): Promise<{ chapters: MangaDexChapter[]; total: number }> {
  const parameters = new URLSearchParams();
  const limit = Math.min(Math.max(options.limit || 100, 1), 500);

  parameters.set('limit', String(limit));
  parameters.set('offset', String(Math.max(options.offset || 0, 0)));
  parameters.set('includeEmptyPages', '0');
  parameters.set('includeFuturePublishAt', '0');
  parameters.set('includeExternalUrl', '0');
  parameters.set('order[readableAt]', 'desc');
  parameters.append('includes[]', 'scanlation_group');
  if (options.translatedLanguage) {
    parameters.append('translatedLanguage[]', options.translatedLanguage);
  }

  const response = await request<MangaDexChapterCollectionResponse>(
    `/manga/${encodeURIComponent(mangaId)}/feed`,
    parameters,
  );

  return {
    chapters: response.data.map(mapChapter),
    total: response.total,
  };
}
