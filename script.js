"use strict";

/*
 * Rutas relativas de las fotografías disponibles en "images".
 * Los nombres coinciden exactamente con los archivos para que
 * funcionen también al publicar el sitio en GitHub Pages.
 */

const fotosInvitados = [
    "images/alicia.png",
    "images/alicia.webp",
    "images/ana.png",
    "images/ana.webp",
    "images/andrea.png",
    "images/andrea.webp",
    "images/cintia.png",
    "images/cintia.webp",
    "images/gabri.png",
    "images/gabri.webp",
    "images/gigi.png",
    "images/gigi.webp",
    "images/irene.png",
    "images/irene.webp",
    "images/jesus.png",
    "images/jesus.webp",
    "images/josefina.png",
    "images/josefina.webp",
    "images/lisa.png",
    "images/lisa.webp",
    "images/manolo.png",
    "images/manolo.webp",
    "images/marina.png",
    "images/marina.webp",
    "images/rachele.png",
    "images/rachele.webp",
    "images/rosa.png",
    "images/rosa.webp",
    "images/simona.png",
    "images/simona.webp",
    "images/tito.png",
    "images/tito.webp"
];

const cantidadInput = document.getElementById("cantidadCartones");
const botonGenerar = document.getElementById("botonGenerar");
const botonImprimir = document.getElementById("botonImprimir");
const contenedor = document.getElementById("contenedorCartones");
const mensaje = document.getElementById("mensaje");

botonGenerar.addEventListener("click", generarCartones);

botonImprimir.addEventListener("click", () => {
    if (contenedor.children.length === 0) {
        mostrarMensaje("Primero debes generar algún cartón.");
        return;
    }

    window.print();
});

/**
 * Devuelve un número entero aleatorio entre mínimo y máximo,
 * incluyendo ambos extremos.
 */
function enteroAleatorio(minimo, maximo) {
    return Math.floor(
        Math.random() * (maximo - minimo + 1)
    ) + minimo;
}

/**
 * Mezcla un array sin modificar el original.
 */
function mezclarArray(array) {
    const copia = [...array];

    for (let i = copia.length - 1; i > 0; i -= 1) {
        const j = enteroAleatorio(0, i);

        [copia[i], copia[j]] = [copia[j], copia[i]];
    }

    return copia;
}

/**
 * Obtiene una cantidad concreta de elementos aleatorios
 * sin repetir.
 */
function seleccionarAleatorios(array, cantidad) {
    return mezclarArray(array).slice(0, cantidad);
}

/**
 * Crea una matriz de 3 filas y 9 columnas.
 *
 * Cada fila tendrá exactamente 5 números.
 * Todas las columnas tendrán al menos un número.
 */
function crearMascaraCarton() {
    const columnas = Array.from(
        { length: 9 },
        (_, indice) => indice
    );

    let mascara;
    let todasLasColumnasUsadas = false;

    do {
        mascara = Array.from(
            { length: 3 },
            () => Array(9).fill(false)
        );

        for (let fila = 0; fila < 3; fila += 1) {
            const columnasFila = seleccionarAleatorios(
                columnas,
                5
            );

            for (const columna of columnasFila) {
                mascara[fila][columna] = true;
            }
        }

        todasLasColumnasUsadas = columnas.every(
            (columna) =>
                mascara.some(
                    (fila) => fila[columna] === true
                )
        );
    } while (!todasLasColumnasUsadas);

    return mascara;
}

/**
 * Devuelve el intervalo correspondiente a cada columna.
 *
 * Columna 0: 1-9
 * Columna 1: 10-19
 * ...
 * Columna 7: 70-79
 * Columna 8: 80-90
 */
function obtenerIntervaloColumna(columna) {
    if (columna === 0) {
        return {
            minimo: 1,
            maximo: 9
        };
    }

    if (columna === 8) {
        return {
            minimo: 80,
            maximo: 90
        };
    }

    return {
        minimo: columna * 10,
        maximo: columna * 10 + 9
    };
}

/**
 * Genera varios números distintos dentro de un intervalo.
 */
function generarNumerosDistintos(
    minimo,
    maximo,
    cantidad
) {
    const disponibles = [];

    for (let numero = minimo; numero <= maximo; numero += 1) {
        disponibles.push(numero);
    }

    return seleccionarAleatorios(
        disponibles,
        cantidad
    ).sort((a, b) => a - b);
}

/**
 * Genera un cartón completo.
 *
 * Las casillas con número contienen un valor numérico.
 * Las demás quedan inicialmente como null.
 */
function generarDatosCarton() {
    const mascara = crearMascaraCarton();

    const carton = Array.from(
        { length: 3 },
        () => Array(9).fill(null)
    );

    for (let columna = 0; columna < 9; columna += 1) {
        const filasConNumero = [];

        for (let fila = 0; fila < 3; fila += 1) {
            if (mascara[fila][columna]) {
                filasConNumero.push(fila);
            }
        }

        const intervalo = obtenerIntervaloColumna(columna);

        const numeros = generarNumerosDistintos(
            intervalo.minimo,
            intervalo.maximo,
            filasConNumero.length
        );

        filasConNumero.forEach((fila, indice) => {
            carton[fila][columna] = numeros[indice];
        });
    }

    return carton;
}

