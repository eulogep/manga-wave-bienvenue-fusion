import { resilientScrape } from '@/integrations/common/scraperClient';

const COMICK_HOSTS = ['https://api.comick.fun', 'https://api.comick.app'];
const COMICK_IMG_BASE = 'https://meo.comick.pictures';

export type ComickSearchResult = {
  id: string; // hid
  slug: string;
  title: string;
  coverUrl: string | null;
  status: string;
  rating: number | null;
  lastChapter: string | null;
  genres: string[];
  url: string;
};

export type ComickChapter = {
  id: string; // hid
  chapterNumber: string;
  volume: string | null;
  title: string | null;
  date: string;
  groupName: string | null;
  lang: string;
  url: string;
};

export type ComickDetail = {
  id: string; // hid
  slug: string;
  title: string;
  coverUrl: string | null;
  altTitles: string[];
  author: string | null;
  artist: string | null;
  status: string;
  genres: string[];
  synopsis: string | null;
  year: number | null;
  rating: number | null;
  chapters: ComickChapter[];
};


async function comickFetch<T>(endpoint: string): Promise<T> {
  let lastErr: Error | null = null;
  for (const host of COMICK_HOSTS) {
    const url = `${host}${endpoint}`;
    try {
      // Try direct first (no CORS on comick APIs usually)
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        return (await res.json()) as T;
      }
    } catch {
      // Direct call failed, try resilientScrape with proxy fallback
    }

    try {
      return await resilientScrape<T>(url, { asJson: true });
    } catch (err: unknown) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw new Error(`Comick API unavailable: ${lastErr?.message}`);
}

export async function searchComick(query: string, page = 1, limit = 20): Promise<ComickSearchResult[]> {
  try {
    const data = await comickFetch<Array<{
      hid: string;
      slug: string;
      title: string;
      rating?: string;
      bayesian_rating?: string;
      md_covers?: Array<{ b2key?: string }>;
      last_chapter?: number | string;
      desc?: string;
      md_comic_md_genres?: Array<{ md_genres?: { name?: string } }>;
    }>>(`/v1.0/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}&type=comic`);

    if (!Array.isArray(data)) return [];

    return data.map((item) => {
      const coverKey = item.md_covers?.[0]?.b2key;
      const coverUrl = coverKey ? `${COMICK_IMG_BASE}/${coverKey}` : null;
      const genres = (item.md_comic_md_genres || [])
        .map((g) => g.md_genres?.name)
        .filter((n): n is string => Boolean(n));
      const score = item.bayesian_rating ? parseFloat(item.bayesian_rating) : item.rating ? parseFloat(item.rating) : null;

      return {
        id: item.slug || item.hid,
        slug: item.slug,
        title: item.title || 'Manga sans titre',
        coverUrl,
        status: 'ongoing',
        rating: score ? score / 2 : 4.5, // 0-10 normalized to 0-5
        lastChapter: item.last_chapter ? String(item.last_chapter) : null,
        genres,
        url: `https://comick.io/comic/${item.slug}`,
      };
    });
  } catch (err) {
    console.error('Error searching Comick:', err);
    return [];
  }
}

export async function getPopularComick(): Promise<ComickSearchResult[]> {
  try {
    const data = await comickFetch<Array<{
      hid: string;
      slug: string;
      title: string;
      rating?: string;
      bayesian_rating?: string;
      md_covers?: Array<{ b2key?: string }>;
      last_chapter?: number | string;
      md_comic_md_genres?: Array<{ md_genres?: { name?: string } }>;
    }>>(`/top?type=comic&limit=18`);

    if (Array.isArray(data) && data.length > 0) {
      return data.map((item) => {
        const coverKey = item.md_covers?.[0]?.b2key;
        const coverUrl = coverKey ? `${COMICK_IMG_BASE}/${coverKey}` : null;
        const genres = (item.md_comic_md_genres || [])
          .map((g) => g.md_genres?.name)
          .filter((n): n is string => Boolean(n));
        const score = item.bayesian_rating ? parseFloat(item.bayesian_rating) : item.rating ? parseFloat(item.rating) : null;

        return {
          id: item.slug || item.hid,
          slug: item.slug,
          title: item.title || 'Manga sans titre',
          coverUrl,
          status: 'ongoing',
          rating: score ? score / 2 : 4.9,
          lastChapter: item.last_chapter ? String(item.last_chapter) : null,
          genres,
          url: `https://comick.io/comic/${item.slug}`,
        };
      });
    }
  } catch {
    // Fallback to top query
  }

  return searchComick('a', 1, 18);
}


