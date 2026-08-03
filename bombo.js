"use strict";

const CLAVE_ESTADO = "bingo-boda-bombo-v1";
const TOTAL_BOLAS = 90;
const INTERVALO_PREDETERMINADO = 5;

const elementos = {
    actual: document.getElementById("bolaActual"),
    anterior: document.getElementById("numeroAnterior"),
    restantes: document.getElementById("restantes"),
    estado: document.getElementById("estado"),
    mensaje: document.getElementById("mensaje"),
    sacar: document.getElementById("sacar"),
    iniciar: document.getElementById("iniciar"),
    pausar: document.getElementById("pausar"),
    intervalo: document.getElementById("intervalo"),
    selectorIntervalo: document.getElementById("selectorIntervalo"),
    errorIntervalo: document.getElementById("errorIntervalo"),
    cuentaAtras: document.getElementById("cuentaAtras"),
    totalExtraidos: document.getElementById("totalExtraidos"),
    listaSalida: document.getElementById("listaSalida"),
    historialVacio: document.getElementById("historialVacio"),
    cuadricula: document.getElementById("cuadricula"),
    reiniciar: document.getElementById("reiniciar"),
    confirmacion: document.getElementById("confirmacion")
};

let partida = cargarPartida();
let automaticoActivo = false;
let temporizador = null;
let proximaExtraccion = null;
let bloqueoManual = false;
let wakeLock = null;

function cargarPartida() {
    try {
        const guardada = JSON.parse(localStorage.getItem(CLAVE_ESTADO));
        const extraidosValidos = Array.isArray(guardada?.extraidos)
            && new Set(guardada.extraidos).size === guardada.extraidos.length
            && guardada.extraidos.every((numero) => Number.isInteger(numero) && numero >= 1 && numero <= TOTAL_BOLAS);
        const intervaloValido = validarIntervalo(guardada?.intervalo);
        if (extraidosValidos) return estadoInicial(intervaloValido || INTERVALO_PREDETERMINADO, guardada.extraidos);
    } catch (_error) {
        localStorage.removeItem(CLAVE_ESTADO);
    }
    return estadoInicial();
}

function estadoInicial(intervalo = INTERVALO_PREDETERMINADO, extraidos = []) {
    return { extraidos: [...extraidos], intervalo };
}

function validarIntervalo(valor) {
    const numero = Number(valor);
    return Number.isInteger(numero) && numero >= 1 && numero <= 300 ? numero : null;
}

function guardarPartida() {
    localStorage.setItem(CLAVE_ESTADO, JSON.stringify({
        extraidos: partida.extraidos,
        actual: partida.extraidos.at(-1) ?? null,
        anterior: partida.extraidos.at(-2) ?? null,
        intervalo: partida.intervalo
    }));
}

function extraerNumero() {
    if (automaticoActivo && document.hidden) return false;
    const disponibles = Array.from({ length: TOTAL_BOLAS }, (_, indice) => indice + 1)
        .filter((numero) => !partida.extraidos.includes(numero));
    if (!disponibles.length) {
        terminarPartida();
        return false;
    }
    const numero = disponibles[Math.floor(Math.random() * disponibles.length)];
    partida.extraidos.push(numero);
    guardarPartida();
    renderizar();
    animarBola();
    if (partida.extraidos.length === TOTAL_BOLAS) terminarPartida();
    return true;
}

function animarBola() {
    elementos.actual.classList.remove("nueva");
    void elementos.actual.offsetWidth;
    elementos.actual.classList.add("nueva");
}

function extraccionManual() {
    if (bloqueoManual || automaticoActivo) return;
    bloqueoManual = true;
    elementos.sacar.disabled = true;
    extraerNumero();
    window.setTimeout(() => {
        bloqueoManual = false;
        actualizarControles();
    }, 450);
}

function iniciarAutomatico() {
    if (automaticoActivo || partida.extraidos.length === TOTAL_BOLAS) return;
    if (!actualizarIntervalo()) return;
    automaticoActivo = true;
    actualizarControles();
    solicitarWakeLock();
    if (extraerNumero()) programarSiguiente();
}

