const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

// =========================================================
// ROLES VÁLIDOS
//
// Deben coincidir exactamente con ROLES en
// frontend/src/utils/constants.js. Este archivo vive en un
// paquete npm independiente (functions/) por lo que no puede
// importar código del frontend, y se mantiene esta lista en
// espejo de forma deliberada.
// =========================================================

const ROLES_VALIDOS = ["administrador", "operador", "consulta"];

const COLECCION_USUARIOS = "usuarios";
const COLECCION_INCUBADORAS = "incubadoras";
const COLECCION_DISPOSITIVOS = "dispositivos";
const COLECCION_UMBRALES = "umbrales";
const COLECCION_ALERTAS = "alertas";
const COLECCION_VENTILADORES = "ventiladores";
const COLECCION_ORDENES_VENTILADOR = "ordenes_ventilador";

// Variables ambientales que acepta procesarMedicion. Deben coincidir
// con ENVIRONMENTAL_VARIABLES de frontend/src/utils/constants.js (ver
// docs/contrato-mqtt.md: el sensor publica temperatura y/o humedad).
const VARIABLES_MEDICION_VALIDAS = ["temperatura", "humedad"];

// =========================================================
// ESTADOS Y TIPOS VÁLIDOS (Sprint 2 — incubadoras/dispositivos)
//
// Igual que ROLES_VALIDOS, deben coincidir con INCUBATOR_STATUS
// y DEVICE_TYPES de frontend/src/utils/constants.js. Se acota
// deliberadamente a los valores que esta Cloud Function acepta
// en esta etapa (alta/edición manual y alta de dispositivo);
// otros valores de esas constantes (por ejemplo "advertencia" o
// "critica" en incubadoras) los escribe el Servicio de
// Integración IoT en un sprint posterior, no este endpoint.
// =========================================================

const ESTADOS_INCUBADORA_VALIDOS = ["activa", "inactiva"];

const TIPOS_DISPOSITIVO_VALIDOS = [
  "sensor_temperatura",
  "sensor_humedad",
  "ventilador",
];

/**
 * Helper compartido: exige sesión activa y uno de los roles
 * indicados, vía el custom claim "role" del token.
 *
 * Extraído de la lógica que ya usaba "gestionarUsuario" al
 * agregarse "gestionarIncubadora", que repite el mismo chequeo.
 *
 * @param {import("firebase-functions").https.CallableContext} context
 * @param {string[]} roles Roles permitidos.
 * @param {string} [mensajeError] Mensaje específico para el caso
 * de permiso denegado (si no se indica, se usa uno genérico).
 */
function requireRole(context, roles, mensajeError) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Debes iniciar sesión para realizar esta acción."
    );
  }

  if (!roles.includes(context.auth.token.role)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      mensajeError || "No tenés permisos suficientes para realizar esta acción."
    );
  }
}

/**
 * Genera un identificadorMqtt único para un dispositivo.
 *
 * Requisito de seguridad real del DDS: este identificador nunca
 * debe reutilizarse entre incubadoras. Se arma con el id de la
 * incubadora y el tipo de dispositivo (para que sea legible en
 * los tópicos MQTT, ver docs/contrato-mqtt.md) más un sufijo
 * aleatorio (UUID v4), y se verifica contra Firestore por si,
 * en un caso extremo, ya existiera un documento con ese mismo
 * valor.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} incubadoraId
 * @param {string} tipo
 * @returns {Promise<string>}
 */
async function generarIdentificadorMqttUnico(db, incubadoraId, tipo) {
  const prefijo = `${incubadoraId}-${tipo}`;

  for (let intento = 0; intento < 5; intento++) {
    const candidato = `${prefijo}-${crypto.randomUUID()}`;

    const coincidencias = await db
      .collection(COLECCION_DISPOSITIVOS)
      .where("identificadorMqtt", "==", candidato)
      .limit(1)
      .get();

    if (coincidencias.empty) {
      return candidato;
    }
  }

  throw new functions.https.HttpsError(
    "internal",
    "No fue posible generar un identificador MQTT único. Intentá nuevamente."
  );
}

/**
 * Cloud Function callable: gestionarUsuario
 *
 * Único punto de entrada autorizado para crear, editar o
 * desactivar usuarios. El cliente nunca escribe directamente
 * en la colección "usuarios" (ver firestore.rules).
 *
 * Datos esperados (data):
 * {
 *   accion: "crear" | "editar" | "desactivar",
 *   uid: string,        // requerido para "editar" y "desactivar"
 *   nombre: string,      // requerido para "crear", opcional para "editar"
 *   correo: string,      // requerido para "crear", opcional para "editar"
 *   rol: string,         // uno de ROLES_VALIDOS, requerido para "crear"
 * }
 */
