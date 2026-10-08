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

  // TODO Sprint 3: comparar esta medición contra los
  // umbrales configurados para la incubadora/dispositivo.
  //
  // Ejemplo futuro:
  //
  // await evaluarUmbrales({
  //   incubadoraId,
  //   dispositivoId,
  //   variable,
  //   valor,
  //   unidad,
  //   medidoEn: medidoEnTimestamp,
  // });

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

