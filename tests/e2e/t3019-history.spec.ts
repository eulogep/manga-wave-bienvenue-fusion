import crypto from 'node:crypto';
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')]; }));
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.API_KEY_ANONYME_SUPABASE;
const admin = createClient(url, env.API_KEY_SERVICE_SUPABASE || env.API_KEY_SECRET_SUPABASE, { auth: { persistSession: false, autoRefreshToken: false } });
const ids: string[] = [];
async function account() {
  const email = `codex-t3019-${crypto.randomUUID()}@example.invalid`;
  const password = `T3019-${crypto.randomBytes(18).toString('hex')}!`;
  const { data, error } = await admin.auth.admin.createUser({email,password,email_confirm:true});
  if(error) throw error;
  const id = data.user.id; ids.push(id);
  const client = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const login = await client.auth.signInWithPassword({email,password}); if(login.error) throw login.error;
  return { id, email, password, client };
}
async function checked<T>(result: {data: T; error: {message:string}|null}) { if(result.error) throw new Error(result.error.message); return result.data; }
test.afterEach(async () => {
  for (const id of [...ids]) {
    let result = await admin.auth.admin.deleteUser(id);
    for (let attempt = 0; result.error?.name === 'AuthRetryableFetchError' && attempt < 2; attempt++) {
      result = await admin.auth.admin.deleteUser(id);
    }
    if (result.error) throw result.error;
    ids.splice(ids.indexOf(id), 1);
  }
});
const progress = (id:string, manga=110, chapter='3', at=new Date().toISOString(), page=0) => ({
  user_id:id,canonical_key:`qa:${manga}`,canonical_manga_id:manga,canonical_chapter_key:chapter,
  chapter_number:chapter,last_provider:'originmanga',last_provider_manga_id:'656de8df-4b6c-483a-b1e0-4fe0aee8eafb',last_provider_chapter_id:`fixture-${chapter}`,
  language:'fr',manga_title: manga === 110 ? 'Solo Leveling':'Pick Me Up, Infinite Gacha',page_index:page,total_pages:6,progress_percentage:Math.round((page+1)/6*100),read_at:at,
});

