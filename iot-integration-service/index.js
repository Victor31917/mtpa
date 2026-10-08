"use strict";

// =========================================================
// M.T.P.A. - Servicio de Integración IoT
// Mejora Técnica de Producción Avícola
// =========================================================
//
// Recibe mensajes MQTT y delega las mediciones a
// "procesarMedicion" mediante HTTPS.
//
// La conexión MQTT y las suscripciones permanecen dentro de
// "conectar()". El handler de producción solo procesa tópicos
// de mediciones.
//
// =========================================================

const path = require("path");
const { cargarVariablesDeEntorno } = require("./lib/env");
const { conectarCliente } = require("./lib/mqtt-client");

cargarVariablesDeEntorno(path.join(__dirname, ".env"));

// =========================================================
// Configuración MQTT
// =========================================================

const MQTT_HOST = process.env.MQTT_HOST;
const MQTT_PORT = process.env.MQTT_PORT || "8883";
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MQTT_TOPIC_PREFIX =
  process.env.MQTT_TOPIC_PREFIX || "mtpa-dev";

// =========================================================
// Configuración procesarMedicion
// =========================================================

const PROCESAR_MEDICION_URL =
  process.env.PROCESAR_MEDICION_URL;

const PROCESAR_MEDICION_TOKEN =
  process.env.PROCESAR_MEDICION_TOKEN;

const MAX_REINTENTOS = Number.parseInt(
  process.env.PROCESAR_MEDICION_MAX_REINTENTOS || "5",
  10
);

const BACKOFF_INICIAL_MS = Number.parseInt(
  process.env.PROCESAR_MEDICION_BACKOFF_MS || "500",
  10
);

// =========================================================
// Tópicos MQTT
// =========================================================

const TOPICO_MEDICIONES =
  `${MQTT_TOPIC_PREFIX}/+/sensores/+/medicion`;

const TOPICO_ESTADO_VENTILADORES =
  `${MQTT_TOPIC_PREFIX}/+/ventiladores/+/estado`;

const TOPICO_LATIDO =
  `${MQTT_TOPIC_PREFIX}/+/dispositivos/+/latido`;

// =========================================================
// Validación de tópicos y mediciones
// =========================================================

const TOPICO_MEDICION_RE = new RegExp(
  `^${escapeRegExp(MQTT_TOPIC_PREFIX)}/([^/]+)/sensores/([^/]+)/medicion$`
);

/*
 * Un mensaje de medición del sensor trae temperatura y/o humedad
 * en un mismo payload (ver docs/contrato-mqtt.md y el simulador),
 * pero "procesarMedicion" recibe una variable por petición y exige
 * su unidad. Esta tabla fija la unidad de cada variable (mismos
 * valores que UNITS en frontend/src/utils/constants.js).
 */
const UNIDAD_POR_VARIABLE = {
  temperatura: "°C",
  humedad: "%",
};

/**
 * Escapa caracteres especiales para utilizar una cadena
 * dentro de una expresión regular.
 *
 * @param {string} valor
 * @returns {string}
 */