exports.gestionarUsuario = functions.https.onCall(async (data, context) => {
  // ---------------------------------------------------------
  // 1. Autenticación y autorización: solo administradores.
  // ---------------------------------------------------------
  requireRole(
    context,
    ["administrador"],
    "Solo un administrador puede gestionar usuarios."
  );

  const accion = data && data.accion;

  if (!["crear", "editar", "desactivar"].includes(accion)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      'El campo "accion" debe ser "crear", "editar" o "desactivar".'
    );
  }

  // ---------------------------------------------------------
  // 2. Validación del rol (si viene incluido en la petición).
  // ---------------------------------------------------------
  if (data.rol !== undefined && !ROLES_VALIDOS.includes(data.rol)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `El rol "${data.rol}" no es válido. Los roles permitidos son: ` +
        ROLES_VALIDOS.join(", ") +
        "."
    );
  }

  const db = admin.firestore();

  // ---------------------------------------------------------
  // 3. CREAR
  // ---------------------------------------------------------
  if (accion === "crear") {
    if (!data.nombre || !data.correo || !data.rol) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Para crear un usuario se requieren nombre, correo y rol."
      );
    }

    const usuarioAuth = await admin.auth().createUser({
      email: data.correo,
      displayName: data.nombre,
    });

    await admin
      .auth()
      .setCustomUserClaims(usuarioAuth.uid, { role: data.rol });

    await db
      .collection(COLECCION_USUARIOS)
      .doc(usuarioAuth.uid)
      .set({
        uid: usuarioAuth.uid,
        nombre: data.nombre,
        correo: data.correo,
        rol: data.rol,
        activo: true,
        creadoEn: admin.firestore.FieldValue.serverTimestamp(),
      });

    return { uid: usuarioAuth.uid };
  }

  // A partir de acá se requiere el uid del usuario a modificar.
  if (!data.uid) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      'El campo "uid" es obligatorio para esta acción.'
    );
  }

  // ---------------------------------------------------------
  // 4. EDITAR
  // ---------------------------------------------------------
  if (accion === "editar") {
    const cambios = {};

    if (data.nombre !== undefined) cambios.nombre = data.nombre;
    if (data.correo !== undefined) cambios.correo = data.correo;
    if (data.rol !== undefined) cambios.rol = data.rol;
    if (data.activo !== undefined) cambios.activo = data.activo;

    if (Object.keys(cambios).length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "No se recibió ningún campo para editar."
      );
    }

    // Se valida que el uid exista en Authentication ANTES de escribir
    // nada en Firestore, para no dejar documentos huérfanos apuntando
    // a un usuario de Auth inexistente.
    let usuarioAuthActual;

    try {
      usuarioAuthActual = await admin.auth().getUser(data.uid);
    } catch (error) {
      throw new functions.https.HttpsError(
        "not-found",
        "El usuario no existe."
      );
    }

    await db
      .collection(COLECCION_USUARIOS)
      .doc(data.uid)
      .set(cambios, { merge: true });

    if (data.rol !== undefined) {
      await admin
        .auth()
        .setCustomUserClaims(data.uid, { role: data.rol });
    }

    // Solo se toca Authentication si el correo realmente cambió, para
    // no disparar una actualización (y su verificación) innecesaria.
    if (
      data.correo !== undefined &&
      data.correo !== usuarioAuthActual.email
    ) {
      await admin.auth().updateUser(data.uid, { email: data.correo });
    }

    // Se mantiene Authentication en espejo del campo "activo": un
    // usuario editado a activo:false queda deshabilitado igual que si
    // se hubiera usado la acción "desactivar".
    if (data.activo !== undefined) {
      await admin.auth().updateUser(data.uid, { disabled: !data.activo });
    }

    return { uid: data.uid };
  }

  // ---------------------------------------------------------
  // 5. DESACTIVAR
  // ---------------------------------------------------------
  if (accion === "desactivar") {
    try {
      await admin.auth().getUser(data.uid);
    } catch (error) {
      throw new functions.https.HttpsError(
        "not-found",
        "El usuario no existe."
      );
    }

    await db.collection(COLECCION_USUARIOS).doc(data.uid).set(
      { activo: false },
      { merge: true }
    );

    await admin.auth().updateUser(data.uid, { disabled: true });

    // Deshabilitar la cuenta no invalida los tokens de sesión ya
    // emitidos: hay que revocarlos explícitamente para que una sesión
    // activa del cliente deje de considerarse válida en el próximo
    // refresh del ID token.
    await admin.auth().revokeRefreshTokens(data.uid);

    return { uid: data.uid };
  }

  // No debería alcanzarse nunca (accion ya fue validada arriba).
  throw new functions.https.HttpsError("internal", "Acción no soportada.");
});

/**
 * Cloud Function callable: gestionarIncubadora
 *
 * Único punto de entrada autorizado para crear, editar o
 * desactivar incubadoras. El cliente nunca escribe
 * directamente en la colección "incubadoras" (ver
 * firestore.rules). El alta de dispositivos vive en su propia
 * Cloud Function ("crearDispositivo", más abajo): mezclarla acá
 * hacía que una sola función resolviera 4 operaciones distintas.
 *
 * Datos esperados (data):
 * {
 *   accion: "crear" | "editar" | "desactivar",
 *
 *   id: string,          // requerido para "editar" y "desactivar"
 *   nombre: string,       // requerido para "crear", opcional para "editar"
 *   ubicacion: string,    // requerido para "crear", opcional para "editar"
 *   estado: string,       // "activa" | "inactiva", opcional (default "activa" al crear)
 * }
 */
