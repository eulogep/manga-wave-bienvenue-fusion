import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const mark = await fs.readFile('video-kit/branding/logo-mark.svg', 'utf8');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 2048, height: 512 }, deviceScaleFactor: 1 });
await page.setContent(`<!doctype html><html><head><style>
  *{box-sizing:border-box}html,body{margin:0;width:2048px;height:512px;background:transparent}
  body{display:flex;align-items:center;padding:48px;font-family:Arial,sans-serif}
  #lockup{display:flex;align-items:center;gap:42px;width:1952px;height:416px;padding:24px;background:transparent}
  #mark{width:320px;height:320px;display:flex}#mark svg{width:100%;height:100%}
  #name{color:#edeff2;font-size:178px;font-weight:800;letter-spacing:10px;white-space:nowrap}
  #name span{color:#ff4d5a}
</style></head><body><div id="lockup"><div id="mark">${mark}</div><div id="name">MANGA <span>WAVE</span></div></div></body></html>`);
await page.screenshot({ path: path.resolve('video-kit/branding/logo-transparent-2048.png'), omitBackground: true });
await browser.close();
console.log(JSON.stringify({ status: 'PASS', width: 2048, height: 512 }));
