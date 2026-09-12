import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { AniListClient } from './anilist-client.ts';
import { JikanClient } from './jikan-client.ts';
import { KitsuClient } from './kitsu-client.ts';
import { MangaUpdatesClient } from './mangaupdates-client.ts';
import { MangaDexMetadataClient } from './mangadex-metadata-client.ts';
import { MetadataProvider, type MetadataCache, type MetadataSource, type SearchProvider } from './metadata-provider.ts';
import {
  mergeAliases,
  selectMetadataMatch,
  quarantineBatchCollisions,
  shouldOverwriteMetadata,
  type CanonicalWork,
  type MatchDecision,
  type AniListMedia,
} from './canonical-metadata.ts';
import { normalizeMetadataText } from '../../supabase/functions/_shared/canonical-metadata.ts';

const REPORT_DIR = resolve(process.env.T3020_METADATA_STATE_DIR || '/private/tmp/manga-wave-t3020-metadata');
const VALID_TYPES = new Set(['manga', 'manhwa', 'manhua']);

function numberOption(name: string): number | null {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const number = Number(process.argv[index + 1]);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`${name}: entier positif requis`);
  return number;
}

async function save(name: string, value: unknown) {
  await mkdir(REPORT_DIR, { recursive: true });
  const path = resolve(REPORT_DIR, name);
  await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2) + '\n');
  await rename(`${path}.tmp`, path);
}

