"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const { numeroEnEspanol, numeroEnItaliano } = require("../lib/numeros");
const { validarConsulta, crearTexto } = require("../lib/tts");

const cargarConfiguracion = () => {
    const cargarOriginal = Module._load;
    try {
        Module._load = (request, parent, isMain) => request === "@google-cloud/text-to-speech"
            ? {}
            : cargarOriginal(request, parent, isMain);
        return require("../api/tts").CONFIGURACION;
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
    assert.equal(crearTexto(13, "es"), "Número... ¡trece!");
    assert.equal(crearTexto(13, "it"), "Numero... tredici!");
    assert.equal(crearTexto(22, "es"), "Número... ¡veintidós!");
    assert.equal(crearTexto(22, "it"), "Numero... ventidue!");
    assert.equal(crearTexto(33, "it"), "Numero... trentatré!");
    assert.equal(crearTexto(83, "es"), "Número... ¡ochenta y tres!");
    assert.equal(crearTexto(83, "it"), "Numero... ottantatré!");
});

test("valida estrictamente los parámetros del endpoint", () => {
    assert.deepEqual(validarConsulta({ numero: "13", idioma: "es", v: "rasalgethi-v1" }), { numero: 13, idioma: "es" });
    assert.deepEqual(validarConsulta({ numero: "90", idioma: "it", v: "rasalgethi-v1" }), { numero: 90, idioma: "it" });
    for (const query of [
        { numero: "13", idioma: "es" }, { numero: "13", idioma: "es", v: "" },
        { numero: "13", idioma: "es", v: "con espacios" }, { numero: "13", idioma: "es", v: "con/barra" },
        { numero: "13", idioma: "es", v: "a".repeat(51) }, { numero: "13", idioma: "es", v: ["v1"] },
        { numero: "0", idioma: "es", v: "v1" }, { numero: "91", idioma: "it", v: "v1" },
        { numero: "13", idioma: "fr", v: "v1" }, { numero: "13.0", idioma: "es", v: "v1" },
        { numero: "13", idioma: "es", v: "v1", texto: "libre" }, { numero: ["13"], idioma: "es", v: "v1" }
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
