import { installEarlyErrorCapture } from './monitoring/errorQueue'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerPwa } from './pwa'

// Capture errors from the very start; the Sentry SDK itself loads after the first render.
installEarlyErrorCapture();
registerPwa();

createRoot(document.getElementById("root")!).render(<App />);

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  const loadSentry = () => { void import('./monitoring/sentry').then(({ initSentry }) => initSentry(sentryDsn)); };
  const whenIdle = () => ('requestIdleCallback' in window ? window.requestIdleCallback(loadSentry, { timeout: 3000 }) : globalThis.setTimeout(loadSentry, 1));
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });
}
