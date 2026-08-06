"use strict";

const { numeroEnEspanol, numeroEnItaliano } = require("./numeros");

function validarConsulta(query = {}) {
    if (Object.keys(query).some((clave) => !["numero", "idioma", "v"].includes(clave))) return null;
    const numeroTexto = Array.isArray(query.numero) ? "" : query.numero;
    const idioma = Array.isArray(query.idioma) ? "" : query.idioma;
    const version = Array.isArray(query.v) ? "" : query.v;
    const numero = Number(numeroTexto);
    if (!/^\d+$/.test(numeroTexto || "") || !Number.isInteger(numero) || numero < 1 || numero > 90
        || !["es", "it"].includes(idioma) || !/^[a-zA-Z0-9._-]{1,50}$/.test(version || "")) return null;
    return { numero, idioma };
}

function crearTexto(numero, idioma) {
    if (idioma === "es") return `Número... ¡${numeroEnEspanol(numero)}!`;
    const palabra = numeroEnItaliano(numero);
    return `${palabra[0].toUpperCase()}${palabra.slice(1)}!`;
}

module.exports = { validarConsulta, crearTexto };
