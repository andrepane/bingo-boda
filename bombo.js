"use strict";

const CLAVE_ESTADO = "bingo-boda-bombo-v1";
const CLAVE_MODO_AUDIO = "bingo-boda-modo-audio";
const CLAVE_MODO_OBTENCION = "bingo-boda-modo-obtencion";
const CLAVE_CONFIG_AVISOS = "bingo-boda-config-avisos";
const VERSION_AUDIO = "rasalgethi-v1";
const CACHE_TTS = `bingo-tts-${VERSION_AUDIO}`;
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
    eliminarAudios: document.getElementById("eliminarAudios"),
    cantarLinea: document.getElementById("cantarLinea"), cantarBingo: document.getElementById("cantarBingo"),
    confirmaciones: document.getElementById("confirmaciones"), avisoJugada: document.getElementById("avisoJugada"),
    tituloAviso: document.getElementById("tituloAviso"), textoAviso: document.getElementById("textoAviso"),
    iconoAviso: document.getElementById("iconoAviso"), confirmarJugada: document.getElementById("confirmarJugada"),
    falsaAlarma: document.getElementById("falsaAlarma"), vozEspanol: document.getElementById("vozEspanol"),
    vozItaliano: document.getElementById("vozItaliano"), velocidadVoz: document.getElementById("velocidadVoz"),
    tonoVoz: document.getElementById("tonoVoz")
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
let botonOrigenAviso = null;
let anunciandoJugada = false;

function estadoInicial(intervalo = INTERVALO_PREDETERMINADO, extraidos = []) {
    return { extraidos: [...extraidos], intervalo, lineaConfirmada: false, bingoConfirmado: false, avisoPendiente: null };
}
function validarIntervalo(valor) { const numero = Number(valor); return Number.isInteger(numero) && numero >= 1 && numero <= 300 ? numero : null; }
function cargarPartida() {
    try {
        const guardada = JSON.parse(localStorage.getItem(CLAVE_ESTADO));
        const validos = Array.isArray(guardada?.extraidos) && new Set(guardada.extraidos).size === guardada.extraidos.length
            && guardada.extraidos.every((n) => Number.isInteger(n) && n >= 1 && n <= TOTAL_BOLAS);
        if (validos) {
            const estado = estadoInicial(validarIntervalo(guardada.intervalo) || INTERVALO_PREDETERMINADO, guardada.extraidos);
            estado.lineaConfirmada = guardada.lineaConfirmada === true;
            estado.bingoConfirmado = guardada.bingoConfirmado === true;
            estado.avisoPendiente = ["linea", "bingo"].includes(guardada.avisoPendiente) ? guardada.avisoPendiente : null;
            return estado;
        }
    } catch (_error) { localStorage.removeItem(CLAVE_ESTADO); }
    return estadoInicial();
}
function guardarPartida() { localStorage.setItem(CLAVE_ESTADO, JSON.stringify(partida)); }