/**
 * Convierte los números del cartón en una clave para evitar
 * cartones duplicados.
 */
function obtenerClaveCarton(carton) {
    return carton
        .flat()
        .map((valor) => valor ?? "X")
        .join("-");
}

/**
 * Selecciona las fotos para los 12 huecos del cartón.
 *
 * Cuando hay al menos 12 fotos, no se repiten dentro
 * del mismo cartón.
 *
 * Si hay menos de 12, se mezclan y reutilizan.
 */
function seleccionarFotosParaCarton(cantidadHuecos) {
    if (fotosInvitados.length === 0) {
        return [];
    }

    if (fotosInvitados.length >= cantidadHuecos) {
        return seleccionarAleatorios(
            fotosInvitados,
            cantidadHuecos
        );
    }

    const resultado = [];

    while (resultado.length < cantidadHuecos) {
        resultado.push(...mezclarArray(fotosInvitados));
    }

    return resultado.slice(0, cantidadHuecos);
}

/**
 * Crea el elemento HTML de un cartón.
 */
function crearElementoCarton(carton, numeroCarton) {
    const articulo = document.createElement("article");
    articulo.className = "carton";

    const indicador = document.createElement("span");
    indicador.className = "carton__numero";
    indicador.textContent = `Cartón ${numeroCarton}`;

    const cabecera = document.createElement("header");
    cabecera.className = "carton__cabecera";

    const titulo = document.createElement("h2");
    titulo.textContent = "BINGO";

    const nombres = document.createElement("p");
    nombres.className = "carton__nombres";
    nombres.textContent = "Andrea & Cintia";

    const fecha = document.createElement("p");
    fecha.className = "carton__fecha";
    fecha.textContent = "5 de septiembre de 2026";

    cabecera.append(titulo, nombres, fecha);

    const tabla = document.createElement("div");
    tabla.className = "tabla-bingo";
    tabla.setAttribute(
        "aria-label",
        `Cartón de bingo número ${numeroCarton}`
    );

    const cantidadHuecos = carton
        .flat()
        .filter((valor) => valor === null)
        .length;

    const fotos = seleccionarFotosParaCarton(
        cantidadHuecos
    );

    let indiceFoto = 0;

    for (let fila = 0; fila < 3; fila += 1) {
        for (let columna = 0; columna < 9; columna += 1) {
            const casilla = document.createElement("div");
            const valor = carton[fila][columna];

            if (valor !== null) {
                casilla.className =
                    "casilla casilla--numero";

                casilla.textContent = valor;
            } else {
                casilla.className =
                    "casilla casilla--foto";

                if (fotos.length > 0) {
                    const imagen = document.createElement("img");
                    const rutaFoto = fotos[indiceFoto];

                    imagen.src = rutaFoto;
                    imagen.alt = "Fotografía de un invitado";
                    imagen.loading = "eager";

                    imagen.addEventListener("error", () => {
                        casilla.textContent = "Foto no disponible";
                        casilla.title =
                            `No se pudo cargar: ${rutaFoto}`;

                        mostrarMensaje(
                            `No se pudo cargar la fotografía: ${rutaFoto}`
                        );

                        imagen.remove();
                    });

                    casilla.appendChild(imagen);
                    indiceFoto += 1;
                } else {
                    casilla.textContent = "Foto";
                }
            }

            tabla.appendChild(casilla);
        }
    }

    const pie = document.createElement("p");
    pie.className = "carton__pie";
    pie.textContent = "¡Que empiece el juego!";

    articulo.append(
        indicador,
        cabecera,
        tabla,
        pie
    );

    return articulo;
}

/**
 * Genera todos los cartones solicitados y evita duplicados.
 */
function generarCartones() {
    const cantidad = Number.parseInt(
        cantidadInput.value,
        10
    );

    if (
        !Number.isInteger(cantidad) ||
        cantidad < 1 ||
        cantidad > 100
    ) {
        mostrarMensaje(
            "Introduce una cantidad entre 1 y 100."
        );

        return;
    }

    if (fotosInvitados.length === 0) {
        mostrarMensaje(
            "Debes añadir las rutas de las fotografías en script.js."
        );

        return;
    }

    contenedor.innerHTML = "";

    const clavesGeneradas = new Set();
    let cartonesCreados = 0;
    let intentos = 0;

    const maximoIntentos = cantidad * 100;

    while (
        cartonesCreados < cantidad &&
        intentos < maximoIntentos
    ) {
        intentos += 1;

        const carton = generarDatosCarton();
        const clave = obtenerClaveCarton(carton);

        if (clavesGeneradas.has(clave)) {
            continue;
        }

        clavesGeneradas.add(clave);
        cartonesCreados += 1;

        const elemento = crearElementoCarton(
            carton,
            cartonesCreados
        );

        contenedor.appendChild(elemento);
    }

    if (cartonesCreados < cantidad) {
        mostrarMensaje(
            `Solo se han podido generar ${cartonesCreados} cartones diferentes.`
        );

        return;
    }

    mostrarMensaje(
        `${cartonesCreados} cartones generados correctamente.`
    );
}

function mostrarMensaje(texto) {
    mensaje.textContent = texto;
}

/*
 * Genera una vista previa automáticamente al abrir la página.
 */
generarCartones();