test('real Supabase ownership, session coalescing, chronology, pagination and deletion isolation', async ({ page }) => {
  const owner=await account(), observer=await account();
  const put=async (row:ReturnType<typeof progress>) => checked(await owner.client.from('user_canonical_reading_progress').upsert(row,{onConflict:'user_id,canonical_key'}));
  const rows=async()=>checked(await owner.client.from('user_reading_history').select('*').order('read_at',{ascending:false}));
  const base=Date.now()-40*86400000;
  for(let i=0;i<5;i++) await put(progress(owner.id,110,'3',new Date(base+i*60000).toISOString(),i));
  expect(await rows()).toHaveLength(1);
  expect((await rows())[0].page_index).toBe(4);
  await put({...progress(owner.id,110,'3',new Date(base+5*60000).toISOString(),2),last_provider:'asurascans',last_provider_manga_id:'other-context',last_provider_chapter_id:'other-chapter'});
  expect(await rows()).toHaveLength(1);
  expect((await rows())[0].canonical_manga_id).toBe(110);
  expect((await rows())[0].manga_title).toBe('Solo Leveling');
  for(let i=1;i<=26;i++) await put(progress(owner.id,110,'3',new Date(base+i*86400000).toISOString(),1));
  expect(await rows()).toHaveLength(27);
  await put(progress(owner.id,145,'10',new Date(Date.now()-10000).toISOString(),1));
  await put(progress(owner.id,110,'4',new Date().toISOString(),0));
  const all=await rows(); expect(all.slice(0,3).map(r=>r.chapter_number)).toEqual(['4','10','3']);
  expect(await checked(await observer.client.from('user_reading_history').select('*').eq('user_id',owner.id))).toHaveLength(0);
  expect(await checked(await observer.client.from('user_reading_history').delete().eq('id',all[0].id).select())).toHaveLength(0);
  const forbidden=await owner.client.from('user_reading_history').insert({...all[0],id:undefined,user_id:observer.id}); expect(forbidden.error).toBeTruthy();
  await checked(await observer.client.from('user_canonical_reading_progress').upsert(progress(observer.id)));
  await checked(await owner.client.from('user_favorites').insert({user_id:owner.id,manga_id:110}));
  await checked(await owner.client.from('user_follows').insert({user_id:owner.id,canonical_manga_id:110}));
  await page.goto('/auth'); await page.getByLabel('Email').fill(owner.email); await page.getByLabel('Mot de passe').fill(owner.password); await page.getByRole('button',{name:'Se connecter',exact:true}).click(); await expect(page).toHaveURL(/\/$/);
  await page.goto('/history'); await expect(page.getByTestId('history-entry')).toHaveCount(25);
  await page.getByRole('button',{name:'Charger les lectures précédentes'}).click(); await expect(page.getByTestId('history-entry')).toHaveCount(29);
  await expect(page.getByTestId('history-entry').first()).toContainText('Chapitre 4');
  await page.getByRole('button',{name:'7 derniers jours',exact:true}).click(); await expect(page.getByTestId('history-entry')).toHaveCount(2);
  await page.getByLabel('Rechercher dans l’historique').fill('Pick Me Up'); await expect(page.getByTestId('history-entry')).toHaveCount(1);
  await page.getByLabel('Rechercher dans l’historique').fill('nothing-matches'); await expect(page.getByText('Aucune lecture ne correspond à ces filtres.')).toBeVisible();
  await page.getByLabel('Rechercher dans l’historique').fill('');
  await page.getByRole('button',{name:'Tous',exact:true}).click();
  for(const viewport of [{width:390,height:844},{width:430,height:932}]) {
    await page.setViewportSize(viewport);
    const main=page.getByTestId('history-page');
    expect(await main.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    for(const button of await main.getByRole('button').all()) { if(await button.isVisible()) { const box=await button.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(44); } }
  }
  const saved=await checked(await owner.client.from('user_canonical_reading_progress').select('*').order('canonical_key'));
  await page.getByRole('button',{name:'Supprimer la lecture de Solo Leveling, chapitre 4',exact:true}).click(); await expect(page.getByTestId('history-entry')).toHaveCount(28);
  expect(await rows()).toHaveLength(28);
  await page.getByRole('button',{name:'Effacer l’historique',exact:true}).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button',{name:'Annuler',exact:true}).click(); expect(await rows()).toHaveLength(28);
  await page.getByRole('button',{name:'Effacer l’historique',exact:true}).click(); await page.getByRole('button',{name:'Confirmer la suppression',exact:true}).click();
  await expect(page.getByText('Aucune lecture dans ton historique pour le moment.')).toBeVisible();
  expect(await checked(await owner.client.from('user_canonical_reading_progress').select('*').order('canonical_key'))).toEqual(saved);
  expect(await checked(await owner.client.from('user_favorites').select('*'))).toHaveLength(1);
  expect(await checked(await owner.client.from('user_follows').select('*'))).toHaveLength(1);
  expect(await checked(await observer.client.from('user_reading_history').select('*'))).toHaveLength(1);
  await page.goto('/library'); await expect(page.locator('article',{hasText:'Solo Leveling'})).toHaveCount(1);
});

test('Reader writes history without favorite/follow, source switch coalesces, exact reopen survives history clear', async ({page}) => {
  const owner=await account();
  const mappings=await checked(await admin.from('manga_source_mappings').select('manga_id,source_id,source_manga_id').in('manga_id',[154,145]));
  const a=mappings.find(m=>m.manga_id===154&&m.source_id==='originmanga')!;
  const asura=mappings.find(m=>m.manga_id===154&&m.source_id==='asurascans')!;
  const b=mappings.find(m=>m.manga_id===145&&m.source_id==='asurascans')!;
  expect(a&&asura&&b).toBeTruthy();
  // Controlled chapter/page payloads; identities and canonical resolution use real catalog mappings.
  await page.route('**/api/extract/detail/**', async route=>{
    const path=new URL(route.request().url()).pathname; const m=mappings.find(m=>path.endsWith(`/${m.source_id}/${encodeURIComponent(m.source_manga_id)}`));
    if(!m) return route.continue();
    await route.fulfill({json:{manga:{id:m.source_manga_id,title:m.manga_id===154?'Chronicles of the Demon Faction':'Pick Me Up, Infinite Gacha',coverUrl:null,author:null,status:'ongoing',genres:[],synopsis:'',chapters:['3','4','10'].map(n=>({id:`history-${m.manga_id}-${n}`,chapterNumber:n,title:null,date:new Date().toISOString(),language:m.source_id==='originmanga'?'fr':'en',url:''}))}}});
  });
  const svg='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="#345"/></svg>');
  await page.route('**/api/extract/pages/**',route=>route.fulfill({json:{images:Array.from({length:6},()=>svg)}}));
  await page.goto('/auth'); await page.getByLabel('Email').fill(owner.email); await page.getByLabel('Mot de passe').fill(owner.password); await page.getByRole('button',{name:'Se connecter',exact:true}).click(); await expect(page).toHaveURL(/\/$/);
  const rows=async()=>checked(await owner.client.from('user_reading_history').select('*').order('read_at',{ascending:false}));
  const read=async(m:typeof a,n:string,p:number)=>{
    await page.goto(`/read/${m.source_id}/${encodeURIComponent(m.source_manga_id)}/history-${m.manga_id}-${n}?lang=${m.source_id==='originmanga'?'fr':'en'}&page=${p}&title=${encodeURIComponent(m.manga_id===154?'Chronicles of the Demon Faction':'Pick Me Up, Infinite Gacha')}`);
    await expect(page.getByText(`Page ${p+1} / 6`)).toBeVisible();
    await expect.poll(async()=> (await rows()).find(r=>r.canonical_manga_id===m.manga_id&&r.canonical_chapter_key===n)?.page_index).toBe(p);
  };
  for(let p=0;p<5;p++) await read(asura,'3',p);
  expect(await rows()).toHaveLength(1);
  await read(a,'3',3); expect(await rows()).toHaveLength(1);
  await read(b,'10',1); await read(a,'4',0);
  await page.goto('/history'); await expect(page.getByTestId('history-entry')).toHaveCount(3);
  expect((await rows()).map(r=>r.chapter_number)).toEqual(['4','10','3']);
  expect(await checked(await owner.client.from('user_favorites').select('*'))).toHaveLength(0);
  expect(await checked(await owner.client.from('user_follows').select('*'))).toHaveLength(0);
  await checked(await owner.client.from('user_follows').insert({user_id:owner.id,canonical_manga_id:154}));
  await checked(await owner.client.from('user_followed_chapter_state').insert(['3','4','10'].map(n=>({
    user_id:owner.id,manga_id:154,canonical_chapter_key:n,chapter_number:n,provider:'originmanga',provider_manga_id:a.source_manga_id,provider_chapter_id:`history-154-${n}`,language:'fr',read_at:n==='4'?null:new Date().toISOString(),
  }))));
  await page.reload(); await expect(page.getByTestId('notification-badge')).toHaveText('1');
  await page.getByTestId('notification-bell').click(); await page.getByTestId('notification-item').click();
  await expect(page.getByText('Page 1 / 6')).toBeVisible();
  await expect.poll(async()=> (await checked(await owner.client.from('user_followed_chapter_state').select('*').is('read_at',null))).length).toBe(0);
  expect((await checked(await owner.client.from('user_notifications').select('*'))).every(r=>r.is_read)).toBe(true);
  expect(await rows()).toHaveLength(3);
  await page.goto('/library'); await page.getByRole('tab',{name:/Nouveautés/}).click(); await expect(page.locator('article',{hasText:'Chronicles of the Demon Faction'})).toHaveCount(0);
  await page.goto('/history');
  await page.getByRole('button',{name:'Rouvrir Chronicles of the Demon Faction au chapitre 3, page 4',exact:true}).click();
  await expect(page).toHaveURL(/history-154-3\?.*page=3/); await expect(page.getByText('Page 4 / 6')).toBeVisible();
  await expect(page.getByRole('img',{name:'Page 4',exact:true})).toBeVisible();
  await expect.poll(async()=> (await rows())[0].chapter_number).toBe('3');
  expect(await rows()).toHaveLength(3);
  expect(await checked(await owner.client.from('user_favorites').select('*'))).toHaveLength(0);
  expect(await checked(await owner.client.from('user_follows').select('*'))).toHaveLength(1);
  await page.goto('/history'); await page.getByRole('button',{name:'Effacer l’historique',exact:true}).click(); await page.getByRole('button',{name:'Confirmer la suppression',exact:true}).click(); await expect(page.getByTestId('history-entry')).toHaveCount(0);
  await page.goto('/library'); await page.getByRole('tab',{name:/En cours/}).click(); await page.getByRole('link',{name:'Reprendre Chronicles of the Demon Faction au chapitre 3',exact:true}).click();
  await expect(page.getByText('Page 4 / 6')).toBeVisible();
  await expect.poll(async()=> (await rows()).length).toBe(1);
});