exports.gestionarIncubadora = functions.https.onCall(async (data, context) => {
  // ---------------------------------------------------------
  // 1. Autenticación y autorización: solo administradores.
  // ---------------------------------------------------------
  requireRole(
    context,
    ["administrador"],
    "Solo un administrador puede gestionar incubadoras."
  );

  const accion = data && data.accion;

  if (!["crear", "editar", "desactivar"].includes(accion)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      'El campo "accion" debe ser "crear", "editar" o "desactivar".'
    );
  }

  const db = admin.firestore();

  // ---------------------------------------------------------
  // 2. CREAR incubadora
  // ---------------------------------------------------------
  if (accion === "crear") {
    if (!data.nombre || !data.ubicacion) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Para crear una incubadora se requieren nombre y ubicación."
      );
    }

    const estado = data.estado !== undefined ? data.estado : "activa";

    if (!ESTADOS_INCUBADORA_VALIDOS.includes(estado)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `El estado "${estado}" no es válido. Los estados permitidos son: ` +
          ESTADOS_INCUBADORA_VALIDOS.join(", ") +
          "."
      );
    }

    const referencia = db.collection(COLECCION_INCUBADORAS).doc();

    await referencia.set({
      nombre: data.nombre,
      ubicacion: data.ubicacion,
      estado,
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { id: referencia.id };
  }

  // A partir de acá (editar/desactivar) se requiere el id de la incubadora.
  if (!data.id) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      'El campo "id" es obligatorio para esta acción.'
    );
  }

  // Se valida que la incubadora exista ANTES de escribir en ediciones,
  // mismo patrón que ya usa "gestionarUsuario" (evita documentos
  // huérfanos / ediciones fantasma).
  const referenciaIncubadora = db.collection(COLECCION_INCUBADORAS).doc(data.id);
  const snapshotIncubadora = await referenciaIncubadora.get();

  if (!snapshotIncubadora.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "La incubadora no existe."
    );
  }

  // ---------------------------------------------------------
  // 3. EDITAR
  // ---------------------------------------------------------
  if (accion === "editar") {
    const cambios = {};

    // Igual que en "crear": si el campo viene incluido en la petición,
    // no puede ser un string vacío (evita nombres/ubicaciones en blanco
    // por un cliente que no validó antes de enviar).
    if (data.nombre !== undefined) {
      if (!data.nombre.trim()) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "El nombre no puede quedar vacío."
        );
      }
      cambios.nombre = data.nombre;
    }

    if (data.ubicacion !== undefined) {
      if (!data.ubicacion.trim()) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "La ubicación no puede quedar vacía."
        );
      }
      cambios.ubicacion = data.ubicacion;
    }

    if (data.estado !== undefined) {
      if (!ESTADOS_INCUBADORA_VALIDOS.includes(data.estado)) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          `El estado "${data.estado}" no es válido. Los estados permitidos ` +
            "son: " +
            ESTADOS_INCUBADORA_VALIDOS.join(", ") +
            "."
        );
      }
      cambios.estado = data.estado;
    }

    if (Object.keys(cambios).length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "No se recibió ningún campo para editar."
      );
    }

    await referenciaIncubadora.set(cambios, { merge: true });

    return { id: data.id };
  }

  // ---------------------------------------------------------
  // 4. DESACTIVAR
  // ---------------------------------------------------------
  if (accion === "desactivar") {
    await referenciaIncubadora.set({ estado: "inactiva" }, { merge: true });

    return { id: data.id };
  }

  // No debería alcanzarse nunca (accion ya fue validada arriba).
  throw new functions.https.HttpsError("internal", "Acción no soportada.");
});

/**
 * Cloud Function callable: crearDispositivo
 *
 * Único punto de entrada autorizado para dar de alta un
 * dispositivo asociado a una incubadora existente. Se separó de
 * "gestionarIncubadora" (que antes mezclaba el CRUD de
 * incubadoras con el alta de dispositivos en una sola función)
 * para que cada Cloud Function resuelva una única operación. El
 * cliente nunca escribe directamente en la colección
 * "dispositivos" (ver firestore.rules).
 *
 * Datos esperados (data):
 * {
 *   incubadoraId: string, // id de la incubadora dueña del dispositivo
 *   tipo: string,         // "sensor_temperatura" | "sensor_humedad" | "ventilador"
 * }
 */
