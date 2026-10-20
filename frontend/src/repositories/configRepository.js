
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db, auth } from "../firebase";

// Documento de configuración del sistema
const COLECCION_CONFIG = "config_sistema";
const DOCUMENTO_CONFIG = "general";

// Valores por defecto
export const CONFIGURACION_POR_DEFECTO = {
  retencionHistoricoMeses: 12,
  intervaloMaximoReporteSeg: 10,
  purgaActiva: false,
};

// Límites de validación
// Ajusta estos límites a los valores exactos de tus reglas de Firestore.
export const MIN_RETENCION_HISTORICO_MESES = 12;
export const MAX_RETENCION_HISTORICO_MESES = 120;

export const MIN_INTERVALO_REPORTE_SEG = 1;
export const MAX_INTERVALO_REPORTE_SEG = 60;

const referenciaConfiguracion = () =>
  doc(db, COLECCION_CONFIG, DOCUMENTO_CONFIG);

/**
 * Escucha los cambios en config_sistema/general.
 *
 * Si el documento no existe, entrega los valores por defecto.
 * Retorna la función para cancelar la suscripción.
 */
export function suscribirseAConfiguracion(onCambio, onError) {
  if (typeof onCambio !== "function") {
    throw new Error("Debes proporcionar una función para recibir la configuración.");
  }

  return onSnapshot(
    referenciaConfiguracion(),
    (snapshot) => {
      if (!snapshot.exists()) {
        onCambio({ ...CONFIGURACION_POR_DEFECTO });
        return;
      }

      onCambio({
        ...CONFIGURACION_POR_DEFECTO,
        ...snapshot.data(),
      });
    },
    (error) => {
      if (typeof onError === "function") {
        onError(
          new Error(
            `No se pudo escuchar la configuración del sistema: ${error.message}`
          )
        );
      }
    }
  );
}

/**
 * Guarda y valida la configuración del sistema.
 */
export async function guardarConfiguracion({
  retencionHistoricoMeses,
  intervaloMaximoReporteSeg,
  purgaActiva,
}) {
  const usuario = auth.currentUser;

  if (!usuario) {
    throw new Error(
      "No puedes guardar la configuración porque no hay un usuario autenticado."
    );
  }

  if (
    !Number.isInteger(retencionHistoricoMeses) ||
    retencionHistoricoMeses < MIN_RETENCION_HISTORICO_MESES ||
    retencionHistoricoMeses > MAX_RETENCION_HISTORICO_MESES
  ) {
    throw new Error(
      `La retención histórica debe ser un número entero entre ${MIN_RETENCION_HISTORICO_MESES} y ${MAX_RETENCION_HISTORICO_MESES} meses.`
    );
  }

  if (
    !Number.isInteger(intervaloMaximoReporteSeg) ||
    intervaloMaximoReporteSeg < MIN_INTERVALO_REPORTE_SEG ||
    intervaloMaximoReporteSeg > MAX_INTERVALO_REPORTE_SEG
  ) {
    throw new Error(
      `El intervalo máximo de reporte debe ser un número entero entre ${MIN_INTERVALO_REPORTE_SEG} y ${MAX_INTERVALO_REPORTE_SEG} segundos.`
    );
  }

  if (typeof purgaActiva !== "boolean") {
    throw new Error(
      "El campo de purga activa debe ser verdadero o falso."
    );
  }

  const datosConfiguracion = {
    retencionHistoricoMeses,
    intervaloMaximoReporteSeg,
    purgaActiva,
    actualizadoPor: usuario.uid,
    actualizadoEn: serverTimestamp(),
  };

  try {
    await setDoc(
      referenciaConfiguracion(),
      datosConfiguracion,
      { merge: true }
    );
  } catch (error) {
    throw new Error(
      `No se pudo guardar la configuración: ${error.message}`
    );
  }
}
