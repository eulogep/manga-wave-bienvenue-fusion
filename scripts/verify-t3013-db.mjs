import crypto from 'node:crypto';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

if (!process.argv.includes('--allow-temporary-user')) {
  throw new Error('Refusé sans --allow-temporary-user');
}

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')];
    }),
);
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.API_KEY_ANONYME_SUPABASE;
const serviceKey = env.API_KEY_SERVICE_SUPABASE || env.API_KEY_SECRET_SUPABASE;
if (!url || !anonKey || !serviceKey) throw new Error('Configuration Supabase de validation absente');

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const suffix = crypto.randomUUID();
const email = `codex-t3013-${suffix}@example.invalid`;
const password = `T3013-${crypto.randomBytes(18).toString('base64url')}!`;
let userId = '';
let cleanupSucceeded = false;

try {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw createError;
  userId = created.user.id;

  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  const { error: favoriteError } = await client.from('user_favorites').insert({ user_id: userId, manga_id: 110 });
  if (favoriteError) throw favoriteError;

  const common = {
    user_id: userId,
    manga_id: 110,
    chapter_title: null,
    provider: 'originmanga',
    provider_manga_id: '656de8df-4b6c-483a-b1e0-4fe0aee8eafb',
    language: 'fr',
  };
  const { error: stateError } = await client.from('user_followed_chapter_state').insert([
    {
      ...common,
      canonical_chapter_key: '200.5',
      chapter_number: '200.5',
      provider_chapter_id: 'baseline-200-5',
      read_at: new Date().toISOString(),
    },
    {
      ...common,
      canonical_chapter_key: '201',
      chapter_number: '201',
      provider_chapter_id: 'new-201',
      read_at: null,
    },
  ]);
  if (stateError) throw stateError;

  const { count: before, error: beforeError } = await client
    .from('user_followed_chapter_state')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (beforeError) throw beforeError;
  const { error: acknowledgeError } = await client
    .from('user_followed_chapter_state')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('manga_id', 110)
    .eq('canonical_chapter_key', '201');
  if (acknowledgeError) throw acknowledgeError;
  const { count: after, error: afterError } = await client
    .from('user_followed_chapter_state')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (afterError) throw afterError;
  if (before !== 1 || after !== 0) throw new Error(`Transition non lue invalide: ${before} -> ${after}`);

  console.log(JSON.stringify({ favoriteCreated: true, unreadBeforeRead: before, unreadAfterRead: after, rlsUserScoped: true }, null, 2));
} finally {
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    cleanupSucceeded = !error;
  }
  console.log(JSON.stringify({ temporaryUserDeleted: cleanupSucceeded }));
}
