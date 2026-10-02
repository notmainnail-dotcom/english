// Офлайн-режим: сначала сеть (чтобы обновления и новые уроки приходили сразу), без сети — сохранённая копия.
// Кэш со своим префиксом: трекер живёт на том же домене github.io, чужие кэши не трогаем.
const C = 'eng-v1';
const FILES = ['./', './index.html', './lessons.js', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('eng-') && k !== C).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const q = e.request;
  if (q.method !== 'GET' || !q.url.startsWith(self.registration.scope)) return;
  // no-cache: браузер сверяется с сервером, а не берёт старый lessons.js из своего кэша
  e.respondWith(
    fetch(q.mode === 'navigate' ? q : new Request(q, { cache: 'no-cache' }))
      .then(r => {
        const copy = r.clone();
        caches.open(C).then(c => c.put(q, copy));
        return r;
      })
      .catch(() => caches.match(q, { ignoreSearch: true }))
  );
});
