// =========================================================
// DOCUMENTO DE VENTILADOR (ventiladores/{id})
//
// Definición única del documento que crea "crearDispositivo"
// al dar de alta un dispositivo de tipo "ventilador" y que
// también usa el script de migración
// scripts/crear-documentos-ventiladores.js para los
// dispositivos que ya existían. Vive en su propio módulo, sin
// efectos secundarios (no inicializa firebase-admin ni
// registra funciones), para que ambos puedan requerirlo sin
// duplicar la definición.
//
// Debe coincidir con docs/modelo-datos.md y con
// FAN_CONTROL_MODE de frontend/src/utils/constants.js.
// =========================================================

// Modo de control con el que nace un ventilador: "manual" para
// que el operador pueda accionarlo desde el primer momento
// (enviarComandoVentilador solo admite "manual" y "mixto").
const MODO_CONTROL_INICIAL = "manual";

/**
 * Arma el documento de un ventilador.
 *
 * "estadoActual" arranca en null: se desconoce el estado real
 * hasta la primera confirmación del dispositivo, que escribe el
 * Servicio de Integración IoT. No se inventa "apagado".
 *
 * @param {object} datos
 * @param {string} datos.incubadoraId Incubadora dueña del ventilador.
 * @param {string} datos.dispositivoId Id del dispositivo físico
 * (dispositivos/{id}); es el mismo id del documento del ventilador.
 * @param {*} datos.creadoEn Marca de creación (server timestamp).
 * @returns {object}
 */
function construirDocumentoVentilador({ incubadoraId, dispositivoId, creadoEn }) {
  return {
    incubadoraId,
    dispositivoId,
    modoControl: MODO_CONTROL_INICIAL,
    estadoActual: null,
    creadoEn,
  };
}

module.exports = { MODO_CONTROL_INICIAL, construirDocumentoVentilador };
