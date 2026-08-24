"use strict";

const { numeroEnEspanol, numeroEnItaliano } = require("./numeros");

const TEXTOS_EVENTO = {
    linea: { es: "¡Han cantado línea!", it: "Hanno fatto cinquina!" },
    bingo: { es: "¡Han cantado bingo!", it: "Hanno fatto bingo!" }
};

function validarConsulta(query = {}) {
    if (Object.keys(query).some((clave) => !["numero", "evento", "idioma", "v"].includes(clave))) return null;
    const numeroTexto = Array.isArray(query.numero) ? "" : query.numero;
    const evento = Array.isArray(query.evento) ? "" : query.evento;
    const idioma = Array.isArray(query.idioma) ? "" : query.idioma;
    const version = Array.isArray(query.v) ? "" : query.v;
    const tieneNumero = numeroTexto !== undefined;
    const tieneEvento = evento !== undefined;
    if (tieneNumero === tieneEvento || !["es", "it"].includes(idioma)
        || !/^[a-zA-Z0-9._-]{1,50}$/.test(version || "")) return null;
    if (tieneEvento) return Object.hasOwn(TEXTOS_EVENTO, evento) ? { evento, idioma } : null;
    const numero = Number(numeroTexto);
    if (!/^\d+$/.test(numeroTexto || "") || !Number.isInteger(numero) || numero < 1 || numero > 90) return null;
    return { numero, idioma };
}

function crearTexto({ numero, evento }, idioma) {
    if (evento) return TEXTOS_EVENTO[evento][idioma];
    if (idioma === "es") return `Número... ¡${numeroEnEspanol(numero)}!`;
    const palabra = numeroEnItaliano(numero);
    return `Numero... ${palabra}!`;
}

module.exports = { TEXTOS_EVENTO, validarConsulta, crearTexto };
