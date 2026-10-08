// =========================================================
// M.T.P.A. - REPOSITORY DE UMBRALES
// Mejora Técnica de Producción Avícola
// =========================================================
//
// Única capa autorizada a hablar directamente con Firestore
// para leer y escribir la colección "umbrales".
//
// Cada documento es "umbrales/{incubadoraId}_{variable}" con
// los campos numéricos "minimo" y "maximo": son exactamente los
// nombres que lee evaluarUmbrales en la Cloud Function
// "procesarMedicion" (functions/index.js).
//
// firestore.rules: cualquier usuario autenticado puede leer los
// umbrales, pero solo un administrador puede crearlos o
// modificarlos. Por eso guardarUmbral escribe directo desde el
// cliente (sin Cloud Function) y falla con "permission-denied"
// si lo invoca otro rol.
// =========================================================

import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { db } from "../services/firebase";
import { COLLECTIONS, ENVIRONMENTAL_VARIABLES } from "../utils/constants";


// Código de los errores de validación que lanza guardarUmbral
// (su "message" ya está en español y es seguro mostrarlo).
export const UMBRAL_INVALIDO = "umbral-invalido";

const VARIABLES_PERMITIDAS = Object.values(ENVIRONMENTAL_VARIABLES);


const crearErrorUmbral = (mensaje) => {
  const error = new Error(mensaje);
  error.code = UMBRAL_INVALIDO;

  return error;
};

// Number("") es 0, así que un texto vacío se descarta antes de convertir.
const aNumero = (valor) => {
  if (typeof valor === "number") {
    return valor;
  }

  if (typeof valor === "string" && valor.trim() !== "") {
    return Number(valor);
  }

  return Number.NaN;
};

// Arma { temperatura: {minimo, maximo} | null, humedad: {...} | null }
// ignorando documentos con variable desconocida o límites no numéricos.
const agruparUmbrales = (documentos) => {
  const umbrales = {};

  VARIABLES_PERMITIDAS.forEach((variable) => {
    umbrales[variable] = null;
  });

  documentos.forEach((documento) => {
    const { variable, minimo, maximo } = documento.data();

    if (
      VARIABLES_PERMITIDAS.includes(variable) &&
      typeof minimo === "number" &&
      typeof maximo === "number"
    ) {
      umbrales[variable] = { minimo, maximo };
    }
  });

  return umbrales;
};

const consultaPorIncubadora = (incubadoraId) =>
  // Un único where: no requiere índice compuesto.
  query(
    collection(db, COLLECTIONS.THRESHOLDS),
    where("incubadoraId", "==", incubadoraId)
  );


// =========================================================
// OBTENER UMBRALES DE UNA INCUBADORA (LECTURA ÚNICA)
// =========================================================

/**
 * @param {string} incubadoraId
 * @returns {Promise<{temperatura: {minimo: number, maximo: number}|null,
 * humedad: {minimo: number, maximo: number}|null}>}
 */
export const obtenerUmbralesPorIncubadora = async (incubadoraId) => {
  const snapshot = await getDocs(consultaPorIncubadora(incubadoraId));

  return agruparUmbrales(snapshot.docs);
};


// =========================================================
// SUSCRIBIRSE A LOS UMBRALES DE UNA INCUBADORA (TIEMPO REAL)
// =========================================================

/**
 * Se suscribe (onSnapshot) a los umbrales de una incubadora.
 *
 * @param {string} incubadoraId
 * @param {(umbrales: Object) => void} onCambio Misma forma que
 * obtenerUmbralesPorIncubadora.
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} Función "unsubscribe": hay que invocarla en el
 * cleanup del efecto que la usa para no dejar el listener colgado.
 */
export const suscribirseAUmbralesPorIncubadora = (
  incubadoraId,
  onCambio,
  onError
) =>
  onSnapshot(
    consultaPorIncubadora(incubadoraId),
    (snapshot) => {
      onCambio(agruparUmbrales(snapshot.docs));
    },
    onError
  );


// =========================================================
// GUARDAR UMBRAL
// =========================================================

/**
 * Crea o actualiza (merge) "umbrales/{incubadoraId}_{variable}".
 *
 * Valida antes de escribir y lanza un Error en español
 * (code = UMBRAL_INVALIDO) si algo no es válido: variable no
 * permitida, límites no numéricos o "minimo" >= "maximo". La
 * humedad además debe estar entre 0 y 100.
 *
 * @param {Object} datos
 * @param {string} datos.incubadoraId
 * @param {string} datos.variable "temperatura" | "humedad".
 * @param {number|string} datos.minimo
 * @param {number|string} datos.maximo
 * @returns {Promise<{minimo: number, maximo: number}>} Los límites ya
 * convertidos a número, tal como quedaron guardados.
 */
export const guardarUmbral = async ({
  incubadoraId,
  variable,
  minimo,
  maximo,
}) => {
  if (
    typeof incubadoraId !== "string" ||
    incubadoraId.trim() === "" ||
    incubadoraId.includes("/")
  ) {
    throw crearErrorUmbral("La incubadora indicada no es válida.");
  }

  if (!VARIABLES_PERMITIDAS.includes(variable)) {
    throw crearErrorUmbral("La variable indicada no es válida.");
  }

  const minimoNumerico = aNumero(minimo);
  const maximoNumerico = aNumero(maximo);

  if (!Number.isFinite(minimoNumerico) || !Number.isFinite(maximoNumerico)) {
    throw crearErrorUmbral("El mínimo y el máximo deben ser números válidos.");
  }

  if (minimoNumerico >= maximoNumerico) {
    throw crearErrorUmbral("El mínimo debe ser menor que el máximo.");
  }

  if (
    variable === ENVIRONMENTAL_VARIABLES.HUMIDITY &&
    (minimoNumerico < 0 || maximoNumerico > 100)
  ) {
    throw crearErrorUmbral("La humedad debe estar entre 0 y 100.");
  }

  const referencia = doc(
    db,
    COLLECTIONS.THRESHOLDS,
    `${incubadoraId}_${variable}`
  );

  await setDoc(
    referencia,
    {
      incubadoraId,
      variable,
      minimo: minimoNumerico,
      maximo: maximoNumerico,
      actualizadoEn: serverTimestamp(),
    },
    { merge: true }
  );

  return { minimo: minimoNumerico, maximo: maximoNumerico };
};


export default {
  UMBRAL_INVALIDO,
  obtenerUmbralesPorIncubadora,
  suscribirseAUmbralesPorIncubadora,
  guardarUmbral,
};
