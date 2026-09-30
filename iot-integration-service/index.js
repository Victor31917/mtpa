
"use strict";

// =========================================================
// M.T.P.A. - Servicio de Integración IoT
// Mejora Técnica de Producción Avícola
// =========================================================
//
// Servicio encargado de:
//
// 1. Conectarse al broker MQTT.
// 2. Escuchar mediciones, estados y latidos.
// 3. Escuchar órdenes pendientes de Firestore.
// 4. Publicar las órdenes de ventiladores mediante MQTT.
//
// La conexión MQTT y el listener de Firestore son
// responsabilidades separadas.
// =========================================================

const path = require("path");
const admin = require("firebase-admin");

const { cargarVariablesDeEntorno } = require("./lib/env");
const { conectarCliente } = require("./lib/mqtt-client");

cargarVariablesDeEntorno(path.join(__dirname, ".env"));

// =========================================================
// Firebase Admin SDK
// =========================================================
//
// El Servicio de Integración utiliza Admin SDK para acceder
// a Firestore sin depender de las reglas del cliente.
//
// =========================================================

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// =========================================================
// Configuración MQTT
// =========================================================

const MQTT_HOST = process.env.MQTT_HOST;
const MQTT_PORT = process.env.MQTT_PORT || "8883";
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MQTT_TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX || "mtpa-dev";

// =========================================================
// Tópicos a suscribir
// =========================================================

const TOPICO_MEDICIONES =
  `${MQTT_TOPIC_PREFIX}/+/sensores/+/medicion`;

const TOPICO_ESTADO_VENTILADORES =
  `${MQTT_TOPIC_PREFIX}/+/ventiladores/+/estado`;

const TOPICO_LATIDO =
  `${MQTT_TOPIC_PREFIX}/+/dispositivos/+/latido`;

// =========================================================
// Handler de mensajes por defecto
// =========================================================

function manejarMensajePorDefecto(topico, payload) {
  console.log(
    `[iot-integration-service] Mensaje en "${topico}":`,
    payload
  );
}

// =========================================================
// CONEXIÓN MQTT
// =========================================================
//
// Esta función se ocupa únicamente de:
//
// - conectar al broker
// - suscribirse a tópicos
// - recibir mensajes
//
// NO contiene lógica de Firestore.
//
// =========================================================

/**
 * @param {(topico: string, payload: Object) => void} [onMensaje]
 * @returns {import("mqtt").MqttClient}
 */
function conectar(onMensaje = manejarMensajePorDefecto) {
  if (!MQTT_HOST || !MQTT_USERNAME || !MQTT_PASSWORD) {
    console.error(
      "[iot-integration-service] Faltan variables de entorno obligatorias " +
        "(MQTT_HOST, MQTT_USERNAME, MQTT_PASSWORD). Copiá .env.example a " +
        ".env y completalo con las credenciales del cluster."
    );

    process.exit(1);
  }

  const cliente = conectarCliente({
    host: MQTT_HOST,
    puerto: MQTT_PORT,
    usuario: MQTT_USERNAME,
    contrasena: MQTT_PASSWORD,
    clientIdPrefijo: "mtpa-iot-integration-service",
  });

  cliente.on("connect", () => {
    console.log(
      `[iot-integration-service] Conectado a ${MQTT_HOST}:${MQTT_PORT}`
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
      "[iot-integration-service] Reconectando al broker MQTT..."
    );
  });

  cliente.on("close", () => {
    console.warn(
      "[iot-integration-service] Conexión con el broker cerrada."
    );
  });

  cliente.on("error", (error) => {
    console.error(
      "[iot-integration-service] Error de conexión MQTT:",
      error.message
    );
  });

  cliente.on("message", (topico, payloadBuffer) => {
    const payloadCrudo = payloadBuffer.toString();

    let payload;

    try {
      payload = JSON.parse(payloadCrudo);
    } catch (error) {
      console.warn(
        `[iot-integration-service] Mensaje en "${topico}" ` +
          "no es JSON válido, se loguea en crudo:",
        payloadCrudo
      );
      return;
    }

    onMensaje(topico, payload);
  });

  return cliente;
}

// =========================================================
// LISTENER DE ÓRDENES DE VENTILADOR
// =========================================================
//
// Esta función es independiente de conectar().
//
// Escucha:
//
//   ordenes_ventilador
//
// solamente cuando:
//
//   estado == "pendiente"
//
// Por cada orden nueva:
//
//   1. Obtiene los datos.
//   2. Construye el tópico MQTT.
//   3. Publica el comando.
//   4. Actualiza la orden a "enviada".
//
// =========================================================

