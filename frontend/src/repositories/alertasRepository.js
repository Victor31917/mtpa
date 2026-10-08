// =========================================================
// M.T.P.A. - REPOSITORY DE ALERTAS
// Mejora Técnica de Producción Avícola
// =========================================================
//
// Única capa autorizada a hablar directamente con Firestore
// para leer la colección "alertas". Las alertas las crea la
// Cloud Function "procesarMedicion" (evaluarUmbrales); el
// cliente solo las consulta.
// =========================================================

import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "../services/firebase";
import { COLLECTIONS } from "../utils/constants";


const LIMITE_POR_DEFECTO = 50;


// =========================================================
// SUSCRIBIRSE A LAS ALERTAS (TIEMPO REAL)
// =========================================================

/**
 * Se suscribe (onSnapshot) a las alertas más recientes, de la
 * más nueva a la más antigua (campo "creadaEn").
 *
 * La consulta usa únicamente orderBy("creadaEn") + limit, que
 * no requiere índice compuesto; por eso "estado" e
 * "incubadoraId" se filtran en el cliente. Consecuencia: el
 * límite se aplica antes del filtro, así que con filtros puede
 * llegar una lista con menos de "limite" alertas.
 *
 * @param {Object} [filtros]
 * @param {string} [filtros.estado] Ej.: ALERT_STATUS.ACTIVE.
 * @param {string} [filtros.incubadoraId]
 * @param {number} [filtros.limite] Máximo de alertas leídas (50 por defecto).
 * @param {(alertas: Object[]) => void} onCambio Se invoca con la lista
 * actualizada cada vez que cambia algo en Firestore.
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} Función "unsubscribe": hay que invocarla en el
 * cleanup del efecto que la usa para no dejar el listener colgado.
 */
export const suscribirseAlertas = (
  filtros = {},
  onCambio,
  onError
) => {
  const {
    estado,
    incubadoraId,
    limite = LIMITE_POR_DEFECTO,
  } = filtros;

  const referencia = query(
    collection(db, COLLECTIONS.ALERTS),
    orderBy("creadaEn", "desc"),
    limit(limite)
  );

  return onSnapshot(
    referencia,
    (snapshot) => {
      const alertas = snapshot.docs
        .map((documento) => ({
          id: documento.id,
          ...documento.data(),
        }))
        .filter(
          (alerta) =>
            (!estado || alerta.estado === estado) &&
            (!incubadoraId || alerta.incubadoraId === incubadoraId)
        );

      onCambio(alertas);
    },
    onError
  );
};


export default {
  suscribirseAlertas,
};
