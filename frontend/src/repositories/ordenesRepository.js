// frontend/src/repositories/ordenesRepository.js

import { db } from "../firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

/**
 * Suscribirse a las órdenes de un ventilador (tiempo real)
 * @param {string} ventiladorId
 * @param {function} callback - recibe la lista de órdenes
 * @returns {function} unsubscribe
 */
export const suscribirseAOrdenesPorVentilador = (ventiladorId, callback) => {
  try {
    const ordenesRef = collection(db, "ordenes_ventilador");

    const q = query(
      ordenesRef,
      where("ventiladorId", "==", ventiladorId),
      orderBy("creadaEn", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordenes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      callback(ordenes);
    });

    return unsubscribe;
  } catch (error) {
    console.error("Error al suscribirse a órdenes:", error);
    throw error;
  }
};