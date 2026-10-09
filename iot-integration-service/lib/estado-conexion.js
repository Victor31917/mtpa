"use strict";

// =========================================================
// M.T.P.A. - Servicio de Integración IoT
// lib/estado-conexion.js — detección de dispositivos desconectados
// =========================================================
//
// Un dispositivo que publica un latido o una medición está vivo.
// Si pasa más de LATIDO_TIMEOUT_SEGUNDOS (30 s por defecto, ver
// docs/contrato-mqtt.md) sin ninguna de las dos señales, se marca
// "estadoConexion: desconectado" en "dispositivos/{dispositivoId}".
//
// Para no agotar la cuota gratuita de Firestore NO se escribe en
// cada latido: el estado vive en memoria y solo se escribe
//
//   - al pasar a "conectado" (primera señal, o tras una caída),
//   - para refrescar "ultimaComunicacionEn" cada
//     LATIDO_REFRESCO_SEGUNDOS mientras sigue conectado,
//   - al pasar a "desconectado" (una sola vez por caída).
//
// Limitación: la detección corre dentro del Servicio de
// Integración. Si el servicio está caído nadie marca dispositivos
// como desconectados.
//
// =========================================================

const PREFIJO_LOG = "[iot-integration-service]";

const COLECCION_DISPOSITIVOS = "dispositivos";

const CONECTADO = "conectado";
const DESCONECTADO = "desconectado";
const DESCONOCIDO = "desconocido";

const VALORES_POR_DEFECTO = {
  timeoutSegundos: 30,
  revisionSegundos: 5,
  refrescoSegundos: 60,
};

// Tiempo que se recuerda un dispositivo que no existe en Firestore
// antes de volver a intentar escribirle (y volver a avisar).
const DESCONOCIDO_RETENCION_MS = 10 * 60 * 1000;

