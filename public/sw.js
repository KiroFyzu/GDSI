/* ============================================================
   GDSI Service Worker
   Strategy: conservative on purpose.
   - Static assets (icons, favicon, manifest) → cache-first
   - HTML pages + app JS → network-first, cache as fallback
     (so users always get the LATEST deploy; cache only kicks
     in when offline — never traps someone on a stale/broken
     version after we ship a fix)
   - Firebase / Firestore / Apps Script / Cloudinary → NEVER
     cached, always network. This app's core data (auth,
     registration, QTT, CMS) must always be live.
   - /admin routes → NEVER cached, always network. Extra
     safety margin for the CMS.
   ============================================================ */

const CACHE_VERSION = 'gdsi-v1';
const STATIC_CACHE   = `${CACHE_VERSION}-static`;
const PAGES_CACHE     = `${CACHE_VERSION}-pages`;

const PRECACHE_ASSETS = [
  '/favicon.ico',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Hosts that must NEVER be intercepted — always go straight to network.
const NEVER_CACHE_HOSTS = [
  'firestore.googleapis.com',
  'firebaseapp.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'script.google.com',
  'script.googleusercontent.com',
  'api.cloudinary.com',
  'res.cloudinary.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('gdsi-') && !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

function shouldBypass(url) {
  // Never touch non-GET requests, admin routes, or third-party live-data hosts.
  if (NEVER_CACHE_HOSTS.some((host) => url.hostname.includes(host))) return true;
  if (url.pathname.startsWith('/admin')) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // let POST/PUT/DELETE pass through untouched

  const url = new URL(req.url);
  if (shouldBypass(url)) return; // let browser handle it normally, no SW involvement

  const isSameOrigin = url.origin === self.location.origin;
  const isHTMLNav = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  const isAppJS = isSameOrigin && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css'));

  if (isHTMLNav || isAppJS) {
    // Network-first: always try fresh content, fall back to cache only if offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(PAGES_CACHE).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  if (isSameOrigin && (url.pathname.startsWith('/icons/') || url.pathname === '/favicon.ico')) {
    // Cache-first for truly static, rarely-changing assets.
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(req, resClone));
        return res;
      }))
    );
    return;
  }

  // Everything else: just pass through to network normally.
});
