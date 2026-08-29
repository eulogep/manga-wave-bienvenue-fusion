import { expect, test, type Locator, type Page } from '@playwright/test';

const READER_PATH = '/read/asurascans/solo-leveling-b57aa235/%2Fcomics%2Fsolo-leveling-b57aa235%2Fchapter%2F5?lang=en&page=0';

async function revealChrome(page: Page, cycle = 0) {
  await page.mouse.move(320 + cycle * 80, 280 + cycle * 40);
}

async function expectPointerReachable(page: Page, control: Locator) {
  await expect(control).toBeVisible();
  await expect.poll(() => control.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');

  const box = await control.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeLessThan(viewport!.height);
  expect(box!.y + box!.height).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThanOrEqual(32);

  const hitBelongsToControl = await control.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return Boolean(hit && (hit === element || element.contains(hit)));
  });
  expect(hitBelongsToControl).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.goto(READER_PATH, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/Page 1 \/ 26/)).toBeVisible({ timeout: 60_000 });
});

test('real pointer navigation changes indicator, URL and rendered AsuraScans page', async ({ page }) => {
  const next = page.getByRole('button', { name: /page suivante/i });
  const previous = page.getByRole('button', { name: /page précédente/i });
  const firstImage = page.getByRole('img', { name: 'Page 1' });
  const firstSource = await firstImage.getAttribute('src');

  await revealChrome(page);
  await expectPointerReachable(page, next);
  await next.click();
  await expect(page.getByText(/Page 2 \/ 26/)).toBeVisible();
  await expect(page).toHaveURL(/(?:\?|&)page=1(?:&|$)/);
  const secondImage = page.getByRole('img', { name: 'Page 2' });
  await expect(secondImage).toBeVisible();
  expect(await secondImage.getAttribute('src')).not.toBe(firstSource);

  await next.click();
  await expect(page.getByText(/Page 3 \/ 26/)).toBeVisible();
  await expect(page).toHaveURL(/(?:\?|&)page=2(?:&|$)/);
  await expect(page.getByRole('img', { name: 'Page 3' })).toBeVisible();

  await previous.click();
  await expect(page.getByText(/Page 2 \/ 26/)).toBeVisible();
  await expect(page).toHaveURL(/(?:\?|&)page=1(?:&|$)/);
  await expect(secondImage).toBeVisible();
});

test('Settings is pointer reachable, mounts its dialog and exposes source selection', async ({ page }) => {
  const settings = page.getByRole('button', { name: /ouvrir les réglages du lecteur/i });
  await revealChrome(page);
  await expectPointerReachable(page, settings);
  await settings.click();

  const dialog = page.getByRole('dialog', { name: /réglages du lecteur/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Ajustement')).toBeVisible();
  await expect(dialog.getByText('Sources')).toBeVisible();
  await expect(dialog.getByText('AsuraScans', { exact: false })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /OriginManga/i })).toBeVisible({ timeout: 60_000 });

  await dialog.getByRole('button', { name: /fermer les réglages/i }).click();
  await expect(dialog).toBeHidden();
});

test('manual source switch preserves logical chapter 5 and current page', async ({ page }) => {
  await revealChrome(page);
  await page.getByRole('button', { name: /page suivante/i }).click();
  await expect(page).toHaveURL(/(?:\?|&)page=1(?:&|$)/);

  await revealChrome(page, 1);
  await page.getByRole('button', { name: /ouvrir les réglages du lecteur/i }).click();
  const dialog = page.getByRole('dialog', { name: /réglages du lecteur/i });
  const originManga = dialog.getByRole('button', { name: /OriginManga/i });
  await expect(originManga).toBeVisible({ timeout: 60_000 });
  await originManga.click();

  await expect(page).toHaveURL(/\/read\/originmanga\//i);
  await expect(page).toHaveURL(/(?:\?|&)page=1(?:&|$)/);
  expect(decodeURIComponent(page.url())).not.toMatch(/chapter(?:-|\/)?1(?:\?|$)/i);
  await expect(page.getByText(/Page 2 \/ \d+/)).toBeVisible({ timeout: 60_000 });
});

test('Reader chrome hides and becomes pointer reachable again for three cycles', async ({ page }) => {
  const toolbar = page.locator('[data-reader-chrome="top"]');
  const controls = page.locator('[data-reader-chrome="bottom"]');
  const settings = page.getByRole('button', { name: /ouvrir les réglages du lecteur/i });
  const next = page.getByRole('button', { name: /page suivante/i });

  for (let cycle = 0; cycle < 3; cycle += 1) {
    await revealChrome(page, cycle);
    await expectPointerReachable(page, settings);
    await expectPointerReachable(page, next);
    await page.waitForTimeout(2_650);
    await expect.poll(() => toolbar.evaluate((element) => getComputedStyle(element).opacity)).toBe('0');
    await expect.poll(() => controls.evaluate((element) => getComputedStyle(element).opacity)).toBe('0');
    await expect(toolbar).toHaveCSS('pointer-events', 'none');
    await expect(controls).toHaveCSS('pointer-events', 'none');
  }
});