function cancelarLocucion() {
    cicloLocucion += 1;
    reproduciendo = false;
    reproductor.pause(); reproductor.removeAttribute("src"); reproductor.load();
    if (urlAudioActual) URL.revokeObjectURL(urlAudioActual);
    urlAudioActual = null;
    if (resolverReproduccion) resolverReproduccion();
    resolverReproduccion = null;
    anunciandoJugada = false;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
function crearRutaTts(numero, idioma) {
    return `/api/tts?numero=${encodeURIComponent(numero)}&idioma=${encodeURIComponent(idioma)}&v=${encodeURIComponent(VERSION_AUDIO)}`;
}
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

const textosJugada = {
    linea: { es: "¡Han cantado línea!", it: "Hanno fatto cinquina!", icono: "〰", confirmar: "Confirmar línea" },
    bingo: { es: "¡Han cantado bingo!", it: "Hanno fatto tombola!", icono: "★", confirmar: "Confirmar bingo" }
};
function secuenciaIdiomas() {
    return { "es-it": ["es", "it"], "it-es": ["it", "es"], es: ["es"], it: ["it"], off: [] }[elementos.modoAudio.value] || [];
}
function vozSeleccionada(idioma) {
    if (!("speechSynthesis" in window)) return null;
    const nombre = idioma === "es" ? elementos.vozEspanol.value : elementos.vozItaliano.value;
    return window.speechSynthesis.getVoices().find((voz) => voz.name === nombre) || null;
}
function pronunciarFrase(texto, idioma, ciclo) {
    return new Promise((resolve) => {
        if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window) || ciclo !== cicloLocucion) return resolve();
        const locucion = new SpeechSynthesisUtterance(texto);
        locucion.lang = idioma === "es" ? "es-ES" : "it-IT";
        locucion.voice = vozSeleccionada(idioma);
        locucion.rate = Number(elementos.velocidadVoz.value) || 1;
        locucion.pitch = Number(elementos.tonoVoz.value) || 1;
        locucion.onend = resolve; locucion.onerror = resolve;
        window.speechSynthesis.speak(locucion);
    });
}
async function anunciarJugada(tipo) {
    const ciclo = cicloLocucion;
    anunciandoJugada = true;
    for (const idioma of secuenciaIdiomas()) {
        if (ciclo !== cicloLocucion || partida.avisoPendiente !== tipo) break;
        await pronunciarFrase(textosJugada[tipo][idioma], idioma, ciclo);
    }
    if (ciclo === cicloLocucion) anunciandoJugada = false;
}
function detenerParaComprobar() {
    automaticoActivo = false; limpiarTemporizador(); cancelarLocucion(); liberarWakeLock();
}
function mostrarAviso(tipo, anunciar = true) {
    if (!textosJugada[tipo] || elementos.avisoJugada.open || partida.bingoConfirmado || (tipo === "linea" && partida.lineaConfirmada)) return;
    detenerParaComprobar();
    partida.avisoPendiente = tipo; guardarPartida();
    botonOrigenAviso = document.activeElement;
    const texto = textosJugada[tipo];
    elementos.avisoJugada.dataset.tipo = tipo; elementos.tituloAviso.textContent = texto.es;
    elementos.textoAviso.textContent = texto.it; elementos.iconoAviso.textContent = texto.icono;
    elementos.confirmarJugada.textContent = texto.confirmar;
    elementos.avisoJugada.showModal(); elementos.confirmarJugada.focus(); actualizarControles("pausado");
    if (anunciar) anunciarJugada(tipo);
}
function cerrarAviso() {
    cancelarLocucion(); partida.avisoPendiente = null; guardarPartida();
    elementos.avisoJugada.close(); actualizarControles("pausado");
    if (botonOrigenAviso?.isConnected) botonOrigenAviso.focus();
    botonOrigenAviso = null;
}
function confirmarJugada() {
    const tipo = partida.avisoPendiente;
    if (!tipo) return;
    if (tipo === "linea") partida.lineaConfirmada = true;
    else partida.bingoConfirmado = true;
    cerrarAviso(); guardarPartida(); renderizar();
    if (tipo === "bingo") elementos.mensaje.textContent = "¡Bingo confirmado! Partida finalizada.";
}
function falsaAlarma() { if (partida.avisoPendiente) cerrarAviso(); }

