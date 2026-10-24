import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildChromeUserAgent,
  parseScantradCookies,
  resolveScantradBrowserConfig,
} from '../dist/lib/scantrad-browser-config.js';
import {
  createScantradPage,
} from '../dist/lib/browser-pool.js';

test('browser pool exposes the dedicated persistent Scantrad page factory', () => {
  assert.equal(typeof createScantradPage, 'function');
});

test('Scantrad uses a persistent project-local profile by default', () => {
  const config = resolveScantradBrowserConfig({}, '/repo/server');

  assert.equal(config.userDataDir, '/repo/server/.playwright_user_data/scantrad');
  assert.equal(config.headless, true);
  assert.equal(config.proxy, undefined);
  assert.equal(config.cdpUrl, undefined);
});

test('Scantrad accepts only a loopback CDP endpoint', () => {
  const config = resolveScantradBrowserConfig({
    SCANTRAD_CDP_URL: 'http://127.0.0.1:9222',
  }, '/repo/server');
  assert.equal(config.cdpUrl, 'http://127.0.0.1:9222');

  assert.throws(
    () => resolveScantradBrowserConfig({ SCANTRAD_CDP_URL: 'http://browser.example:9222' }, '/repo/server'),
    /CDP.*local/i,
  );
});

test('a stable Chrome user agent is built without the HeadlessChrome marker', () => {
  const userAgent = buildChromeUserAgent('darwin', '151.0.7922.34');

  assert.match(userAgent, /Chrome\/151\.0\.7922\.34/);
  assert.doesNotMatch(userAgent, /HeadlessChrome/);
});

test('Scantrad proxy credentials are configured explicitly', () => {
  const config = resolveScantradBrowserConfig({
    SCANTRAD_PROXY_SERVER: 'http://proxy.example:8080',
    SCANTRAD_PROXY_USERNAME: 'proxy-user',
    SCANTRAD_PROXY_PASSWORD: 'proxy-password',
  }, '/repo/server');

  assert.deepEqual(config.proxy, {
    server: 'http://proxy.example:8080',
    username: 'proxy-user',
    password: 'proxy-password',
  });
});

test('proxy credentials without a proxy server are rejected', () => {
  assert.throws(
    () => resolveScantradBrowserConfig({ SCANTRAD_PROXY_USERNAME: 'orphan' }, '/repo/server'),
    /SCANTRAD_PROXY_SERVER/,
  );
});

test('SOCKS5 proxy authentication is rejected', () => {
  assert.throws(
    () => resolveScantradBrowserConfig({
      SCANTRAD_PROXY_SERVER: 'socks5://proxy.example:1080',
      SCANTRAD_PROXY_USERNAME: 'proxy-user',
      SCANTRAD_PROXY_PASSWORD: 'proxy-password',
    }, '/repo/server'),
    /SOCKS5.*identifiants/i,
  );
});

test('proxy credentials embedded in the server URL are rejected', () => {
  assert.throws(
    () => resolveScantradBrowserConfig({
      SCANTRAD_PROXY_SERVER: 'http://proxy-user:proxy-password@proxy.example:8080',
    }, '/repo/server'),
    /intégrés.*URL/i,
  );
});

test('serverless default profile uses a writable process-unique temporary directory', () => {
  const config = resolveScantradBrowserConfig({ VERCEL: '1' }, '/var/task/server');

  assert.equal(config.userDataDir, path.join(tmpdir(), `scantrad-${process.pid}`));
});

test('cookie injection accepts only Scantrad cookies', () => {
  const cookies = parseScantradCookies(JSON.stringify([
    {
      name: 'cf_clearance',
      value: 'clearance-token',
      domain: '.manga-scantrad.io',
      path: '/',
      expires: 2_000_000_000,
      httpOnly: true,
      secure: true,
      sameSite: 'None',
    },
  ]));

  assert.equal(cookies.length, 1);
  assert.equal(cookies[0].name, 'cf_clearance');
  assert.equal(cookies[0].domain, '.manga-scantrad.io');
});

test('cookie injection rejects cookies for another domain', () => {
  assert.throws(
    () => parseScantradCookies(JSON.stringify([
      { name: 'cf_clearance', value: 'token', domain: '.example.com', path: '/' },
    ])),
    /manga-scantrad\.io/,
  );
});

test('cookie injection rejects an empty cookie name', () => {
  assert.throws(
    () => parseScantradCookies(JSON.stringify([
      { name: '   ', value: 'token', domain: '.manga-scantrad.io', path: '/' },
    ])),
    /name.*vide/i,
  );
});

test('cookie injection requires exactly one addressing mode', () => {
  assert.throws(
    () => parseScantradCookies(JSON.stringify([
      {
        name: 'cf_clearance',
        value: 'token',
        url: 'https://manga-scantrad.io/',
        domain: '.manga-scantrad.io',
        path: '/',
      },
    ])),
    /url.*domain.*path/i,
  );
  assert.throws(
    () => parseScantradCookies(JSON.stringify([
      { name: 'cf_clearance', value: 'token', url: 'https://manga-scantrad.io/', path: '/' },
    ])),
    /url.*domain.*path/i,
  );
});

test('cookie injection requires a non-empty path with domain addressing', () => {
  for (const cookie of [
    { name: 'cf_clearance', value: 'token', domain: '.manga-scantrad.io' },
    { name: 'cf_clearance', value: 'token', domain: '.manga-scantrad.io', path: '' },
  ]) {
    assert.throws(
      () => parseScantradCookies(JSON.stringify([cookie])),
      /domain.*path/i,
    );
  }
});

test('cookie injection validates Playwright expiry bounds', () => {
  const cookie = {
    name: 'cf_clearance',
    value: 'token',
    domain: '.manga-scantrad.io',
    path: '/',
  };

  for (const expires of [-2, 253_402_300_800, '2000000000']) {
    assert.throws(
      () => parseScantradCookies(JSON.stringify([{ ...cookie, expires }])),
      /expires/i,
    );
  }

  for (const expires of [-1, 0, 253_402_300_799]) {
    const [parsed] = parseScantradCookies(JSON.stringify([{ ...cookie, expires }]));
    assert.equal(parsed.expires, expires);
  }
});
