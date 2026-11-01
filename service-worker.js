// ==========================================================================
// AUTO DRIVE CRM - SERVICE WORKER (PWA OFFLINE)
// ==========================================================================
const CACHE_NAME = 'autodrive-crm-v6';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    // CDN Libraries
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://unpkg.com/lucide@latest',
    'https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// --------------------------------------------------------------------------
// INSTALL — Cache all essential resources & activate immediately
// --------------------------------------------------------------------------
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching essential assets...');
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => {
            return self.skipWaiting();
        })
    );
});

// --------------------------------------------------------------------------
// ACTIVATE — Clean old caches on update & take immediate control
// --------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// --------------------------------------------------------------------------
// FETCH — Network Only for API & Central DB; Network-First for App Code
// --------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests (POST, PUT, DELETE go straight to network)
    if (event.request.method !== 'GET') return;

    // NEVER cache central CRM API routes — always hit network directly
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/api') || url.pathname.startsWith('/auth')) {
        return;
    }

    // Skip Supabase API calls — they must always hit the network
    if (url.hostname.includes('supabase.co')) return;

    // For scripts and main document, Network-First ensures latest code is always loaded
    if (url.pathname.endsWith('.js') || url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Static assets (CSS, images, icons, fonts)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            });
        })
    );
});
