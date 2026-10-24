import crypto from 'node:crypto';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

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

const createQaClient = async (label) => {
  const suffix = crypto.randomUUID();
  const email = `codex-user-lists-${label}-${suffix}@example.invalid`;
  const password = `Lists-${crypto.randomBytes(18).toString('base64url')}!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  createdUserIds.push(data.user.id);

  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { client, userId: data.user.id };
};

const requireNoError = (error, context) => {
  if (error) throw new Error(`${context}: ${error.message}`);
};

let cleanupSucceeded = false;
try {
  const owner = await createQaClient('owner');
  const observer = await createQaClient('observer');

  const firstDefaults = await owner.client.rpc('ensure_default_user_lists');
  requireNoError(firstDefaults.error, 'Création des listes système');
  const secondDefaults = await owner.client.rpc('ensure_default_user_lists');
  requireNoError(secondDefaults.error, 'Idempotence des listes système');

  const expectedKinds = ['to_read', 'on_hold', 'completed'];
  if (firstDefaults.data?.length !== 3 || secondDefaults.data?.length !== 3) {
    throw new Error('Le RPC ne retourne pas exactement trois listes système');
  }
  if (firstDefaults.data.map((row) => row.kind).join(',') !== expectedKinds.join(',')) {
    throw new Error('Ordre ou type des listes système invalide');
  }

  const invalidSystem = await owner.client.from('user_lists').insert({
    user_id: owner.userId,
    name: 'À lire piratée',
    kind: 'to_read',
    position: 10,
  });
  if (!invalidSystem.error) throw new Error('Une variante de liste système a contourné la politique INSERT');

  const crossOwnerInsert = await observer.client.from('user_lists').insert({
    user_id: owner.userId,
    name: 'Liste étrangère',
    kind: 'custom',
    position: 3,
  });
  if (!crossOwnerInsert.error) throw new Error('Un utilisateur a créé une liste pour un autre propriétaire');

  const customInsert = await owner.client.from('user_lists').insert({
    user_id: owner.userId,
    name: 'Favoris du week-end',
    kind: 'custom',
    position: 3,
  }).select().single();
  requireNoError(customInsert.error, 'Création de liste personnalisée');
  const customListId = customInsert.data.id;

  const itemsInsert = await owner.client.from('user_list_items').insert([
    { list_id: customListId, user_id: owner.userId, canonical_manga_id: 110, note: 'Relire le tome 3' },
    { list_id: customListId, user_id: owner.userId, canonical_manga_id: 100 },
  ]).select('id,canonical_manga_id,position');
  requireNoError(itemsInsert.error, 'Ajout des éléments');
  if (itemsInsert.data.length !== 2) throw new Error('Les deux éléments attendus ne sont pas présents');

  const itemByManga = new Map(itemsInsert.data.map((row) => [row.canonical_manga_id, row]));
  const orderedIds = [itemByManga.get(100)?.id, itemByManga.get(110)?.id];
  if (orderedIds.some((id) => !id)) throw new Error('Identifiants des éléments incomplets');
  const reordered = await owner.client.rpc('reorder_user_list_items', {
    p_list_id: customListId,
    p_item_ids: orderedIds,
  });
  requireNoError(reordered.error, 'Réordonnancement');

  const ownerItems = await owner.client.from('user_list_items')
    .select('id,canonical_manga_id,position,note')
    .eq('list_id', customListId)
    .order('position');
  requireNoError(ownerItems.error, 'Lecture des éléments du propriétaire');
  if (ownerItems.data.map((row) => row.canonical_manga_id).join(',') !== '100,110') {
    throw new Error('Le nouvel ordre n’a pas été conservé');
  }

  const observerLists = await observer.client.from('user_lists').select('id').eq('user_id', owner.userId);
  requireNoError(observerLists.error, 'Lecture RLS des listes');
  const observerItems = await observer.client.from('user_list_items').select('id').eq('user_id', owner.userId);
  requireNoError(observerItems.error, 'Lecture RLS des éléments');
  if (observerLists.data.length !== 0 || observerItems.data.length !== 0) {
    throw new Error('RLS SELECT expose les données privées à un autre utilisateur');
  }

  const foreignDelete = await observer.client.from('user_lists').delete().eq('id', customListId);
  requireNoError(foreignDelete.error, 'Suppression RLS étrangère');
  const stillOwned = await owner.client.from('user_lists').select('id').eq('id', customListId).maybeSingle();
  requireNoError(stillOwned.error, 'Contrôle après suppression étrangère');
  if (!stillOwned.data) throw new Error('RLS DELETE a supprimé la liste d’un autre utilisateur');

  const systemDelete = await owner.client.from('user_lists').delete().eq('kind', 'to_read');
  requireNoError(systemDelete.error, 'Protection de suppression système');
  const systemCount = await owner.client.from('user_lists')
    .select('*', { count: 'exact', head: true })
    .neq('kind', 'custom');
  requireNoError(systemCount.error, 'Comptage des listes système');
  if (systemCount.count !== 3) throw new Error('Une liste système a pu être supprimée');

  const customDelete = await owner.client.from('user_lists').delete().eq('id', customListId);
  requireNoError(customDelete.error, 'Suppression de liste personnalisée');
  const remainingItems = await owner.client.from('user_list_items')
    .select('*', { count: 'exact', head: true })
    .eq('list_id', customListId);
  requireNoError(remainingItems.error, 'Contrôle de cascade');
  if (remainingItems.count !== 0) throw new Error('La suppression de liste n’a pas supprimé ses éléments');

  console.log(JSON.stringify({
    defaultLists: firstDefaults.data.length,
    idempotentDefaultLists: secondDefaults.data.length,
    invalidSystemListBlocked: true,
    crossOwnerInsertBlocked: true,
    sequenceBackedInsert: true,
    reorderPersisted: true,
    observerVisibleLists: observerLists.data.length,
    observerVisibleItems: observerItems.data.length,
    foreignDeleteBlocked: true,
    systemDeleteBlocked: true,
    itemCascade: true,
  }, null, 2));
} finally {
  const results = await Promise.all(createdUserIds.map((userId) => admin.auth.admin.deleteUser(userId)));
  cleanupSucceeded = results.every((result) => !result.error);
  const remaining = await admin.from('user_lists').select('*', { count: 'exact', head: true }).in('user_id', createdUserIds);
  if (remaining.error || remaining.count !== 0) cleanupSucceeded = false;
  console.log(JSON.stringify({ temporaryUsersDeleted: cleanupSucceeded, count: createdUserIds.length }));
}

if (!cleanupSucceeded) process.exitCode = 1;