test('History UI fixture: loading, error, search, pagination, mobile, keyboard and confirmed deletion', async ({ page }, testInfo) => {
  const owner=await account();
  let data=Array.from({length:29},(_,i)=>({id:i+1,user_id:owner.id,canonical_manga_id:i%2?145:110,canonical_chapter_key:String(i+1),chapter_number:String(i+1),manga_title:i%2?'Pick Me Up':'Solo Leveling',manga_author:null,cover_image:null,page_index:1,total_pages:6,provider:'originmanga',provider_manga_id:'fixture',provider_chapter_id:'fixture',language:'fr',started_at:new Date(Date.now()-i*86400000).toISOString(),read_at:new Date(Date.now()-i*86400000).toISOString(),updated_at:new Date().toISOString()}));
  let failed=false;
  let deletes=0;
  await page.route('**/rest/v1/user_reading_history*',async route=>{
    const request=route.request(); const params=new URL(request.url()).searchParams;
    if(request.method()==='DELETE') { deletes++; const id=params.get('id'); data=id?data.filter(r=>r.id!==Number(id.slice(3))):[]; return route.fulfill({status:204}); }
    if(failed) return route.fulfill({status:503,json:{message:'Fixture offline'}});
    const q=params.get('manga_title')?.slice(6).replaceAll('%','').toLowerCase() || '';
    const since=params.get('read_at')?.slice(4);
    const filtered=data.filter(r=>r.manga_title.toLowerCase().includes(q)&&(!since||r.read_at>=since));
    const start=Number(params.get('offset')||0),limit=Number(params.get('limit')||25);
    return route.fulfill({json:filtered.slice(start,start+limit)});
  });
  await page.goto('/auth'); await page.getByLabel('Email').fill(owner.email); await page.getByLabel('Mot de passe').fill(owner.password); await page.getByRole('button',{name:'Se connecter',exact:true}).click(); await expect(page).toHaveURL(/\/$/);
  await page.goto('/history'); await expect(page.getByTestId('history-entry')).toHaveCount(25);
  await page.getByRole('button',{name:'Charger les lectures précédentes'}).click(); await expect(page.getByTestId('history-entry')).toHaveCount(29);
  await page.getByLabel('Rechercher dans l’historique').fill('Pick Me Up'); await expect(page.getByTestId('history-entry')).toHaveCount(14);
  await page.getByLabel('Rechercher dans l’historique').fill('missing'); await expect(page.getByText('Aucune lecture ne correspond à ces filtres.')).toBeVisible();
  await page.getByLabel('Rechercher dans l’historique').fill('');
  await page.getByRole('button',{name:'Aujourd’hui',exact:true}).click(); await expect(page.getByTestId('history-entry')).toHaveCount(1);
  await page.getByRole('button',{name:'7 derniers jours',exact:true}).click(); await expect(page.getByTestId('history-entry')).toHaveCount(7);
  await page.getByRole('button',{name:'30 derniers jours',exact:true}).click(); await expect(page.getByTestId('history-entry')).toHaveCount(25);
  for(const viewport of [{width:390,height:844},{width:430,height:932}]) {
    await page.setViewportSize(viewport);const main=page.getByTestId('history-page');
    expect(await main.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    for(const button of await main.getByRole('button').all()) { if(await button.isVisible()) { const box=await button.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.width).toBeGreaterThanOrEqual(44); } }
    await page.screenshot({path:testInfo.outputPath(`history-${viewport.width}.png`)});
  }
  if(process.env.AXE_CORE_PATH) {
    await page.addScriptTag({path:process.env.AXE_CORE_PATH});
    const axe=await page.evaluate(async()=> {
      const engine=(window as unknown as {axe:{run:(context:unknown)=>Promise<{violations:Array<{id:string;nodes:unknown[]}>}>}}).axe;
      return engine.run(document.querySelector('[data-testid="history-page"]'));
    });
    await testInfo.attach('history-axe',{body:JSON.stringify(axe),contentType:'application/json'});
    expect(axe.violations).toEqual([]);
  }
  const clear=page.getByRole('button',{name:'Effacer l’historique',exact:true});
  await clear.focus(); await page.keyboard.press('Enter'); await expect(page.getByRole('alertdialog')).toBeVisible();
  await expect(page.getByRole('button',{name:'Annuler',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'Annuler',exact:true}).press('Escape');
  await expect(page.getByRole('alertdialog')).toHaveCount(0); await expect(clear).toBeFocused(); expect(deletes).toBe(0);
  await clear.click(); await page.getByRole('button',{name:'Confirmer la suppression',exact:true}).click(); await expect(page.getByRole('alertdialog')).toHaveCount(0);expect(deletes).toBe(1);
  await page.getByRole('button',{name:'Tous',exact:true}).click(); await expect(page.getByText('Aucune lecture dans ton historique pour le moment.')).toBeVisible();
  failed=true; await page.reload(); await expect(page.getByText('Historique indisponible.',{exact:true})).toBeVisible();
  failed=false; await page.getByRole('button',{name:'Réessayer'}).click(); await expect(page.getByText('Aucune lecture dans ton historique pour le moment.')).toBeVisible();
});
