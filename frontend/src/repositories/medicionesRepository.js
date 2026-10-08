import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { db } from "../services/firebase";
import { COLLECTIONS } from "../utils/constants";

/**
 * Suscripción en tiempo real a las mediciones
 * pertenecientes a una incubadora.
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
    where("incubadoraId", "==", incubadoraId)
  );

  return onSnapshot(
    referencia,
    (snapshot) => {
      const mediciones = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      }));

      onCambio(mediciones);
    },
    onError
  );
};

const medicionesRepository = {
  suscribirseAMedicionesPorIncubadora,
};

export default medicionesRepository;