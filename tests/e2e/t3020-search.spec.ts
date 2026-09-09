import { expect, test } from '@playwright/test';
const catalog = [
  { id:110,title:'Solo Leveling',aliases:['Only I Level Up','나 혼자만 레벨업'],author:'Chugong',genre:['Action','Fantasy'],manga_type:'manhwa',status:'completed',rating:9,views:100,created_at:'2026-01-01',cover_image:null },
  { id:111,title:'Solo Leveling Ragnarok',aliases:[],author:null,genre:['Action'],manga_type:'manhwa',status:'ongoing',rating:8,views:50,created_at:'2026-01-02',cover_image:null },
  { id:112,title:'One Piece',aliases:[],author:'Eiichiro Oda',genre:['Action'],manga_type:'manga',status:'ongoing',rating:9,views:200,created_at:'2026-01-01',cover_image:null },
];
// Deterministic canonical database payload; provider endpoints always fail.
// Set T3020_REAL_CATALOG=1 to run the same acceptance against the real catalog.
let providerRequests = 0;
test.beforeEach(async ({ page }) => {
  providerRequests = 0;
  await page.route('**/api/extract/**', route => { providerRequests++; return route.fulfill({status:503,json:{error:'Provider unavailable'}}); });
  if (process.env.T3020_REAL_CATALOG) return;
  await page.route('**/rest/v1/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/mangas')) {
      const after = Number(url.searchParams.get('id')?.replace('gt.','') || 0);
      return route.fulfill({json:catalog.filter(work => work.id > after)});
    }
    if (url.pathname.endsWith('/canonical_manga_catalog')) return route.fulfill({json:{...catalog[0],canonical_id:110,cover:null,genres:catalog[0].genre,type:'manhwa',description:'Une aventure fantastique.',source_count:0,sources:[]}});
    return route.fulfill({json:[]});
  });
});
test('A exact canonical result opens canonical detail and Back restores query', async ({page}) => {
  await page.goto('/search?q=Solo+Leveling');
  const results = page.getByRole('region',{name:'Résultats Manga Wave'});
  await expect(results.getByRole('heading',{name:'Solo Leveling',exact:true})).toHaveCount(1);
  await results.getByRole('link',{name:'Découvrir Solo Leveling',exact:true}).click();
  await expect(page).toHaveURL(/\/manga\/110$/);
  await expect(page.getByRole('heading',{name:'Solo Leveling',exact:true,level:1})).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel('Rechercher un manga')).toHaveValue('Solo Leveling');
  await expect(results.getByRole('heading',{name:'Solo Leveling',exact:true})).toBeVisible();
});
test('B typo finds Solo Leveling without a provider request', async ({page}) => {
  await page.goto('/search');
  await page.getByLabel('Rechercher un manga').fill('solo levling');
  await expect(page.getByRole('heading',{name:'Solo Leveling',exact:true})).toBeVisible();
  await expect(page).toHaveURL(/q=solo\+levling/);
  expect(providerRequests).toBe(0);
});
test('C/D filters combine and survive reload, Back and Forward', async ({page}) => {
  await page.goto('/search?q=solo');
  await page.getByRole('combobox',{name:'Type',exact:true}).selectOption('manhwa');
  await page.getByRole('combobox',{name:'Statut',exact:true}).selectOption('completed');
  await page.getByRole('combobox',{name:'Genre',exact:true}).selectOption('Action');
  const results = page.getByRole('region',{name:'Résultats Manga Wave'});
  await expect(results.locator('article')).toHaveCount(1);
  await expect(results.locator('article')).toHaveAttribute('data-type','manhwa');
  await page.reload();
  await expect(page.getByRole('combobox',{name:'Type',exact:true})).toHaveValue('manhwa');
  await expect(page.getByRole('combobox',{name:'Statut',exact:true})).toHaveValue('completed');
  await expect(page.getByRole('combobox',{name:'Genre',exact:true})).toHaveValue('Action');
  await page.getByRole('button',{name:'Effacer les filtres'}).click();
  await expect(results.locator('article')).toHaveCount(2);
  await page.goBack(); await expect(page.getByRole('combobox',{name:'Genre',exact:true})).toHaveValue('Action');
  await page.goForward(); await expect(page.getByRole('combobox',{name:'Genre',exact:true})).toHaveValue('');
});
test('E provider degradation leaves canonical search usable and rejects garbage', async ({page}) => {
  await page.goto('/search?q=Solo+Leveling');
  await expect(page.getByRole('heading',{name:'Solo Leveling',exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'Résultats Manga Wave'})).not.toContainText('MangaFire');
  expect(providerRequests).toBe(0);
});
test('mobile controls, keyboard submission, empty state and optional axe', async ({page},testInfo) => {
  await page.goto('/search');
  const main = page.getByTestId('search-v2');
  await expect(main.getByText(/Saisissez un titre/)).toBeVisible();
  for (const viewport of [{width:390,height:844},{width:430,height:932}]) {
    await page.setViewportSize(viewport);
    await page.getByLabel('Rechercher un manga').fill('Solo Leveling');
    await page.getByLabel('Rechercher un manga').press('Enter');
    await expect(main.getByRole('heading',{name:'Solo Leveling',exact:true})).toBeVisible();
    expect(await main.evaluate(el=>el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const el of await main.locator('input,select,button,a').all()) {
      if (await el.isVisible()) expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({path:testInfo.outputPath(`search-${viewport.width}.png`),fullPage:true});
  }
  if (process.env.AXE_CORE_PATH) {
    await page.addScriptTag({path:process.env.AXE_CORE_PATH});
    const violations = await page.evaluate(async()=> (await (window as unknown as {axe:{run:(el:Element)=>Promise<{violations:unknown[]}>}}).axe.run(document.querySelector('[data-testid="search-v2"]')!)).violations);
    expect(violations).toEqual([]);
  }
  await page.getByLabel('Rechercher un manga').fill('zzzzzzzzzz');
  await expect(main.getByText(/Aucune œuvre ne correspond/)).toBeVisible();
});
test('canonical database failure offers retry and recovers', async ({page}) => {
  test.skip(Boolean(process.env.T3020_REAL_CATALOG), 'Synthetic database error only');
  let fail = true;
  await page.route('**/rest/v1/mangas?**',route => fail ? route.fulfill({status:503,json:{message:'Offline'}}) : route.fulfill({json: new URL(route.request().url()).searchParams.get('id') === 'gt.0' ? catalog : []}));
  await page.goto('/search?q=solo');
  await expect(page.getByRole('alert')).toContainText('indisponible');
  fail = false; await page.getByRole('button',{name:'Réessayer'}).click();
  await expect(page.getByRole('heading',{name:'Solo Leveling',exact:true})).toBeVisible();
});

test('metadata pagination loads beyond the API batch and query edits reuse the cache', async ({page}) => {
  test.skip(Boolean(process.env.T3020_REAL_CATALOG), 'Synthetic pagination catalog only');
  const many = Array.from({length:501},(_,i)=>({...catalog[0],id:i+1,title:i===500?'Last Canonical Work':`Work ${String(i+1).padStart(3,'0')}`,aliases:[]}));
  let requests=0;
  await page.route('**/rest/v1/mangas?**',route => {
    requests++;
    const after=Number(new URL(route.request().url()).searchParams.get('id')!.slice(3));
    return route.fulfill({json:many.filter(work=>work.id>after).slice(0,500)});
  });
  await page.goto('/search?q=Last+Canonical+Work');
  await expect(page.getByRole('heading',{name:'Last Canonical Work',exact:true})).toBeVisible();
  expect(requests).toBe(3);
  await page.getByLabel('Rechercher un manga').fill('Work');
  await page.getByLabel('Rechercher un manga').press('Enter');
  const results=page.getByRole('region',{name:'Résultats Manga Wave'});
  await expect(results.locator('article')).toHaveCount(24);
  await page.getByRole('button',{name:'Suivant',exact:true}).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(results.getByText('Page 2 / 21', {exact:true})).toBeVisible();
  expect(requests).toBe(3);
});