export async function getComickDetail(slugOrHid: string): Promise<ComickDetail> {
  const data = await comickFetch<{
    comic: {
      hid: string;
      slug: string;
      title: string;
      desc?: string;
      bayesian_rating?: string;
      status?: number;
      year?: number;
      md_covers?: Array<{ b2key?: string }>;
      md_titles?: Array<{ title?: string }>;
    };
    authors?: Array<{ name?: string }>;
    artists?: Array<{ name?: string }>;
    genres?: Array<{ name?: string }>;
  }>(`/comic/${slugOrHid}`);

  const comic = data.comic;
  const coverKey = comic.md_covers?.[0]?.b2key;
  const coverUrl = coverKey ? `${COMICK_IMG_BASE}/${coverKey}` : null;
  const altTitles = (comic.md_titles || []).map((t) => t.title).filter((t): t is string => Boolean(t));
  const author = data.authors?.[0]?.name || null;
  const artist = data.artists?.[0]?.name || null;
  const genres = (data.genres || []).map((g) => g.name).filter((n): n is string => Boolean(n));

  const statusMap: Record<number, string> = { 1: 'ongoing', 2: 'completed', 3: 'cancelled', 4: 'hiatus' };
  const status = comic.status ? statusMap[comic.status] || 'ongoing' : 'ongoing';

  // Fetch chapters for this comic
  let chapters: ComickChapter[] = [];
  try {
    const chapterData = await comickFetch<{
      chapters?: Array<{
        hid: string;
        chap?: string;
        vol?: string;
        title?: string;
        updated_at?: string;
        group_name?: string[];
        lang?: string;
      }>;
    }>(`/comic/${comic.hid}/chapters?lang=fr,en&limit=150`);

    if (chapterData.chapters && Array.isArray(chapterData.chapters)) {
      chapters = chapterData.chapters.map((ch) => ({
        id: ch.hid,
        chapterNumber: ch.chap || '0',
        volume: ch.vol || null,
        title: ch.title || null,
        date: ch.updated_at ? new Date(ch.updated_at).toLocaleDateString('fr-FR') : '',
        groupName: ch.group_name?.join(', ') || null,
        lang: ch.lang || 'en',
        url: `https://comick.io/comic/${comic.slug}/${ch.hid}`,
      }));
    }
  } catch (err) {
    console.warn('Could not fetch chapters from Comick:', err);
  }

  return {
    id: comic.hid,
    slug: comic.slug,
    title: comic.title,
    coverUrl,
    altTitles,
    author,
    artist,
    status,
    genres,
    synopsis: comic.desc ? comic.desc.replace(/<[^>]*>/g, '').trim() : null,
    year: comic.year || null,
    rating: comic.bayesian_rating ? parseFloat(comic.bayesian_rating) / 2 : null,
    chapters,
  };
}

export async function getComickPages(chapterHid: string): Promise<string[]> {
  const data = await comickFetch<{
    chapter?: {
      // Comick currently exposes chapter pages as `md_images`. Keep the old
      // field as a fallback so the reader remains compatible with both shapes.
      md_images?: Array<{
        b2key?: string;
        url?: string;
      }>;
      images?: Array<{
        b2key?: string;
        url?: string;
      }>;
    };
  }>(`/chapter/${chapterHid}`);

  const images = data.chapter?.md_images || data.chapter?.images || [];
  return images.map((img) => {
    if (img.url?.startsWith('http')) return img.url;
    if (img.b2key) return `${COMICK_IMG_BASE}/${img.b2key}`;
    return '';
  }).filter(Boolean);
}
