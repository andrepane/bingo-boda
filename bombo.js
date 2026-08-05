"use strict";

const CLAVE_ESTADO = "bingo-boda-bombo-v1";
const TOTAL_BOLAS = 90;
const INTERVALO_PREDETERMINADO = 5;

const elementos = {
    actual: document.getElementById("bolaActual"), anterior: document.getElementById("numeroAnterior"),
    restantes: document.getElementById("restantes"), estado: document.getElementById("estado"),
    mensaje: document.getElementById("mensaje"), sacar: document.getElementById("sacar"),
    iniciar: document.getElementById("iniciar"), pausar: document.getElementById("pausar"),
    intervalo: document.getElementById("intervalo"), selectorIntervalo: document.getElementById("selectorIntervalo"),
    errorIntervalo: document.getElementById("errorIntervalo"), cuentaAtras: document.getElementById("cuentaAtras"),
    totalExtraidos: document.getElementById("totalExtraidos"), listaSalida: document.getElementById("listaSalida"),
    historialVacio: document.getElementById("historialVacio"), cuadricula: document.getElementById("cuadricula"),
    reiniciar: document.getElementById("reiniciar"), confirmacion: document.getElementById("confirmacion"),
    probarAudio: document.getElementById("probarAudio")
};

let partida = cargarPartida();
let automaticoActivo = false;
let temporizador = null;
let bloqueoManual = false;
let reproduciendo = false;
let cicloLocucion = 0;
let resolverReproduccion = null;
let wakeLock = null;

function estadoInicial(intervalo = INTERVALO_PREDETERMINADO, extraidos = []) { return { extraidos: [...extraidos], intervalo }; }
function validarIntervalo(valor) { const numero = Number(valor); return Number.isInteger(numero) && numero >= 1 && numero <= 300 ? numero : null; }
function cargarPartida() {
    try {
        const guardada = JSON.parse(localStorage.getItem(CLAVE_ESTADO));
        const validos = Array.isArray(guardada?.extraidos) && new Set(guardada.extraidos).size === guardada.extraidos.length
            && guardada.extraidos.every((n) => Number.isInteger(n) && n >= 1 && n <= TOTAL_BOLAS);
        if (validos) return estadoInicial(validarIntervalo(guardada.intervalo) || INTERVALO_PREDETERMINADO, guardada.extraidos);
    } catch (_error) { localStorage.removeItem(CLAVE_ESTADO); }
    return estadoInicial();
}
function guardarPartida() { localStorage.setItem(CLAVE_ESTADO, JSON.stringify({ extraidos: partida.extraidos, intervalo: partida.intervalo })); }

