"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const { numeroEnEspanol, numeroEnItaliano } = require("../lib/numeros");
const { validarConsulta, crearSsml } = require("../lib/tts");

const cargarApi = (textToSpeech = {}) => {
    const cargarOriginal = Module._load;
    try {
        Module._load = (request, parent, isMain) => request === "@google-cloud/text-to-speech"
            ? textToSpeech
            : cargarOriginal(request, parent, isMain);
        delete require.cache[require.resolve("../api/tts")];
        return require("../api/tts");
    } finally {
        Module._load = cargarOriginal;
    }
};

const cargarConfiguracion = () => cargarApi().CONFIGURACION;

const casos = {
    1: ["uno", "uno"], 5: ["cinco", "cinque"], 6: ["seis", "sei"], 13: ["trece", "tredici"],
    16: ["dieciséis", "sedici"], 22: ["veintidós", "ventidue"], 23: ["veintitrés", "ventitré"],
    26: ["veintiséis", "ventisei"], 33: ["treinta y tres", "trentatré"], 62: ["sesenta y dos", "sessantadue"],
    72: ["setenta y dos", "settantadue"], 80: ["ochenta", "ottanta"], 81: ["ochenta y uno", "ottantuno"],
    83: ["ochenta y tres", "ottantatré"], 88: ["ochenta y ocho", "ottantotto"], 90: ["noventa", "novanta"]
};

test("convierte los números requeridos en español e italiano", () => {
    for (const [numero, [es, it]] of Object.entries(casos)) {
        assert.equal(numeroEnEspanol(Number(numero)), es);
        assert.equal(numeroEnItaliano(Number(numero)), it);
    }
});

test("rechaza valores fuera del rango", () => {
    for (const numero of [0, 91, 1.5, NaN]) {
        assert.equal(numeroEnEspanol(numero), "");
        assert.equal(numeroEnItaliano(numero), "");
    }
});

test("construye el SSML expresivo sin aceptar texto libre", () => {
    const esperadoEspanol = (numero) => `<speak>Número<break time="500ms"/><prosody rate="105%" volume="+3dB">${numero}</prosody></speak>`;
    const esperadoItaliano = (numero) => `<speak><prosody rate="105%" volume="+3dB">${numero}</prosody></speak>`;

    assert.equal(crearSsml(5, "es"), esperadoEspanol("cinco"));
    assert.equal(crearSsml(13, "es"), esperadoEspanol("trece"));
    assert.equal(crearSsml(22, "es"), esperadoEspanol("veintidós"));
    assert.equal(crearSsml(83, "es"), esperadoEspanol("ochenta y tres"));
    assert.equal(crearSsml(5, "it"), esperadoItaliano("Cinque"));
    assert.equal(crearSsml(13, "it"), esperadoItaliano("Tredici"));
    assert.equal(crearSsml(23, "it"), esperadoItaliano("Ventitré"));
    assert.equal(crearSsml(83, "it"), esperadoItaliano("Ottantatré"));
});

test("valida estrictamente los parámetros del endpoint", () => {
    assert.deepEqual(validarConsulta({ numero: "1", idioma: "es" }), { numero: 1, idioma: "es" });
    assert.deepEqual(validarConsulta({ numero: "90", idioma: "it" }), { numero: 90, idioma: "it" });
    for (const query of [
        { numero: "0", idioma: "es" }, { numero: "91", idioma: "it" },
        { numero: "13", idioma: "fr" }, { numero: "13.0", idioma: "es" },
        { numero: "13", idioma: "es", texto: "libre" }, { numero: ["13"], idioma: "es" }
    ]) {
        assert.equal(validarConsulta(query), null);
    }
});

test("configura las voces predeterminadas válidas", () => {
    const CONFIGURACION = cargarConfiguracion();
    assert.equal(CONFIGURACION.es.defaultVoice, "es-ES-Neural2-A");
    assert.equal(CONFIGURACION.it.defaultVoice, "it-IT-Neural2-F");
    assert.equal(CONFIGURACION.it.languageCode, "it-IT");
});

test("envía únicamente SSML y respeta las voces configuradas", async () => {
    const solicitudes = [];
    class TextToSpeechClient {
        async synthesizeSpeech(solicitud) {
            solicitudes.push(solicitud);
            return [{ audioContent: Buffer.from("audio") }];
        }
    }
    const endpoint = cargarApi({ TextToSpeechClient });
    const response = {
        setHeader() {},
        status(estado) { this.estado = estado; return this; },
        send(audio) { this.audio = audio; return this; },
        json(contenido) { this.contenido = contenido; return this; }
    };
    const entornoOriginal = {
        credentials: process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64,
        es: process.env.GOOGLE_TTS_VOICE_ES,
        it: process.env.GOOGLE_TTS_VOICE_IT
    };
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 = Buffer.from(JSON.stringify({
        client_email: "test@example.com", private_key: "key", project_id: "project"
    })).toString("base64");
    process.env.GOOGLE_TTS_VOICE_ES = "es-ES-Chirp3-HD-Rasalgethi";
    process.env.GOOGLE_TTS_VOICE_IT = "it-IT-Chirp3-HD-Rasalgethi";

    try {
        await endpoint({ method: "GET", query: { numero: "13", idioma: "es" } }, response);
        await endpoint({ method: "GET", query: { numero: "13", idioma: "it" } }, response);
    } finally {
        for (const [variable, valor] of [
            ["GOOGLE_SERVICE_ACCOUNT_JSON_BASE64", entornoOriginal.credentials],
            ["GOOGLE_TTS_VOICE_ES", entornoOriginal.es],
            ["GOOGLE_TTS_VOICE_IT", entornoOriginal.it]
        ]) {
            if (valor === undefined) delete process.env[variable];
            else process.env[variable] = valor;
        }
    }

    assert.deepEqual(solicitudes.map(({ input, voice, audioConfig }) => ({ input, voice, audioConfig })), [
        {
            input: { ssml: '<speak>Número<break time="500ms"/><prosody rate="105%" volume="+3dB">trece</prosody></speak>' },
            voice: { languageCode: "es-ES", name: "es-ES-Chirp3-HD-Rasalgethi" },
            audioConfig: { audioEncoding: "MP3", speakingRate: 1, pitch: 0 }
        },
        {
            input: { ssml: '<speak><prosody rate="105%" volume="+3dB">Tredici</prosody></speak>' },
            voice: { languageCode: "it-IT", name: "it-IT-Chirp3-HD-Rasalgethi" },
            audioConfig: { audioEncoding: "MP3", speakingRate: 1, pitch: 0 }
        }
    ]);
});
