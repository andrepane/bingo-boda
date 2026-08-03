"use strict";

const CLAVE_ESTADO = "bingo-boda-bombo-v1";
const CLAVE_VOZ = "bingo-boda-voz-v1";
const TOTAL_BOLAS = 90;
const INTERVALO_PREDETERMINADO = 5;
const SPEECH_TIMEOUT = 12000;
const PAUSA_IDIOMAS = 280;
const VELOCIDADES = { slow: 0.85, normal: 1, lively: 1.12 };
const TONOS = { normal: 1, fun: 1.15 };

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
    controlesVoz: document.getElementById("controlesVoz"), avisoVoz: document.getElementById("avisoVoz"),
    modoVoz: document.getElementById("modoVoz"), vozEspanola: document.getElementById("vozEspanola"),
    vozItaliana: document.getElementById("vozItaliana"), velocidadVoz: document.getElementById("velocidadVoz"),
    tonoVoz: document.getElementById("tonoVoz"), probarVoces: document.getElementById("probarVoces")
};

const vozDisponible = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
let partida = cargarPartida();
let preferenciasVoz = cargarPreferenciasVoz();
let voces = [];
let automaticoActivo = false;
let temporizador = null;
let bloqueoManual = false;
let hablando = false;
let cicloVoz = 0;
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
function cargarPreferenciasVoz() {
    const iniciales = { modo: "es-it", vozEs: "", vozIt: "", velocidad: "normal", tono: "fun" };
    try {
        const datos = JSON.parse(localStorage.getItem(CLAVE_VOZ));
        if (["es-it", "it-es", "es", "it", "off"].includes(datos?.modo)) iniciales.modo = datos.modo;
        if (typeof datos?.vozEs === "string") iniciales.vozEs = datos.vozEs;
        if (typeof datos?.vozIt === "string") iniciales.vozIt = datos.vozIt;
        if (datos?.velocidad in VELOCIDADES) iniciales.velocidad = datos.velocidad;
        if (datos?.tono in TONOS) iniciales.tono = datos.tono;
    } catch (_error) { localStorage.removeItem(CLAVE_VOZ); }
    return iniciales;
}
function guardarPartida() { localStorage.setItem(CLAVE_ESTADO, JSON.stringify({ extraidos: partida.extraidos, intervalo: partida.intervalo })); }
function guardarPreferenciasVoz() {
    preferenciasVoz = { modo: elementos.modoVoz.value, vozEs: elementos.vozEspanola.value, vozIt: elementos.vozItaliana.value, velocidad: elementos.velocidadVoz.value, tono: elementos.tonoVoz.value };
    localStorage.setItem(CLAVE_VOZ, JSON.stringify(preferenciasVoz));
}

function obtenerVoces() {
    if (!vozDisponible) return;
    voces = window.speechSynthesis.getVoices();
    rellenarSelectorVoz(elementos.vozEspanola, "es", preferenciasVoz.vozEs, "Automática (es-ES)");
    rellenarSelectorVoz(elementos.vozItaliana, "it", preferenciasVoz.vozIt, "Automatica (it-IT)");
}
function rellenarSelectorVoz(selector, idioma, guardada, etiquetaAutomatica) {
    const compatibles = voces.filter((voz) => voz.lang.toLowerCase().startsWith(idioma));
    const automatica = new Option(etiquetaAutomatica, "");
    selector.replaceChildren(automatica, ...compatibles.map((voz) => new Option(`${voz.name} (${voz.lang})`, voz.voiceURI)));
    selector.value = compatibles.some((voz) => voz.voiceURI === guardada) ? guardada : "";
}
function vozPara(idioma) {
    const uri = idioma === "es" ? preferenciasVoz.vozEs : preferenciasVoz.vozIt;
    const manual = voces.find((voz) => voz.voiceURI === uri && voz.lang.toLowerCase().startsWith(idioma));
    if (manual) return manual;
    const exacta = voces.find((voz) => voz.lang.toLowerCase() === `${idioma}-${idioma === "es" ? "es" : "it"}`);
    return exacta || voces.find((voz) => voz.lang.toLowerCase().startsWith(idioma));
}