function cancelarLocucion() {
    cicloLocucion += 1;
    reproduciendo = false;
    if (resolverReproduccion) resolverReproduccion();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
function capitalizar(texto) {
    return texto ? `${texto[0].toUpperCase()}${texto.slice(1)}` : "";
}
function textoEspanol(numero) {
    const unidades = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
    const especiales = ["diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"];
    const veintes = ["veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
    const decenas = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
    if (numero < 1 || numero > TOTAL_BOLAS) return "";
    if (numero < 10) return unidades[numero];
    if (numero < 20) return especiales[numero - 10];
    if (numero < 30) return veintes[numero - 20];
    const decena = Math.floor(numero / 10);
    const unidad = numero % 10;
    return unidad === 0 ? decenas[decena] : `${decenas[decena]} y ${unidades[unidad]}`;
}
function textoItaliano(numero) {
    const unidades = ["", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove"];
    const especiales = ["dieci", "undici", "dodici", "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto", "diciannove"];
    const decenas = ["", "", "venti", "trenta", "quaranta", "cinquanta", "sessanta", "settanta", "ottanta", "novanta"];
    if (numero < 1 || numero > TOTAL_BOLAS) return "";
    if (numero < 10) return capitalizar(unidades[numero]);
    if (numero < 20) return capitalizar(especiales[numero - 10]);
    const decena = Math.floor(numero / 10);
    const unidad = numero % 10;
    const base = decenas[decena];
    const texto = unidad === 1 || unidad === 8 ? `${base.slice(0, -1)}${unidades[unidad]}` : `${base}${unidades[unidad]}`;
    return capitalizar(texto);
}
function seleccionarVoz(idioma, preferida) {
    if (!("speechSynthesis" in window)) return null;
    const voces = window.speechSynthesis.getVoices().filter((voz) => voz.lang.toLowerCase().startsWith(idioma));
    return voces.find((voz) => voz.lang.toLowerCase() === preferida) || voces[0] || null;
}
function crearLocucion(texto, idioma, voz) {
    const locucion = new SpeechSynthesisUtterance(texto);
    locucion.lang = idioma;
    locucion.rate = 0.9;
    locucion.pitch = 1;
    locucion.volume = 1;
    if (voz) locucion.voice = voz;
    return locucion;
}
function hablar(texto, idioma, voz) {
    return new Promise((resolve) => {
        const locucion = crearLocucion(texto, idioma, voz);
        locucion.onend = resolve;
        locucion.onerror = resolve;
        resolverReproduccion = () => { window.speechSynthesis.cancel(); resolve(); };
        window.speechSynthesis.speak(locucion);
    });
}
async function speakNumber(numero) {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return;
    cancelarLocucion();
    const ciclo = cicloLocucion;
    reproduciendo = true;
    actualizarControles();

    const nombreEspanol = textoEspanol(numero);
    const nombreItaliano = textoItaliano(numero);
    const vozEspanola = seleccionarVoz("es", "es-es");
    const vozItaliana = seleccionarVoz("it", "it-it");

    try {
        await hablar(`Número... ¡${nombreEspanol}!`, "es-ES", vozEspanola);
        if (ciclo === cicloLocucion && vozItaliana) await hablar(`${nombreItaliano}!`, "it-IT", vozItaliana);
    } finally {
        resolverReproduccion = null;
        if (ciclo === cicloLocucion) { reproduciendo = false; actualizarControles(); }
    }
}
async function probarAudio() {
    if (reproduciendo) return;
    await speakNumber(1);
}

function extraerNumero() {
    if (automaticoActivo && document.hidden) return null;
    const disponibles = Array.from({ length: TOTAL_BOLAS }, (_, i) => i + 1).filter((n) => !partida.extraidos.includes(n));
    if (!disponibles.length) { terminarPartida(); return null; }
    const numero = disponibles[Math.floor(Math.random() * disponibles.length)];
    partida.extraidos.push(numero); guardarPartida(); renderizar(); animarBola();
    if (partida.extraidos.length === TOTAL_BOLAS) terminarPartida();
    return numero;
}
function animarBola() { elementos.actual.classList.remove("nueva"); void elementos.actual.offsetWidth; elementos.actual.classList.add("nueva"); }
async function extraccionManual() {
    if (bloqueoManual || automaticoActivo || reproduciendo) return;
    bloqueoManual = true; actualizarControles();
    const numero = extraerNumero();
    if (numero !== null) await speakNumber(numero);
    bloqueoManual = false; actualizarControles();
}
async function iniciarAutomatico() {
    if (automaticoActivo || partida.extraidos.length === TOTAL_BOLAS || !actualizarIntervalo()) return;
    automaticoActivo = true; actualizarControles(); solicitarWakeLock();
    await cicloAutomatico();
}
async function cicloAutomatico() {
    if (!automaticoActivo || document.hidden) return;
    const numero = extraerNumero();
    if (numero === null) return;
    await speakNumber(numero);
    if (automaticoActivo && partida.extraidos.length < TOTAL_BOLAS) programarSiguiente(partida.intervalo);
}
function programarSiguiente(segundosRestantes) {
    limpiarTemporizador();
    if (!automaticoActivo) return;
    elementos.cuentaAtras.textContent = `Siguiente número en ${segundosRestantes} s`;
    temporizador = window.setTimeout(() => {
        temporizador = null;
        if (!automaticoActivo) return;
        if (segundosRestantes <= 1) cicloAutomatico();
        else programarSiguiente(segundosRestantes - 1);
    }, 1000);
}
function pausarAutomatico() {
    automaticoActivo = false; limpiarTemporizador(); cancelarLocucion(); liberarWakeLock(); actualizarControles("pausado");
}
function terminarPartida() {
    automaticoActivo = false; limpiarTemporizador(); liberarWakeLock();
    elementos.mensaje.textContent = "No quedan bolas. La partida ha terminado."; actualizarControles("terminado");
}
function limpiarTemporizador() { if (temporizador !== null) window.clearTimeout(temporizador); temporizador = null; }
function actualizarIntervalo() {
    const valor = validarIntervalo(elementos.intervalo.value);
    if (!valor) { elementos.errorIntervalo.textContent = "Introduce un número entero entre 1 y 300."; elementos.intervalo.focus(); return false; }
    elementos.errorIntervalo.textContent = ""; partida.intervalo = valor; marcarOpcionActiva(); guardarPartida(); return true;
}
function renderizar() {
    elementos.actual.textContent = partida.extraidos.at(-1) ?? "—"; elementos.anterior.textContent = partida.extraidos.at(-2) ?? "—";
    elementos.restantes.textContent = `Quedan ${TOTAL_BOLAS - partida.extraidos.length} de ${TOTAL_BOLAS}`;
    elementos.totalExtraidos.textContent = partida.extraidos.length; elementos.historialVacio.hidden = partida.extraidos.length > 0;
    elementos.listaSalida.replaceChildren(...partida.extraidos.map(crearElementoSalida)); renderizarCuadricula(); actualizarControles();
}
function crearElementoSalida(numero, indice) {
    const elemento = document.createElement("li"); elemento.textContent = numero; elemento.setAttribute("aria-label", `${numero}, ${indice + 1}.º en salir`);
    if (indice === partida.extraidos.length - 1) elemento.classList.add("ultimo");
    const posicion = document.createElement("small"); posicion.textContent = `${indice + 1}.º`; elemento.append(posicion); return elemento;
}
function renderizarCuadricula() {
    const extraidos = new Set(partida.extraidos); const ultimo = partida.extraidos.at(-1);
    elementos.cuadricula.replaceChildren(...Array.from({ length: TOTAL_BOLAS }, (_, i) => {
        const numero = i + 1; const bola = document.createElement("span"); bola.textContent = numero;
        bola.classList.toggle("extraido", extraidos.has(numero)); bola.classList.toggle("ultimo", numero === ultimo);
        bola.setAttribute("aria-label", `${numero}: ${extraidos.has(numero) ? "extraído" : "pendiente"}${numero === ultimo ? ", último" : ""}`); return bola;
    }));
}
function actualizarControles(forzarEstado) {
    const terminada = partida.extraidos.length === TOTAL_BOLAS;
    elementos.sacar.disabled = automaticoActivo || terminada || bloqueoManual || reproduciendo;
    elementos.iniciar.disabled = automaticoActivo || terminada || reproduciendo;
    elementos.iniciar.textContent = partida.extraidos.length && !terminada ? "Reanudar automático" : "Iniciar automático";
    elementos.pausar.disabled = !automaticoActivo; elementos.selectorIntervalo.disabled = automaticoActivo;
    elementos.probarAudio.disabled = reproduciendo || automaticoActivo || bloqueoManual;
    if (automaticoActivo) mostrarEstado(reproduciendo ? "Automático activo · reproduciendo" : "Automático activo", "activo");
    else if (terminada || forzarEstado === "terminado") { mostrarEstado("Partida terminada", "terminado"); elementos.cuentaAtras.textContent = "No quedan bolas"; }
    else if (reproduciendo) mostrarEstado("Audio en curso", "activo");
    else if (forzarEstado === "pausado" || partida.extraidos.length) { mostrarEstado("Pausado", "pausado"); elementos.cuentaAtras.textContent = "Automático pausado"; }
    else { mostrarEstado("Preparado", "preparado"); elementos.cuentaAtras.textContent = "Automático detenido"; }
}
function mostrarEstado(texto, estado) { elementos.estado.textContent = texto; elementos.estado.dataset.estado = estado; }
function marcarOpcionActiva() { document.querySelectorAll(".opcion").forEach((b) => b.classList.toggle("opcion--activa", Number(b.dataset.segundos) === partida.intervalo)); }
function cambiarVista(numerica) {
    document.getElementById("vistaSalida").hidden = numerica; document.getElementById("vistaNumerica").hidden = !numerica;
    document.getElementById("tabSalida").classList.toggle("activa", !numerica); document.getElementById("tabNumerico").classList.toggle("activa", numerica);
    document.getElementById("tabSalida").setAttribute("aria-selected", String(!numerica)); document.getElementById("tabNumerico").setAttribute("aria-selected", String(numerica));
}
function pedirReinicio() {
    if (typeof elementos.confirmacion.showModal === "function") elementos.confirmacion.showModal();
    else if (window.confirm("Se borrará el historial, volverán las 90 bolas y se detendrá el automático. ¿Reiniciar?")) reiniciarPartida();
}
function reiniciarPartida() {
    pausarAutomatico(); localStorage.removeItem(CLAVE_ESTADO); partida = estadoInicial(partida.intervalo);
    elementos.intervalo.value = partida.intervalo; elementos.mensaje.textContent = "Partida reiniciada."; guardarPartida(); marcarOpcionActiva(); renderizar();
}
async function solicitarWakeLock() { if (!("wakeLock" in navigator) || document.hidden) return; try { wakeLock = await navigator.wakeLock.request("screen"); } catch (_error) { wakeLock = null; } }
async function liberarWakeLock() { if (!wakeLock) return; try { await wakeLock.release(); } catch (_error) { /* Ya liberado. */ } wakeLock = null; }

function configurarVoz() {
    elementos.probarAudio.addEventListener("click", probarAudio);
}

elementos.sacar.addEventListener("click", extraccionManual); elementos.iniciar.addEventListener("click", iniciarAutomatico); elementos.pausar.addEventListener("click", pausarAutomatico);
elementos.intervalo.addEventListener("change", actualizarIntervalo); elementos.reiniciar.addEventListener("click", pedirReinicio);
elementos.confirmacion.addEventListener("close", () => { if (elementos.confirmacion.returnValue === "confirm") reiniciarPartida(); });
document.querySelectorAll(".opcion").forEach((boton) => boton.addEventListener("click", () => { elementos.intervalo.value = boton.dataset.segundos; actualizarIntervalo(); }));
document.getElementById("tabSalida").addEventListener("click", () => cambiarVista(false)); document.getElementById("tabNumerico").addEventListener("click", () => cambiarVista(true));
document.addEventListener("visibilitychange", () => { if (document.hidden && automaticoActivo) pausarAutomatico(); });
window.addEventListener("pagehide", () => { automaticoActivo = false; limpiarTemporizador(); cancelarLocucion(); liberarWakeLock(); });

configurarVoz(); elementos.intervalo.value = partida.intervalo; marcarOpcionActiva(); renderizar();
