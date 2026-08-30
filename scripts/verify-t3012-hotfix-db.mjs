import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      return [
        line.slice(0, separator).trim(),
        line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, ''),
      ];
    }),
);

if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Configuration Supabase publique absente');
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});
const { data, error } = await supabase
  .from('canonical_manga_catalog')
  .select('canonical_id,title,source_count,sources')
  .ilike('title', '%Solo Leveling%')
  .limit(1);
if (error) throw error;
if (!data?.[0]) throw new Error('Solo Leveling absent du catalogue canonique');

const manga = data[0];
const { data: ranking, error: rankingError } = await supabase.rpc('rank_canonical_manga_sources', {
  requested_canonical_id: manga.canonical_id,
  preferred_language: 'fr',
});
if (rankingError) throw rankingError;

console.log(JSON.stringify({
  canonicalId: manga.canonical_id,
  title: manga.title,
  sourceCount: manga.source_count,
  mappings: (manga.sources || []).map((mapping) => ({
    provider: mapping.provider,
    externalId: mapping.external_id,
    language: mapping.language,
    available: mapping.available,
  })),
  rankedEligible: (ranking || []).filter((mapping) => mapping.eligible).length,
  topSource: ranking?.[0]?.source_id,
  topLanguage: ranking?.[0]?.language,
  topScore: ranking?.[0]?.source_score,
}, null, 2));
