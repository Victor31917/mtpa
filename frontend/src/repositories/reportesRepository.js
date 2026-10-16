
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/firebaseConfig";

/**
 * Convierte una fecha válida a texto ISO.
 */
function convertirFechaISO(fecha, nombreCampo) {
  const fechaDate =
    fecha instanceof Date ? fecha : new Date(fecha);

  if (Number.isNaN(fechaDate.getTime())) {
    throw new Error(`El campo ${nombreCampo} no contiene una fecha válida.`);
  }

  return fechaDate.toISOString();
}

/**
 * Traduce errores de Firebase a mensajes comprensibles.
 */
function traducirErrorReporte(error) {
  const codigo = String(error?.code || "")
    .toLowerCase()
    .replace(/^functions\//, "");

  const detalle = String(
    error?.message || error?.details?.message || ""
  ).toLowerCase();

  if (
    codigo === "permission-denied" ||
    codigo === "unauthenticated" ||
    detalle.includes("sin permiso") ||
    detalle.includes("permission denied") ||
    detalle.includes("unauthenticated")
  ) {
    return "No tienes permiso para generar este reporte. Verifica tu acceso.";
  }

  if (
    codigo === "resource-exhausted" ||
    detalle.includes("rango demasiado grande") ||
    detalle.includes("range too large") ||
    detalle.includes("too many rows") ||
    detalle.includes("límite de filas")
  ) {
    return "El rango de fechas es demasiado grande. Selecciona un período más corto.";
  }

  if (
    codigo === "not-found" ||
    detalle.includes("sin datos") ||
    detalle.includes("no hay datos") ||
    detalle.includes("no data") ||
    detalle.includes("no records")
  ) {
    return "No hay datos disponibles para generar el reporte seleccionado.";
  }

  if (
    codigo === "invalid-argument" ||
    codigo === "failed-precondition"
  ) {
    return "No se pudo generar el reporte con los parámetros seleccionados. Verifica los datos e inténtalo nuevamente.";
  }

  return "Ocurrió un error al generar el reporte. Inténtalo nuevamente más tarde.";
}

/**
 * Solicita un reporte al backend mediante la callable exportarReporte.
 *
 * @param {Object} parametros
 * @param {string} parametros.tipo
 * @param {string} parametros.formato
 * @param {string} parametros.incubadoraId
 * @param {string} parametros.variable
 * @param {Date|string} parametros.desde
 * @param {Date|string} parametros.hasta
 *
 * @returns {Promise<{
 *   url: string,
 *   nombreArchivo: string,
 *   expiraEn: string|number|Date,
 *   filas: number
 * }>}
 */
async function solicitarReporte({
  tipo,
  formato,
  incubadoraId,
  variable,
  desde,
  hasta,
} = {}) {
  try {
    // Validar campos obligatorios.
    const campos = {
      tipo,
      formato,
      incubadoraId,
      variable,
      desde,
      hasta,
    };

    for (const [campo, valor] of Object.entries(campos)) {
      if (
        valor === undefined ||
        valor === null ||
        (typeof valor === "string" && !valor.trim())
      ) {
        throw new Error(
          `El campo "${campo}" es obligatorio.`
        );
      }
    }

    // Validar y convertir las fechas.
    const desdeISO = convertirFechaISO(desde, "desde");
    const hastaISO = convertirFechaISO(hasta, "hasta");

    if (new Date(desdeISO) >= new Date(hastaISO)) {
      throw new Error(
        "La fecha inicial debe ser anterior a la fecha final."
      );
    }

    // Preparar los parámetros enviados al servidor.
    const parametros = {
      tipo: tipo.trim(),
      formato: formato.trim(),
      incubadoraId: incubadoraId.trim(),
      variable: variable.trim(),
      desde: desdeISO,
      hasta: hastaISO,
    };

    // Invocar la función callable de Firebase.
    const exportarReporte = httpsCallable(
      functions,
      "exportarReporte"
    );

    const respuesta = await exportarReporte(parametros);
    const datos = respuesta.data;

    // Validar la respuesta del servidor.
    if (
      !datos ||
      typeof datos.url !== "string" ||
      !datos.url.trim() ||
      typeof datos.nombreArchivo !== "string" ||
      !datos.nombreArchivo.trim() ||
      datos.expiraEn === undefined ||
      !Number.isInteger(datos.filas) ||
      datos.filas < 0
    ) {
      throw new Error(
        "El servidor devolvió una respuesta de reporte no válida."
      );
    }

    return {
      url: datos.url,
      nombreArchivo: datos.nombreArchivo,
      expiraEn: datos.expiraEn,
      filas: datos.filas,
    };
  } catch (error) {
    // Los errores de validación ya tienen mensajes legibles.
    if (
      error instanceof Error &&
      (
        error.message.startsWith('El campo "') ||
        error.message.startsWith("La fecha") ||
        error.message.startsWith("El servidor")
      )
    ) {
      throw error;
    }

    throw new Error(traducirErrorReporte(error));
  }
}

const reportesRepository = {
  solicitarReporte,
};

export default reportesRepository;
