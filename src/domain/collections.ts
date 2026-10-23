import { normalizeQuery, type SearchWork } from './canonicalSearch.ts';

export type EditorialCollection = {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  /** Rule over canonical (normalized) metadata; adult works are excluded separately. */
  matches: (work: SearchWork) => boolean;
};

/** Below this size a collection is not published: a near-empty page is worse than none. */
export const MIN_COLLECTION_SIZE = 6;

const hasGenre = (work: SearchWork, ...genres: string[]) => work.genre.some((genre) => genres.includes(genre));

export const EDITORIAL_COLLECTIONS: readonly EditorialCollection[] = [
  {
    slug: 'manhwas-action',
    title: 'Manhwas d’action',
    tagline: 'Montées en puissance, combats et donjons',
    description: 'Les manhwas où chaque chapitre se termine sur un affrontement : chasseurs, tours, système de niveaux et rivalités qui explosent.',
    matches: (work) => work.manga_type === 'manhwa' && hasGenre(work, 'Action'),
  },
  {
    slug: 'isekai',
    title: 'Isekai : un autre monde',
    tagline: 'Réincarnés, invoqués, transportés',
    description: 'Un héros projeté dans un monde inconnu, ses règles à apprendre et une seconde chance à saisir. Le meilleur de l’isekai au même endroit.',
    matches: (work) => hasGenre(work, 'Isekai'),
  },
  {
    slug: 'series-terminees',
    title: 'Séries terminées',
    tagline: 'À lire d’une traite, sans attendre la suite',
    description: 'Des histoires complètes, de la première à la dernière page. Idéal pour un marathon sans cliffhanger en suspens.',
    matches: (work) => work.status === 'completed',
  },
  {
    slug: 'romances',
    title: 'Romances à dévorer',
    tagline: 'Coups de cœur, malentendus et slow burn',
    description: 'Rencontres improbables, triangles amoureux et déclarations attendues pendant des dizaines de chapitres.',
    matches: (work) => hasGenre(work, 'Romance'),
  },
  {
    slug: 'fantasy-aventure',
    title: 'Fantasy et grande aventure',
    tagline: 'Magie, quêtes et terres inconnues',
    description: 'Royaumes à sauver, magie ancienne et compagnons de route : des récits qui donnent envie de partir.',
    matches: (work) => hasGenre(work, 'Fantasy', 'Adventure'),
  },
  {
    slug: 'feel-good',
    title: 'Feel-good',
    tagline: 'Comédies et tranches de vie qui font du bien',
    description: 'Des lectures légères et chaleureuses pour décompresser : répliques qui font sourire et quotidien attachant.',
    matches: (work) => hasGenre(work, 'Comedy', 'Slice of Life') && !hasGenre(work, 'Tragedy', 'Horror'),
  },
  {
    slug: 'recits-sombres',
    title: 'Récits sombres',
    tagline: 'Tragédie, tension psychologique et frissons',
    description: 'Des histoires qui serrent la gorge : drames lourds, manipulations, horreur et fins qui ne pardonnent pas.',
    matches: (work) => hasGenre(work, 'Tragedy', 'Psychological', 'Horror', 'Thriller'),
  },
];

const isAdultWork = (work: SearchWork) => work.content_rating === 'erotica' || work.genre.includes('Smut');

/** Most-read first, then best-rated, then title, so the order is stable for sharing. */
function rankWorks(works: SearchWork[]): SearchWork[] {
  return [...works].sort((left, right) => (
    (right.views || 0) - (left.views || 0)
    || (right.rating ?? -1) - (left.rating ?? -1)
    || left.title.localeCompare(right.title, 'fr')
    || left.id - right.id
  ));
}

/**
 * Display-only: the same work imported from several sources appears once, keeping
 * the most-read entry. Identity in the database is never merged (see canonicalSearch).
 */
function hideSourceDuplicates(ranked: SearchWork[]): SearchWork[] {
  const seen = new Set<string>();
  return ranked.filter((work) => {
    const key = `${normalizeQuery(work.title)}|${normalizeQuery(work.author || '')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function collectionWorks(collection: EditorialCollection, catalog: SearchWork[]): SearchWork[] {
  const unique = [...new Map(catalog.map((work) => [work.id, work])).values()];
  return hideSourceDuplicates(rankWorks(unique.filter((work) => !isAdultWork(work) && collection.matches(work))));
}

export type PublishedCollection = { collection: EditorialCollection; works: SearchWork[] };

/** Collections that have enough works to be worth a page, in editorial order. */
export function publishedCollections(catalog: SearchWork[]): PublishedCollection[] {
  return EDITORIAL_COLLECTIONS
    .map((collection) => ({ collection, works: collectionWorks(collection, catalog) }))
    .filter(({ works }) => works.length >= MIN_COLLECTION_SIZE);
}

/**
 * Picks cover works for each collection tile, preferring works not already shown
 * on an earlier tile so the index does not repeat the same covers everywhere.
 */
export function distinctTileCovers(collections: PublishedCollection[], perTile = 3): SearchWork[][] {
  const used = new Set<number>();
  return collections.map(({ works }) => {
    const withCover = works.filter((work) => work.cover_image);
    const fresh = withCover.filter((work) => !used.has(work.id));
    const picked = [...fresh, ...withCover.filter((work) => used.has(work.id))].slice(0, perTile);
    picked.forEach((work) => used.add(work.id));
    return picked;
  });
}

export function findCollection(slug: string | undefined): EditorialCollection | null {
  return EDITORIAL_COLLECTIONS.find((collection) => collection.slug === slug) || null;
}