exports.crearDispositivo = functions.https.onCall(async (data, context) => {
  // ---------------------------------------------------------
  // 1. Autenticación y autorización: solo administradores.
  // ---------------------------------------------------------
  requireRole(
    context,
    ["administrador"],
    "Solo un administrador puede gestionar dispositivos."
  );

  const incubadoraId = data && data.incubadoraId;

  if (!incubadoraId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      'El campo "incubadoraId" es obligatorio para dar de alta un ' +
        "dispositivo."
    );
  }

  if (!TIPOS_DISPOSITIVO_VALIDOS.includes(data.tipo)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `El tipo "${data.tipo}" no es válido. Los tipos permitidos son: ` +
        TIPOS_DISPOSITIVO_VALIDOS.join(", ") +
        "."
    );
  }

  const db = admin.firestore();

  // Se valida que la incubadora exista ANTES de escribir el
  // dispositivo, para no dejar dispositivos huérfanos apuntando a
  // una incubadora inexistente (mismo patrón que "editar" en
  // gestionarUsuario/gestionarIncubadora).
  const incubadoraSnapshot = await db
    .collection(COLECCION_INCUBADORAS)
    .doc(incubadoraId)
    .get();

  if (!incubadoraSnapshot.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "La incubadora indicada no existe."
    );
  }

  const identificadorMqtt = await generarIdentificadorMqttUnico(
    db,
    incubadoraId,
    data.tipo
  );

  const referencia = db.collection(COLECCION_DISPOSITIVOS).doc();

  await referencia.set({
    incubadoraId,
    tipo: data.tipo,
    identificadorMqtt,
    estadoConexion: "desconocido",
    ultimaComunicacionEn: null,
    creadoEn: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { id: referencia.id, identificadorMqtt };
});

/**
 * Compara dos tokens en tiempo constante.
 *
 * "crypto.timingSafeEqual" exige buffers de igual longitud (si no,
 * lanza una excepción), por lo que se comparan los hashes SHA-256 de
 * ambos valores: siempre miden 32 bytes y no se filtra la longitud
 * del token esperado ni se lanza un error ante un token de otro largo.
 *
 * @param {string} recibido Token enviado por el cliente.
 * @param {string} esperado Token configurado en el entorno.
 * @returns {boolean}
 */
function tokensCoinciden(recibido, esperado) {
  const hashRecibido = crypto.createHash("sha256").update(recibido).digest();
  const hashEsperado = crypto.createHash("sha256").update(esperado).digest();

  return crypto.timingSafeEqual(hashRecibido, hashEsperado);
}

// Banda de histéresis para resolver alertas: fracción del rango
// (maximo - minimo) que el valor debe recuperar, hacia el interior del
// rango, antes de dar por resuelta una alerta. Evita que un valor que
// oscila sobre el límite abra y cierre alertas (y envíe un correo) en
// cada medición. Con 0.05, una alerta "alta" se resuelve cuando
// valor <= maximo - margen y una "baja" cuando valor >= minimo + margen,
// con margen = (maximo - minimo) * 0.05.
const MARGEN_RESOLUCION = 0.05;

/**
 * Evalúa una medición contra el umbral configurado: resuelve las alertas
 * abiertas cuya condición ya se recuperó y, si el valor está fuera de
 * rango, genera una alerta.
 *
 * Lee el umbral compuesto "umbrales/{incubadoraId}_{variable}" (campos
 * "minimo" y "maximo"). Si no hay umbral configurado, o sus límites no
 * son numéricos, no hace nada.
 *
 * En cada medición consulta, con una sola query, las alertas abiertas
 * (estado "activa" o "reconocida") de la misma incubadora + variable.
 *
 * Resolución automática: según el sufijo de "tipo" ("temperatura_alta",
 * "temperatura_baja", "humedad_alta" o "humedad_baja", ver ALERT_TYPES en
 * frontend/src/utils/constants.js), una alerta "alta" se resuelve cuando
 * valor <= maximo - margen y una "baja" cuando valor >= minimo + margen,
 * donde margen = (maximo - minimo) * MARGEN_RESOLUCION (histéresis: dentro
 * de esa banda la alerta sigue abierta). Si el rango es inválido
 * (maximo - minimo <= 0), el margen es 0. Las alertas resueltas se
 * actualizan en un único batch con estado "resuelta", "resueltaEn",
 * "resueltaPor" ("sistema") y "valorResolucion".
 *
 * Para no duplicar alertas mientras la condición se sostiene, no crea
 * una nueva si queda abierta (sin resolver en esta misma llamada) una
 * alerta del mismo tipo para la misma incubadora + variable. Una alerta
 * "resuelta" ya no cuenta: si la condición reaparece, se genera una
 * alerta nueva.
 *
 * No es una Cloud Function: la invoca "procesarMedicion" luego de
 * almacenar la medición, y quien la llama decide qué hacer ante un error.
 *
 * @param {object} medicion
 * @param {string} medicion.incubadoraId
 * @param {string} medicion.dispositivoId
 * @param {string} medicion.variable "temperatura" | "humedad".
 * @param {number} medicion.valor
 * @param {string} medicion.unidad
 * @param {FirebaseFirestore.Timestamp} medicion.medidoEn
 * @returns {Promise<{
 *   alertaCreada: boolean,
 *   alertaId?: string,
 *   alertasResueltas?: string[]
 * }>} "alertasResueltas" contiene los ids de las alertas resueltas
 *   (ausente si no hubo umbral válido).
 */
