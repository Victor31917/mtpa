
"use strict";

const RANGOS = {
  intervaloMinimo: 5,
  intervaloMaximo: 60,
  retencionMinima: 12,
  retencionMaxima: 60,
};

const RUTA_CONFIGURACION = "config_sistema/general";

function esEnteroEnRango(valor, minimo, maximo) {
  return (
    Number.isInteger(valor) &&
    valor >= minimo &&
    valor <= maximo
  );
}

function validarConfiguracion(data) {
  if (!data || typeof data !== "object") {
    return "El documento no contiene una configuración válida.";
  }

  const clavesPermitidas = [
    "retencionHistoricoMeses",
    "intervaloMaximoReporteSeg",
    "purgaActiva",
    "actualizadoPor",
    "actualizadoEn",
  ];

  const claves = Object.keys(data);

  if (
    claves.length !== clavesPermitidas.length ||
    !clavesPermitidas.every((clave) =>
      Object.prototype.hasOwnProperty.call(data, clave)
    )
  ) {
    return "La configuración contiene campos faltantes o adicionales.";
  }

  if (
    !esEnteroEnRango(
      data.retencionHistoricoMeses,
      RANGOS.retencionMinima,
      RANGOS.retencionMaxima
    )
  ) {
    return "retencionHistoricoMeses está fuera del rango permitido.";
  }

  if (
    !esEnteroEnRango(
      data.intervaloMaximoReporteSeg,
      RANGOS.intervaloMinimo,
      RANGOS.intervaloMaximo
    )
  ) {
    return "intervaloMaximoReporteSeg está fuera del rango permitido.";
  }

  if (typeof data.purgaActiva !== "boolean") {
    return "purgaActiva debe ser un booleano.";
  }

  if (
    typeof data.actualizadoPor !== "string" ||
    data.actualizadoPor.trim() === ""
  ) {
    return "actualizadoPor debe contener un UID válido.";
  }

  // Firestore Timestamp expone toMillis().
  if (
    !data.actualizadoEn ||
    typeof data.actualizadoEn.toMillis !== "function"
  ) {
    return "actualizadoEn debe ser un Timestamp de Firestore.";
  }

  return null;
}

/**
 * Crea un lector reactivo de config_sistema/general.
 *
 * @param {{ db: FirebaseFirestore.Firestore }} options
 * @returns {{
 *   intervaloMaximoReporteSeg: () => number | null,
 *   timeoutDesconexionSegundos: () => number | null,
 *   cerrar: () => void
 * }}
 */
function crearLectorConfiguracion({ db }) {
  if (!db || typeof db.collection !== "function") {
    throw new TypeError(
      "crearLectorConfiguracion requiere una instancia válida de Firestore."
    );
  }

  // Última configuración válida recibida.
  let ultimaConfiguracionValida = null;

  // Estado de la configuración observada actualmente.
  let estado = "pendiente";
  let cerrado = false;

  // Evita repetir el mismo mensaje de configuración inválida.
  let ultimoErrorConfiguracion = null;

  function registrarErrorUnaVez(clave, mensaje) {
    if (ultimoErrorConfiguracion === clave) {
      return;
    }

    ultimoErrorConfiguracion = clave;
    console.warn(`[configuracion-sistema] ${mensaje}`);
  }

  const cancelarListener = db
    .collection("config_sistema")
    .doc("general")
    .onSnapshot(
      (snapshot) => {
        if (cerrado) {
          return;
        }

        if (!snapshot.exists) {
          estado = "invalido";

          registrarErrorUnaVez(
            "documento-inexistente",
            `No existe el documento ${RUTA_CONFIGURACION}.`
          );

          return;
        }

        const data = snapshot.data();
        const error = validarConfiguracion(data);

        if (error) {
          estado = "invalido";

          // Identificar el contenido inválido para no repetir
          // el mismo error en cada notificación idéntica.
          const clave = JSON.stringify({
            error,
            retencionHistoricoMeses:
              data?.retencionHistoricoMeses ?? null,
            intervaloMaximoReporteSeg:
              data?.intervaloMaximoReporteSeg ?? null,
            purgaActiva: data?.purgaActiva ?? null,
            actualizadoPor: data?.actualizadoPor ?? null,
            actualizadoEn:
              typeof data?.actualizadoEn?.toMillis === "function"
                ? data.actualizadoEn.toMillis()
                : null,
            claves: data ? Object.keys(data).sort() : [],
          });

          registrarErrorUnaVez(clave, error);
          return;
        }

        // Solo una configuración válida reemplaza la anterior.
        ultimaConfiguracionValida = Object.freeze({
          retencionHistoricoMeses: data.retencionHistoricoMeses,
          intervaloMaximoReporteSeg: data.intervaloMaximoReporteSeg,
          purgaActiva: data.purgaActiva,
          actualizadoPor: data.actualizadoPor,
          actualizadoEn: data.actualizadoEn,
        });

        estado = "valido";
        ultimoErrorConfiguracion = null;
      },
      (error) => {
        if (cerrado) {
          return;
        }

        // Un error terminal de onSnapshot indica que el listener
        // ya no puede seguir entregando actualizaciones.
        // El SDK administra internamente los reintentos de red
        // transitorios que no terminan en este callback.
        estado = "error";

        registrarErrorUnaVez(
          `listener-${error?.code || "desconocido"}`,
          `Falló el listener de Firestore: ${
            error?.message || "error desconocido"
          }`
        );
      }
    );

  function obtenerConfiguracionActual() {
    if (cerrado || estado !== "valido") {
      return null;
    }

    return ultimaConfiguracionValida;
  }

  function intervaloMaximoReporteSeg() {
    const configuracion = obtenerConfiguracionActual();

    return configuracion
      ? configuracion.intervaloMaximoReporteSeg
      : null;
  }

  function timeoutDesconexionSegundos() {
    const intervalo = intervaloMaximoReporteSeg();

    return intervalo === null ? null : intervalo * 3;
  }

  function cerrar() {
    if (cerrado) {
      return;
    }

    cerrado = true;
    estado = "cerrado";
    cancelarListener();
  }

  return Object.freeze({
    intervaloMaximoReporteSeg,
    timeoutDesconexionSegundos,
    cerrar,
  });
}

module.exports = {
  crearLectorConfiguracion,
};
