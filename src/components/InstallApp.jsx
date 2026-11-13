/**
 * Installable app (PWA) affordance.
 *
 * Browsers fire `beforeinstallprompt` when the store satisfies the install
 * criteria (manifest, icons, service worker, HTTPS). We keep that event and offer
 * a single, dismissible install card. iOS Safari never fires the event, so it gets
 * a short "Add to Home Screen" hint instead. Nothing is shown in standalone mode.
 */
import { useEffect, useState } from 'react';
import { Button } from './ui';

const DISMISS_KEY = 'zyrex:install-dismissed';

export default function InstallApp() {
  const [event, setEvent] = useState(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (standalone || localStorage.getItem(DISMISS_KEY) === '1') return undefined;

    const onPrompt = (e) => {
      e.preventDefault();
      setEvent(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    const onInstalled = () => {
      setVisible(false);
      localStorage.setItem(DISMISS_KEY, '1');
    };
    window.addEventListener('appinstalled', onInstalled);

    // iOS has no install event: offer instructions after a short browse.
    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const timer = isIos ? setTimeout(() => { setIosHint(true); setVisible(true); }, 6000) : null;

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, '1');
  };

  const install = async () => {
    if (!event) return;
    setBusy(true);
    try {
      event.prompt();
      const { outcome } = await event.userChoice;
      if (outcome === 'accepted') localStorage.setItem(DISMISS_KEY, '1');
      setVisible(false);
    } finally {
      setBusy(false);
      setEvent(null);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-md animate-fade-in sm:inset-x-auto sm:right-4">
      <div className="flex items-start gap-3 rounded-2xl border border-ink-200 bg-white p-3 shadow-float dark:border-ink-700 dark:bg-ink-900">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-accent-600 font-display text-lg font-black text-white">
          Z
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink-900 dark:text-white">Install ZYREX STORE</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
            {iosHint
              ? 'Tap the Share button, then “Add to Home Screen” to keep the store one tap away.'
              : 'Add the store to your home screen for a faster, full-screen app experience.'}
          </p>
          <div className="mt-2 flex items-center gap-2">
            {!iosHint && (
              <Button onClick={install} disabled={busy} className="px-3 py-1.5 text-xs">
                {busy ? 'Opening…' : 'Install app'}
              </Button>
            )}
            <button type="button" onClick={dismiss} className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-white">
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
