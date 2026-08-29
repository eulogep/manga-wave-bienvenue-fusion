export type HomeCatalogItem = {
  id: number;
  title: string;
  genre: string[];
  status: string;
  manga_type: string | null;
  rating: number | null;
  views: number;
  source_updated_at: string | null;
  created_at: string;
};

export type PersonalizedHomeCatalog<T extends HomeCatalogItem> = {
  newChapters: T[];
  forYou: T[];
  trending: T[];
  recentlyUpdated: T[];
  favoriteGenres: string[];
  completed: T[];
};

export type AnonymousHomeCatalog<T extends HomeCatalogItem> = {
  latest: T[];
  popular: T[];
  randomDiscovery: T[];
  formats: string[];
};

const updatedAt = (manga: HomeCatalogItem) => new Date(manga.source_updated_at || manga.created_at).getTime() || 0;
const popularity = (manga: HomeCatalogItem) => manga.views + (manga.rating || 0) * 1_000;

export function rankFavoriteGenres<T extends HomeCatalogItem>(mangas: T[], favoriteIds: number[]): string[] {
  const favorites = new Set(favoriteIds);
  const counts = new Map<string, number>();
  mangas.forEach((manga) => {
    if (!favorites.has(manga.id)) return;
    manga.genre.forEach((genre) => counts.set(genre, (counts.get(genre) || 0) + 1));
  });
  return [...counts]
    .sort(([leftGenre, leftCount], [rightGenre, rightCount]) => rightCount - leftCount || leftGenre.localeCompare(rightGenre, 'fr'))
    .map(([genre]) => genre)
    .slice(0, 6);
}

export function buildPersonalizedHomeCatalog<T extends HomeCatalogItem>(
  mangas: T[],
  favoriteIds: number[],
  limit = 6,
): PersonalizedHomeCatalog<T> {
  const favorites = new Set(favoriteIds);
  const favoriteGenres = rankFavoriteGenres(mangas, favoriteIds);
  const genrePriority = new Map(favoriteGenres.map((genre, index) => [genre, favoriteGenres.length - index]));
  const recent = [...mangas].sort((left, right) => updatedAt(right) - updatedAt(left) || left.title.localeCompare(right.title, 'fr'));
  const trending = [...mangas].sort((left, right) => popularity(right) - popularity(left) || left.title.localeCompare(right.title, 'fr'));
  const recommendations = mangas
    .filter((manga) => !favorites.has(manga.id))
    .map((manga) => ({
      manga,
      affinity: manga.genre.reduce((score, genre) => score + (genrePriority.get(genre) || 0), 0),
    }))
    .sort((left, right) => right.affinity - left.affinity || popularity(right.manga) - popularity(left.manga))
    .map(({ manga }) => manga);

  return {
    newChapters: recent.filter((manga) => manga.status === 'ongoing').slice(0, limit),
    forYou: (favoriteIds.length ? recommendations : trending).slice(0, limit),
    trending: trending.slice(0, limit),
    recentlyUpdated: recent.slice(0, limit),
    favoriteGenres,
    completed: recent.filter((manga) => manga.status === 'completed').slice(0, limit),
  };
}

export function buildAnonymousHomeCatalog<T extends HomeCatalogItem>(
  mangas: T[],
  seed: number,
  limit = 6,
): AnonymousHomeCatalog<T> {
  const latest = [...mangas].sort((left, right) => updatedAt(right) - updatedAt(left) || left.title.localeCompare(right.title, 'fr'));
  const popular = [...mangas].sort((left, right) => popularity(right) - popularity(left) || left.title.localeCompare(right.title, 'fr'));
  const offset = mangas.length ? Math.abs(Math.trunc(seed)) % mangas.length : 0;
  const rotated = [...mangas.slice(offset), ...mangas.slice(0, offset)];
  const formats = [...new Set(mangas.map((manga) => manga.manga_type?.trim()).filter((type): type is string => Boolean(type)))]
    .sort((left, right) => left.localeCompare(right, 'fr'));

  return {
    latest: latest.slice(0, limit),
    popular: popular.slice(0, limit),
    randomDiscovery: rotated.slice(0, limit),
    formats,
  };
}
