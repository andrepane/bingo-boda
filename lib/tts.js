"use strict";

const { numeroEnEspanol, numeroEnItaliano } = require("./numeros");

function validarConsulta(query = {}) {
    if (Object.keys(query).some((clave) => !["numero", "idioma"].includes(clave))) return null;
    const numeroTexto = Array.isArray(query.numero) ? "" : query.numero;
    const idioma = Array.isArray(query.idioma) ? "" : query.idioma;
    const numero = Number(numeroTexto);
    if (!/^\d+$/.test(numeroTexto || "") || !Number.isInteger(numero) || numero < 1 || numero > 90 || !["es", "it"].includes(idioma)) return null;
    return { numero, idioma };
}

function escaparXml(texto) {
    return texto.replace(/[&<>"']/g, (caracter) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;"
    })[caracter]);
}

function crearSsml(numero, idioma) {
    const palabra = idioma === "es"
        ? numeroEnEspanol(numero)
        : numeroEnItaliano(numero);
    const numeroPronunciado = idioma === "it"
        ? `${palabra[0].toUpperCase()}${palabra.slice(1)}`
        : palabra;
    const prosodia = `<prosody rate="105%" volume="+3dB">${escaparXml(numeroPronunciado)}</prosody>`;
    return idioma === "es"
        ? `<speak>Número<break time="500ms"/>${prosodia}</speak>`
        : `<speak>${prosodia}</speak>`;
}

module.exports = { validarConsulta, crearSsml };
