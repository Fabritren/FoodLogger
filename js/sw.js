/* FoodLogger Service Worker
   Scope: /FoodLogger/
   Purpose: Enable real PWA install + storage persistence on iOS
*/

self.addEventListener('install', event => {
  // Activate immediately on install
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Take control of existing pages
  event.waitUntil(self.clients.claim());
});

/*
  IMPORTANT:
  No fetch handler is intentionally defined.

  On iOS, a Service Worker is required for:
  - PWA install
  - Persistent storage eligibility

  But aggressive caching can cause:
  - stale HTML
  - broken IndexedDB upgrades
  - hard-to-debug bugs

  Add fetch caching ONLY if you really need offline support.
*/