function programarSiguiente() {
    limpiarTemporizador();
    if (!automaticoActivo || partida.extraidos.length === TOTAL_BOLAS) return;
    proximaExtraccion = Date.now() + partida.intervalo * 1000;
    actualizarCuentaAtras();
    temporizador = window.setInterval(actualizarCuentaAtras, 250);
}

function actualizarCuentaAtras() {
    if (!automaticoActivo || document.hidden) return;
    const milisegundos = proximaExtraccion - Date.now();
    if (milisegundos <= 0) {
        limpiarTemporizador();
        if (extraerNumero() && automaticoActivo) programarSiguiente();
        return;
    }
    elementos.cuentaAtras.textContent = `Siguiente número en ${Math.ceil(milisegundos / 1000)} s`;
}

function pausarAutomatico() {
    if (!automaticoActivo) return;
    automaticoActivo = false;
    limpiarTemporizador();
    liberarWakeLock();
    actualizarControles("pausado");
}

function terminarPartida() {
    automaticoActivo = false;
    limpiarTemporizador();
    liberarWakeLock();
    elementos.mensaje.textContent = "No quedan bolas. La partida ha terminado.";
    actualizarControles("terminado");
}

function limpiarTemporizador() {
    if (temporizador !== null) window.clearInterval(temporizador);
    temporizador = null;
    proximaExtraccion = null;
}

function actualizarIntervalo() {
    const valor = validarIntervalo(elementos.intervalo.value);
    if (!valor) {
        elementos.errorIntervalo.textContent = "Introduce un número entero entre 1 y 300.";
        elementos.intervalo.focus();
        return false;
    }
    elementos.errorIntervalo.textContent = "";
    partida.intervalo = valor;
    marcarOpcionActiva();
    guardarPartida();
    return true;
}

function renderizar() {
    const actual = partida.extraidos.at(-1) ?? "—";
    const anterior = partida.extraidos.at(-2) ?? "—";
    elementos.actual.textContent = actual;
    elementos.anterior.textContent = anterior;
    elementos.restantes.textContent = `Quedan ${TOTAL_BOLAS - partida.extraidos.length} de ${TOTAL_BOLAS}`;
    elementos.totalExtraidos.textContent = partida.extraidos.length;
    elementos.historialVacio.hidden = partida.extraidos.length > 0;
    elementos.listaSalida.replaceChildren(...partida.extraidos.map(crearElementoSalida));
    renderizarCuadricula();
    actualizarControles();
}

function crearElementoSalida(numero, indice) {
    const elemento = document.createElement("li");
    elemento.textContent = numero;
    elemento.setAttribute("aria-label", `${numero}, ${indice + 1}.º en salir`);
    if (indice === partida.extraidos.length - 1) elemento.classList.add("ultimo");
    const posicion = document.createElement("small");
    posicion.textContent = `${indice + 1}.º`;
    elemento.append(posicion);
    return elemento;
}

function renderizarCuadricula() {
    const extraidos = new Set(partida.extraidos);
    const ultimo = partida.extraidos.at(-1);
    const bolas = Array.from({ length: TOTAL_BOLAS }, (_, indice) => {
        const numero = indice + 1;
        const bola = document.createElement("span");
        bola.textContent = numero;
        bola.classList.toggle("extraido", extraidos.has(numero));
        bola.classList.toggle("ultimo", numero === ultimo);
        bola.setAttribute("aria-label", `${numero}: ${extraidos.has(numero) ? "extraído" : "pendiente"}${numero === ultimo ? ", último" : ""}`);
        return bola;
    });
    elementos.cuadricula.replaceChildren(...bolas);
}

