"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const bombo = fs.readFileSync(`${__dirname}/../bombo.js`, "utf8");
const serviceWorker = fs.readFileSync(`${__dirname}/../sw.js`, "utf8");

test("versiona la caché y todas las rutas de audio", () => {
    assert.match(bombo, /const VERSION_AUDIO = "rasalgethi-v3";/);
    assert.match(bombo, /const CACHE_TTS = `bingo-tts-\$\{VERSION_AUDIO\}`;/);
    assert.match(bombo, /numero=\$\{encodeURIComponent\(numero\)\}/);
    assert.match(bombo, /idioma=\$\{encodeURIComponent\(idioma\)\}/);
    assert.match(bombo, /v=\$\{encodeURIComponent\(VERSION_AUDIO\)\}/);
    assert.equal(new Set(["es", "it"].flatMap((idioma) => Array.from(
        { length: 90 },
        (_, indice) => `/api/tts?numero=${indice + 1}&idioma=${idioma}&v=rasalgethi-v2`
    ))).size, 180);
    assert.match(bombo, /evento=\$\{encodeURIComponent\(evento\)\}/);
    assert.match(bombo, /const TOTAL_AUDIOS = 192;/);
});

test("la limpieza TTS se limita a versiones antiguas de bingo-tts", () => {
    assert.match(bombo, /nombre\.startsWith\("bingo-tts-"\) && nombre !== CACHE_TTS/);
    assert.match(bombo, /limpiarCachesTtsAntiguas\(\)\.catch/);
    assert.match(bombo, /caches\.delete\(CACHE_TTS\)/);
});

test("el Service Worker elimina solo versiones antiguas de bingo-app", () => {
    assert.match(serviceWorker, /const VERSION_APP = "v5";/);
    assert.match(serviceWorker, /const CACHE_APP = `bingo-app-\$\{VERSION_APP\}`;/);
    assert.match(serviceWorker, /nombre\.startsWith\("bingo-app-"\) && nombre !== CACHE_APP/);
    assert.match(serviceWorker, /self\.skipWaiting\(\)/);
    assert.match(serviceWorker, /self\.clients\.claim\(\)/);
    assert.match(serviceWorker, /url\.pathname\.startsWith\("\/api\/"\)/);
});
