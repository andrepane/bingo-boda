"use strict";

const CLAVE_ESTADO = "bingo-boda-bombo-v1";
const CLAVE_MODO_AUDIO = "bingo-boda-modo-audio";
const CLAVE_MODO_OBTENCION = "bingo-boda-modo-obtencion";
const CACHE_TTS = "bingo-tts-v1";
const TOTAL_AUDIOS = 180;
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
    probarAudio: document.getElementById("probarAudio"), modoAudio: document.getElementById("modoAudio"),
    modosObtencion: document.querySelectorAll('[name="modoObtencion"]'),
    contadorAudios: document.getElementById("contadorAudios"), progresoAudios: document.getElementById("progresoAudios"),
    estadoAudios: document.getElementById("estadoAudios"), prepararAudios: document.getElementById("prepararAudios"),
    completarAudios: document.getElementById("completarAudios"), cancelarDescarga: document.getElementById("cancelarDescarga"),
    eliminarAudios: document.getElementById("eliminarAudios")
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
let descargaActiva = null;
let urlAudioActual = null;

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
    if (urlAudioActual) URL.revokeObjectURL(urlAudioActual);
    urlAudioActual = null;
    if (resolverReproduccion) resolverReproduccion();
    resolverReproduccion = null;
}
function crearRutaTts(numero, idioma) { return `/api/tts?numero=${encodeURIComponent(numero)}&idioma=${idioma}`; }
function rutasTts() {
    return ["es", "it"].flatMap((idioma) => Array.from({ length: TOTAL_BOLAS }, (_, i) => crearRutaTts(i + 1, idioma)));
}
function modoObtencion() { return document.querySelector('[name="modoObtencion"]:checked')?.value || "streaming"; }
async function obtenerAudioTts(ruta) {
    if (!("caches" in window)) {
        if (modoObtencion() === "offline") return null;
        const respuesta = await fetch(ruta);
        if (!respuesta.ok) throw new Error("No se pudo descargar el audio");
        return respuesta;
    }
    const cache = await caches.open(CACHE_TTS);
    const guardada = await cache.match(ruta);
    if (guardada) return guardada;
    if (modoObtencion() === "offline") return null;
    const respuesta = await fetch(ruta);
    if (!respuesta.ok) throw new Error("No se pudo descargar el audio");
    await cache.put(ruta, respuesta.clone());
    actualizarEstadoAudios();
    return respuesta;
}
async function reproducirAudioTts(numero, idioma, ciclo) {
    if (ciclo !== cicloLocucion) return;
    const respuesta = await obtenerAudioTts(crearRutaTts(numero, idioma));
    if (!respuesta) {
        elementos.mensaje.textContent = "Audio no disponible sin conexión.";
        return;
    }
    const urlObjeto = URL.createObjectURL(await respuesta.blob());
    urlAudioActual = urlObjeto;
    reproductor.src = urlObjeto;
    try {
        await new Promise((resolve, reject) => {
            resolverReproduccion = resolve;
            reproductor.onended = resolve;
            reproductor.onerror = () => reject(new Error("No se pudo reproducir el audio"));
            reproductor.play().catch(reject);
        });
    } finally {
        URL.revokeObjectURL(urlObjeto);
        if (urlAudioActual === urlObjeto) urlAudioActual = null;
        resolverReproduccion = null;
    }
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

function mostrarEstadoAudios(preparados, descargando = false, procesados = 0) {
    elementos.progresoAudios.value = preparados;
    elementos.contadorAudios.textContent = descargando
        ? `Descargando… ${procesados} / ${TOTAL_AUDIOS}`
        : `${preparados} / ${TOTAL_AUDIOS} audios preparados`;
    const faltan = TOTAL_AUDIOS - preparados;
    elementos.estadoAudios.textContent = faltan === 0 ? "🟢 Listo para jugar sin conexión" : `🟡 Faltan ${faltan} audios`;
}
async function contarAudiosGuardados(cache) {
    const coincidencias = await Promise.all(rutasTts().map((ruta) => cache.match(ruta)));
    return coincidencias.filter(Boolean).length;
}
async function actualizarEstadoAudios() {
    if (!("caches" in window)) {
        elementos.contadorAudios.textContent = "Cache Storage no está disponible";
        elementos.estadoAudios.textContent = "🟡 No se pueden guardar audios en este navegador";
        return 0;
    }
    const cache = await caches.open(CACHE_TTS);
    const preparados = await contarAudiosGuardados(cache);
    mostrarEstadoAudios(preparados);
    return preparados;
}
function bloquearGestionAudios(descargando) {
    elementos.prepararAudios.disabled = descargando;
    elementos.completarAudios.disabled = descargando;
    elementos.eliminarAudios.disabled = descargando;
    elementos.cancelarDescarga.hidden = !descargando;
}
async function descargarAudiosFaltantes() {
    if (descargaActiva || !("caches" in window)) return;
    const cache = await caches.open(CACHE_TTS);
    const comprobaciones = await Promise.all(rutasTts().map(async (ruta) => ({ ruta, existe: Boolean(await cache.match(ruta)) })));
    const pendientes = comprobaciones.filter(({ existe }) => !existe).map(({ ruta }) => ruta);
    let preparados = TOTAL_AUDIOS - pendientes.length;
    let procesados = preparados;
    const control = { cancelada: false, controllers: new Set() };
    descargaActiva = control;
    bloquearGestionAudios(true);
    mostrarEstadoAudios(preparados, true, procesados);
    let indice = 0;
    async function trabajador() {
        while (!control.cancelada) {
            const actual = indice++;
            if (actual >= pendientes.length) return;
            const controller = new AbortController();
            control.controllers.add(controller);
            try {
                const respuesta = await fetch(pendientes[actual], { signal: controller.signal });
                if (!respuesta.ok) throw new Error("Respuesta de audio no válida");
                await cache.put(pendientes[actual], respuesta);
                preparados += 1;
            } catch (_error) { /* Un fallo no debe detener las demás descargas. */ }
            finally {
                control.controllers.delete(controller);
                procesados += 1;
                mostrarEstadoAudios(preparados, true, Math.min(procesados, TOTAL_AUDIOS));
            }
        }
    }
    await Promise.all(Array.from({ length: Math.min(4, pendientes.length) }, trabajador));
    if (descargaActiva === control) descargaActiva = null;
    bloquearGestionAudios(false);
    await actualizarEstadoAudios();
}
function cancelarDescargaAudios() {
    if (!descargaActiva) return;
    descargaActiva.cancelada = true;
    descargaActiva.controllers.forEach((controller) => controller.abort());
}
async function eliminarAudiosGuardados() {
    if (!("caches" in window) || !window.confirm("¿Eliminar los audios guardados para jugar sin conexión?")) return;
    await caches.delete(CACHE_TTS);
    await actualizarEstadoAudios();
}

function configurarAudio() {
    const modoGuardado = localStorage.getItem(CLAVE_MODO_AUDIO);
    if (["es-it", "es", "it", "off"].includes(modoGuardado)) elementos.modoAudio.value = modoGuardado;
    elementos.modoAudio.addEventListener("change", () => {
        localStorage.setItem(CLAVE_MODO_AUDIO, elementos.modoAudio.value);
        cancelarLocucion(); actualizarControles();
    });
    elementos.probarAudio.addEventListener("click", probarAudio);
    const obtencionGuardada = localStorage.getItem(CLAVE_MODO_OBTENCION);
    const modoInicial = ["streaming", "offline"].includes(obtencionGuardada) ? obtencionGuardada : "streaming";
    const radioInicial = document.querySelector(`[name="modoObtencion"][value="${modoInicial}"]`);
    if (radioInicial) radioInicial.checked = true;
    elementos.modosObtencion.forEach((radio) => radio.addEventListener("change", () => {
        if (radio.checked) localStorage.setItem(CLAVE_MODO_OBTENCION, radio.value);
    }));
    elementos.prepararAudios.addEventListener("click", descargarAudiosFaltantes);
    elementos.completarAudios.addEventListener("click", descargarAudiosFaltantes);
    elementos.cancelarDescarga.addEventListener("click", cancelarDescargaAudios);
    elementos.eliminarAudios.addEventListener("click", eliminarAudiosGuardados);
    actualizarEstadoAudios();
}

elementos.sacar.addEventListener("click", extraccionManual); elementos.iniciar.addEventListener("click", iniciarAutomatico); elementos.pausar.addEventListener("click", pausarAutomatico);
elementos.intervalo.addEventListener("change", actualizarIntervalo); elementos.reiniciar.addEventListener("click", pedirReinicio);
elementos.confirmacion.addEventListener("close", () => { if (elementos.confirmacion.returnValue === "confirm") reiniciarPartida(); });
document.querySelectorAll(".opcion").forEach((boton) => boton.addEventListener("click", () => { elementos.intervalo.value = boton.dataset.segundos; actualizarIntervalo(); }));
document.getElementById("tabSalida").addEventListener("click", () => cambiarVista(false)); document.getElementById("tabNumerico").addEventListener("click", () => cambiarVista(true));
document.addEventListener("visibilitychange", () => { if (document.hidden && automaticoActivo) pausarAutomatico(); });
window.addEventListener("pagehide", () => { automaticoActivo = false; limpiarTemporizador(); cancelarLocucion(); liberarWakeLock(); });

if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => { /* La aplicación sigue disponible sin registro PWA. */ });

configurarAudio(); elementos.intervalo.value = partida.intervalo; marcarOpcionActiva(); renderizar();
