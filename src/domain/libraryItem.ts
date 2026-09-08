import { normalizeMangaTitle } from './canonicalManga.ts';

export type LibraryResumeTarget = {
  source: string;
  providerMangaId: string;
  chapterId: string;
  language: string;
  pageIndex: number;
  chapterNumber: string;
};

export type LibraryUnreadUpdate = {
  chapterNumber: string;
  provider: string;
  providerMangaId: string;
  providerChapterId: string;
  language: string;
  firstSeenAt: string;
  count: number;
};

export type LibraryItem = {
  canonicalKey: string;
  canonicalMangaId: number | null;
  title: string;
  author: string | null;
  cover: string | null;
  genre: string[];
  canonicalStatus: string | null;
  favorite: boolean;
  favoritedAt: string | null;
  following: boolean;
  followedAt: string | null;
  hasProgress: boolean;
  currentChapterNumber: string | null;
  progressPercent: number | null;
  lastReadAt: string | null;
  resume: LibraryResumeTarget | null;
  unreadUpdate: LibraryUnreadUpdate | null;
  updatedAt: string;
};

export type LibraryFavoriteInput = {
  canonicalMangaId: number;
  title: string;
  author?: string | null;
  cover?: string | null;
  genre?: string[];
  status?: string | null;
  favoritedAt: string;
};

export type LibraryFollowInput = {
  canonicalMangaId: number;
  title: string;
  author?: string | null;
  cover?: string | null;
  genre?: string[];
  status?: string | null;
  followedAt: string;
};

export type LibraryProgressInput = {
  canonicalMangaId: number | null;
  canonicalKey: string;
  title: string;
  author?: string | null;
  cover?: string | null;
  chapterNumber: string;
  progressPercent: number;
  readAt: string;
  source: string;
  providerMangaId: string;
  chapterId: string;
  language: string;
  pageIndex: number;
};

export type LibraryUpdateInput = {
  canonicalMangaId: number;
  title: string;
  author?: string | null;
  cover?: string | null;
  genre?: string[];
  status?: string | null;
  chapterNumber: string;
  provider: string;
  providerMangaId: string;
  providerChapterId: string;
  language: string;
  firstSeenAt: string;
  unreadCount: number;
};

const keyFor = (canonicalMangaId: number | null, title: string, canonicalKey?: string): string => (
  canonicalMangaId !== null
    ? `manga:${canonicalMangaId}`
    : canonicalKey || `title:${normalizeMangaTitle(title)}`
);

const laterOf = (left: string | null, right: string | null): string | null => {
  if (!left) return right;
  if (!right) return left;
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
};

type Draft = LibraryItem & { _seedTitle: string };

/**
 * Builds the canonical LibraryItem[] the Library page renders. One row per canonical
 * manga: Favorite, Follow, reading progress and unread-update signals all aggregate
 * onto the same item instead of producing separate provider-shaped cards (P1 rule).
 */
