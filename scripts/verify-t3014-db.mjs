import crypto from 'node:crypto';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { reconcileFollowedChapters } from '../src/domain/followedChapterUpdates.ts';

if (!process.argv.includes('--allow-temporary-users')) {
  throw new Error('Refuse sans --allow-temporary-users');
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
const createdUserIds = [];
const mangaId = 110;
const now = () => new Date().toISOString();
const detected = (number) => ({
  mangaId,
  canonicalChapterKey: number,
  chapterNumber: number,
  chapterTitle: `Chapitre ${number}`,
  provider: 'originmanga',
  providerMangaId: '656de8df-4b6c-483a-b1e0-4fe0aee8eafb',
  providerChapterId: `qa-t3014-${number}`,
  language: 'fr',
});
const toRow = (userId, chapter) => ({
  user_id: userId,
  manga_id: chapter.mangaId,
  canonical_chapter_key: chapter.canonicalChapterKey,
  chapter_number: chapter.chapterNumber,
  chapter_title: chapter.chapterTitle,
  provider: chapter.provider,
  provider_manga_id: chapter.providerMangaId,
  provider_chapter_id: chapter.providerChapterId,
  language: chapter.language,
  first_seen_at: chapter.firstSeenAt,
  read_at: chapter.readAt,
});
const toState = (row) => ({
  mangaId: row.manga_id,
  canonicalChapterKey: row.canonical_chapter_key,
  chapterNumber: row.chapter_number,
  chapterTitle: row.chapter_title,
  provider: row.provider,
  providerMangaId: row.provider_manga_id,
  providerChapterId: row.provider_chapter_id,
  language: row.language,
  firstSeenAt: row.first_seen_at,
  readAt: row.read_at,
});

const createQaClient = async (label) => {
  const suffix = crypto.randomUUID();
  const email = `codex-t3014-${label}-${suffix}@example.invalid`;
  const password = `T3014-${crypto.randomBytes(18).toString('base64url')}!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  createdUserIds.push(data.user.id);
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { client, userId: data.user.id };
};

const countRows = async (client, table, userId, extra = (query) => query) => {
  const query = extra(client.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId));
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
};

let cleanupSucceeded = false;
try {
  const owner = await createQaClient('owner');
  const observer = await createQaClient('observer');

  const { error: favoriteError } = await owner.client.from('user_favorites').insert({
    user_id: owner.userId,
    manga_id: mangaId,
  });
  if (favoriteError) throw favoriteError;
  const favoriteOnlyFollowCount = await countRows(owner.client, 'user_follows', owner.userId);
  if (favoriteOnlyFollowCount !== 0) throw new Error('Un nouveau favori a cree un Follow implicite');

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { error } = await owner.client.from('user_follows').upsert({
      user_id: owner.userId,
      canonical_manga_id: mangaId,
    }, { onConflict: 'user_id,canonical_manga_id', ignoreDuplicates: true });
    if (error) throw error;
  }
  const uniqueFollowCount = await countRows(owner.client, 'user_follows', owner.userId);
  if (uniqueFollowCount !== 1) throw new Error(`Follow non idempotent: ${uniqueFollowCount}`);

  const { error: removeFavoriteError } = await owner.client
    .from('user_favorites')
    .delete()
    .eq('user_id', owner.userId)
    .eq('manga_id', mangaId);
  if (removeFavoriteError) throw removeFavoriteError;
  const followOnlyCount = await countRows(owner.client, 'user_follows', owner.userId);
  if (followOnlyCount !== 1) throw new Error('Supprimer le favori a supprime le Follow');

  const observerVisible = await countRows(observer.client, 'user_follows', owner.userId);
  if (observerVisible !== 0) throw new Error('RLS SELECT expose le Follow a un autre utilisateur');
  const { error: crossDeleteError } = await observer.client
    .from('user_follows')
    .delete()
    .eq('user_id', owner.userId)
    .eq('canonical_manga_id', mangaId);
  if (crossDeleteError) throw crossDeleteError;
  if (await countRows(owner.client, 'user_follows', owner.userId) !== 1) {
    throw new Error('RLS DELETE a supprime le Follow d un autre utilisateur');
  }

  const baseline = reconcileFollowedChapters([detected('200')], [], now());
  const { error: baselineError } = await owner.client
    .from('user_followed_chapter_state')
    .insert(baseline.rowsToInsert.map((chapter) => toRow(owner.userId, chapter)));
  if (baselineError) throw baselineError;
  const baselineUnread = await countRows(
    owner.client,
    'user_followed_chapter_state',
    owner.userId,
    (query) => query.is('read_at', null),
  );
  if (baselineUnread !== 0) throw new Error(`Baseline invalide: ${baselineUnread} unread`);

  const update = reconcileFollowedChapters(
    [detected('201'), detected('200')],
    baseline.rowsToInsert,
    now(),
  );
  const { error: updateError } = await owner.client
    .from('user_followed_chapter_state')
    .insert(update.rowsToInsert.map((chapter) => toRow(owner.userId, chapter)));
  if (updateError) throw updateError;
  const unreadBeforeRead = await countRows(
    owner.client,
    'user_followed_chapter_state',
    owner.userId,
    (query) => query.is('read_at', null),
  );
  const { error: readError } = await owner.client
    .from('user_followed_chapter_state')
    .update({ read_at: now() })
    .eq('user_id', owner.userId)
    .eq('manga_id', mangaId)
    .eq('canonical_chapter_key', '201');
  if (readError) throw readError;
  const unreadAfterRead = await countRows(
    owner.client,
    'user_followed_chapter_state',
    owner.userId,
    (query) => query.is('read_at', null),
  );
  if (unreadBeforeRead !== 1 || unreadAfterRead !== 0) {
    throw new Error(`Transition lecture invalide: ${unreadBeforeRead} -> ${unreadAfterRead}`);
  }

  const { error: unfollowError } = await owner.client
    .from('user_follows')
    .delete()
    .eq('user_id', owner.userId)
    .eq('canonical_manga_id', mangaId);
  if (unfollowError) throw unfollowError;
  const stateAfterUnfollow = await countRows(owner.client, 'user_followed_chapter_state', owner.userId);
  if (stateAfterUnfollow !== 0) throw new Error('Unfollow n a pas nettoye l etat de detection');

  const blockedWhileUnfollowed = reconcileFollowedChapters([detected('201')], [], now());
  const { error: missingFollowError } = await owner.client
    .from('user_followed_chapter_state')
    .insert(blockedWhileUnfollowed.rowsToInsert.map((chapter) => toRow(owner.userId, chapter)));
  if (!missingFollowError) throw new Error('Etat de detection accepte sans Follow');

  const { error: refollowError } = await owner.client.from('user_follows').insert({
    user_id: owner.userId,
    canonical_manga_id: mangaId,
  });
  if (refollowError) throw refollowError;
  const refollowBaseline = reconcileFollowedChapters([detected('201'), detected('200')], [], now());
  const { error: refollowBaselineError } = await owner.client
    .from('user_followed_chapter_state')
    .insert(refollowBaseline.rowsToInsert.map((chapter) => toRow(owner.userId, chapter)));
  if (refollowBaselineError) throw refollowBaselineError;
  const refollowUnread = await countRows(
    owner.client,
    'user_followed_chapter_state',
    owner.userId,
    (query) => query.is('read_at', null),
  );
  if (refollowUnread !== 0) throw new Error(`Refollow baseline invalide: ${refollowUnread}`);

  const { data: refollowRows, error: refollowRowsError } = await owner.client
    .from('user_followed_chapter_state')
    .select('*')
    .eq('user_id', owner.userId)
    .eq('manga_id', mangaId);
  if (refollowRowsError) throw refollowRowsError;
  const nextUpdate = reconcileFollowedChapters(
    [detected('202'), detected('201'), detected('200')],
    (refollowRows || []).map(toState),
    now(),
  );
  const { error: nextUpdateError } = await owner.client
    .from('user_followed_chapter_state')
    .insert(nextUpdate.rowsToInsert.map((chapter) => toRow(owner.userId, chapter)));
  if (nextUpdateError) throw nextUpdateError;
  const unreadAfterNextPublication = await countRows(
    owner.client,
    'user_followed_chapter_state',
    owner.userId,
    (query) => query.is('read_at', null),
  );
  if (unreadAfterNextPublication !== 1) {
    throw new Error(`Publication apres refollow invalide: ${unreadAfterNextPublication}`);
  }

  console.log(JSON.stringify({
    favoriteOnlyFollowCount,
    uniqueFollowCount,
    followOnlyCount,
    rlsObserverVisible: observerVisible,
    baselineUnread,
    unreadBeforeRead,
    unreadAfterRead,
    stateAfterUnfollow,
    refollowUnread,
    unreadAfterNextPublication,
  }, null, 2));
} finally {
  const results = await Promise.all(createdUserIds.map((userId) => admin.auth.admin.deleteUser(userId)));
  cleanupSucceeded = results.every((result) => !result.error);
  console.log(JSON.stringify({ temporaryUsersDeleted: cleanupSucceeded, count: createdUserIds.length }));
}
