#!/usr/bin/env node
/**
 * Script standalone para crear los documentos "ventiladores/{id}" de
 * los dispositivos de tipo "ventilador" que ya existían antes de que
 * "crearDispositivo" los generara automáticamente.
 *
 * Por qué existe: la Cloud Function "enviarComandoVentilador" lee
 * "ventiladores/{ventiladorId}" y responde "not-found" si no existe.
 * Hasta ahora nada creaba esos documentos, y los clientes no pueden
 * escribirlos (ver firestore.rules). "crearDispositivo" ya los crea
 * para los ventiladores nuevos; este script cubre los que se dieron de
 * alta antes.
 *
 * IMPORTANTE:
 * - Este script NO se despliega como Cloud Function (ver
 *   "functions.ignore" en firebase.json, que excluye "scripts").
 *   Se ejecuta manualmente, una vez por entorno, DESPUÉS de desplegar
 *   las Cloud Functions.
 * - Requiere credenciales de una cuenta de servicio (Service Account)
 *   con permisos sobre el proyecto de Firebase (igual que
 *   crear-primer-admin.js, ver docs/bootstrap-admin.md).
 * - Es idempotente y seguro: solo crea los documentos que faltan y
 *   NUNCA sobrescribe uno existente (usa create()).
 * - Un dispositivo ventilador sin "incubadoraId" válido se omite y se
 *   informa: hay que corregirlo a mano.
 *
 * Uso (desde functions/). Primero en modo simulación, que no escribe:
 *
 *   GOOGLE_APPLICATION_CREDENTIALS="./service-account.json" \
 *   node scripts/crear-documentos-ventiladores.js --dry-run
 *
 * Y luego en serio:
 *
 *   GOOGLE_APPLICATION_CREDENTIALS="./service-account.json" \
 *   node scripts/crear-documentos-ventiladores.js
 *
 * Termina con código distinto de 0 si hubo errores.
 */

const admin = require("firebase-admin");
const { construirDocumentoVentilador } = require("../lib/ventilador");

const COLECCION_DISPOSITIVOS = "dispositivos";
const COLECCION_VENTILADORES = "ventiladores";
const TIPO_VENTILADOR = "ventilador";

// Límite de operaciones por batch de Firestore.
const TAMANIO_LOTE = 500;

const dividirEnLotes = (elementos) => {
  const lotes = [];

  for (let i = 0; i < elementos.length; i += TAMANIO_LOTE) {
    lotes.push(elementos.slice(i, i + TAMANIO_LOTE));
  }

  return lotes;
};

const main = async () => {
  const dryRun = process.argv.slice(2).includes("--dry-run");

  admin.initializeApp();

  const db = admin.firestore();

  if (dryRun) {
    console.log("Modo --dry-run: no se escribe nada en Firestore.");
  }

  const dispositivos = await db
    .collection(COLECCION_DISPOSITIVOS)
    .where("tipo", "==", TIPO_VENTILADOR)
    .get();

  const total = dispositivos.docs.length;
  const omitidos = [];
  const candidatos = [];

  dispositivos.docs.forEach((doc) => {
    const { incubadoraId } = doc.data();

    if (typeof incubadoraId !== "string" || !incubadoraId.trim()) {
      omitidos.push(doc.id);
      return;
    }

    candidatos.push({ id: doc.id, incubadoraId });
  });

  // Se separan los que ya tienen su documento de los que faltan.
  const pendientes = [];
  let yaExistian = 0;

  for (const lote of dividirEnLotes(candidatos)) {
    const referencias = lote.map(({ id }) =>
      db.collection(COLECCION_VENTILADORES).doc(id)
    );
    const snapshots = await db.getAll(...referencias);

    snapshots.forEach((snapshot, indice) => {
      if (snapshot.exists) {
        yaExistian += 1;
      } else {
        pendientes.push(lote[indice]);
      }
    });
  }

  let creados = 0;
  let errores = 0;

  if (dryRun) {
    pendientes.forEach(({ id, incubadoraId }) => {
      console.log(`[dry-run] Se crearía ventiladores/${id} (incubadora ${incubadoraId}).`);
    });
  } else {
    for (const lote of dividirEnLotes(pendientes)) {
      const batch = db.batch();

      lote.forEach(({ id, incubadoraId }) => {
        batch.create(
          db.collection(COLECCION_VENTILADORES).doc(id),
          construirDocumentoVentilador({
            incubadoraId,
            dispositivoId: id,
            creadoEn: admin.firestore.FieldValue.serverTimestamp(),
          })
        );
      });

      try {
        await batch.commit();
        creados += lote.length;
      } catch (error) {
        // Un batch es atómico: si falla, no se escribió ninguno de
        // este lote. Es seguro volver a correr el script.
        errores += lote.length;
        console.error(
          `Error al crear un lote de ${lote.length} documentos:`,
          error
        );
      }
    }
  }

  omitidos.forEach((id) => {
    console.warn(
      `Se omite dispositivos/${id}: no tiene un "incubadoraId" válido.`
    );
  });

  console.log("");
  console.log("Resumen:");
  console.log(`  Dispositivos ventilador encontrados: ${total}`);
  console.log(
    dryRun
      ? `  Se crearían: ${pendientes.length}`
      : `  Creados: ${creados}`
  );
  console.log(`  Ya existían: ${yaExistian}`);
  console.log(`  Omitidos (sin incubadoraId válido): ${omitidos.length}`);
  console.log(`  Errores: ${errores}`);

  return errores > 0 ? 1 : 0;
};

main()
  .then((codigo) => process.exit(codigo))
  .catch((error) => {
    console.error("Error al crear los documentos de ventiladores:", error);
    process.exit(1);
  });