function actualizarControles(forzarEstado) {
    const terminada = partida.extraidos.length === TOTAL_BOLAS;
    elementos.sacar.disabled = automaticoActivo || terminada || bloqueoManual;
    elementos.iniciar.disabled = automaticoActivo || terminada;
    elementos.iniciar.textContent = partida.extraidos.length && !terminada ? "Reanudar automático" : "Iniciar automático";
    elementos.pausar.disabled = !automaticoActivo;
    elementos.selectorIntervalo.disabled = automaticoActivo;
    if (automaticoActivo) {
        mostrarEstado("Automático activo", "activo");
    } else if (terminada || forzarEstado === "terminado") {
        mostrarEstado("Partida terminada", "terminado");
        elementos.cuentaAtras.textContent = "No quedan bolas";
    } else if (forzarEstado === "pausado" || partida.extraidos.length) {
        mostrarEstado("Pausado", "pausado");
        elementos.cuentaAtras.textContent = "Automático pausado";
    } else {
        mostrarEstado("Preparado", "preparado");
        elementos.cuentaAtras.textContent = "Automático detenido";
    }
}

function mostrarEstado(texto, estado) {
    elementos.estado.textContent = texto;
    elementos.estado.dataset.estado = estado;
}

function marcarOpcionActiva() {
    document.querySelectorAll(".opcion").forEach((boton) => {
        boton.classList.toggle("opcion--activa", Number(boton.dataset.segundos) === partida.intervalo);
    });
}

function cambiarVista(mostrarNumerica) {
    document.getElementById("vistaSalida").hidden = mostrarNumerica;
    document.getElementById("vistaNumerica").hidden = !mostrarNumerica;
    document.getElementById("tabSalida").classList.toggle("activa", !mostrarNumerica);
    document.getElementById("tabNumerico").classList.toggle("activa", mostrarNumerica);
    document.getElementById("tabSalida").setAttribute("aria-selected", String(!mostrarNumerica));
    document.getElementById("tabNumerico").setAttribute("aria-selected", String(mostrarNumerica));
}

function pedirReinicio() {
    if (typeof elementos.confirmacion.showModal === "function") elementos.confirmacion.showModal();
    else if (window.confirm("Se borrará el historial, volverán las 90 bolas y se detendrá el automático. ¿Reiniciar?")) reiniciarPartida();
}

function reiniciarPartida() {
    pausarAutomatico();
    localStorage.removeItem(CLAVE_ESTADO);
    partida = estadoInicial(partida.intervalo);
    elementos.intervalo.value = partida.intervalo;
    elementos.mensaje.textContent = "Partida reiniciada.";
    guardarPartida();
    marcarOpcionActiva();
    renderizar();
}

async function solicitarWakeLock() {
    if (!("wakeLock" in navigator) || document.hidden) return;
    try { wakeLock = await navigator.wakeLock.request("screen"); } catch (_error) { wakeLock = null; }
}

async function liberarWakeLock() {
    if (!wakeLock) return;
    try { await wakeLock.release(); } catch (_error) { /* Ya liberado por el navegador. */ }
    wakeLock = null;
}

elementos.sacar.addEventListener("click", extraccionManual);
elementos.iniciar.addEventListener("click", iniciarAutomatico);
elementos.pausar.addEventListener("click", pausarAutomatico);
elementos.intervalo.addEventListener("change", actualizarIntervalo);
elementos.reiniciar.addEventListener("click", pedirReinicio);
elementos.confirmacion.addEventListener("close", () => {
    if (elementos.confirmacion.returnValue === "confirm") reiniciarPartida();
});
document.querySelectorAll(".opcion").forEach((boton) => boton.addEventListener("click", () => {
    elementos.intervalo.value = boton.dataset.segundos;
    actualizarIntervalo();
}));
document.getElementById("tabSalida").addEventListener("click", () => cambiarVista(false));
document.getElementById("tabNumerico").addEventListener("click", () => cambiarVista(true));
document.addEventListener("visibilitychange", () => {
    if (!automaticoActivo) return;
    if (document.hidden) {
        limpiarTemporizador();
        liberarWakeLock();
    } else {
        solicitarWakeLock();
        programarSiguiente();
    }
});
window.addEventListener("pagehide", () => {
    limpiarTemporizador();
    liberarWakeLock();
});

elementos.intervalo.value = partida.intervalo;
marcarOpcionActiva();
renderizar();
