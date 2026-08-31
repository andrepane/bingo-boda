"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const { numeroEnEspanol, numeroEnItaliano } = require("../lib/numeros");
const { validarConsulta, crearTexto } = require("../lib/tts");

const cargarApiTts = () => {
    const cargarOriginal = Module._load;
    try {
        Module._load = (request, parent, isMain) => request === "@google-cloud/text-to-speech"
            ? {}
            : cargarOriginal(request, parent, isMain);
        return require("../api/tts");
    } finally {
        Module._load = cargarOriginal;
    }
};

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

test("construye las frases sin aceptar texto libre", () => {
    assert.equal(crearTexto({ numero: 13 }, "es"), "Número... ¡trece!");
    assert.equal(crearTexto({ numero: 13 }, "it"), "Numero... tredici!");
    assert.equal(crearTexto({ numero: 22 }, "es"), "Número... ¡veintidós!");
    assert.equal(crearTexto({ numero: 22 }, "it"), "Numero... ventidue!");
    assert.equal(crearTexto({ numero: 33 }, "it"), "Numero... trentatré!");
    assert.equal(crearTexto({ numero: 83 }, "es"), "Número... ¡ochenta y tres!");
    assert.equal(crearTexto({ numero: 83 }, "it"), "Numero... ottantatré!");
    assert.equal(crearTexto({ evento: "linea" }, "es"), "¡Han cantado línea!");
    assert.equal(crearTexto({ evento: "linea" }, "it"), "Hanno fatto cinquina!");
    assert.equal(crearTexto({ evento: "bingo" }, "es"), "¡Han cantado bingo!");
    assert.equal(crearTexto({ evento: "bingo" }, "it"), "Hanno fatto bingo!");
    assert.equal(crearTexto({ evento: "linea_correcta" }, "es"), "Línea es correcta! Seguimos para Bingo");
    assert.equal(crearTexto({ evento: "linea_correcta" }, "it"), "La cinquina è corretta! Continuiamo per il Bingo");
    assert.equal(crearTexto({ evento: "bingo_correcto" }, "es"), "El Bingo es correcto, finaliza la partida");
    assert.equal(crearTexto({ evento: "bingo_correcto" }, "it"), "Il Bingo è corretto, la partita finisce");
    assert.equal(crearTexto({ evento: "linea_incorrecta" }, "es"), "Línea incorrecta, continuamos");
    assert.equal(crearTexto({ evento: "linea_incorrecta" }, "it"), "Cinquina errata, continuiamo");
    assert.equal(crearTexto({ evento: "bingo_incorrecto" }, "es"), "Bingo incorrecto, continuamos");
    assert.equal(crearTexto({ evento: "bingo_incorrecto" }, "it"), "Bingo errato, continuiamo");
});

test("valida estrictamente los parámetros del endpoint", () => {
    assert.deepEqual(validarConsulta({ numero: "13", idioma: "es", v: "rasalgethi-v1" }), { numero: 13, idioma: "es" });
    assert.deepEqual(validarConsulta({ numero: "90", idioma: "it", v: "rasalgethi-v1" }), { numero: 90, idioma: "it" });
    assert.deepEqual(validarConsulta({ evento: "linea", idioma: "es", v: "rasalgethi-v2" }), { evento: "linea", idioma: "es" });
    assert.deepEqual(validarConsulta({ evento: "bingo", idioma: "it", v: "rasalgethi-v2" }), { evento: "bingo", idioma: "it" });
    assert.deepEqual(validarConsulta({ evento: "linea_correcta", idioma: "it", v: "rasalgethi-v3" }), { evento: "linea_correcta", idioma: "it" });
    for (const query of [
        { numero: "13", idioma: "es" }, { numero: "13", idioma: "es", v: "" },
        { numero: "13", idioma: "es", v: "con espacios" }, { numero: "13", idioma: "es", v: "con/barra" },
        { numero: "13", idioma: "es", v: "a".repeat(51) }, { numero: "13", idioma: "es", v: ["v1"] },
        { numero: "0", idioma: "es", v: "v1" }, { numero: "91", idioma: "it", v: "v1" },
        { numero: "13", idioma: "fr", v: "v1" }, { numero: "13.0", idioma: "es", v: "v1" },
        { numero: "13", idioma: "es", v: "v1", texto: "libre" }, { numero: ["13"], idioma: "es", v: "v1" },
        { idioma: "es", v: "v1" }, { numero: "13", evento: "linea", idioma: "es", v: "v1" },
        { evento: "tombola", idioma: "it", v: "v1" }, { evento: ["linea"], idioma: "es", v: "v1" }
    ]) {
        assert.equal(validarConsulta(query), null);
    }
});

test("configura las voces predeterminadas válidas", () => {
    const CONFIGURACION = cargarApiTts().CONFIGURACION;
    assert.equal(CONFIGURACION.es.defaultVoice, "es-ES-Neural2-A");
    assert.equal(CONFIGURACION.it.defaultVoice, "it-IT-Neural2-F");
    assert.equal(CONFIGURACION.it.languageCode, "it-IT");
});


test("números y eventos comparten exactamente la configuración de síntesis", () => {
    const { crearSolicitudSintesis } = cargarApiTts();
    for (const idioma of ["es", "it"]) {
        const numero = crearSolicitudSintesis({ numero: 13, idioma });
        for (const evento of ["linea", "bingo", "linea_correcta", "bingo_correcto", "linea_incorrecta", "bingo_incorrecto"]) {
            const aviso = crearSolicitudSintesis({ evento, idioma });
            assert.deepEqual(aviso.voice, numero.voice);
            assert.deepEqual(aviso.audioConfig, numero.audioConfig);
        }
    }
});