export function aggregateLibraryItems(input: {
  favorites: LibraryFavoriteInput[];
  follows: LibraryFollowInput[];
  progress: LibraryProgressInput[];
  updates: LibraryUpdateInput[];
}): LibraryItem[] {
  const items = new Map<string, Draft>();

  const ensure = (canonicalMangaId: number | null, title: string, canonicalKey?: string): Draft => {
    const key = keyFor(canonicalMangaId, title, canonicalKey);
    const existing = items.get(key);
    if (existing) {
      if (canonicalMangaId !== null && existing.canonicalMangaId === null) {
        existing.canonicalMangaId = canonicalMangaId;
      }
      return existing;
    }
    const created: Draft = {
      canonicalKey: key,
      canonicalMangaId,
      title,
      author: null,
      cover: null,
      genre: [],
      canonicalStatus: null,
      favorite: false,
      favoritedAt: null,
      following: false,
      followedAt: null,
      hasProgress: false,
      currentChapterNumber: null,
      progressPercent: null,
      lastReadAt: null,
      resume: null,
      unreadUpdate: null,
      updatedAt: new Date(0).toISOString(),
      _seedTitle: title,
    };
    items.set(key, created);
    return created;
  };

  const applyMeta = (item: Draft, meta: { author?: string | null; cover?: string | null; genre?: string[]; status?: string | null }) => {
    item.author = item.author ?? meta.author ?? null;
    item.cover = item.cover ?? meta.cover ?? null;
    if (meta.genre && meta.genre.length > 0 && item.genre.length === 0) item.genre = meta.genre;
    item.canonicalStatus = item.canonicalStatus ?? meta.status ?? null;
  };

  for (const favorite of input.favorites) {
    const item = ensure(favorite.canonicalMangaId, favorite.title);
    item.favorite = true;
    item.favoritedAt = favorite.favoritedAt;
    applyMeta(item, favorite);
    item.updatedAt = laterOf(item.updatedAt, favorite.favoritedAt) as string;
  }

  for (const follow of input.follows) {
    const item = ensure(follow.canonicalMangaId, follow.title);
    item.following = true;
    item.followedAt = follow.followedAt;
    applyMeta(item, follow);
    item.updatedAt = laterOf(item.updatedAt, follow.followedAt) as string;
  }

  for (const progress of input.progress) {
    const item = ensure(progress.canonicalMangaId, progress.title, progress.canonicalKey);
    applyMeta(item, progress);
    const isNewer = !item.hasProgress || laterOf(item.lastReadAt, progress.readAt) === progress.readAt;
    if (isNewer) {
      item.hasProgress = true;
      item.currentChapterNumber = progress.chapterNumber;
      item.progressPercent = progress.progressPercent;
      item.lastReadAt = progress.readAt;
      item.resume = {
        source: progress.source,
        providerMangaId: progress.providerMangaId,
        chapterId: progress.chapterId,
        language: progress.language,
        pageIndex: progress.pageIndex,
        chapterNumber: progress.chapterNumber,
      };
    }
    item.updatedAt = laterOf(item.updatedAt, progress.readAt) as string;
  }

  for (const update of input.updates) {
    const item = ensure(update.canonicalMangaId, update.title);
    applyMeta(item, update);
    item.unreadUpdate = {
      chapterNumber: update.chapterNumber,
      provider: update.provider,
      providerMangaId: update.providerMangaId,
      providerChapterId: update.providerChapterId,
      language: update.language,
      firstSeenAt: update.firstSeenAt,
      count: update.unreadCount,
    };
    item.updatedAt = laterOf(item.updatedAt, update.firstSeenAt) as string;
  }

  return [...items.values()].map(({ _seedTitle, ...item }) => item);
}

export type LibrarySectionId = 'all' | 'in-progress' | 'favorites' | 'following' | 'updates' | 'completed';

/** A manga belongs to "En cours" when it has progress and its series is not marked completed. */
export function isInProgress(item: LibraryItem): boolean {
  return item.hasProgress && item.canonicalStatus !== 'completed';
}

export function isCompleted(item: LibraryItem): boolean {
  return item.canonicalStatus === 'completed';
}

export function hasUnreadUpdate(item: LibraryItem): boolean {
  return Boolean(item.unreadUpdate && item.unreadUpdate.count > 0);
}

export function filterLibraryItems(items: LibraryItem[], section: LibrarySectionId): LibraryItem[] {
  switch (section) {
    case 'in-progress':
      return items.filter(isInProgress);
    case 'favorites':
      return items.filter((item) => item.favorite);
    case 'following':
      return items.filter((item) => item.following);
    case 'updates':
      return items.filter(hasUnreadUpdate);
    case 'completed':
      return items.filter(isCompleted);
    case 'all':
    default:
      return items;
  }
}

export type LibrarySortOption = 'activity' | 'lastRead' | 'lastUpdated' | 'title';

export function sortLibraryItems(items: LibraryItem[], sort: LibrarySortOption): LibraryItem[] {
  const sorted = [...items];
  if (sort === 'title') return sorted.sort((left, right) => left.title.localeCompare(right.title, 'fr'));
  if (sort === 'lastRead') {
    return sorted.sort((left, right) => new Date(right.lastReadAt || 0).getTime() - new Date(left.lastReadAt || 0).getTime());
  }
  if (sort === 'lastUpdated') {
    return sorted.sort((left, right) => (
      new Date(right.unreadUpdate?.firstSeenAt || 0).getTime() - new Date(left.unreadUpdate?.firstSeenAt || 0).getTime()
    ));
  }
  return sorted.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

export function searchLibraryItems(items: LibraryItem[], query: string): LibraryItem[] {
  const normalized = normalizeMangaTitle(query);
  if (!normalized) return items;
  return items.filter((item) => normalizeMangaTitle(item.title).includes(normalized));
}
