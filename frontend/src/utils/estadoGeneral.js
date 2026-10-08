// =========================================================
// M.T.P.A. - ESTADO GENERAL DE UNA INCUBADORA
// Mejora Técnica de Producción Avícola
// =========================================================

import { DEVICE_STATUS, STATUS } from "./constants";

/**
 * Calcula el estado general de UNA incubadora a partir de sus
 * alertas activas y sus dispositivos (RF-017):
 *
 * - "critico": algún dispositivo está "desconectado".
 * - "advertencia": no hay dispositivos desconectados, pero la
 *   incubadora tiene al menos una alerta activa.
 * - "normal": en cualquier otro caso.
 *
 * @param {Object} datos
 * @param {Object[]} [datos.alertasActivas] Alertas con estado "activa"
 * de ESTA incubadora.
 * @param {Object[]} [datos.dispositivos] Dispositivos de ESTA incubadora.
 * @returns {"normal"|"advertencia"|"critico"} Valores de STATUS.
 */
export const calcularEstadoGeneral = ({
  alertasActivas = [],
  dispositivos = [],
} = {}) => {
  const hayDesconectados = dispositivos.some(
    (dispositivo) =>
      dispositivo.estadoConexion === DEVICE_STATUS.DISCONNECTED
  );

  if (hayDesconectados) {
    return STATUS.CRITICAL;
  }

  if (alertasActivas.length > 0) {
    return STATUS.WARNING;
  }

  return STATUS.NORMAL;
};

export default calcularEstadoGeneral;
