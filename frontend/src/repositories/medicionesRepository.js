import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "../services/firebase";
import { COLLECTIONS } from "../utils/constants";

// Máximo de mediciones recientes que se mantienen escuchando.
const LIMITE_MEDICIONES = 200;

/**
 * Suscripción en tiempo real a las mediciones más recientes
 * pertenecientes a una incubadora.
 *
 * La consulta usa solo orderBy("medidoEn") + limit, que no requiere
 * índice compuesto (where("incubadoraId") + orderBy("medidoEn") sí lo
 * requeriría); por eso se filtra por incubadora en el cliente. El límite
 * se aplica antes del filtro, así que con varias incubadoras enviando
 * datos la ventana puede contener pocas mediciones de la seleccionada.
 *
 * @param {string} incubadoraId
 * @param {(mediciones: Object[]) => void} onCambio
 * @param {(error: Error) => void} onError
 * @returns {() => void} unsubscribe
 */
export const suscribirseAMedicionesPorIncubadora = (
  incubadoraId,
  onCambio,
  onError
) => {
  if (!incubadoraId) {
    return () => {};
  }

  const referencia = query(
    collection(db, COLLECTIONS.MEASUREMENTS),
    orderBy("medidoEn", "desc"),
    limit(LIMITE_MEDICIONES)
  );

  return onSnapshot(
    referencia,
    (snapshot) => {
      const mediciones = snapshot.docs
        .map((documento) => ({
          id: documento.id,
          ...documento.data(),
        }))
        .filter(
          (medicion) =>
            medicion.incubadoraId === incubadoraId
        );

      onCambio(mediciones);
    },
    onError
  );
};

const medicionesRepository = {
  suscribirseAMedicionesPorIncubadora,
};

export default medicionesRepository;