importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js'); 

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('meu-app-cache').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html'
      ]);
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