const UNIDADES_ES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const ESPECIALES_ES = ["diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const DECENAS_ES = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
function numeroEspanol(numero) {
    if (numero < 10) return UNIDADES_ES[numero];
    if (numero < 30) return ESPECIALES_ES[numero - 10];
    const decena = Math.floor(numero / 10); const unidad = numero % 10;
    return DECENAS_ES[decena] + (unidad ? ` y ${UNIDADES_ES[unidad]}` : "");
}
const UNIDADES_IT = ["", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove"];
const ESPECIALES_IT = ["dieci", "undici", "dodici", "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto", "diciannove"];
const DECENAS_IT = ["", "", "venti", "trenta", "quaranta", "cinquanta", "sessanta", "settanta", "ottanta", "novanta"];
function numeroItaliano(numero) {
    if (numero < 10) return UNIDADES_IT[numero];
    if (numero < 20) return ESPECIALES_IT[numero - 10];
    const decena = Math.floor(numero / 10); const unidad = numero % 10;
    let base = DECENAS_IT[decena];
    if (unidad === 1 || unidad === 8) base = base.slice(0, -1);
    return base + UNIDADES_IT[unidad];
}
function idiomasActivos() {
    return { "es-it": ["es", "it"], "it-es": ["it", "es"], es: ["es"], it: ["it"], off: [] }[preferenciasVoz.modo] || [];
}
function cancelarLocucion() {
    cicloVoz += 1;
    hablando = false;
    if (vozDisponible) window.speechSynthesis.cancel();
}
function decir(texto, idioma, ciclo) {
    return new Promise((resolve) => {
        if (!vozDisponible || ciclo !== cicloVoz) { resolve(); return; }
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = idioma === "es" ? "es-ES" : "it-IT";
        utterance.rate = VELOCIDADES[preferenciasVoz.velocidad];
        utterance.pitch = TONOS[preferenciasVoz.tono];
        const seleccionada = vozPara(idioma);
        if (seleccionada) utterance.voice = seleccionada;
        let resuelta = false;
        const finalizar = () => { if (!resuelta) { resuelta = true; window.clearTimeout(seguridad); resolve(); } };
        const seguridad = window.setTimeout(() => { window.speechSynthesis.cancel(); finalizar(); }, SPEECH_TIMEOUT);
        utterance.onend = finalizar;
        utterance.onerror = finalizar;
        try { window.speechSynthesis.speak(utterance); } catch (_error) { finalizar(); }
    });
}
function pausa(ms, ciclo) { return new Promise((resolve) => { if (ciclo !== cicloVoz) resolve(); else window.setTimeout(resolve, ms); }); }
async function locutar(contenidos) {
    if (!vozDisponible || !idiomasActivos().length) return;
    cancelarLocucion();
    const ciclo = cicloVoz;
    hablando = true;
    actualizarControles();
    const idiomas = idiomasActivos();
    for (let indice = 0; indice < idiomas.length && ciclo === cicloVoz; indice += 1) {
        const idioma = idiomas[indice];
        await decir(contenidos[idioma], idioma, ciclo);
        if (indice < idiomas.length - 1 && ciclo === cicloVoz) await pausa(PAUSA_IDIOMAS, ciclo);
    }
    if (ciclo === cicloVoz) { hablando = false; actualizarControles(); }
}
async function locutarNumero(numero) { await locutar({ es: numeroEspanol(numero), it: numeroItaliano(numero) }); }
async function probarVoces() {
    if (hablando) return;
    await locutar({ es: "Bingo, prueba de voz", it: "Bingo, prova della voce" });
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
    if (bloqueoManual || automaticoActivo || hablando) return;
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
    elementos.sacar.disabled = automaticoActivo || terminada || bloqueoManual || hablando;
    elementos.iniciar.disabled = automaticoActivo || terminada || hablando;
    elementos.iniciar.textContent = partida.extraidos.length && !terminada ? "Reanudar automático" : "Iniciar automático";
    elementos.pausar.disabled = !automaticoActivo; elementos.selectorIntervalo.disabled = automaticoActivo;
    elementos.probarVoces.disabled = !vozDisponible || hablando || automaticoActivo || bloqueoManual;
    if (automaticoActivo) mostrarEstado(hablando ? "Automático activo · hablando" : "Automático activo", "activo");
    else if (terminada || forzarEstado === "terminado") { mostrarEstado("Partida terminada", "terminado"); elementos.cuentaAtras.textContent = "No quedan bolas"; }
    else if (hablando) mostrarEstado("Locución en curso", "activo");
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
    elementos.modoVoz.value = preferenciasVoz.modo; elementos.velocidadVoz.value = preferenciasVoz.velocidad; elementos.tonoVoz.value = preferenciasVoz.tono;
    if (!vozDisponible) { elementos.controlesVoz.disabled = true; elementos.avisoVoz.hidden = false; return; }
    obtenerVoces(); window.speechSynthesis.addEventListener("voiceschanged", obtenerVoces);
    [elementos.modoVoz, elementos.vozEspanola, elementos.vozItaliana, elementos.velocidadVoz, elementos.tonoVoz].forEach((control) => control.addEventListener("change", guardarPreferenciasVoz));
    elementos.probarVoces.addEventListener("click", probarVoces);
}

elementos.sacar.addEventListener("click", extraccionManual); elementos.iniciar.addEventListener("click", iniciarAutomatico); elementos.pausar.addEventListener("click", pausarAutomatico);
elementos.intervalo.addEventListener("change", actualizarIntervalo); elementos.reiniciar.addEventListener("click", pedirReinicio);
elementos.confirmacion.addEventListener("close", () => { if (elementos.confirmacion.returnValue === "confirm") reiniciarPartida(); });
document.querySelectorAll(".opcion").forEach((boton) => boton.addEventListener("click", () => { elementos.intervalo.value = boton.dataset.segundos; actualizarIntervalo(); }));
document.getElementById("tabSalida").addEventListener("click", () => cambiarVista(false)); document.getElementById("tabNumerico").addEventListener("click", () => cambiarVista(true));
document.addEventListener("visibilitychange", () => { if (document.hidden && automaticoActivo) pausarAutomatico(); });
window.addEventListener("pagehide", () => { automaticoActivo = false; limpiarTemporizador(); cancelarLocucion(); liberarWakeLock(); });

configurarVoz(); elementos.intervalo.value = partida.intervalo; marcarOpcionActiva(); renderizar();
