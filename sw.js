/* ============================================================
   Yandex2 Service Worker — офлайн-режим + кэш
   ============================================================ */
const CACHE_VERSION = 'yandex2-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Что кэшируем сразу при установке
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Установка — кэшируем оболочку
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Активация — чистим старые кэши
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => !k.startsWith(CACHE_VERSION))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Стратегии кэширования
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Только GET
  if (request.method !== 'GET') return;

  // API поиска — сеть сначала, кэш при офлайне
  if (url.hostname.includes('wikipedia.org') || url.hostname.includes('duckduckgo.com')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Всё остальное (оболочка, шрифты, иконки) — кэш сначала
  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // fallback для навигации
    if (request.mode === 'navigate') {
      return caches.match('./index.html');
    }
    return new Response('Офлайн', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ offline: true, error: 'Нет соединения' }),
      { headers: { 'Content-Type': 'application/json' }, status: 503 }
    );
  }
}