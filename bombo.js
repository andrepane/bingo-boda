"use strict";

const CLAVE_ESTADO = "bingo-boda-bombo-v1";
const CLAVE_MODO_AUDIO = "bingo-boda-modo-audio";
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
    probarAudio: document.getElementById("probarAudio"), modoAudio: document.getElementById("modoAudio")
};

let partida = cargarPartida();
let automaticoActivo = false;
let temporizador = null;
let bloqueoManual = false;
let reproduciendo = false;
let cicloLocucion = 0;
let resolverReproduccion = null;
const reproductor = new Audio();
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
    reproductor.pause(); reproductor.removeAttribute("src"); reproductor.load();
    if (resolverReproduccion) resolverReproduccion();
    resolverReproduccion = null;
}
function crearRutaTts(numero, idioma) { return `/api/tts?numero=${encodeURIComponent(numero)}&idioma=${idioma}`; }
async function reproducirAudioTts(numero, idioma, ciclo) {
    if (ciclo !== cicloLocucion) return;
    reproductor.src = crearRutaTts(numero, idioma);
    await new Promise((resolve, reject) => {
        resolverReproduccion = resolve;
        reproductor.onended = resolve;
        reproductor.onerror = () => reject(new Error("No se pudo reproducir el audio"));
        reproductor.play().catch(reject);
    });
    resolverReproduccion = null;
}
async function locutarNumero(numero) {
    const modo = elementos.modoAudio.value;
    if (modo === "off") return;
    cancelarLocucion();
    const ciclo = cicloLocucion;
    reproduciendo = true;
    actualizarControles();
    try {
        if (modo === "es-it" || modo === "es") await reproducirAudioTts(numero, "es", ciclo);
        if (ciclo === cicloLocucion && (modo === "es-it" || modo === "it")) await reproducirAudioTts(numero, "it", ciclo);
    } catch (error) {
        if (ciclo === cicloLocucion) elementos.mensaje.textContent = "No se ha podido reproducir el audio. La partida puede continuar.";
    } finally {
        resolverReproduccion = null;
        if (ciclo === cicloLocucion) { reproduciendo = false; actualizarControles(); }
    }
}
async function probarAudio() {
    if (reproduciendo) return;
    elementos.mensaje.textContent = "";
    await locutarNumero(13);
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
    if (numero !== null) await locutarNumero(numero);
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
    await locutarNumero(numero);
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

function configurarAudio() {
    const modoGuardado = localStorage.getItem(CLAVE_MODO_AUDIO);
    if (["es-it", "es", "it", "off"].includes(modoGuardado)) elementos.modoAudio.value = modoGuardado;
    elementos.modoAudio.addEventListener("change", () => {
        localStorage.setItem(CLAVE_MODO_AUDIO, elementos.modoAudio.value);
        cancelarLocucion(); actualizarControles();
    });
    elementos.probarAudio.addEventListener("click", probarAudio);
}

elementos.sacar.addEventListener("click", extraccionManual); elementos.iniciar.addEventListener("click", iniciarAutomatico); elementos.pausar.addEventListener("click", pausarAutomatico);
elementos.intervalo.addEventListener("change", actualizarIntervalo); elementos.reiniciar.addEventListener("click", pedirReinicio);
elementos.confirmacion.addEventListener("close", () => { if (elementos.confirmacion.returnValue === "confirm") reiniciarPartida(); });
document.querySelectorAll(".opcion").forEach((boton) => boton.addEventListener("click", () => { elementos.intervalo.value = boton.dataset.segundos; actualizarIntervalo(); }));
document.getElementById("tabSalida").addEventListener("click", () => cambiarVista(false)); document.getElementById("tabNumerico").addEventListener("click", () => cambiarVista(true));
document.addEventListener("visibilitychange", () => { if (document.hidden && automaticoActivo) pausarAutomatico(); });
window.addEventListener("pagehide", () => { automaticoActivo = false; limpiarTemporizador(); cancelarLocucion(); liberarWakeLock(); });

configurarAudio(); elementos.intervalo.value = partida.intervalo; marcarOpcionActiva(); renderizar();