const ID_PROHIBIDO_RE = /[\s/+#]/;

/**
 * Indica si el id proveniente del tópico sirve como id de documento.
 *
 * @param {*} dispositivoId
 * @returns {boolean}
 */
function esIdValido(dispositivoId) {
  return (
    typeof dispositivoId === "string" &&
    dispositivoId.length > 0 &&
    dispositivoId.length <= 128 &&
    !ID_PROHIBIDO_RE.test(dispositivoId) &&
    dispositivoId !== "." &&
    dispositivoId !== ".." &&
    !/^__.*__$/.test(dispositivoId)
  );
}

/**
 * Usa el valor configurado si es un número positivo; si no, el
 * valor por defecto.
 *
 * @param {*} valor
 * @param {number} porDefecto
 * @returns {number}
 */
function segundosValidos(valor, porDefecto) {
  return Number.isFinite(valor) && valor > 0 ? valor : porDefecto;
}

/**
 * Indica si un error de Firestore es "el documento no existe".
 *
 * @param {Object} error
 * @returns {boolean}
 */
function esNoEncontrado(error) {
  return (
    Boolean(error) &&
    (error.code === 5 ||
      error.code === "not-found" ||
      /NOT_FOUND/.test(String(error.message)))
  );
}

/**
 * Crea el rastreador de conexión de dispositivos.
 *
 * @param {Object} opciones
 * @param {import("firebase-admin").firestore.Firestore} opciones.db
 * @param {() => number} [opciones.ahora] Reloj en ms (inyectable en tests).
 * @param {Object} [opciones.config]
 * @param {number} [opciones.config.timeoutSegundos]
 * @param {number} [opciones.config.revisionSegundos]
 * @param {number} [opciones.config.refrescoSegundos]
 * @param {Object} [opciones.logger] Con log, warn y error.
 * @param {Object} [opciones.FieldValue] FieldValue de Firestore Admin.
 * @returns {{
 *   iniciar: () => Promise<void>,
 *   detener: () => void,
 *   registrarSenalDeVida: (dispositivoId: string, origen?: string) => Promise<void>,
 *   revisarTimeouts: () => Promise<void>,
 *   cargarEstadoInicial: () => Promise<void>
 * }}
 */
function crearRastreadorConexion({
  db,
  ahora = () => Date.now(),
  config = {},
  logger = console,
  FieldValue = require("firebase-admin").firestore.FieldValue,
}) {
  const timeoutMs =
    segundosValidos(config.timeoutSegundos, VALORES_POR_DEFECTO.timeoutSegundos) *
    1000;

  const revisionMs =
    segundosValidos(config.revisionSegundos, VALORES_POR_DEFECTO.revisionSegundos) *
    1000;

  const refrescoMs =
    segundosValidos(config.refrescoSegundos, VALORES_POR_DEFECTO.refrescoSegundos) *
    1000;

  // dispositivoId -> { ultimaSenal, estado, ultimoRefresco, cola }
  // "cola" encadena las escrituras del dispositivo para que lleguen
  // a Firestore en el mismo orden en que se decidieron.
  const dispositivos = new Map();

  // dispositivoId -> ms hasta el que se ignora (no existe en Firestore).
  const desconocidos = new Map();

  let temporizador = null;
  let activo = false;

  function encolar(entrada, tarea) {
    entrada.cola = entrada.cola.then(tarea, tarea);

    return entrada.cola;
  }

  /**
   * Hace update sobre dispositivos/{id}. Nunca lanza.
   *
   * @returns {Promise<"ok"|"no-encontrado"|"error">}
   */
  async function actualizar(dispositivoId, campos) {
    try {
      await db
        .collection(COLECCION_DISPOSITIVOS)
        .doc(dispositivoId)
        .update(campos);

      return "ok";
    } catch (error) {
      if (esNoEncontrado(error)) {
        olvidarComoDesconocido(dispositivoId);

        return "no-encontrado";
      }

      logger.error(
        `${PREFIJO_LOG} No se pudo actualizar el estado de conexión ` +
          `de "${dispositivoId}":`,
        error && error.message ? error.message : error
      );

      return "error";
    }
  }

  function olvidarComoDesconocido(dispositivoId) {
    dispositivos.delete(dispositivoId);

    if (!desconocidos.has(dispositivoId)) {
      logger.warn(
        `${PREFIJO_LOG} El dispositivo "${dispositivoId}" envía ` +
          "señales pero no está registrado en Firestore, se ignora."
      );
    }

    desconocidos.set(dispositivoId, ahora() + DESCONOCIDO_RETENCION_MS);
  }

  function estaIgnorado(dispositivoId) {
    const hasta = desconocidos.get(dispositivoId);

    if (hasta === undefined) {
      return false;
    }

    if (ahora() >= hasta) {
      desconocidos.delete(dispositivoId);

      return false;
    }

    return true;
  }

  /**
   * Registra que el dispositivo dio señales de vida (latido o
   * medición válida). Nunca lanza ni rechaza.
   *
   * @param {string} dispositivoId
   * @param {string} [origen] "latido" o "medicion" (solo para logs).
   * @returns {Promise<void>}
   */
  async function registrarSenalDeVida(dispositivoId, origen = "señal") {
    try {
      if (!activo || !esIdValido(dispositivoId) || estaIgnorado(dispositivoId)) {
        return;
      }

      const t = ahora();
      let entrada = dispositivos.get(dispositivoId);

      if (!entrada) {
        entrada = {
          ultimaSenal: t,
          estado: DESCONOCIDO,
          ultimoRefresco: Number.NEGATIVE_INFINITY,
          cola: Promise.resolve(),
        };

        dispositivos.set(dispositivoId, entrada);
      }

      entrada.ultimaSenal = t;

      if (entrada.estado === CONECTADO) {
        if (t - entrada.ultimoRefresco < refrescoMs) {
          return;
        }

        entrada.ultimoRefresco = t;

        await encolar(entrada, () =>
          actualizar(dispositivoId, {
            ultimaComunicacionEn: FieldValue.serverTimestamp(),
          })
        );

        return;
      }

      const estadoAnterior = entrada.estado;

      entrada.estado = CONECTADO;
      entrada.ultimoRefresco = t;

      const resultado = await encolar(entrada, () =>
        actualizar(dispositivoId, {
          estadoConexion: CONECTADO,
          ultimaComunicacionEn: FieldValue.serverTimestamp(),
        })
      );

      if (resultado === "ok") {
        logger.log(
          `${PREFIJO_LOG} Dispositivo "${dispositivoId}" conectado ` +
            `(${origen}).`
        );
      } else if (
        resultado === "error" &&
        entrada.estado === CONECTADO &&
        entrada.ultimoRefresco === t
      ) {
        // No se pudo escribir: la próxima señal lo reintenta.
        entrada.estado = estadoAnterior;
      }
    } catch (error) {
      logger.error(
        `${PREFIJO_LOG} Error al registrar la señal de "${dispositivoId}":`,
        error && error.message ? error.message : error
      );
    }
  }

  /**
   * Marca como desconectados los dispositivos conectados que
   * superaron el timeout. Nunca lanza ni rechaza.
   *
   * @returns {Promise<void>}
   */
  async function revisarTimeouts() {
    try {
      const t = ahora();
      const pendientes = [];

      for (const [dispositivoId, hasta] of desconocidos) {
        if (t >= hasta) {
          desconocidos.delete(dispositivoId);
        }
      }

      for (const [dispositivoId, entrada] of dispositivos) {
        if (entrada.estado !== CONECTADO || t - entrada.ultimaSenal <= timeoutMs) {
          continue;
        }

        // Se cambia el estado antes de escribir para que los
        // siguientes ciclos no repitan la escritura.
        entrada.estado = DESCONECTADO;

        pendientes.push(
          encolar(entrada, () =>
            // ultimaComunicacionEn no se toca: es la última vez visto.
            actualizar(dispositivoId, { estadoConexion: DESCONECTADO })
          ).then((resultado) => {
            if (resultado === "ok") {
              logger.warn(
                `${PREFIJO_LOG} Dispositivo "${dispositivoId}" ` +
                  `desconectado (sin señales hace más de ${timeoutMs / 1000} s).`
              );
            } else if (resultado === "error" && entrada.estado === DESCONECTADO) {
              // No se pudo escribir: el próximo ciclo lo reintenta.
              entrada.estado = CONECTADO;
            }
          })
        );
      }

      await Promise.all(pendientes);
    } catch (error) {
      logger.error(
        `${PREFIJO_LOG} Error al revisar timeouts de dispositivos:`,
        error && error.message ? error.message : error
      );
    }
  }

  /**
   * Carga los dispositivos que quedaron "conectado" en Firestore
   * (por ejemplo antes de reiniciar el servicio) para que, si no
   * vuelven a dar señales, se marquen desconectados. A todos se les
   * da el margen completo del timeout contado desde ahora:
   * "ultimaComunicacionEn" solo se refresca cada cierto tiempo y puede
   * estar vieja aunque el dispositivo siga vivo, así que no sirve para
   * decidir si venció.
   * Nunca lanza ni rechaza.
   *
   * @returns {Promise<void>}
   */
  async function cargarEstadoInicial() {
    try {
      const snapshot = await db
        .collection(COLECCION_DISPOSITIVOS)
        .where("estadoConexion", "==", CONECTADO)
        .get();

      const t = ahora();

      snapshot.forEach((doc) => {
        // Si ya llegó una señal más reciente, esa manda.
        if (!esIdValido(doc.id) || dispositivos.has(doc.id)) {
          return;
        }

        dispositivos.set(doc.id, {
          ultimaSenal: t,
          estado: CONECTADO,
          ultimoRefresco: t,
          cola: Promise.resolve(),
        });
      });
    } catch (error) {
      logger.error(
        `${PREFIJO_LOG} No se pudo cargar el estado inicial de ` +
          "conexión de los dispositivos:",
        error && error.message ? error.message : error
      );
    }
  }

  /**
   * Activa el rastreador: arranca el watchdog y carga el estado
   * inicial. Es idempotente.
   *
   * @returns {Promise<void>}
   */
  async function iniciar() {
    if (activo) {
      return;
    }

    activo = true;

    temporizador = setInterval(() => {
      revisarTimeouts();
    }, revisionMs);

    // No mantiene vivo el proceso por sí solo.
    if (typeof temporizador.unref === "function") {
      temporizador.unref();
    }

    await cargarEstadoInicial();
  }

  /**
   * Detiene el watchdog. Después de esto se ignoran las señales.
   */
  function detener() {
    activo = false;

    if (temporizador) {
      clearInterval(temporizador);
      temporizador = null;
    }
  }

  return {
    iniciar,
    detener,
    registrarSenalDeVida,
    revisarTimeouts,
    cargarEstadoInicial,
  };
}

module.exports = {
  crearRastreadorConexion,
};
