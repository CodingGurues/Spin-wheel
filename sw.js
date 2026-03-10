const CACHE = 'spinwheel-v2';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './changelog.html'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS))));
self.addEventListener('fetch', (e) => e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request))));
