"use strict";

const CACHE_APP = "bingo-app-v1";
const RECURSOS_APP = ["/bombo.html", "/bombo.css", "/bombo.js", "/manifest.webmanifest", "/monograma.png"];

self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE_APP).then((cache) => cache.addAll(RECURSOS_APP)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Solo se intercepta la interfaz del bombo; /api/tts permanece bajo el control explícito de bombo.js.
self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
    if (!RECURSOS_APP.includes(url.pathname)) return;
    event.respondWith(caches.match(event.request).then((guardada) => guardada || fetch(event.request)));
});
