"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { numeroEnEspanol, numeroEnItaliano } = require("../lib/numeros");
const { validarConsulta, crearTexto } = require("../lib/tts");

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
    assert.equal(crearTexto(13, "it"), "Tredici!");
    assert.equal(crearTexto(22, "es"), "Número... ¡veintidós!");
    assert.equal(crearTexto(22, "it"), "Ventidue!");
    assert.equal(crearTexto(83, "es"), "Número... ¡ochenta y tres!");
    assert.equal(crearTexto(83, "it"), "Ottantatré!");
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
