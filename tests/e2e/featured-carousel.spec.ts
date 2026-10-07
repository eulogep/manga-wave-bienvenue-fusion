import { expect, test } from '@playwright/test';
import fs from 'node:fs';

const real = process.env.CAROUSEL_REAL === '1';
const works = Array.from({ length: 7 }, (_, i) => ({
  id: 800001 + i, title: `Œuvre canonique ${i + 1}`, aliases: [], author: 'Auteur', artist: null,
  genre: ['Action', 'Aventure'], manga_type: 'manhwa', status: 'ongoing', rating: 8.7,
  cover_image: '/favicon.ico', views: 50, created_at: '2026-01-01', content_rating: null,
  normalized_title: `oeuvre ${i+1}`, description: 'Une œuvre du catalogue.',
}));
test.beforeEach(async ({ page }) => {
  if (real) return;
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/mangas?**', route => {
    const params = new URL(route.request().url()).searchParams;
    const id = params.get('id');
    return route.fulfill({ json: id?.startsWith('eq.') ? works.filter(x=>x.id===Number(id.slice(3))) : id === 'gt.800007' ? [] : works });
  });
  await page.route('**/api/extract/**', route => route.fulfill({ status: 503, json: { error:'Fixture provider unavailable' } }));
});

for(const [width,height] of [[390,844],[430,932],[768,1024],[1440,1000]]) {
  test(`carousel ${width}x${height}: layout, navigation, a11y`, async ({page}, info) => {
    await page.setViewportSize({width,height}); await page.goto('/');
    const hero=page.locator('.mw-spotlight');
    await expect(hero.locator('.mw-spotlight-card[data-offset="0"] img')).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(await hero.locator('.mw-spotlight-card:visible').count()).toBeLessThanOrEqual(width<768?3:5);
    const title=await hero.locator('h2').innerText();
    const next=hero.getByRole('button',{name:'Œuvre suivante'});
    await next.focus(); await page.keyboard.press('ArrowRight');
    await expect(hero.locator('h2')).not.toHaveText(title);
    await expect(next).toBeFocused();
    await page.keyboard.press('ArrowLeft'); await expect(hero.locator('h2')).toHaveText(title);
    const stage=hero.getByTestId('spotlight-stage');
    await stage.evaluate(element => {
      const start = new Touch({identifier:1,target:element,clientX:280,clientY:420});
      const end = new Touch({identifier:1,target:element,clientX:100,clientY:425});
      element.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[start]}));
      element.dispatchEvent(new TouchEvent('touchend',{bubbles:true,changedTouches:[end]}));
    });
    await expect(hero.locator('h2')).not.toHaveText(title);
    await page.emulateMedia({reducedMotion:'reduce'});
    expect(await hero.locator('.mw-spotlight-card').first().evaluate(el=>parseFloat(getComputedStyle(el).transitionDuration))).toBeLessThanOrEqual(.001);
    expect(await hero.locator('.mw-spotlight-dots button[aria-current]').count()).toBe(1);
    for(const control of await hero.locator('button,.mw-spotlight-actions a').all()) {
      const box=await control.boundingBox(); if(box) expect(Math.min(box.width,box.height)).toBeGreaterThanOrEqual(44);
    }
    const axe=process.env.AXE_CORE_PATH;
    test.skip(!axe || !fs.existsSync(axe),'Set AXE_CORE_PATH to an external axe-core/axe.min.js installation');
    await page.addScriptTag({path:axe!});
    const violations=await page.evaluate(async()=> {
      const axe=(window as unknown as {axe:{run:(context:string)=>Promise<{violations:unknown[]}>}}).axe;
      return (await axe.run('.mw-spotlight')).violations;
    });
    expect(violations).toEqual([]);
    if (real) await expect.poll(() => hero.locator('.mw-spotlight-card[data-offset="0"] img')
      .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0 && !img.src.includes('unsplash.com')), {timeout:30000}).toBe(true);
    await page.screenshot({path:info.outputPath(`carousel-${width}.png`)});
    await expect(hero.getByRole('link',{name:'Lire maintenant'})).toHaveAttribute('href',/^\/manga\/\d+\?read=1$/);
    await hero.getByRole('link',{name:'Voir la fiche',exact:true}).click();
    await expect(page).toHaveURL(/\/manga\/\d+$/);
  });
}
test('read intent preserves canonical detail when no source is available',async({page})=>{
  test.skip(real,'Controlled outage fixture');
  await page.goto('/'); await page.locator('.mw-spotlight-read').click();
  await expect(page).toHaveURL('/manga/800001?read=1');
  await expect(page.getByTestId('manga-detail-v2')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Aucun chapitre disponible'})).toBeVisible();
});
test('Read enters Reader through the existing canonical P1 mapping',async({page})=>{
  test.skip(real,'Controlled provider mapping fixture');
  await page.route('**/rest/v1/manga_source_mappings**', route=>route.fulfill({json:[{
    manga_id:800001,source_id:'originmanga',source_manga_id:'canonical-qa',available:true,language:'fr',
  }]}));
  await page.route('**/api/extract/detail/originmanga/canonical-qa',route=>route.fulfill({json:{manga:{
    id:'canonical-qa',title:works[0].title,coverUrl:null,author:'Auteur',status:'ongoing',genres:[],synopsis:'Fixture',
    chapters:[{id:'chapter-2',chapterNumber:'2',title:'Suite',date:'2026-01-01',url:''},{id:'chapter-1',chapterNumber:'1',title:'Début',date:'2026-01-01',url:''}],
  }}}));
  await page.goto('/');await page.locator('.mw-spotlight-read').click();
  await expect(page).toHaveURL(/\/read\/originmanga\/canonical-qa\/chapter-1\?/);
  expect(new URL(page.url()).searchParams.get('lang')).toBe('fr');
});
test('read intent cannot bypass the adult gate',async({page})=>{
  test.skip(real,'Controlled adult fixture');
  await page.route('**/rest/v1/mangas?**',route=>route.fulfill({json:[{...works[0],content_rating:'erotica'}]}));
  await page.goto('/manga/800001?read=1');
  await expect(page.getByText(/réservé aux adultes|contenu adulte|18\+/i).first()).toBeVisible();
  await expect(page).toHaveURL('/manga/800001?read=1');
});