async function main() {
  // Intentionally no database write path until this exact dry-run has been reviewed.
  if (process.argv.includes('--apply')) throw new Error('Apply désactivé: revue et autorisation explicite du plan requises.');
  const permitted = new Set(['--dry-run', '--resume', '--limit', '--canonical-id', '--with-kitsu', '--with-mangaupdates', '--with-mangadex']);
  for (const arg of process.argv.slice(2)) if (arg.startsWith('--') && !permitted.has(arg)) throw new Error(`Option inconnue: ${arg}`);
  const limit = numberOption('--limit');
  const canonicalId = numberOption('--canonical-id');
  const url = process.env.VITE_SUPABASE_URL;
  // Read-only API key is sufficient: this CLI cannot mutate the catalog.
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Configuration Supabase absente.');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const rows: Array<Omit<CanonicalWork, 'sourceTitles'>> = [];
  for (let from = 0; ; from += 1_000) {
    // Existing deployments may not have the new provenance columns yet.
    const { data, error } = await db.from('mangas').select('*').order('id').range(from, from + 999);
    if (error) throw new Error(`Catalog read failed: ${error.message}`);
    rows.push(...(data || []));
    if ((data || []).length < 1_000) break;
  }
  const mappings: Array<{ manga_id: number; source_title: string; match_confidence: number }> = [];
  for (let from = 0; ; from += 1_000) {
    const { data, error } = await db.from('manga_source_mappings').select('manga_id,source_title,match_confidence').order('id').range(from, from + 999);
    if (error) throw new Error(`Mappings read failed: ${error.message}`);
    mappings.push(...(data || []));
    if ((data || []).length < 1_000) break;
  }
  const allWorks: CanonicalWork[] = rows.map((row) => ({
    ...row,
    aliases: row.aliases || [],
    sourceTitles: mappings.filter((mapping) => mapping.manga_id === row.id && mapping.match_confidence >= 0.95).map((mapping) => mapping.source_title),
  }));
  let works = canonicalId ? allWorks.filter((work) => work.id === canonicalId) : allWorks;
  if (limit) works = works.slice(0, limit);
  const owners = new Map<string, number[]>();
  for (const row of allWorks) for (const title of [row.title, ...row.aliases]) {
    const key = normalizeMetadataText(title);
    owners.set(key, [...new Set([...(owners.get(key) || []), row.id])]);
  }
  let cache: MetadataCache = {};
  try { cache = JSON.parse(await readFile(resolve(REPORT_DIR, 'provider-cache.json'), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }

  // Clients
  const mangadexClient = new MangaDexMetadataClient();
  const mangaupdatesClient = new MangaUpdatesClient();
  const kitsuClient = new KitsuClient();
  const anilistClient = new AniListClient();
  const jikanClient = new JikanClient();

  // Multi-tier provider search chain: AniList -> Jikan -> MangaUpdates -> Kitsu
  const searchProviders: Array<{ name: MetadataSource; provider: SearchProvider }> = [
    { name: 'anilist', provider: anilistClient },
    { name: 'jikan', provider: jikanClient },
    { name: 'mangaupdates', provider: mangaupdatesClient },
    { name: 'kitsu', provider: kitsuClient },
  ];

  const provider = new MetadataProvider(searchProviders, cache);
  const holds = JSON.parse(await readFile(new URL('./review-holds.json', import.meta.url), 'utf8')) as Array<{ source: string; externalId: number | string; reason: string }>;
  const decisions: Array<{ work: CanonicalWork; source: string; decision: MatchDecision }> = [];
  const errors: Array<{ canonicalId: number; message: string }> = [];
  await save('snapshot.json', { generatedAt: new Date().toISOString(), rows, mappings });

  for (const work of works) {
    try {
      let source: string = '';
      let candidates: AniListMedia[] = [];

      // Tier 0: Direct MangaDex ID lookup if row already has a mangadex_id (100% precision)
      if (work.mangadex_id) {
        const mdKey = `mangadex:${work.mangadex_id}`;
        const cachedMd = provider.cache[mdKey];
        if (cachedMd?.candidates?.length) {
          source = 'mangadex';
          candidates = cachedMd.candidates;
        } else {
          try {
            const directMedia = await mangadexClient.getById(work.mangadex_id);
            source = 'mangadex';
            candidates = [directMedia];
            provider.cache[mdKey] = {
              source: 'mangadex',
              query: work.mangadex_id,
              fetchedAt: new Date().toISOString(),
              candidates,
            };
          } catch {
            // Direct lookup failed; fall through to search provider
          }
        }
      }

      // If not resolved via direct lookup, query search provider failover chain
      if (!candidates.length) {
        const result = await provider.search(work.title);
        source = result.source;
        candidates = result.candidates;
      }

      const decision = selectMetadataMatch(work, candidates, owners);
      const hold = holds.find((hold) => hold.source === source && String(hold.externalId) === String(decision.media?.id));
      if (hold && decision.confidence !== 'REJECT') {
        decision.confidence = 'REVIEW';
        decision.reasons.push(hold.reason);
        decision.aliases = [];
        decision.mangaType = null;
        decision.countryOfOrigin = null;
      }
      decisions.push({ work, source, decision });
    } catch (error) {
      errors.push({ canonicalId: work.id, message: error instanceof Error ? error.message : String(error) });
    }
    await save('provider-cache.json', provider.cache);
    await save('checkpoint.json', { lastCanonicalId: work.id, processed: decisions.length, errors, decisions, outages: provider.outages });
    if ((decisions.length + errors.length) % 10 === 0) console.log(JSON.stringify({ attempted: decisions.length + errors.length, processed: decisions.length, errors: errors.length, total: works.length }));
    // Circuit breaker if multiple consecutive errors and zero successes
    if (errors.length >= 3 && decisions.length === 0) break;
  }
  quarantineBatchCollisions(decisions);
  const patches = works.flatMap((work) => {
    const item = decisions.find((item) => item.work.id === work.id);
    const decision = item?.decision;
    const invalid = Boolean(work.manga_type && !VALID_TYPES.has(work.manga_type));
    if (decision && shouldOverwriteMetadata(work.metadata_confidence || null, decision.confidence)) {
      return [{
        canonicalId: work.id,
        before: { aliases: work.aliases, manga_type: work.manga_type, metadata_confidence: work.metadata_confidence || null },
        after: {
          aliases: mergeAliases(work.title, work.aliases, decision.aliases),
          manga_type: decision.mangaType || (invalid ? null : work.manga_type),
          ...(decision.countryOfOrigin ? { country_of_origin: decision.countryOfOrigin } : {}),
          metadata_source: item.source,
          metadata_external_id: String(decision.media?.id),
          metadata_confidence: decision.confidence,
        },
        reason: decision.reasons,
      }];
    }
    return invalid ? [{ canonicalId: work.id, before: { aliases: work.aliases, manga_type: work.manga_type, metadata_confidence: work.metadata_confidence || null }, after: { manga_type: null }, reason: ['invalid taxonomy cleanup only; preserve aliases and identity'] }] : [];
  });
  const projected = rows.map((row) => ({ ...row, ...patches.find((patch) => patch.canonicalId === row.id)?.after }));
  const count = (source: string, confidence: string) => decisions.filter((item) => item.source === source && item.decision.confidence === confidence).length;
  const summary = {
    ROWS_SELECTED: works.length,
    ROWS_PROCESSED: decisions.length,
    ROWS_UNPROCESSED: works.length - decisions.length,
    MANGADEX_MATCHED_EXACT: count('mangadex', 'EXACT'),
    MANGADEX_MATCHED_HIGH: count('mangadex', 'HIGH'),
    MANGADEX_REVIEW: count('mangadex', 'REVIEW'),
    MANGADEX_REJECTED: count('mangadex', 'REJECT'),
    MANGAUPDATES_MATCHED_EXACT: count('mangaupdates', 'EXACT'),
    MANGAUPDATES_MATCHED_HIGH: count('mangaupdates', 'HIGH'),
    MANGAUPDATES_REVIEW: count('mangaupdates', 'REVIEW'),
    MANGAUPDATES_REJECTED: count('mangaupdates', 'REJECT'),
    KITSU_MATCHED_EXACT: count('kitsu', 'EXACT'),
    KITSU_MATCHED_HIGH: count('kitsu', 'HIGH'),
    KITSU_REVIEW: count('kitsu', 'REVIEW'),
    KITSU_REJECTED: count('kitsu', 'REJECT'),
    JIKAN_MATCHED_EXACT: count('jikan', 'EXACT'),
    JIKAN_MATCHED_HIGH: count('jikan', 'HIGH'),
    JIKAN_REVIEW: count('jikan', 'REVIEW'),
    JIKAN_REJECTED: count('jikan', 'REJECT'),
    ANILIST_MATCHED_EXACT: count('anilist', 'EXACT'),
    ANILIST_MATCHED_HIGH: count('anilist', 'HIGH'),
    ALIASES_PROJECTED: projected.reduce((sum, row) => sum + (row.aliases || []).length, 0),
    TYPE_MANGA: projected.filter((row) => row.manga_type === 'manga').length,
    TYPE_MANHWA: projected.filter((row) => row.manga_type === 'manhwa').length,
    TYPE_MANHUA: projected.filter((row) => row.manga_type === 'manhua').length,
    TYPE_UNKNOWN: projected.filter((row) => row.manga_type === null).length,
    INVALID_TYPE_COUNT_AFTER: projected.filter((row) => row.manga_type && !VALID_TYPES.has(row.manga_type)).length,
    COLLISIONS: decisions.reduce((sum, item) => sum + item.decision.collisions.length, 0),
    API_ERRORS: errors.length,
    PROVIDER_OUTAGES: provider.outages.length,
    ROWS_UPDATED: 0,
    DRY_RUN: decisions.length === works.length && works.length === rows.length && !errors.length ? 'PASS' : 'BLOCKED',
  };
  const plan = { snapshotHash: createHash('sha256').update(JSON.stringify(rows)).digest('hex'), patches };
  await save('dry-run.json', { mode: 'dry-run', generatedAt: new Date().toISOString(), ...summary, outages: provider.outages, errors, decisions, plan });
  console.log(JSON.stringify(summary, null, 2));
  if (summary.DRY_RUN !== 'PASS') process.exitCode = 2;
}
main().catch((error) => { console.error(error instanceof Error ? error.message : 'Metadata dry-run failed'); process.exitCode = 1; });
