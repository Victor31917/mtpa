// =========================================================
// M.T.P.A. - REPOSITORY DE ALERTAS
// Mejora Técnica de Producción Avícola
// =========================================================
//
// Única capa autorizada a hablar directamente con Firestore
// para la colección "alertas". Las alertas las crea la
// Cloud Function "procesarMedicion" (evaluarUmbrales); el
// cliente las consulta y, con permiso, solo cambia su "estado".
// =========================================================

import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
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


// =========================================================
// SUSCRIBIRSE A UNA ALERTA (TIEMPO REAL)
// =========================================================

/**
 * Se suscribe (onSnapshot) al documento alertas/{id}.
 *
 * @param {string} id
 * @param {(alerta: Object|null) => void} onCambio Se invoca con la alerta
 * (incluyendo su id), o con null si el documento no existe.
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} Función "unsubscribe": hay que invocarla en el
 * cleanup del efecto que la usa para no dejar el listener colgado.
 */
export const suscribirseAAlerta = (id, onCambio, onError) =>
  onSnapshot(
    doc(db, COLLECTIONS.ALERTS, id),
    (snapshot) => {
      onCambio(
        snapshot.exists()
          ? { id: snapshot.id, ...snapshot.data() }
          : null
      );
    },
    onError
  );


// =========================================================
// ACTUALIZAR EL ESTADO DE UNA ALERTA
// =========================================================

/**
 * Cambia únicamente el campo "estado" de alertas/{id}.
 *
 * firestore.rules solo lo permite a administrador y operador, y solo
 * hacia "reconocida" o "resuelta" (ALERT_STATUS en utils/constants.js):
 * cualquier otro intento lo rechaza Firestore con "permission-denied".
 *
 * @param {string} id
 * @param {string} estado
 * @returns {Promise<void>}
 */
export const actualizarEstado = (id, estado) =>
  updateDoc(doc(db, COLLECTIONS.ALERTS, id), { estado });


export default {
  suscribirseAlertas,
  suscribirseAAlerta,
  actualizarEstado,
};
