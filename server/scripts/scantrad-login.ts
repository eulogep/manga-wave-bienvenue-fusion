import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { resolveScantradBrowserConfig } from '../src/lib/scantrad-browser-config.js';

const config = resolveScantradBrowserConfig();
const profileDir = config.userDataDir;
const cdpUrl = new URL(config.cdpUrl || 'http://127.0.0.1:9222');

const candidates = process.platform === 'darwin'
  ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
  : process.platform === 'win32'
    ? [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ]
    : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium'];
const executable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || candidates.find((candidate) => existsSync(candidate));
if (!executable) {
  throw new Error('Google Chrome est introuvable. Configurez PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.');
}

const args = [
  `--user-data-dir=${profileDir}`,
  `--remote-debugging-address=${cdpUrl.hostname === 'localhost' ? '127.0.0.1' : cdpUrl.hostname.replace(/^\[|\]$/g, '')}`,
  `--remote-debugging-port=${cdpUrl.port || '9222'}`,
  '--no-first-run',
  '--no-default-browser-check',
  'https://manga-scantrad.io/manga/',
];
if (config.proxy?.server) {
  args.splice(-1, 0, `--proxy-server=${config.proxy.server}`);
}

console.log([
  `Chrome Scantrad va utiliser le profil : ${profileDir}`,
  `Endpoint CDP local : ${cdpUrl.origin}`,
  'Résolvez le challenge sur /manga/, puis laissez cette fenêtre Chrome ouverte.',
  `Dans un autre terminal, lancez le backend avec SCANTRAD_CDP_URL=${cdpUrl.origin}.`,
].join('\n'));

const chrome = spawn(executable, args, { stdio: 'inherit' });
const [code, signal] = await once(chrome, 'exit') as [number | null, NodeJS.Signals | null];
if (signal) throw new Error(`Chrome interrompu par le signal ${signal}.`);
process.exitCode = code ?? 0;
