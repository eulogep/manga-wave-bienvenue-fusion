import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * WCAG 2.1 A/AA scan of every public route with axe-core, on desktop and phone
 * widths. Signed-in pages are scanned in their signed-out state (sign-in prompt).
 * Serious and critical violations fail the run; minor/moderate ones are reported.
 */
const ROUTES: { path: string; ready: string }[] = [
  { path: '/', ready: 'main' },
  { path: '/search?browse=1', ready: '.catalogue-card' },
  { path: '/pour-toi', ready: '#onboarding-title, [data-feed-card]' },
  { path: '/collections', ready: 'a[href^="/collections/"] h2' },
  { path: '/collections/isekai', ready: '.catalogue-card' },
  { path: '/manga/88', ready: '#manga-title' },
  { path: '/trending', ready: 'main h1' },
  { path: '/ranking', ready: 'main h1' },
  { path: '/random', ready: 'main h1' },
  { path: '/library', ready: 'main h1' },
  { path: '/stats', ready: 'main h1' },
  { path: '/history', ready: 'main' },
  { path: '/auth', ready: 'form' },
  { path: '/page-inexistante', ready: 'h1' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const BLOCKING = new Set(['serious', 'critical']);

for (const viewport of VIEWPORTS) {
  for (const route of ROUTES) {
    test(`a11y ${viewport.name} ${route.path}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(route.path);
      await page.locator(route.ready).first().waitFor({ timeout: 30_000 });
      // Let lazy sections and images settle so the scan sees the real page.
      await page.waitForTimeout(800);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const summary = results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.length,
        help: violation.help,
        targets: violation.nodes.slice(0, 3).map((node) => node.target.join(' ')),
      }));
      await testInfo.attach('axe-violations.json', { body: JSON.stringify(summary, null, 2), contentType: 'application/json' });
      console.log(`AXE ${viewport.name} ${route.path} ${JSON.stringify(summary.map(({ id, impact, nodes }) => ({ id, impact, nodes })))}`);

      const blocking = summary.filter((violation) => BLOCKING.has(violation.impact || ''));
      expect(blocking, `${route.path}: ${blocking.map((violation) => `${violation.id} → ${violation.targets.join(', ')}`).join(' | ')}`).toEqual([]);
    });
  }
}
