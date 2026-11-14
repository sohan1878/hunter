/* Hunter System service worker: offline-first cache */
const CACHE = 'hunter-system-v6';
const MEDIA = 'hunter-media-v1'; // exercise GIFs and thumbnails; kept across app updates
const ASSETS = [
  './', 'index.html', 'styles.css', 'app.js', 'engine.js', 'library.js', 'exercises.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== MEDIA).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (new URL(req.url).pathname.indexOf('/media/') !== -1) {
    // demo media: cache first, saved forever (never revalidated)
    e.respondWith(caches.open(MEDIA).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res && res.ok) c.put(req, res.clone()); return res; }))));
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined));
      return hit || net; // cache first, refresh in background
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const tab = (e.notification.data && e.notification.data.tab) || 'today';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) { c.postMessage({ tab }); return c.focus(); } }
      return self.clients.openWindow('./#' + tab);
    })
  );
});