async function evaluarUmbrales(medicion) {
  const { incubadoraId, dispositivoId, variable, valor, unidad, medidoEn } =
    medicion;

  const db = admin.firestore();

  const umbralSnapshot = await db
    .collection(COLECCION_UMBRALES)
    .doc(`${incubadoraId}_${variable}`)
    .get();

  if (!umbralSnapshot.exists) {
    return { alertaCreada: false };
  }

  const umbral = umbralSnapshot.data();

  if (
    typeof umbral.minimo !== "number" ||
    typeof umbral.maximo !== "number"
  ) {
    console.warn("El documento de umbral tiene límites inválidos.", {
      umbralId: umbralSnapshot.id,
    });

    return { alertaCreada: false };
  }

  // Alertas abiertas de esta incubadora + variable (una sola query: se
  // usa tanto para resolver como para evitar duplicados).
  const alertasAbiertas = await db
    .collection(COLECCION_ALERTAS)
    .where("incubadoraId", "==", incubadoraId)
    .where("variable", "==", variable)
    .where("estado", "in", ["activa", "reconocida"])
    .get();

  // Resolución automática con histéresis (ver MARGEN_RESOLUCION).
  const rango = umbral.maximo - umbral.minimo;
  const margen = rango > 0 ? rango * MARGEN_RESOLUCION : 0;

  const alertasPorResolver = [];
  const tiposAbiertos = new Set();

  alertasAbiertas.forEach((alertaDoc) => {
    const tipoAlerta = alertaDoc.data().tipo;

    const recuperada =
      (typeof tipoAlerta === "string" &&
        tipoAlerta.endsWith("_alta") &&
        valor <= umbral.maximo - margen) ||
      (typeof tipoAlerta === "string" &&
        tipoAlerta.endsWith("_baja") &&
        valor >= umbral.minimo + margen);

    if (recuperada) {
      alertasPorResolver.push(alertaDoc);
    } else {
      tiposAbiertos.add(tipoAlerta);
    }
  });

  if (alertasPorResolver.length > 0) {
    const batch = db.batch();

    alertasPorResolver.forEach((alertaDoc) => {
      batch.update(alertaDoc.ref, {
        estado: "resuelta",
        resueltaEn: admin.firestore.FieldValue.serverTimestamp(),
        resueltaPor: "sistema",
        valorResolucion: valor,
      });
    });

    await batch.commit();
  }

  const alertasResueltas = alertasPorResolver.map((alertaDoc) => alertaDoc.id);

  let sentido;
  let limite;

  if (valor > umbral.maximo) {
    sentido = "alta";
    limite = umbral.maximo;
  } else if (valor < umbral.minimo) {
    sentido = "baja";
    limite = umbral.minimo;
  } else {
    return { alertaCreada: false, alertasResueltas };
  }

  const tipo = `${variable}_${sentido}`;

  // Si queda una alerta abierta del mismo tipo (no resuelta en esta
  // misma llamada), la condición ya está notificada: no se duplica.
  if (tiposAbiertos.has(tipo)) {
    return { alertaCreada: false, alertasResueltas };
  }

  const etiqueta = variable.charAt(0).toUpperCase() + variable.slice(1);
  const posicion =
    sentido === "alta" ? "por encima del máximo" : "por debajo del mínimo";

  const alertaRef = await db.collection(COLECCION_ALERTAS).add({
    incubadoraId,
    dispositivoId,
    variable,
    valor,
    limite,
    tipo,
    estado: "activa",
    titulo: `${etiqueta} fuera de rango`,
    mensaje:
      `La ${variable} registró ${valor} ${unidad}, ${posicion} de ` +
      `${limite} ${unidad}.`,
    medidoEn,
    creadaEn: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { alertaCreada: true, alertaId: alertaRef.id, alertasResueltas };
}

/**
 * Cloud Function HTTPS: procesarMedicion
 *
 * Recibe mediciones exclusivamente desde el Servicio de Integración.
 *
 * IMPORTANTE:
 * - NO es callable.
 * - NO debe ser invocada desde el cliente web.
 * - Utiliza autenticación servicio a servicio mediante Bearer Token.
 *
 * Datos esperados:
 * {
 *   incubadoraId: string,
 *   dispositivoId: string,
 *   variable: string,
 *   valor: number,
 *   unidad: string,
 *   medidoEn: string | number | Timestamp serializado
 * }
 */
exports.procesarMedicion = functions.https.onRequest(async (req, res) => {
  // ---------------------------------------------------------
  // 1. Validar método HTTP
  // ---------------------------------------------------------

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Método no permitido. Utiliza POST.",
    });
  }

  // ---------------------------------------------------------
  // 2. Autenticación servicio a servicio
  // ---------------------------------------------------------
  //
  // El Servicio de Integración debe enviar:
  //
  // Authorization: Bearer <TOKEN>
  //
  // El token debe configurarse como variable de entorno.
  // ---------------------------------------------------------

  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      ok: false,
      error: "No autorizado.",
    });
  }

  const token = authorization.substring("Bearer ".length).trim();

  if (!token) {
    return res.status(401).json({
      ok: false,
      error: "Token de autenticación requerido.",
    });
  }

  const expectedToken = process.env.INTEGRATION_SERVICE_TOKEN;

  if (!expectedToken || !tokensCoinciden(token, expectedToken)) {
    console.warn(
      "Intento de acceso no autorizado a procesarMedicion."
    );

    return res.status(403).json({
      ok: false,
      error: "Credenciales inválidas.",
    });
  }

  // ---------------------------------------------------------
  // 3. Validar payload
  // ---------------------------------------------------------

  const {
    incubadoraId,
    dispositivoId,
    variable,
    valor,
    unidad,
    medidoEn,
  } = req.body || {};

  const camposFaltantes = [];

  if (!incubadoraId) camposFaltantes.push("incubadoraId");
  if (!dispositivoId) camposFaltantes.push("dispositivoId");
  if (!variable) camposFaltantes.push("variable");

  if (valor === undefined || valor === null) {
    camposFaltantes.push("valor");
  }

  if (!unidad) camposFaltantes.push("unidad");
  if (!medidoEn) camposFaltantes.push("medidoEn");

  if (camposFaltantes.length > 0) {
    return res.status(400).json({
      ok: false,
      error: "Payload inválido.",
      camposFaltantes,
    });
  }

  // ---------------------------------------------------------
  // 4. Validar tipos
  // ---------------------------------------------------------

  if (typeof incubadoraId !== "string") {
    return res.status(400).json({
      ok: false,
      error: "incubadoraId debe ser un string.",
    });
  }

  if (typeof dispositivoId !== "string") {
    return res.status(400).json({
      ok: false,
      error: "dispositivoId debe ser un string.",
    });
  }

  if (typeof variable !== "string") {
    return res.status(400).json({
      ok: false,
      error: "variable debe ser un string.",
    });
  }

  if (!VARIABLES_MEDICION_VALIDAS.includes(variable)) {
    return res.status(400).json({
      ok: false,
      error:
        `La variable "${variable}" no es válida. Las variables permitidas ` +
        "son: " +
        VARIABLES_MEDICION_VALIDAS.join(", ") +
        ".",
    });
  }

  if (typeof unidad !== "string") {
    return res.status(400).json({
      ok: false,
      error: "unidad debe ser un string.",
    });
  }

  if (typeof valor !== "number" || !Number.isFinite(valor)) {
    return res.status(400).json({
      ok: false,
      error: "valor debe ser un número válido.",
    });
  }

  // ---------------------------------------------------------
  // 5. Validar y convertir medidoEn
  // ---------------------------------------------------------

  let medidoEnTimestamp;

  if (
    typeof medidoEn === "string" ||
    typeof medidoEn === "number"
  ) {
    const fecha = new Date(medidoEn);

    if (Number.isNaN(fecha.getTime())) {
      return res.status(400).json({
        ok: false,
        error: "medidoEn no contiene una fecha válida.",
      });
    }

    medidoEnTimestamp =
      admin.firestore.Timestamp.fromDate(fecha);
  } else if (
    typeof medidoEn === "object" &&
    medidoEn !== null &&
    typeof medidoEn._seconds === "number"
  ) {
    medidoEnTimestamp = new admin.firestore.Timestamp(
      medidoEn._seconds,
      medidoEn._nanoseconds || 0
    );
  } else {
    return res.status(400).json({
      ok: false,
      error:
        "medidoEn debe ser una fecha válida o un Timestamp serializado.",
    });
  }

  // ---------------------------------------------------------
  // 6. Referencias Firestore
  // ---------------------------------------------------------

  const db = admin.firestore();

  const dispositivoRef = db
    .collection(COLECCION_DISPOSITIVOS)
    .doc(dispositivoId);

  const medicionRef = db
    .collection("mediciones")
    .doc();

  // ---------------------------------------------------------
  // 7. Verificar que exista el dispositivo
  // ---------------------------------------------------------

  const dispositivoSnapshot = await dispositivoRef.get();

  if (!dispositivoSnapshot.exists) {
    return res.status(404).json({
      ok: false,
      error: "El dispositivo no existe.",
      dispositivoId,
    });
  }

  const dispositivo = dispositivoSnapshot.data();

  // ---------------------------------------------------------
  // 8. Verificar relación dispositivo / incubadora
  // ---------------------------------------------------------

  if (
    dispositivo.incubadoraId &&
    dispositivo.incubadoraId !== incubadoraId
  ) {
    return res.status(400).json({
      ok: false,
      error:
        "El dispositivo no pertenece a la incubadora indicada.",
    });
  }

  // ---------------------------------------------------------
  // 9. Persistir medición y actualizar dispositivo
  // ---------------------------------------------------------

  const ahora = admin.firestore.Timestamp.now();

  const medicion = {
    incubadoraId,
    dispositivoId,
    variable,
    valor,
    unidad,
    medidoEn: medidoEnTimestamp,
    creadoEn: ahora,
  };

  const batch = db.batch();

  // Crear:
  // mediciones/{medicionId}
  batch.set(medicionRef, medicion);

  // Actualizar directamente:
  // dispositivos/{dispositivoId}
  //
  // NO se utiliza estado_dispositivos/.
  batch.update(dispositivoRef, {
    estadoConexion: "conectado",
    ultimaComunicacionEn: ahora,
  });

  await batch.commit();

  // ---------------------------------------------------------
  // 10. Punto de entrada para evaluación de umbrales
  // ---------------------------------------------------------

  // La medición ya está almacenada: si la evaluación de umbrales
  // falla, se registra el error pero no se hace fallar la ingesta
  // (el Servicio de Integración reintentaría una medición ya guardada).

  try {
    await evaluarUmbrales({
      incubadoraId,
      dispositivoId,
      variable,
      valor,
      unidad,
      medidoEn: medidoEnTimestamp,
    });
  } catch (error) {
    console.error("Error al evaluar umbrales de la medición.", {
      medicionId: medicionRef.id,
      incubadoraId,
      variable,
      error: error.message,
    });
  }

  // ---------------------------------------------------------
  // 11. Automatización de ventiladores
  // ---------------------------------------------------------

  // TODO Sprint 4: evaluarAutomatizacion

  // ---------------------------------------------------------
  // 12. Respuesta
  // ---------------------------------------------------------

  console.log("Medición procesada correctamente.", {
    medicionId: medicionRef.id,
    incubadoraId,
    dispositivoId,
    variable,
    valor,
    unidad,
  });

  return res.status(201).json({
    ok: true,
    medicionId: medicionRef.id,
    dispositivoId,
    estadoConexion: "conectado",
    ultimaComunicacionEn: ahora.toDate().toISOString(),
  });
});

