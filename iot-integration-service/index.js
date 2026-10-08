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
// Además escucha en Firestore las órdenes pendientes de
// "ordenes_ventilador" y publica el comando MQTT
// correspondiente (ver "escucharOrdenesPendientes()").
//
// =========================================================

const path = require("path");
const admin = require("firebase-admin");
const { cargarVariablesDeEntorno } = require("./lib/env");
const { conectarCliente } = require("./lib/mqtt-client");

cargarVariablesDeEntorno(path.join(__dirname, ".env"));

// =========================================================
// Firebase Admin SDK
//
// Se usa para acceder a Firestore sin depender de las reglas
// del cliente.
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
// Configuración de órdenes de ventilador
// =========================================================

/*
 * Una orden que sigue pendiente pasado este tiempo no se envía:
 * se marca "expirada". Evita que, por ejemplo tras reiniciar el
 * servicio, se accione un ventilador con una orden vieja.
 */
const ORDEN_MAX_ANTIGUEDAD_SEGUNDOS_ENTORNO = Number.parseInt(
  process.env.ORDEN_MAX_ANTIGUEDAD_SEGUNDOS,
  10
);

const ORDEN_MAX_ANTIGUEDAD_MS =
  (ORDEN_MAX_ANTIGUEDAD_SEGUNDOS_ENTORNO > 0
    ? ORDEN_MAX_ANTIGUEDAD_SEGUNDOS_ENTORNO
    : 60) * 1000;

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
        error.permanente = true;
        throw error;
      }

      ultimoError = error;
    } catch (error) {
      if (error.permanente) {
        throw error;
      }

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
// Por cada orden pendiente (ver procesarOrdenPendiente):
//
//   1. La reclama en una transacción (pendiente -> enviando).
//   2. Valida los datos y descarta las órdenes vencidas.
//   3. Construye el tópico MQTT y publica el comando.
//   4. Actualiza la orden a "enviada" (o "fallida").
//
// Si MQTT no está conectado la orden queda "pendiente" y se
// vuelve a revisar en cada (re)conexión.
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
    .where("estado", "==", ESTADO_ORDEN.PENDIENTE);

  // Al (re)conectar se revisan las órdenes que quedaron
  // pendientes mientras MQTT no estaba disponible.
  const revisarPendientes = async () => {
    try {
      const snapshot = await consulta.get();

      snapshot.docs.forEach((doc) => {
        procesarOrdenPendiente(doc, cliente);
      });
    } catch (error) {
      console.error(
        "[iot-integration-service] Error revisando " +
          "ordenes_ventilador pendientes:",
        error
      );
    }
  };

  cliente.on("connect", revisarPendientes);

  const cancelarSnapshot = consulta.onSnapshot(
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

  return () => {
    cancelarSnapshot();
    cliente.removeListener("connect", revisarPendientes);
  };
}

// =========================================================
// ESTADO DE LAS ÓRDENES
// =========================================================
//
// Vocabulario documentado en docs/modelo-datos.md (basado en
// COMMAND_STATUS de frontend/src/utils/constants.js).
//
// =========================================================

const ESTADO_ORDEN = {
  PENDIENTE: "pendiente",
  ENVIANDO: "enviando",
  ENVIADA: "enviada",
  FALLIDA: "fallida",
  EXPIRADA: "expirada",
};

const ACCIONES_VALIDAS = ["encender", "apagar"];

// Un id que se usa como segmento de tópico no puede traer
// separadores ni comodines MQTT.
const SEGMENTO_TOPICO_RE = /^[^/+#\s]+$/;

/**
 * Comprueba que la orden tenga todo lo necesario para publicar
 * el comando.
 *
 * @param {Object} orden
 * @returns {string|null} Motivo del rechazo, o null si es válida.
 */
function validarOrden(orden) {
  if (!orden || typeof orden !== "object") {
    return "La orden no tiene datos.";
  }

  if (
    typeof orden.incubadoraId !== "string" ||
    !SEGMENTO_TOPICO_RE.test(orden.incubadoraId)
  ) {
    return "La orden no tiene un incubadoraId válido.";
  }

  if (
    typeof orden.dispositivoId !== "string" ||
    !SEGMENTO_TOPICO_RE.test(orden.dispositivoId)
  ) {
    return "La orden no tiene un dispositivoId válido.";
  }

  if (!ACCIONES_VALIDAS.includes(orden.accionSolicitada)) {
    return (
      'accionSolicitada debe ser "encender" o "apagar" ' +
      `(recibido: ${JSON.stringify(orden.accionSolicitada)}).`
    );
  }

  // Sin fecha de creación no se puede saber si la orden venció.
  if (
    !orden.creadaEn ||
    typeof orden.creadaEn.toMillis !== "function"
  ) {
    return "La orden no tiene una fecha de creación (creadaEn) válida.";
  }

  return null;
}

/**
 * Cambia el estado de una orden y registra cuándo.
 *
 * @param {FirebaseFirestore.DocumentReference} ordenRef
 * @param {string} estado
 * @param {Object} [campos] Campos adicionales a escribir.
 * @returns {Promise<void>}
 */
async function marcarOrden(ordenRef, estado, campos = {}) {
  await ordenRef.update({
    estado,
    actualizadaEn: admin.firestore.FieldValue.serverTimestamp(),
    ...campos,
  });
}

/**
 * Marca una orden como fallida guardando el motivo. Nunca lanza:
 * si Firestore también falla, solo se loguea.
 *
 * @param {FirebaseFirestore.DocumentReference} ordenRef
 * @param {string} motivo
 * @returns {Promise<void>}
 */
async function marcarOrdenFallida(ordenRef, motivo) {
  console.error(
    `[iot-integration-service] Orden ${ordenRef.id} fallida: ` +
      motivo
  );

  try {
    await marcarOrden(ordenRef, ESTADO_ORDEN.FALLIDA, {
      error: motivo,
    });
  } catch (error) {
    console.error(
      `[iot-integration-service] No se pudo marcar la orden ` +
        `${ordenRef.id} como fallida:`,
      error
    );
  }
}

/**
 * Cambia el estado de una orden dentro de una transacción, solo
 * si todavía está en el estado "desde". Es lo que garantiza que
 * dos instancias del servicio (o un snapshot repetido) no
 * reclamen la misma orden dos veces.
 *
 * @param {FirebaseFirestore.DocumentReference} ordenRef
 * @param {string} desde Estado esperado.
 * @param {string} hasta Estado nuevo.
 * @returns {Promise<Object|null>} Datos de la orden si se hizo el
 * cambio, o null si ya no estaba en el estado esperado.
 */
function transicionarOrden(ordenRef, desde, hasta) {
  return db.runTransaction(async (transaccion) => {
    const snapshot = await transaccion.get(ordenRef);

    if (!snapshot.exists || snapshot.data().estado !== desde) {
      return null;
    }

    transaccion.update(ordenRef, {
      estado: hasta,
      actualizadaEn: admin.firestore.FieldValue.serverTimestamp(),
    });

    return snapshot.data();
  });
}

// =========================================================
// PROCESAR UNA ORDEN PENDIENTE
// =========================================================

async function procesarOrdenPendiente(ordenDoc, cliente) {
  const ordenRef = ordenDoc.ref;
  const ordenId = ordenDoc.id;

  // -------------------------------------------------------
  // Verificar conexión MQTT
  // -------------------------------------------------------
  //
  // Sin conexión no se toca la orden: queda "pendiente" y se
  // revisa de nuevo en la próxima conexión.
  //

  if (!cliente.connected) {
    console.warn(
      `[iot-integration-service] MQTT no está conectado. ` +
        `La orden ${ordenId} permanece pendiente.`
    );
    return;
  }

  // -------------------------------------------------------
  // Reclamar la orden (pendiente -> enviando)
  // -------------------------------------------------------

  let orden;

  try {
    orden = await transicionarOrden(
      ordenRef,
      ESTADO_ORDEN.PENDIENTE,
      ESTADO_ORDEN.ENVIANDO
    );
  } catch (error) {
    console.error(
      `[iot-integration-service] No se pudo reclamar la ` +
        `orden ${ordenId}:`,
      error
    );
    return;
  }

  if (!orden) {
    // Otra instancia (o un snapshot anterior) ya la tomó.
    return;
  }

  try {
    await enviarOrdenReclamada(ordenRef, orden, cliente);
  } catch (error) {
    await marcarOrdenFallida(
      ordenRef,
      `Error inesperado: ${error.message}`
    );
  }
}

/**
 * Valida, descarta si venció y publica una orden que esta
 * instancia ya reclamó (estado "enviando").
 *
 * @param {FirebaseFirestore.DocumentReference} ordenRef
 * @param {Object} orden Datos de la orden reclamada.
 * @param {import("mqtt").MqttClient} cliente
 * @returns {Promise<void>}
 */
async function enviarOrdenReclamada(ordenRef, orden, cliente) {
  const ordenId = ordenRef.id;

  // -------------------------------------------------------
  // Validar datos necesarios
  // -------------------------------------------------------

  const problema = validarOrden(orden);

  if (problema) {
    await marcarOrdenFallida(ordenRef, problema);
    return;
  }

  // -------------------------------------------------------
  // Descartar órdenes vencidas
  // -------------------------------------------------------

  const antiguedadMs = Date.now() - orden.creadaEn.toMillis();

  if (antiguedadMs > ORDEN_MAX_ANTIGUEDAD_MS) {
    const motivo =
      `La orden venció: tiene ${Math.round(antiguedadMs / 1000)} s ` +
      `y el máximo es ${ORDEN_MAX_ANTIGUEDAD_MS / 1000} s.`;

    console.warn(
      `[iot-integration-service] Orden ${ordenId} expirada. ` +
        motivo
    );

    await marcarOrden(ordenRef, ESTADO_ORDEN.EXPIRADA, {
      error: motivo,
    });
    return;
  }

  // -------------------------------------------------------
  // Reconfirmar la conexión MQTT
  // -------------------------------------------------------
  //
  // Si se cayó mientras se reclamaba la orden, se devuelve a
  // "pendiente": el cliente MQTT encolaría la publicación y la
  // entregaría recién al reconectar, quizás tarde.
  //

  if (!cliente.connected) {
    console.warn(
      `[iot-integration-service] MQTT se desconectó. ` +
        `La orden ${ordenId} vuelve a pendiente.`
    );

    await marcarOrden(ordenRef, ESTADO_ORDEN.PENDIENTE);
    return;
  }

  // -------------------------------------------------------
  // Construir tópico y payload
  // -------------------------------------------------------
  //
  // Formato definido en docs/contrato-mqtt.md: el dispositivo
  // (y el simulador) leen "accion".
  //

  const topico =
    `${MQTT_TOPIC_PREFIX}/` +
    `${orden.incubadoraId}/` +
    `ventiladores/` +
    `${orden.dispositivoId}/` +
    `comando`;

  const payload = JSON.stringify({
    accion: orden.accionSolicitada,
    ordenId,
    solicitadoEn: new Date(orden.creadaEn.toMillis()).toISOString(),
  });

  // -------------------------------------------------------
  // Publicar comando
  // -------------------------------------------------------

  try {
    await publicarMensaje(cliente, topico, payload);
  } catch (error) {
    await marcarOrdenFallida(
      ordenRef,
      `No se pudo publicar el comando: ${error.message}`
    );
    return;
  }

  console.log(
    `[iot-integration-service] Orden ${ordenId} publicada ` +
      `en "${topico}".`
  );

  // -------------------------------------------------------
  // Actualizar estado
  // -------------------------------------------------------
  //
  // Si esta escritura falla, la orden queda en "enviando": el
  // comando ya salió y no debe publicarse otra vez.
  //

  try {
    await marcarOrden(ordenRef, ESTADO_ORDEN.ENVIADA, {
      enviadaEn: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
      `[iot-integration-service] Orden ${ordenId} actualizada ` +
        'a estado "enviada".'
    );
  } catch (error) {
    console.error(
      `[iot-integration-service] El comando de la orden ` +
        `${ordenId} se publicó, pero no se pudo actualizar ` +
        "su estado:",
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
// Ejecución directa
// =========================================================

if (require.main === module) {
  const cliente = conectar(
    manejarMensajeProduccion
  );

  const unsubscribeOrdenes = escucharOrdenesPendientes(cliente);

  function cerrar() {
    console.log(
      "[iot-integration-service] " +
        "Cerrando conexión MQTT..."
    );

    // Detener el listener de Firestore.
    unsubscribeOrdenes();

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
  escucharOrdenesPendientes,
  manejarMensajeProduccion,
  validarMedicion,
  invocarProcesarMedicion,
};