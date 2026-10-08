// =========================================================
// M.T.P.A. - REPOSITORY DE VENTILADORES
// Mejora Técnica de Producción Avícola
// =========================================================
//
// Única capa autorizada a hablar directamente con Firestore
// para leer la colección "ventiladores", y con la Cloud
// Function "enviarComandoVentilador" para pedir que un
// ventilador se encienda o se apague (ver functions/index.js).
// =========================================================

import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { httpsCallable } from "firebase/functions";

import { db, functions } from "../services/firebase";
import { COLLECTIONS } from "../utils/constants";


// =========================================================
// SUSCRIBIRSE A LOS VENTILADORES DE UNA INCUBADORA (TIEMPO REAL)
// =========================================================

/**
 * Se suscribe (onSnapshot) a los ventiladores de la colección
 * "ventiladores" cuyo campo "incubadoraId" coincide con el id
 * indicado, para reflejar en tiempo real cambios de
 * "estadoActual" y "modoControl".
 *
 * @param {string} incubadoraId
 * @param {(ventiladores: Object[]) => void} onCambio Se invoca con la
 * lista actualizada de ventiladores cada vez que cambia algo en Firestore.
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} Función "unsubscribe": hay que invocarla en el
 * cleanup del efecto que la usa para no dejar el listener colgado.
 */
export const suscribirseAVentiladoresPorIncubadora = (
  incubadoraId,
  onCambio,
  onError
) => {
  const referencia = query(
    collection(db, COLLECTIONS.FANS),
    where("incubadoraId", "==", incubadoraId)
  );

  return onSnapshot(
    referencia,
    (snapshot) => {
      const ventiladores = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      }));

      onCambio(ventiladores);
    },
    onError
  );
};


// =========================================================
// ENVIAR COMANDO A UN VENTILADOR
// =========================================================

/**
 * Invoca la Cloud Function callable "enviarComandoVentilador",
 * que crea una orden pendiente en "ordenes_ventilador" (el
 * Servicio de Integración IoT la publica luego por MQTT).
 *
 * @param {string} ventiladorId
 * @param {string} accionSolicitada "encender" | "apagar"
 * (FAN_ACTIONS.TURN_ON / FAN_ACTIONS.TURN_OFF).
 * @returns {Promise<Object>} `{ ok, ordenId, mensaje }`
 */
export const enviarComando = async (ventiladorId, accionSolicitada) => {
  const callable = httpsCallable(functions, "enviarComandoVentilador");

  const resultado = await callable({ ventiladorId, accionSolicitada });

  return resultado.data;
};


export default {
  suscribirseAVentiladoresPorIncubadora,
  enviarComando,
};
