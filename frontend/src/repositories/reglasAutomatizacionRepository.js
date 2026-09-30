javascript
import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

import { httpsCallable } from "firebase/functions";

import { db, functions } from "../firebase/firebase.js";

// ============================================================
// OBTENER REGLA DE AUTOMATIZACIÓN
// ============================================================
//
// Busca la regla asociada a un ventilador.
//
// La lectura se realiza directamente contra Firestore.
// No se utiliza listener en tiempo real porque esta operación
// no lo requiere.
//
// ============================================================

export async function obtenerReglaPorVentiladorId(ventiladorId) {
  if (!ventiladorId) {
    throw new Error("El ventiladorId es obligatorio.");
  }

  const reglasRef = collection(db, "reglas_automatizacion");

  const q = query(
    reglasRef,
    where("ventiladorId", "==", ventiladorId)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const documento = snapshot.docs[0];

  return {
    id: documento.id,
    ...documento.data(),
  };
}

// ============================================================
// GUARDAR REGLA DE AUTOMATIZACIÓN
// ============================================================
//
// La escritura NO se realiza directamente en Firestore.
//
// Se invoca la Cloud Function:
//     guardarReglaAutomatizacion
//
// La Cloud Function se encarga de:
//   - validar el rol del usuario
//   - validar el ventilador
//   - validar modoControl
//   - validar margenHisteresis
//   - crear o actualizar la regla
//
// ============================================================

export async function guardarRegla(datos) {
  if (!datos || typeof datos !== "object") {
    throw new Error("Los datos de la regla son obligatorios.");
  }

  const guardarReglaAutomatizacion = httpsCallable(
    functions,
    "guardarReglaAutomatizacion"
  );

  const resultado = await guardarReglaAutomatizacion(datos);

  return resultado.data;
}

