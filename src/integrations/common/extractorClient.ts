export type ExtractedSearchResult = {
  id: string;
  title: string;
  coverUrl: string | null;
  status: string;
  rating: number | null;
  genres: string[];
  author: string | null;
  url: string;
};

export type ExtractedChapter = {
  id: string;
  chapterNumber: string;
  title: string | null;
  date: string;
  language: string;
  url: string;
};

export type ExtractedManga = {
  id: string;
  title: string;
  coverUrl: string | null;
  author: string | null;
  status: string;
  genres: string[];
  synopsis: string | null;
  chapters: ExtractedChapter[];
};

export async function extractorFetch<T>(path: string): Promise<T> {
  const response = await fetch(`/api/extract${path}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(65_000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || `Extracteur indisponible (${response.status}).`);
  }
  return response.json() as Promise<T>;
}
