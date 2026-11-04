self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) {
    if (name.startsWith('autodrive-crm-') || name.startsWith('mcampos-desktop-')) await caches.delete(name);
  }
  await self.clients.claim();
})()));
// Fetches use the network. Offline writes and API response caching are disabled.
