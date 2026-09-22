// /sw.js — served from a route (not public/) so the cache name can carry the
// build id. A fixed cache name would serve replaced public assets (icons, fonts,
// background) forever, because cache-first never re-checks them; naming the
// cache per build means `activate` drops the previous shell on every deploy.
const VERSION = `melofy-shell-${process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev'}`;

const SW = `// Melofy service worker — app shell only. Cache: ${VERSION}
//
// Scope of what this touches is deliberately narrow:
//   · never /api/* or /ingest/*  (translation streams, auth, rate limits, analytics)
//   · never non-GET, never cross-origin
//   · never a URL with a query string (the Spotify callback lands on
//     /?access_token=… — caching that would persist a token in Cache Storage)
const VERSION = '${VERSION}';
const SHELL = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isStatic = (p) =>
  p.startsWith('/_next/static/') || p.startsWith('/fonts/') || /\\.(png|webp|ico|svg)$/.test(p);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ingest/')) return;

  // Pages: network first so deploys show up immediately; cached copy (or the
  // root shell) only when offline. Only clean URLs are ever written to cache.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && url.search === '') {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/')))
    );
    return;
  }

  // Build assets (content-hashed), fonts and icons: cache first within a build.
  // Safe because the whole cache is dropped when VERSION changes on deploy.
  if (isStatic(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
  // Everything else falls through to the network untouched.
});
`;

export function GET() {
  return new Response(SW, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      // Always re-fetched: a cached sw.js would pin users to an old shell for
      // up to 24h after a deploy.
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
    },
  });
}