// Textos legibles de los tipos de alerta. Deben coincidir con ALERT_TYPES
// de frontend/src/utils/constants.js (temperatura/humedad, alta/baja, y la
// desconexión de dispositivos).
const TIPOS_ALERTA_LEGIBLES = {
  temperatura_alta: "temperatura alta",
  temperatura_baja: "temperatura baja",
  humedad_alta: "humedad alta",
  humedad_baja: "humedad baja",
  dispositivo_desconectado: "dispositivo desconectado",
};

/**
 * Escapa los caracteres especiales de HTML de un texto para poder
 * interpolarlo de forma segura en el cuerpo HTML de un correo.
 *
 * @param {*} texto
 * @returns {string}
 */
function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Cloud Function trigger: notificarAlerta
 *
 * Se ejecuta automáticamente cuando se crea una nueva alerta:
 *
 * alertas/{alertaId}
 *
 * IMPORTANTE:
 * - NO es callable.
 * - NO es un endpoint HTTPS.
 * - NO debe ser invocada desde el cliente web.
 * - El cliente recibe la alerta in-app mediante su listener
 *   en tiempo real sobre la colección "alertas".
 *
 * Esta función se encarga únicamente de preparar el envío
 * de correo electrónico a los administradores activos.
 */
exports.notificarAlerta = functions.firestore
  .document("alertas/{alertaId}")
  .onCreate(async (snap, context) => {
    const alerta = snap.data();

    if (!alerta) {
      console.warn(
        `La alerta ${context.params.alertaId} no contiene datos.`
      );

      return null;
    }

    const db = admin.firestore();

    // ---------------------------------------------------------
    // 1. Buscar administradores activos
    // ---------------------------------------------------------

    const administradoresSnapshot = await db
      .collection(COLECCION_USUARIOS)
      .where("rol", "==", "administrador")
      .where("activo", "==", true)
      .get();

    if (administradoresSnapshot.empty) {
      console.log(
        "No existen administradores activos para notificar."
      );

      return null;
    }

    // ---------------------------------------------------------
    // 2. Obtener datos de la alerta
    // ---------------------------------------------------------

    // "titulo" y "mensaje" los escribe evaluarUmbrales al crear la
    // alerta. Si faltan, se arma un texto de respaldo con los demás
    // campos de la alerta (variable, valor, limite, tipo).
    const hayDetalle =
      typeof alerta.variable === "string" &&
      alerta.valor !== undefined &&
      alerta.limite !== undefined;

    // "tipo" usa los valores de ALERT_TYPES (por ejemplo
    // "temperatura_alta"); si no es uno conocido, se usa la variable.
    const tipoLegible =
      TIPOS_ALERTA_LEGIBLES[alerta.tipo] ||
      (typeof alerta.variable === "string" ? alerta.variable : null);

    const titulo =
      alerta.titulo ||
      (tipoLegible
        ? `Alerta de ${tipoLegible} en M.T.P.A.`
        : "Nueva alerta de M.T.P.A.");

    const mensaje =
      alerta.mensaje ||
      alerta.descripcion ||
      alerta.texto ||
      (hayDetalle
        ? `La ${alerta.variable} registró ${alerta.valor}, ` +
          `${
            typeof alerta.tipo === "string" && alerta.tipo.endsWith("_baja")
              ? "por debajo"
              : "por encima"
          } del límite de ${alerta.limite}.`
        : "Se ha generado una nueva alerta.");

    // ---------------------------------------------------------
    // 3. Preparar destinatarios
    // ---------------------------------------------------------

    const destinatarios = administradoresSnapshot.docs
      .map((doc) => doc.data())
      .map((usuario) => usuario.correo)
      .filter(
        (correo) =>
          typeof correo === "string" &&
          correo.trim().length > 0
      );

    if (destinatarios.length === 0) {
      console.log(
        "Los administradores activos no tienen correos válidos."
      );

      return null;
    }

    // ---------------------------------------------------------
    // 4. Trigger Email de Firebase
    // ---------------------------------------------------------
    //
    // La extensión "Trigger Email" utiliza una colección
    // configurada para enviar correos.
    //
    // IMPORTANTE:
    // Cambia "mail" por el nombre real de la colección que
    // hayas configurado en la extensión.
    //
    // La función NO envía directamente el correo.
    // Solo crea los documentos que procesará la extensión.
    // ---------------------------------------------------------

    const batch = db.batch();

    destinatarios.forEach((correo) => {
      const correoRef = db.collection("mail").doc();

      batch.set(correoRef, {
        to: correo,

        message: {
          subject: titulo,

          text: mensaje,

          html: `
            <h2>${escaparHtml(titulo)}</h2>
            <p>${escaparHtml(mensaje)}</p>
            <p>
              Se generó una nueva alerta en M.T.P.A.
            </p>
          `,
        },
      });
    });

    await batch.commit();

    console.log(
      `Correo preparado para ${destinatarios.length} administrador(es).`,
      {
        alertaId: context.params.alertaId,
      }
    );

    return null;
  });

