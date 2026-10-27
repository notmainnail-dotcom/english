// Офлайн-режим: сначала сеть (чтобы обновления и новые уроки приходили сразу), без сети — сохранённая копия.
// Кэш со своим префиксом: трекер живёт на том же домене github.io, чужие кэши не трогаем.
// Курс СДСМ (папка net/) — часть этого приложения, поэтому его файлы тоже здесь.
const C = 'eng-v7';
const CH = ['ch01', 'ch02', 'ch03', 'ch04', 'ch05', 'ch06', 'ch07', 'ch08', 'ch08b', 'ch09', 'ch10', 'ch11', 'ch11b', 'ch12', 'ch12b', 'ch12c', 'ch13', 'ch14', 'ch15', 'x1', 'x2', 'x3'];
const FILES = ['./', './index.html', './lessons.js', './nets.js', './cloud.js', './sync.js', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png',
  './type.html', './type.js', './type-data.js',
  './net/', './net/index.html', './net/style.css', './net/app.js', './net/eve.js', './net/guide.js', './net/sim.js', './net/tts.js', './net/data/course.js']
  .concat(CH.map(c => './net/data/' + c + '.js'), ['ch02', 'ch03', 'ch04', 'ch05', 'ch06'].map(c => './net/book/' + c + '.js'), ['ch06'].map(c => './net/sim/' + c + '.js'));

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
  // только свои файлы: запросы к Supabase (данные, токены) не кэшируем
  if (q.method !== 'GET' || !q.url.startsWith(self.registration.scope)) return;
  // no-cache: браузер сверяется с сервером, а не берёт старые файлы уроков из своего кэша
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
