// =========================================================
// M.T.P.A. - REPOSITORY DE REGLAS DE AUTOMATIZACIÓN
// Mejora Técnica de Producción Avícola
// =========================================================
//
// Única capa autorizada a hablar directamente con Firestore
// para leer la colección "reglas_automatizacion", y con la
// Cloud Function "guardarReglaAutomatizacion" para crear o
// actualizar una regla: el cliente nunca escribe en esa
// colección (ver firestore.rules).
// =========================================================

import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { httpsCallable } from "firebase/functions";

import { db, functions } from "../services/firebase";
import { COLLECTIONS } from "../utils/constants";


// =========================================================
// OBTENER REGLA DE AUTOMATIZACIÓN
// =========================================================

/**
 * Busca la regla de automatización asociada a un ventilador.
 *
 * La lectura es única (getDocs): esta operación no requiere
 * un listener en tiempo real.
 *
 * @param {string} ventiladorId
 * @returns {Promise<Object|null>}
 * La regla (incluyendo su id), o null si el ventilador no tiene.
 */
export const obtenerReglaPorVentiladorId = async (ventiladorId) => {
  if (!ventiladorId) {
    throw new Error("El ventiladorId es obligatorio.");
  }

  const referencia = query(
    collection(db, COLLECTIONS.AUTOMATION_RULES),
    where("ventiladorId", "==", ventiladorId)
  );

  const snapshot = await getDocs(referencia);

  if (snapshot.empty) {
    return null;
  }

  const documento = snapshot.docs[0];

  return {
    id: documento.id,
    ...documento.data(),
  };
};


// =========================================================
// GUARDAR REGLA DE AUTOMATIZACIÓN
// =========================================================

/**
 * Invoca la Cloud Function callable "guardarReglaAutomatizacion" (solo
 * administrador), que cambia el modo de control de un ventilador y, según el
 * modo, crea o actualiza su regla de histéresis en una sola operación.
 *
 * Campos según el modo:
 * - "manual": solo se cambia el modo. Alcanza con `ventiladorId` y
 *   `modoControl`; la regla guardada se conserva y los demás campos se
 *   ignoran.
 * - "automatico" o "mixto": además son obligatorios `variable`,
 *   `umbralActivacion`, `margenHisteresis` y `activa`.
 *
 * Validaciones de la función (rechaza con un error "invalid-argument"):
 * - `variable` es "temperatura" o "humedad".
 * - `umbralActivacion` y `margenHisteresis` son números finitos.
 * - `margenHisteresis` es al menos 0,01 y menor que `umbralActivacion`.
 * - `activa` es booleano y, en modo "automatico", debe ser true: una regla
 *   inactiva dejaría al ventilador sin control, porque en ese modo se
 *   rechazan los comandos manuales. Con "mixto" sí puede ser false.
 *
 * @param {Object} datos
 * @param {string} datos.ventiladorId Ventilador al que aplica la regla.
 * @param {string} datos.modoControl Uno de FAN_CONTROL_MODE.
 * @param {string} [datos.variable] ENVIRONMENTAL_VARIABLES; obligatorio salvo
 * en modo manual.
 * @param {number} [datos.umbralActivacion] Valor de activación; obligatorio
 * salvo en modo manual.
 * @param {number} [datos.margenHisteresis] Banda de histéresis; obligatorio
 * salvo en modo manual.
 * @param {boolean} [datos.activa] Si la regla está activa; obligatorio salvo
 * en modo manual.
 * @returns {Promise<Object>}
 */
export const guardarRegla = async (datos) => {
  if (!datos || typeof datos !== "object" || !datos.ventiladorId) {
    throw new Error("Los datos de la regla y el ventiladorId son obligatorios.");
  }

  // La callable "guardarReglaAutomatizacion" la entrega la tarea pendiente
  // de Sprint 4 (todavía no existe en functions/index.js).
  const callable = httpsCallable(functions, "guardarReglaAutomatizacion");

  const resultado = await callable(datos);

  return resultado.data;
};


export default {
  obtenerReglaPorVentiladorId,
  guardarRegla,
};
