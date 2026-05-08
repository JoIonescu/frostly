// sw.js — Frostly service worker v4
// Strategy:
//   HTML files  → network-first  (always get latest index.html)
//   Everything else → cache-first (fast, offline-capable)

const CACHE   = ‘frostly-v4’;  // bump this on every deploy to force cache refresh
const ASSETS  = [’/’, ‘/index.html’, ‘/manifest.json’];

// ── Install ───────────────────────────────────────────────
self.addEventListener(‘install’, e => {
e.waitUntil(
caches.open(CACHE).then(c => c.addAll(ASSETS))
);
self.skipWaiting(); // activate immediately, don’t wait for old tabs to close
});

// ── Activate: delete old caches ──────────────────────────
self.addEventListener(‘activate’, e => {
e.waitUntil(
caches.keys().then(keys =>
Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
)
);
self.clients.claim(); // take control of all open tabs immediately
});

// ── Fetch ─────────────────────────────────────────────────
self.addEventListener(‘fetch’, e => {
if (e.request.method !== ‘GET’) return;

const url = new URL(e.request.url);

// Network-first for HTML — ensures every app open gets the latest version.
// Falls back to cache if offline.
if (url.pathname === ‘/’ || url.pathname.endsWith(’.html’)) {
e.respondWith(
fetch(e.request)
.then(response => {
const clone = response.clone();
caches.open(CACHE).then(c => c.put(e.request, clone));
return response;
})
.catch(() => caches.match(e.request))
);
return;
}

// Cache-first for everything else
e.respondWith(
caches.match(e.request).then(cached => cached || fetch(e.request))
);
});

// ── Push notifications ────────────────────────────────────
self.addEventListener(‘push’, e => {
let data = { title: ‘❄️ Frostly’, body: ‘Check your freezer.’ };
if (e.data) {
try { data = e.data.json(); } catch { data.body = e.data.text(); }
}
e.waitUntil(
self.registration.showNotification(data.title, {
body:      data.body    || ‘’,
icon:      data.icon    || ‘/icons/icon-192.png’,
badge:     data.badge   || ‘/icons/badge-72.png’,
tag:       data.tag     || ‘frostly’,
renotify:  data.renotify ?? true,
data:      data.data    || { url: ‘/’ },
actions: [
{ action: ‘open’,    title: ‘See meal ideas’ },
{ action: ‘dismiss’, title: ‘Dismiss’ },
],
})
);
});

// ── Notification click ────────────────────────────────────
self.addEventListener(‘notificationclick’, e => {
e.notification.close();
if (e.action === ‘dismiss’) return;
const url = e.notification.data?.url || ‘/’;
e.waitUntil(
clients.matchAll({ type: ‘window’, includeUncontrolled: true }).then(list => {
for (const client of list) {
if (client.url.includes(self.location.origin) && ‘focus’ in client)
return client.focus();
}
if (clients.openWindow) return clients.openWindow(url);
})
);
});