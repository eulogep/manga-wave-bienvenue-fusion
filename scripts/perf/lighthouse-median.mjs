#!/usr/bin/env node
// Lighthouse protocol used for Manga Wave performance claims: mobile profile,
// performance category, N runs per URL, median reported (single runs are too noisy).
//   node scripts/perf/lighthouse-median.mjs http://localhost:4173 / /search?browse=1 --runs 3
// Serve a production build first (npm run build && npm run preview). Uses Playwright's Chromium.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const LIGHTHOUSE = 'lighthouse@12.2.1';
const args = process.argv.slice(2);
const runsIndex = args.indexOf('--runs');
const runs = runsIndex === -1 ? 3 : Number(args.splice(runsIndex, 2)[1]);
const [origin, ...routes] = args;
if (!origin || !routes.length || !Number.isInteger(runs) || runs < 1) {
  console.error('Usage: lighthouse-median.mjs <origin> <route...> [--runs N]');
  process.exit(1);
}

const outDir = mkdtempSync(path.join(tmpdir(), 'mw-lighthouse-'));
const env = { ...process.env, CHROME_PATH: process.env.CHROME_PATH || chromium.executablePath() };
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

for (const route of routes) {
  const reports = [];
  for (let run = 0; run < runs; run += 1) {
    const output = path.join(outDir, `${route.replace(/\W+/g, '_')}-${run}.json`);
    execFileSync('npx', ['-y', LIGHTHOUSE, new URL(route, origin).href, '--quiet', '--only-categories=performance',
      '--chrome-flags=--headless=new --no-sandbox', '--output=json', `--output-path=${output}`], { env, stdio: 'ignore' });
    reports.push(JSON.parse(readFileSync(output, 'utf8')));
  }
  const pick = (read) => median(reports.map(read));
  const audit = (report, id) => report.audits[id].numericValue;
  console.log([
    route.padEnd(20),
    `perf ${Math.round(pick((report) => report.categories.performance.score) * 100)}`,
    `LCP ${(pick((report) => audit(report, 'largest-contentful-paint')) / 1000).toFixed(1)}s`,
    `FCP ${(pick((report) => audit(report, 'first-contentful-paint')) / 1000).toFixed(1)}s`,
    `CLS ${pick((report) => audit(report, 'cumulative-layout-shift')).toFixed(3)}`,
    `TBT ${Math.round(pick((report) => audit(report, 'total-blocking-time')))}ms`,
    `${Math.round(pick((report) => audit(report, 'total-byte-weight')) / 1024)} kB`,
  ].join(' | '));
}
