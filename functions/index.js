// =========================================================
// PROCESAMIENTO DE MEDICIONES
// =========================================================
//
// Lee el umbral compuesto:
//   umbrales/{incubadoraId}_{variable}
//
// Si la medición está fuera del rango permitido, crea una
// alerta con estado "nueva".
//
// No crea alertas duplicadas mientras exista una alerta
// "nueva" para la misma incubadora + variable + límite.
//
// =========================================================

const COLECCION_UMBRALES = "umbrales";
const COLECCION_ALERTAS = "alertas";

/**
 * Cloud Function: procesarMedicion
 *
 * Procesa una medición recibida desde el Servicio de
 * Integración IoT.
 *
 * Datos esperados:
 * {
 *   incubadoraId: string,
 *   dispositivoId: string,
 *   variable: "temperatura" | "humedad",
 *   valor: number,
 *   unidad: string,
 *   medidoEn: string | number
 * }
 *
 * Reglas:
 * 1. Lee umbrales/{incubadoraId}_{variable}.
 * 2. Si valor < minimo o valor > maximo, genera una alerta.
 * 3. No duplica alertas nuevas para la misma condición.
 */
exports.procesarMedicion = functions.https.onRequest(
  async (req, res) => {
    // -------------------------------------------------------
    // 1. Validación básica de la petición
    // -------------------------------------------------------

    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Método no permitido. Usa POST.",
      });
    }

    const {
      incubadoraId,
      dispositivoId,
      variable,
      valor,
      unidad,
      medidoEn,
    } = req.body || {};

    if (!incubadoraId) {
      return res.status(400).json({
        error: "El campo incubadoraId es obligatorio.",
      });
    }

    if (!dispositivoId) {
      return res.status(400).json({
        error: "El campo dispositivoId es obligatorio.",
      });
    }

    if (!["temperatura", "humedad"].includes(variable)) {
      return res.status(400).json({
        error:
          'El campo variable debe ser "temperatura" o "humedad".',
      });
    }

    if (
      typeof valor !== "number" ||
      !Number.isFinite(valor)
    ) {
      return res.status(400).json({
        error:
          "El campo valor debe ser un número finito.",
      });
    }

    // -------------------------------------------------------
    // 2. Firestore
    // -------------------------------------------------------

    const db = admin.firestore();

    // DDS sección 4:
    // umbrales/{incubadoraId}_{variable}
    const umbralId = `${incubadoraId}_${variable}`;

    const umbralRef = db
      .collection(COLECCION_UMBRALES)
      .doc(umbralId);

    const umbralSnapshot = await umbralRef.get();

    if (!umbralSnapshot.exists) {
      return res.status(404).json({
        error:
          `No existe un umbral configurado para ` +
          `${incubadoraId}_${variable}.`,
      });
    }

    const umbral = umbralSnapshot.data();

    // -------------------------------------------------------
    // 3. Validar límites
    // -------------------------------------------------------

    if (
      typeof umbral.minimo !== "number" ||
      typeof umbral.maximo !== "number"
    ) {
      return res.status(500).json({
        error:
          "El documento de umbral tiene límites inválidos.",
      });
    }

    const estaDebajoDelMinimo =
      valor < umbral.minimo;

    const estaSobreElMaximo =
      valor > umbral.maximo;

    // La medición está dentro del rango permitido.
    if (
      !estaDebajoDelMinimo &&
      !estaSobreElMaximo
    ) {
      return res.status(200).json({
        procesada: true,
        fueraDeRango: false,
        alertaCreada: false,
      });
    }

    // -------------------------------------------------------
    // 4. Determinar qué límite fue incumplido
    // -------------------------------------------------------

    const limite = estaDebajoDelMinimo
      ? "minimo"
      : "maximo";

    // -------------------------------------------------------
    // 5. Buscar alerta "nueva" existente
    // -------------------------------------------------------
    //
    // Una alerta se considera duplicada cuando corresponde a:
    //
    //   misma incubadora
    //   + misma variable
    //   + mismo límite
    //   + estado "nueva"
    //
    // De esta forma, mientras la condición permanezca sostenida,
    // no se generan múltiples alertas.

    const alertasExistentes = await db
      .collection(COLECCION_ALERTAS)
      .where(
        "incubadoraId",
        "==",
        incubadoraId
      )
      .where(
        "variable",
        "==",
        variable
      )
      .where(
        "limite",
        "==",
        limite
      )
      .where(
        "estado",
        "==",
        "nueva"
      )
      .limit(1)
      .get();

    // -------------------------------------------------------
    // 6. No duplicar alerta
    // -------------------------------------------------------

    if (!alertasExistentes.empty) {
      return res.status(200).json({
        procesada: true,
        fueraDeRango: true,
        alertaCreada: false,
        alertaDuplicada: true,
        limite,
      });
    }

    // -------------------------------------------------------
    // 7. Crear nueva alerta
    // -------------------------------------------------------

    const alertaRef = await db
      .collection(COLECCION_ALERTAS)
      .add({
        incubadoraId,
        dispositivoId,
        variable,
        valor,
        unidad: unidad || null,
        minimo: umbral.minimo,
        maximo: umbral.maximo,
        limite,
        estado: "nueva",
        medidoEn: medidoEn || null,
        creadoEn:
          admin.firestore.FieldValue.serverTimestamp(),
      });

    return res.status(201).json({
      procesada: true,
      fueraDeRango: true,
      alertaCreada: true,
      alertaId: alertaRef.id,
      limite,
    });
  }
);