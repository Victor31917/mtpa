// =========================================================
// M.T.P.A. - REPOSITORY DE ÓRDENES DE VENTILADOR
// Mejora Técnica de Producción Avícola
// =========================================================
//
// Única capa autorizada a hablar directamente con Firestore
// para leer la colección "ordenes_ventilador". Las órdenes las
// crea la Cloud Function "enviarComandoVentilador" y su estado
// lo actualiza el Servicio de Integración IoT: el cliente solo
// las lee (ver firestore.rules).
// =========================================================

import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "../services/firebase";
import { COLLECTIONS } from "../utils/constants";


// =========================================================
// SUSCRIBIRSE A LAS ÓRDENES DE UN VENTILADOR (TIEMPO REAL)
// =========================================================

/**
 * Se suscribe (onSnapshot) a las órdenes de la colección
 * "ordenes_ventilador" cuyo campo "ventiladorId" coincide con el
 * id indicado, de la más reciente a la más antigua.
 *
 * Esta consulta (where + orderBy sobre campos distintos) necesita
 * el índice compuesto declarado en firestore.indexes.json.
 *
 * @param {string} ventiladorId
 * @param {(ordenes: Object[]) => void} onCambio Se invoca con la
 * lista actualizada de órdenes cada vez que cambia algo en Firestore.
 * @param {(error: Error) => void} [onError]
 * @param {number} [limite] Cantidad máxima de órdenes (las más recientes).
 * Sin este argumento se leen todas. Usa el mismo índice compuesto.
 * @returns {() => void} Función "unsubscribe": hay que invocarla en el
 * cleanup del efecto que la usa para no dejar el listener colgado.
 */
export const suscribirseAOrdenesPorVentilador = (
  ventiladorId,
  onCambio,
  onError,
  limite
) => {
  const restricciones = [
    where("ventiladorId", "==", ventiladorId),
    orderBy("creadaEn", "desc"),
  ];

  if (Number.isInteger(limite) && limite > 0) {
    restricciones.push(limit(limite));
  }

  const referencia = query(
    collection(db, COLLECTIONS.FAN_COMMANDS),
    ...restricciones
  );

  return onSnapshot(
    referencia,
    (snapshot) => {
      const ordenes = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      }));

      onCambio(ordenes);
    },
    onError
  );
};


export default {
  suscribirseAOrdenesPorVentilador,
};
