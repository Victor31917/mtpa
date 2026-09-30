// frontend/src/repositories/ventiladoresRepository.js

import { db, functions } from "../firebase"; 
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

/**
 * Suscribirse a los ventiladores por incubadora (listener en tiempo real)
 * @param {string} incubadoraId
 * @param {function} callback - función que recibe la lista de ventiladores
 * @returns {function} unsubscribe
 */
export const suscribirseAVentiladoresPorIncubadora = (incubadoraId, callback) => {
  try {
    const ventiladoresRef = collection(db, "ventiladores");

    const q = query(
      ventiladoresRef,
      where("incubadoraId", "==", incubadoraId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ventiladores = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      callback(ventiladores);
    });

    return unsubscribe;
  } catch (error) {
    console.error("Error al suscribirse a ventiladores:", error);
    throw error;
  }
};

/**
 * Enviar comando a un ventilador (Cloud Function)
 * @param {string} ventiladorId
 * @param {string} accion - ejemplo: "ENCENDER" o "APAGAR"
 */
export const enviarComando = async (ventiladorId, accion) => {
  try {
    const enviarComandoVentilador = httpsCallable(
      functions,
      "enviarComandoVentilador"
    );

    const response = await enviarComandoVentilador({
      ventiladorId,
      accion,
    });

    return response.data;
  } catch (error) {
    console.error("Error al enviar comando al ventilador:", error);
    throw error;
  }
};