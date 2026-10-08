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
 * Invoca la Cloud Function callable "guardarReglaAutomatizacion".
 *
 * La función valida el rol del usuario, el ventilador, el
 * "modoControl" y la banda de histéresis ("margenHisteresis"), y
 * crea o actualiza la regla.
 *
 * @param {Object} datos
 * @param {string} datos.ventiladorId Ventilador al que aplica la regla.
 * @param {string} datos.modoControl Uno de FAN_CONTROL_MODE.
 * @param {number} datos.margenHisteresis Banda de histéresis.
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
