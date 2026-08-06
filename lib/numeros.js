"use strict";

const UNIDADES_ES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const DIEZ_ES = ["diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"];
const VEINTE_ES = ["veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const DECENAS_ES = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];

const UNIDADES_IT = ["", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove"];
const DIEZ_IT = ["dieci", "undici", "dodici", "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto", "diciannove"];
const DECENAS_IT = ["", "", "venti", "trenta", "quaranta", "cinquanta", "sessanta", "settanta", "ottanta", "novanta"];

function numeroEnEspanol(numero) {
    if (!Number.isInteger(numero) || numero < 1 || numero > 90) return "";
    if (numero < 10) return UNIDADES_ES[numero];
    if (numero < 20) return DIEZ_ES[numero - 10];
    if (numero < 30) return VEINTE_ES[numero - 20];
    const unidad = numero % 10;
    const decena = DECENAS_ES[Math.floor(numero / 10)];
    return unidad ? `${decena} y ${UNIDADES_ES[unidad]}` : decena;
}

function numeroEnItaliano(numero) {
    if (!Number.isInteger(numero) || numero < 1 || numero > 90) return "";
    if (numero < 10) return UNIDADES_IT[numero];
    if (numero < 20) return DIEZ_IT[numero - 10];
    const unidad = numero % 10;
    let decena = DECENAS_IT[Math.floor(numero / 10)];
    if (unidad === 1 || unidad === 8) decena = decena.slice(0, -1);
    const palabra = `${decena}${UNIDADES_IT[unidad]}`;
    return unidad === 3 ? `${palabra.slice(0, -1)}é` : palabra;
}

module.exports = { numeroEnEspanol, numeroEnItaliano };
