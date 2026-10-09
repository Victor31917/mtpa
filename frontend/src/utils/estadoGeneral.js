// =========================================================
// M.T.P.A. - ESTADO GENERAL DE UNA INCUBADORA
// Mejora Técnica de Producción Avícola
// =========================================================

import { DEVICE_STATUS, STATUS } from "./constants";

/**
 * Calcula el estado general de UNA incubadora a partir de sus
 * alertas abiertas y sus dispositivos (RF-017):
 *
 * - "critico": algún dispositivo está "desconectado".
 * - "advertencia": no hay dispositivos desconectados, pero la
 *   incubadora tiene al menos una alerta abierta.
 * - "normal": en cualquier otro caso.
 *
 * Una alerta abierta es la que está "activa" o "reconocida": una
 * alerta reconocida sigue sin resolverse (el valor continúa fuera de
 * rango) hasta que el sistema la marca "resuelta".
 *
 * @param {Object} datos
 * @param {Object[]} [datos.alertasAbiertas] Alertas con estado "activa"
 * o "reconocida" de ESTA incubadora.
 * @param {Object[]} [datos.dispositivos] Dispositivos de ESTA incubadora.
 * @returns {"normal"|"advertencia"|"critico"} Valores de STATUS.
 */
export const calcularEstadoGeneral = ({
  alertasAbiertas = [],
  dispositivos = [],
} = {}) => {
  const hayDesconectados = dispositivos.some(
    (dispositivo) =>
      dispositivo.estadoConexion === DEVICE_STATUS.DISCONNECTED
  );

  if (hayDesconectados) {
    return STATUS.CRITICAL;
  }

  if (alertasAbiertas.length > 0) {
    return STATUS.WARNING;
  }

  return STATUS.NORMAL;
};

export default calcularEstadoGeneral;