function escapeRegExp(valor) {
  return valor.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

/**
 * Obtiene la incubadora y el dispositivo desde el tópico.
 *
 * @param {string} topico
 * @returns {{incubadoraId: string, dispositivoId: string}|null}
 */
function obtenerContextoDelTopico(topico) {
  if (typeof topico !== "string") {
    return null;
  }

  const match = topico.match(TOPICO_MEDICION_RE);

  if (!match) {
    return null;
  }

  return {
    incubadoraId: match[1],
    dispositivoId: match[2],
  };
}

/**
 * Valida el payload de una medición y comprueba que el origen
 * declarado en el payload coincida con el dispositivo e
 * incubadora indicados en el tópico MQTT.
 *
 * La autorización del dispositivo debe permanecer garantizada
 * por las ACL del broker MQTT.
 *
 * @param {string} topico
 * @param {Object} payload
 * @returns {{valido: boolean, razon?: string, mediciones?: Object[]}}
 */
function validarMedicion(topico, payload) {
  const contexto =
    obtenerContextoDelTopico(topico);

  if (!contexto) {
    return {
      valido: false,
      razon:
        "El mensaje no pertenece a un tópico de mediciones.",
    };
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return {
      valido: false,
      razon:
        "El payload debe ser un objeto JSON.",
    };
  }

  if (
    payload.incubadoraId !==
    contexto.incubadoraId
  ) {
    return {
      valido: false,
      razon:
        "La incubadora del payload no coincide con la del tópico.",
    };
  }

  if (
    payload.dispositivoId !==
    contexto.dispositivoId
  ) {
    return {
      valido: false,
      razon:
        "El dispositivo del payload no coincide con la del tópico.",
    };
  }

  const variablesPresentes = Object.keys(
    UNIDAD_POR_VARIABLE
  ).filter(
    (variable) =>
      payload[variable] !== undefined
  );

  if (variablesPresentes.length === 0) {
    return {
      valido: false,
      razon:
        "La medición debe incluir temperatura y/o humedad.",
    };
  }

  for (const variable of variablesPresentes) {
    if (
      typeof payload[variable] !== "number" ||
      !Number.isFinite(payload[variable])
    ) {
      return {
        valido: false,
        razon:
          `El valor de ${variable} debe ser numérico y finito.`,
      };
    }
  }

  if (
    typeof payload.medidoEn !== "string" &&
    typeof payload.medidoEn !== "number"
  ) {
    return {
      valido: false,
      razon:
        "La medición debe incluir medidoEn.",
    };
  }

  // Una medición por variable, con el formato que espera
  // "procesarMedicion": { incubadoraId, dispositivoId, variable,
  // valor, unidad, medidoEn }.
  return {
    valido: true,
    mediciones: variablesPresentes.map((variable) => ({
      incubadoraId: contexto.incubadoraId,
      dispositivoId: contexto.dispositivoId,
      variable,
      valor: payload[variable],
      unidad: UNIDAD_POR_VARIABLE[variable],
      medidoEn: payload.medidoEn,
    })),
  };
}

// =========================================================
// Retry / backoff
// =========================================================

function esperar(ms) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

/**
 * Invoca procesarMedicion mediante HTTPS.
 *
 * Los errores transitorios se reintentan con backoff
 * exponencial.
 *
 * @param {Object} medicion
 * @returns {Promise<Response>}
 */
async function invocarProcesarMedicion(medicion) {
  if (!PROCESAR_MEDICION_URL) {
    throw new Error(
      "Falta PROCESAR_MEDICION_URL."
    );
  }

  if (!PROCESAR_MEDICION_TOKEN) {
    throw new Error(
      "Falta PROCESAR_MEDICION_TOKEN."
    );
  }

  let ultimoError;

  for (
    let intento = 0;
    intento < MAX_REINTENTOS;
    intento += 1
  ) {
    try {
      const respuesta = await fetch(
        PROCESAR_MEDICION_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              `Bearer ${PROCESAR_MEDICION_TOKEN}`,
          },
          body: JSON.stringify(medicion),
        }
      );

      if (respuesta.ok) {
        return respuesta;
      }

      const cuerpo =
        await respuesta.text().catch(() => "");

      const error = new Error(
        `procesarMedicion respondió HTTP ` +
          `${respuesta.status}` +
          `${
            cuerpo
              ? `: ${cuerpo.slice(0, 300)}`
              : ""
          }`
      );

      /*
       * No reintentar errores 4xx permanentes.
       *
       * 408 y 429 sí pueden ser transitorios.
       */
      if (
        respuesta.status >= 400 &&
        respuesta.status < 500 &&
        respuesta.status !== 408 &&
        respuesta.status !== 429
      ) {
        throw error;
      }

      ultimoError = error;
    } catch (error) {
      ultimoError = error;
    }

    if (intento === MAX_REINTENTOS - 1) {
      break;
    }

    const demora =
      BACKOFF_INICIAL_MS *
      2 ** intento;

    await esperar(demora);
  }

  throw (
    ultimoError ||
    new Error(
      "Falló la invocación de procesarMedicion."
    )
  );
}

// =========================================================
// Handler de producción
// =========================================================

/**
 * Procesa los mensajes MQTT recibidos.
 *
 * Solo las mediciones son enviadas a procesarMedicion.
 * Los mensajes de estado de ventiladores y latidos continúan
 * llegando al handler, pero no son enviados a dicha función.
 *
 * @param {string} topico
 * @param {Object} payload
 * @returns {Promise<void>}
 */