function escucharOrdenesPendientes(cliente) {
  if (!cliente) {
    throw new Error(
      "Se necesita un cliente MQTT para escuchar órdenes pendientes."
    );
  }

  console.log(
    "[iot-integration-service] Iniciando listener de " +
      "ordenes_ventilador..."
  );

  const consulta = db
    .collection("ordenes_ventilador")
    .where("estado", "==", "pendiente");

  return consulta.onSnapshot(
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        // Solo procesamos documentos que aparecen como nuevos.
        if (change.type !== "added") {
          return;
        }

        procesarOrdenPendiente(change.doc, cliente);
      });
    },
    (error) => {
      console.error(
        "[iot-integration-service] Error escuchando " +
          "ordenes_ventilador:",
        error
      );
    }
  );
}

// =========================================================
// PROCESAR UNA ORDEN PENDIENTE
// =========================================================

async function procesarOrdenPendiente(ordenDoc, cliente) {
  const ordenId = ordenDoc.id;
  const orden = ordenDoc.data();

  try {
    // -------------------------------------------------------
    // Validar datos necesarios
    // -------------------------------------------------------

    if (!orden.incubadoraId) {
      console.error(
        `[iot-integration-service] La orden ${ordenId} ` +
          "no tiene incubadoraId."
      );
      return;
    }

    if (!orden.dispositivoId) {
      console.error(
        `[iot-integration-service] La orden ${ordenId} ` +
          "no tiene dispositivoId."
      );
      return;
    }

    if (!orden.accionSolicitada) {
      console.error(
        `[iot-integration-service] La orden ${ordenId} ` +
          "no tiene accionSolicitada."
      );
      return;
    }

    // -------------------------------------------------------
    // Verificar conexión MQTT
    // -------------------------------------------------------

    if (!cliente.connected) {
      console.warn(
        `[iot-integration-service] MQTT no está conectado. ` +
          `La orden ${ordenId} permanece pendiente.`
      );
      return;
    }

    // -------------------------------------------------------
    // Construir tópico MQTT
    // -------------------------------------------------------

    const topico =
      `${MQTT_TOPIC_PREFIX}/` +
      `${orden.incubadoraId}/` +
      `ventiladores/` +
      `${orden.dispositivoId}/` +
      `comando`;

    // -------------------------------------------------------
    // Construir payload
    // -------------------------------------------------------

    const payload = JSON.stringify({
      accionSolicitada: orden.accionSolicitada,
    });

    // -------------------------------------------------------
    // Publicar comando
    // -------------------------------------------------------

    await publicarMensaje(cliente, topico, payload);

    console.log(
      `[iot-integration-service] Orden ${ordenId} publicada ` +
        `en "${topico}".`
    );

    // -------------------------------------------------------
    // Actualizar estado
    // -------------------------------------------------------

    await ordenDoc.ref.update({
      estado: "enviada",
    });

    console.log(
      `[iot-integration-service] Orden ${ordenId} actualizada ` +
        'a estado "enviada".'
    );
  } catch (error) {
    console.error(
      `[iot-integration-service] Error procesando ` +
        `orden ${ordenId}:`,
      error
    );
  }
}

// =========================================================
// PUBLICAR MENSAJE MQTT
// =========================================================

function publicarMensaje(cliente, topico, payload) {
  return new Promise((resolve, reject) => {
    cliente.publish(
      topico,
      payload,
      { qos: 1 },
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      }
    );
  });
}

// =========================================================
// EJECUCIÓN DIRECTA
// =========================================================
//
// Si index.js se ejecuta directamente:
//
//   node index.js
//
// se inicia:
//
//   1. conexión MQTT
//   2. listener de Firestore
//
// =========================================================

if (require.main === module) {
  const cliente = conectar();

  const unsubscribeOrdenes = escucharOrdenesPendientes(cliente);

  function cerrar() {
    console.log(
      "[iot-integration-service] Cerrando servicio..."
    );

    // Detener listener de Firestore.
    unsubscribeOrdenes();

    // Cerrar MQTT.
    cliente.end(false, () => {
      process.exit(0);
    });
  }

  process.on("SIGINT", cerrar);
  process.on("SIGTERM", cerrar);
}

// =========================================================
// EXPORTS
// =========================================================

module.exports = {
  conectar,
  escucharOrdenesPendientes,
};

