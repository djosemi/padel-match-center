const CACHE_NAME = 'padel-match-cache-v1';
const ASSETS = [
  '/',
  'index.html',
  'style.css',
  'app.js',
  'manifest.json',
  // images
  'bg1.png',
  'config_banner_new.png',
  'emoji_angry_new.png',
  'emoji_bored_new.png',
  'emoji_excited_new.png',
  'emoji_happy_new.png',
  'emoji_neutral_new.png',
  'hero_padel.png',
  'padelu_logo.png',
  'players_banner_new.png',
  'schedule_banner_new.png',
  'scoreboard_icon.png'
];

// On install, cache core assets so the app can work offline
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Intercept fetch requests and serve cached assets when available
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});