import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8')) as {
  name: string;
  start_url: string;
  scope: string;
  display: string;
  icons: Array<{ src: string; sizes: string; purpose: string }>;
};
const serviceWorker = fs.readFileSync('public/sw.js', 'utf8');
const entrypoint = fs.readFileSync('src/main.tsx', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

const pngDimensions = (path: string) => {
  const png = fs.readFileSync(path);
  assert.equal(png.toString('ascii', 1, 4), 'PNG');
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
};

test('manifest exposes an installable Manga Wave application with valid icons', () => {
  assert.equal(manifest.name, 'Manga Wave');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.deepEqual(pngDimensions('public/icons/manga-wave-192.png'), { width: 192, height: 192 });
  assert.deepEqual(pngDimensions('public/icons/manga-wave-512.png'), { width: 512, height: 512 });
  assert.equal(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose.includes('maskable')), true);
});

test('application registers the worker and exposes the manifest in document metadata', () => {
  assert.match(entrypoint, /registerPwa\(\)/);
  assert.match(index, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(index, /name="theme-color" content="#06101a"/);
  assert.match(index, /<html lang="fr">/);
  assert.match(index, /<title>Manga Wave/);
  assert.doesNotMatch(index, /Lovable Generated Project|lovable\.dev/);
});

test('offline cache is restricted to the public shell and excludes APIs and reading content', () => {
  assert.match(serviceWorker, /request\.mode === 'navigate'/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\('\/assets\/'\)/);
  assert.match(serviceWorker, /cacheShellAssets/);
  assert.match(serviceWorker, /trimAssetCache/);
  assert.match(serviceWorker, /key\.startsWith\(CACHE_PREFIX\)/);
  assert.doesNotMatch(serviceWorker, /cache\.put\([^\n]*(\/api\/|mangadex|chapter|read)/i);
  assert.doesNotMatch(serviceWorker, /caches\.match\([^\n]*ignoreSearch/);
});
