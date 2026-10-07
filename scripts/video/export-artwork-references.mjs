import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of (await fs.readFile('.env', 'utf8')).split(/\r?\n/)) {
  const index = line.indexOf('=');
  if (index > 0) env[line.slice(0, index)] = line.slice(index + 1).trim();
}
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.API_KEY_ANONYME_SUPABASE;
if (!url || !key) throw new Error('Supabase public configuration unavailable.');

const reasons = new Map([
  [7, 'Couverture très lisible, repère manga grand public et fiche canonique riche.'],
  [51, 'Palette rouge énergique, excellente présence dans une grille et dans les classements.'],
  [100, 'Silhouette immédiatement reconnaissable et contraste fort pour les formats verticaux.'],
  [57, 'Univers sportif distinct, utile pour varier le rythme visuel.'],
  [5, 'Couverture forte et source multiple, adaptée aux transitions de catalogue.'],
  [20, 'Titre reconnu, composition graphique très contrastée.'],
  [6, 'Palette claire et contemplative qui équilibre les scènes d’action.'],
  [22, 'Icône populaire et source multiple, utile pour expliquer la résolution canonique.'],
]);
const ids = [...reasons.keys()];
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const result = await db.from('mangas')
  .select('id,title,author,cover_image,manga_type,genre,status,rating,content_rating,manga_source_mappings(source_id,available)')
  .in('id', ids);
if (result.error) throw result.error;

const out = path.resolve('video-kit/artwork-references');
await fs.mkdir(out, { recursive: true });
const manifest = [];
for (const work of result.data.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))) {
  if (!work.cover_image || work.content_rating === 'erotica') continue;
  const response = await fetch(work.cover_image);
  if (!response.ok) throw new Error(`Cover ${work.id} failed with ${response.status}`);
  const slug = work.title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const filename = `${work.id}-${slug}.jpg`;
  await fs.writeFile(path.join(out, filename), Buffer.from(await response.arrayBuffer()));
  manifest.push({
    canonicalId: work.id,
    title: work.title,
    route: `/manga/${work.id}`,
    file: filename,
    coverSource: work.cover_image,
    type: work.manga_type,
    genres: work.genre,
    status: work.status,
    rating: work.rating,
    providers: work.manga_source_mappings.filter((mapping) => mapping.available).map((mapping) => mapping.source_id),
    reason: reasons.get(work.id),
  });
}
await fs.writeFile(path.join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ status: 'PASS', exported: manifest.length }));