function extraerNumero() {
    if (partida.avisoPendiente || partida.bingoConfirmado) return null;
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
    if (bloqueoManual || automaticoActivo || reproduciendo || partida.avisoPendiente || partida.bingoConfirmado) return;
    bloqueoManual = true; actualizarControles();
    const numero = extraerNumero();
    if (numero !== null) await locutarNumero(numero);
    bloqueoManual = false; actualizarControles();
}
async function iniciarAutomatico() {
    if (automaticoActivo || partida.extraidos.length === TOTAL_BOLAS || partida.avisoPendiente || partida.bingoConfirmado || !actualizarIntervalo()) return;
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
    elementos.listaSalida.replaceChildren(...partida.extraidos.map(crearElementoSalida)); renderizarCuadricula();
    elementos.confirmaciones.textContent = partida.bingoConfirmado ? "★ Bingo confirmado · Partida finalizada" : partida.lineaConfirmada ? "✓ Línea confirmada" : "";
    elementos.cantarLinea.classList.toggle("confirmada", partida.lineaConfirmada);
    elementos.cantarLinea.innerHTML = partida.lineaConfirmada ? '<span aria-hidden="true">✓</span> Línea confirmada' : '<span aria-hidden="true">〰</span> ¡Línea!';
    actualizarControles();
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
    const bloqueada = Boolean(partida.avisoPendiente) || partida.bingoConfirmado;
    elementos.sacar.disabled = automaticoActivo || terminada || bloqueoManual || reproduciendo || bloqueada;
    elementos.iniciar.disabled = automaticoActivo || terminada || reproduciendo || bloqueada;
    elementos.iniciar.textContent = partida.extraidos.length && !terminada ? "Reanudar automático" : "Iniciar automático";
    elementos.pausar.disabled = !automaticoActivo; elementos.selectorIntervalo.disabled = automaticoActivo;
    elementos.probarAudio.disabled = reproduciendo || automaticoActivo || bloqueoManual;
    elementos.cantarLinea.disabled = partida.lineaConfirmada || partida.bingoConfirmado || Boolean(partida.avisoPendiente) || anunciandoJugada;
    elementos.cantarBingo.disabled = partida.bingoConfirmado || Boolean(partida.avisoPendiente) || anunciandoJugada;
    if (automaticoActivo) mostrarEstado(reproduciendo ? "Automático activo · reproduciendo" : "Automático activo", "activo");
    else if (partida.bingoConfirmado) { mostrarEstado("Bingo confirmado · Partida finalizada", "terminado"); elementos.cuentaAtras.textContent = "Partida finalizada"; }
    else if (partida.avisoPendiente) { mostrarEstado("Pausado para comprobar", "pausado"); elementos.cuentaAtras.textContent = "Comprobación en curso"; }
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
    detenerParaComprobar();
    if (elementos.avisoJugada.open) elementos.avisoJugada.close();
    localStorage.removeItem(CLAVE_ESTADO); partida = estadoInicial(partida.intervalo); botonOrigenAviso = null;
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

async function limpiarCachesTtsAntiguas() {
    if (!("caches" in window)) return;
    const nombres = await caches.keys();
    await Promise.all(nombres
        .filter((nombre) => nombre.startsWith("bingo-tts-") && nombre !== CACHE_TTS)
        .map((nombre) => caches.delete(nombre)));
}

function configurarAudio() {
    const modoGuardado = localStorage.getItem(CLAVE_MODO_AUDIO);
    if (["es-it", "it-es", "es", "it", "off"].includes(modoGuardado)) elementos.modoAudio.value = modoGuardado;
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
    let configAvisos = {};
    try { configAvisos = JSON.parse(localStorage.getItem(CLAVE_CONFIG_AVISOS)) || {}; } catch (_error) { /* Usa valores predeterminados. */ }
    elementos.velocidadVoz.value = configAvisos.velocidad || "1"; elementos.tonoVoz.value = configAvisos.tono || "1";
    function cargarVoces() {
        if (!("speechSynthesis" in window)) return;
        const voces = window.speechSynthesis.getVoices();
        [[elementos.vozEspanol, "es", configAvisos.vozEs], [elementos.vozItaliano, "it", configAvisos.vozIt]].forEach(([select, idioma, elegida]) => {
            const anterior = select.value || elegida || "";
            select.replaceChildren(new Option("Voz predeterminada", ""), ...voces.filter((voz) => voz.lang.toLowerCase().startsWith(idioma)).map((voz) => new Option(`${voz.name} (${voz.lang})`, voz.name)));
            if ([...select.options].some((opcion) => opcion.value === anterior)) select.value = anterior;
        });
    }
    function guardarConfigAvisos() {
        localStorage.setItem(CLAVE_CONFIG_AVISOS, JSON.stringify({ vozEs: elementos.vozEspanol.value, vozIt: elementos.vozItaliano.value, velocidad: elementos.velocidadVoz.value, tono: elementos.tonoVoz.value }));
    }
    [elementos.vozEspanol, elementos.vozItaliano, elementos.velocidadVoz, elementos.tonoVoz].forEach((control) => control.addEventListener("change", guardarConfigAvisos));
    cargarVoces();
    if ("speechSynthesis" in window) window.speechSynthesis.addEventListener?.("voiceschanged", cargarVoces);
    actualizarEstadoAudios();
}

elementos.sacar.addEventListener("click", extraccionManual); elementos.iniciar.addEventListener("click", iniciarAutomatico); elementos.pausar.addEventListener("click", pausarAutomatico);
elementos.cantarLinea.addEventListener("click", () => mostrarAviso("linea")); elementos.cantarBingo.addEventListener("click", () => mostrarAviso("bingo"));
elementos.confirmarJugada.addEventListener("click", confirmarJugada); elementos.falsaAlarma.addEventListener("click", falsaAlarma);
elementos.avisoJugada.addEventListener("cancel", (evento) => { evento.preventDefault(); falsaAlarma(); });
elementos.intervalo.addEventListener("change", actualizarIntervalo); elementos.reiniciar.addEventListener("click", pedirReinicio);
elementos.confirmacion.addEventListener("close", () => { if (elementos.confirmacion.returnValue === "confirm") reiniciarPartida(); });
document.querySelectorAll(".opcion").forEach((boton) => boton.addEventListener("click", () => { elementos.intervalo.value = boton.dataset.segundos; actualizarIntervalo(); }));
document.getElementById("tabSalida").addEventListener("click", () => cambiarVista(false)); document.getElementById("tabNumerico").addEventListener("click", () => cambiarVista(true));
document.addEventListener("visibilitychange", () => { if (document.hidden && automaticoActivo) pausarAutomatico(); });
window.addEventListener("pagehide", () => { automaticoActivo = false; limpiarTemporizador(); cancelarLocucion(); liberarWakeLock(); });

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js")
        .then((registro) => registro.update())
        .catch(() => { /* La aplicación sigue disponible sin registro PWA. */ });
}

limpiarCachesTtsAntiguas().catch(() => { /* Una limpieza fallida no debe bloquear la interfaz. */ });
configurarAudio(); elementos.intervalo.value = partida.intervalo; marcarOpcionActiva(); renderizar();
if (partida.avisoPendiente) {
    const pendiente = partida.avisoPendiente; partida.avisoPendiente = null;
    window.setTimeout(() => mostrarAviso(pendiente, false), 0);
}
