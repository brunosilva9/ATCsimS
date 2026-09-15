#!/usr/bin/env node
/**
 * upload-firestore.js — espeja data/*.json en 16 colecciones de Firestore, una por archivo.
 *
 *   node tools/upload-firestore.js
 *
 * Es un ESPEJO, no una migracion todavia: la app sigue leyendo unicamente data/*.json (que sigue
 * siendo la unica fuente de verdad, generada desde las planillas por tools/build-db.js). Este
 * script solo sube una copia de consulta a un proyecto de Firebase — pensado para cuando la app
 * empiece a leer de Firestore en vez de los JSON empaquetados, un paso aparte y posterior.
 *
 * Cada corrida BORRA y vuelve a escribir cada coleccion entera (mirror exacto, no merge), mismo
 * espiritu que "data/*.json no se edita a mano, se regenera": si algo se borro de un JSON, se
 * borra tambien de Firestore. Los anidados (legs de un procedimiento, fixes de una aerovia)
 * quedan EMBEBIDOS en el documento, igual forma que hoy en el JSON — no hay subcolecciones.
 *
 * Requiere:
 *  - `firebase-admin` instalado (devDependency del repo).
 *  - Una service account key descargada de Consola Firebase > Configuracion del proyecto >
 *    Cuentas de servicio > Generar nueva clave privada, guardada como tools/serviceAccountKey.json
 *    (gitignored: es una credencial real con permisos de administrador, no una config publica
 *    como las VITE_FIREBASE_* de apps/web/.env.example).
 *
 * No es parte de `data:build`, `data:validate`, `test` ni del build de CI: corre a mano, contra
 * un proyecto de Firebase real, y no hay credenciales para esto en GitHub Actions.
 */

const fs = require('fs');
const path = require('path');

const DATA = path.resolve(__dirname, '..', 'data');
const read = (name) => JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));

const KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(KEY_PATH)) {
  console.error(
    `Falta ${path.relative(process.cwd(), KEY_PATH)}.\n\n` +
      `Descargala de Consola Firebase > Configuracion del proyecto > Cuentas de servicio > ` +
      `Generar nueva clave privada, y guardala con ese nombre exacto (esta en .gitignore, no se sube).`
  );
  process.exit(1);
}

let admin;
try {
  admin = require('firebase-admin');
} catch {
  console.error(
    `Falta la dependencia firebase-admin. Instalala con:\n\n  npm install -D firebase-admin\n`
  );
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });
const db = admin.firestore();

/** Convierte texto libre en un id de documento legible (para radars, que no trae clave corta). */
function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

/** Aplica hasta 500 operaciones por batch, el limite de Firestore. */
async function commitInChunks(ops) {
  const CHUNK = 500;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + CHUNK)) {
      if (op.type === 'delete') batch.delete(op.ref);
      else batch.set(op.ref, op.data);
    }
    await batch.commit();
  }
}

/**
 * Espeja una coleccion entera: borra todos los docs existentes y escribe `records` con el id que
 * calcula `idFn`. Un id duplicado (puede pasar en sampleFlights) se resuelve con sufijo -2, -3...
 * y queda avisado por consola en vez de pisar un documento en silencio.
 */
async function mirror(collectionName, records, idFn, meta) {
  const docs = new Map();
  for (const record of records) {
    let id = String(idFn(record));
    if (docs.has(id)) {
      let n = 2;
      while (docs.has(`${id}-${n}`)) n++;
      console.warn(`  aviso: id duplicado "${id}" en ${collectionName}, se usa "${id}-${n}"`);
      id = `${id}-${n}`;
    }
    docs.set(id, { ...record, _meta: meta });
  }

  const colRef = db.collection(collectionName);
  const existing = await colRef.listDocuments();
  await commitInChunks(existing.map((ref) => ({ type: 'delete', ref })));
  await commitInChunks([...docs.entries()].map(([id, data]) => ({ type: 'set', ref: colRef.doc(id), data })));

  console.log(`  ${collectionName.padEnd(20)} ${docs.size} documentos`);
}

async function main() {
  console.log(`Subiendo data/*.json a Firestore...\n`);

  const fixes = read('fixes.json');
  await mirror('fixes', fixes.fixes, (r) => r.ident, fixes._meta);

  const procedures = read('procedures.json');
  await mirror('procedures', procedures.procedures, (r) => r.ident, procedures._meta);

  const airways = read('airways.json');
  await mirror('airways', airways.airways, (r) => r.ident, airways._meta);

  const runways = read('runways.json');
  await mirror('runways', runways.runways, (r) => r.ident, runways._meta);

  const approaches = read('approaches.json');
  await mirror('approaches', approaches.approaches, (r) => r.code, approaches._meta);

  const holdings = read('holdings.json');
  await mirror('holdings', holdings.holdings, (r) => r.fix, holdings._meta);

  const performance = read('performance.json');
  await mirror('performance', performance.performance, (r) => r.level, performance._meta);

  const aircraftTypes = read('aircraft-types.json');
  await mirror('aircraftTypes', aircraftTypes.aircraftTypes, (r) => r.icao, aircraftTypes._meta);

  const fleet = read('fleet.json');
  await mirror('fleet', fleet.fleet, (r) => r.registration, fleet._meta);

  const operators = read('operators.json');
  await mirror('operators', operators.operators, (r) => r.icaoPrefix, operators._meta);

  const sampleFlights = read('sample-flights.json');
  await mirror('sampleFlights', sampleFlights.sampleFlights, (r) => r.callsign, sampleFlights._meta);

  const ssr = read('ssr.json');
  await mirror('ssrBlocks', ssr.blocks, (r) => r.base, ssr._meta);

  const units = read('units.json');
  await mirror('units', units.units, (r) => r.id, units._meta);

  const radars = read('radars.json');
  await mirror('radars', radars.radars, (r) => slugify(r.equipment), radars._meta);

  const separation = read('separation.json');
  await mirror(
    'separation',
    separation.separation,
    (r) => `${r.runway}-dep${r.withDepartures}-sivigats${r.sivigats}-lvp${r.lvp}`,
    separation._meta
  );

  const tma = read('tma.json');
  await mirror('tma', [tma.tma], () => 'scel', tma._meta);

  console.log(`\nListo.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
