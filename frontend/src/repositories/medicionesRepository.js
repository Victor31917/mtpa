
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";

import { db } from "../firebase/firebaseConfig";

// Límite predeterminado para las consultas históricas.
const LIMITE_MEDICIONES = 5000;

/**
 * Obtiene las mediciones de una incubadora dentro de un rango de fechas.
 *
 * @param {Object} params
 * @param {string} params.incubadoraId
 * @param {string} params.variable
 * @param {Date} params.desde
 * @param {Date} params.hasta
 * @param {number} [params.limite=5000]
 *
 * @returns {Promise<{mediciones: Array, truncado: boolean}>}
 */
export async function obtenerMedicionesPorRango({
  incubadoraId,
  variable,
  desde,
  hasta,
  limite = LIMITE_MEDICIONES,
}) {
  if (!incubadoraId || !variable) {
    throw new Error(
      "Debes indicar la incubadora y la variable."
    );
  }

  if (!(desde instanceof Date) || !(hasta instanceof Date)) {
    throw new Error(
      "Las fechas desde y hasta deben ser objetos Date."
    );
  }

  if (
    Number.isNaN(desde.getTime()) ||
    Number.isNaN(hasta.getTime()) ||
    desde > hasta
  ) {
    throw new Error("El rango de fechas no es válido.");
  }

  if (!Number.isInteger(limite) || limite < 1) {
    throw new Error("El límite debe ser un entero positivo.");
  }

  const medicionesRef = collection(db, "mediciones");

  const consulta = query(
    medicionesRef,
    where("incubadoraId", "==", incubadoraId),
    where("variable", "==", variable),
    where("medidoEn", ">=", desde),
    where("medidoEn", "<=", hasta),
    orderBy("medidoEn", "asc"),
    limit(limite)
  );

  const snapshot = await getDocs(consulta);

  const mediciones = snapshot.docs.map((documento) => {
    const datos = documento.data();

    return {
      id: documento.id,
      ...datos,
      medidoEn:
        datos.medidoEn?.toDate instanceof Function
          ? datos.medidoEn.toDate()
          : datos.medidoEn instanceof Date
            ? datos.medidoEn
            : null,
    };
  });

  return {
    mediciones,
    truncado: mediciones.length >= limite,
  };
}