// ============================================================
// ENVIAR COMANDO AL VENTILADOR
// ============================================================
//
// Permite a administradores y operadores autorizados enviar
// manualmente una orden para encender o apagar un ventilador.
//
// La orden NO modifica directamente el ventilador.
// Se crea en "ordenes_ventilador" con estado "pendiente".
// El Servicio de Integración será quien ejecute posteriormente
// la orden.
//
// ============================================================

exports.enviarComandoVentilador = functions.https.onCall(async (data, context) => {
  // ----------------------------------------------------------
  // 1. Autorización
  // ----------------------------------------------------------
  //
  // Permite únicamente:
  //   - administrador
  //   - operador
  //
  // El rol "consulta" es de solo lectura y queda rechazado.
  //
  requireRole(
    context,
    ["administrador", "operador"],
    "Solo un administrador u operador puede enviar comandos a un ventilador."
  );

  // ----------------------------------------------------------
  // 2. Validar datos recibidos
  // ----------------------------------------------------------

  const { ventiladorId, accionSolicitada } = data || {};

  if (!ventiladorId || typeof ventiladorId !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "El ventiladorId es obligatorio."
    );
  }

  if (!["encender", "apagar"].includes(accionSolicitada)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      'accionSolicitada debe ser "encender" o "apagar".'
    );
  }

  // ----------------------------------------------------------
  // 3. Verificar que el ventilador exista
  // ----------------------------------------------------------

  const db = admin.firestore();

  const ventiladorRef = db
    .collection(COLECCION_VENTILADORES)
    .doc(ventiladorId);

  const ventiladorSnap = await ventiladorRef.get();

  if (!ventiladorSnap.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "El ventilador solicitado no existe."
    );
  }

  const ventilador = ventiladorSnap.data();

  // ----------------------------------------------------------
  // 4. Validar modo de control
  // ----------------------------------------------------------
  //
  // Se permite control manual cuando el modo es:
  //   - manual
  //   - mixto
  //
  // En modo automático el cliente no puede enviar órdenes
  // manuales.
  //

  if (
    ventilador.modoControl !== "manual" &&
    ventilador.modoControl !== "mixto"
  ) {
    if (ventilador.modoControl === "automatico") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "El ventilador está configurado en modo automático y no admite comandos manuales."
      );
    }

    throw new functions.https.HttpsError(
      "failed-precondition",
      "El modo de control del ventilador no permite comandos manuales."
    );
  }

  // ----------------------------------------------------------
  // 5. Resolver la incubadora y el dispositivo del ventilador
  // ----------------------------------------------------------
  //
  // El Servicio de Integración necesita incubadoraId y
  // dispositivoId para armar el tópico MQTT del comando
  // (ver docs/contrato-mqtt.md), por eso se copian a la orden
  // desde el documento del ventilador.
  //
  const { incubadoraId, dispositivoId } = ventilador;

  if (
    !incubadoraId ||
    typeof incubadoraId !== "string" ||
    !dispositivoId ||
    typeof dispositivoId !== "string"
  ) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "El ventilador no tiene incubadora o dispositivo asociado, por lo que no se puede enviar el comando."
    );
  }

  // ----------------------------------------------------------
  // 6. Crear la orden
  // ----------------------------------------------------------

  const ordenRef = await db.collection(COLECCION_ORDENES_VENTILADOR).add({
    ventiladorId,
    incubadoraId,
    dispositivoId,
    accionSolicitada,
    origen: "manual",
    estado: "pendiente",
    solicitadoPor: context.auth.uid,
    creadaEn: admin.firestore.FieldValue.serverTimestamp(),
  });

  // ----------------------------------------------------------
  // 7. Respuesta
  // ----------------------------------------------------------

  return {
    ok: true,
    ordenId: ordenRef.id,
    mensaje: "Orden de ventilador creada correctamente.",
  };
});

