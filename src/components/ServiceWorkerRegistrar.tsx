'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[SW] Registered, scope:', reg.scope);
          // Proactively check for a new sw.js on every app load instead of
          // waiting for the browser's own (much longer) update interval.
          reg.update().catch(() => {});
        })
        .catch((err) => console.error('[SW] Registration failed:', err));
    }
  }, []);

  return null;
}
