import { expect, test } from '@playwright/test';

const real = process.env.CATALOGUE_REAL === '1';
const works = Array.from({length:14},(_,index)=>({
  id:900001+index,title:`Catalogue QA ${index+1}`,aliases:[],author:'Auteur QA',
  genre:[index%2 ? 'Romance' : 'Fantasy','Action'],manga_type:'manga',status:'ongoing',
  rating:8,views:0,created_at:'2026-01-01',cover_image:'/favicon.ico',content_rating:null,
}));
test.beforeEach(async({page})=>{
  if(real) return;
  await page.route('**/rest/v1/**',route=>{
    const url=new URL(route.request().url());
    const after=Number(url.searchParams.get('id')?.replace('gt.','')||0);
    return route.fulfill({json:url.pathname.endsWith('/mangas')?works.filter(work=>work.id>after):[]});
  });
});

for(const [width,height] of [[390,844],[430,932],[768,1024],[1440,1100]]) {
  test(`editorial catalogue ${width}: overflow, views, accessibility`,async({page},info)=>{
    await page.setViewportSize({width,height});await page.goto('/search?browse=1');
    const main=page.getByTestId('search-v2');
    await expect(main.locator('.catalogue-card').first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const columns=await main.locator('.catalogue-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(width<768?2:width<1280?3:5);
    const order=await main.locator('.catalogue-card h3').allTextContents();
    await main.getByRole('button',{name:'Vue liste'}).click();
    await expect(main.locator('.catalogue-grid')).toHaveClass(/catalogue-list/);
    expect(await main.locator('.catalogue-card h3').allTextContents()).toEqual(order);
    await main.getByRole('button',{name:'Vue grille'}).click();
    await page.emulateMedia({reducedMotion:'reduce'});
    expect(await main.locator('.catalogue-card img').first().evaluate(el=>parseFloat(getComputedStyle(el).transitionDuration))).toBeLessThanOrEqual(.001);
    for(const element of await main.locator('button,a,input,select').all()) if(await element.isVisible()) {
      expect((await element.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect(process.env.AXE_CORE_PATH,'AXE_CORE_PATH must point to axe.min.js').toBeTruthy();
    await page.addScriptTag({path:process.env.AXE_CORE_PATH!});
    const violations=await page.evaluate(async()=>{
      const axe=(window as unknown as {axe:{run:(context:string)=>Promise<{violations:unknown[]}>}}).axe;
      return (await axe.run('[data-testid="search-v2"]')).violations;
    });
    expect(violations).toEqual([]);
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:info.outputPath(`catalogue-${width}.png`)});
    await expect(main.getByRole('link',{name:'Découvrir la série'})).toHaveAttribute('href',/^\/manga\/\d+$/);
  });
}
test('mood maps to real genre; filter chip removes it; featured navigates canonically',async({page})=>{
  test.skip(real,'Controlled genre fixture');
  await page.goto('/search?browse=1');
  await page.getByRole('complementary',{name:'Explorer par ambiance'}).getByRole('button',{name:'Fantastique'}).click();
  await expect(page).toHaveURL(/genre=Fantasy/);
  await expect(page.getByRole('combobox',{name:'Genre',exact:true})).toHaveValue('Fantasy');
  await expect(page.locator('.catalogue-card')).toHaveCount(7);
  await page.getByRole('button',{name:'Retirer le genre Fantasy'}).click();
  await expect(page.locator('.catalogue-card')).toHaveCount(14);
  await page.getByRole('link',{name:'Découvrir la série'}).focus();await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/manga\/900001$/);
});
test('empty results retain a functional Random discovery link',async({page})=>{
  await page.goto('/search?q=zzzzzzzzzzzzzzz');
  await expect(page.getByRole('link',{name:'Surprise-moi'})).toHaveAttribute('href','/random');
  await page.getByRole('link',{name:'Surprise-moi'}).click();await expect(page).toHaveURL(/\/random/);
});
test('sort keeps canonical order and is restored from the URL',async({page})=>{
  test.skip(real,'Controlled ordering fixture');
  await page.goto('/search?browse=1');
  await page.getByRole('combobox',{name:'Trier par'}).selectOption('az');
  await expect(page).toHaveURL(/sort=az/);
  const before=await page.locator('.catalogue-card h3').allTextContents();
  expect(before.length).toBe(14);
  await page.reload();await expect(page.getByRole('combobox',{name:'Trier par'})).toHaveValue('az');
  await expect(page.locator('.catalogue-card')).toHaveCount(14);
  expect(await page.locator('.catalogue-card h3').allTextContents()).toEqual(before);
});