async function manejarMensajeProduccion(
  topico,
  payload
) {
  const contexto =
    obtenerContextoDelTopico(topico);

  // Solo procesar tópicos de mediciones.
  if (!contexto) {
    return;
  }

  const validacion = validarMedicion(
    topico,
    payload
  );

  if (!validacion.valido) {
    console.error(
      `[iot-integration-service] Medición rechazada ` +
        `("${topico}"): ${validacion.razon}`
    );

    return;
  }

  // Una petición por variable; si una falla, las demás se envían igual.
  for (const medicion of validacion.mediciones) {
    try {
      await invocarProcesarMedicion(medicion);

      console.log(
        `[iot-integration-service] Medición enviada a ` +
          `procesarMedicion: ${contexto.incubadoraId}/` +
          `${contexto.dispositivoId} (${medicion.variable})`
      );
    } catch (error) {
      console.error(
        `[iot-integration-service] Error al procesar ` +
          `la medición de ${contexto.incubadoraId}/` +
          `${contexto.dispositivoId} (${medicion.variable}):`,
        error.message
      );
    }
  }
}

// =========================================================
// Conexión MQTT
// =========================================================

/**
 * Conecta al broker MQTT, se suscribe a los tópicos relevantes
 * y delega cada mensaje entrante a "onMensaje".
 *
 * @param {(topico: string, payload: Object) => void} [onMensaje]
 * @returns {import("mqtt").MqttClient}
 */
function conectar(
  onMensaje = manejarMensajeProduccion
) {
  if (
    !MQTT_HOST ||
    !MQTT_USERNAME ||
    !MQTT_PASSWORD
  ) {
    console.error(
      "[iot-integration-service] Faltan variables de entorno " +
        "obligatorias (MQTT_HOST, MQTT_USERNAME, MQTT_PASSWORD). " +
        "Copiá .env.example a .env y completalo con las " +
        "credenciales del cluster."
    );

    process.exit(1);
  }

  const cliente = conectarCliente({
    host: MQTT_HOST,
    puerto: MQTT_PORT,
    usuario: MQTT_USERNAME,
    contrasena: MQTT_PASSWORD,
    clientIdPrefijo:
      "mtpa-iot-integration-service",
  });

  cliente.on("connect", () => {
    console.log(
      `[iot-integration-service] Conectado a ` +
        `${MQTT_HOST}:${MQTT_PORT}`
    );

    cliente.subscribe(
      [
        TOPICO_MEDICIONES,
        TOPICO_ESTADO_VENTILADORES,
        TOPICO_LATIDO,
      ],
      (error) => {
        if (error) {
          console.error(
            "[iot-integration-service] Error al suscribirse:",
            error
          );

          return;
        }

        console.log(
          `[iot-integration-service] Suscripto a ` +
            `"${TOPICO_MEDICIONES}", ` +
            `"${TOPICO_ESTADO_VENTILADORES}" y ` +
            `"${TOPICO_LATIDO}"`
        );
      }
    );
  });

  cliente.on("reconnect", () => {
    console.warn(
      "[iot-integration-service] " +
        "Reconectando al broker MQTT..."
    );
  });

  cliente.on("close", () => {
    console.warn(
      "[iot-integration-service] " +
        "Conexión con el broker cerrada."
    );
  });

  cliente.on("error", (error) => {
    console.error(
      "[iot-integration-service] " +
        "Error de conexión MQTT:",
      error.message
    );
  });

  cliente.on(
    "message",
    async (topico, payloadBuffer) => {
      const payloadCrudo =
        payloadBuffer.toString();

      let payload;

      try {
        payload = JSON.parse(payloadCrudo);
      } catch (error) {
        console.warn(
          `[iot-integration-service] Mensaje en ` +
            `"${topico}" no es JSON válido, ` +
            "se ignora:",
          payloadCrudo
        );

        return;
      }

      try {
        await onMensaje(topico, payload);
      } catch (error) {
        console.error(
          "[iot-integration-service] Error en handler:",
          error
        );
      }
    }
  );

  return cliente;
}

// =========================================================
// Ejecución directa
// =========================================================

if (require.main === module) {
  const cliente = conectar(
    manejarMensajeProduccion
  );

  function cerrar() {
    console.log(
      "[iot-integration-service] " +
        "Cerrando conexión MQTT..."
    );

    cliente.end(
      false,
      () => process.exit(0)
    );
  }

  process.on("SIGINT", cerrar);
  process.on("SIGTERM", cerrar);
}

// =========================================================
// Exports
// =========================================================

module.exports = {
  conectar,
  manejarMensajeProduccion,
  validarMedicion,
  invocarProcesarMedicion,
};