/**
 * Conexión de solo lectura a Firestore para los scripts de auditoría.
 *
 * Usa la misma service account que tools/upload-firestore.js. Ningún script de esta carpeta
 * escribe: solo exporta `db` para leer y las rutas que necesitan.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const KEY_PATH = path.join(ROOT, 'tools', 'serviceAccountKey.json');

if (!fs.existsSync(KEY_PATH)) {
  console.error(
    'Falta tools/serviceAccountKey.json. Se descarga de Consola Firebase › Configuración del ' +
      'proyecto › Cuentas de servicio › Generar nueva clave privada.'
  );
  process.exit(1);
}

const admin = require(path.join(ROOT, 'node_modules', 'firebase-admin'));
admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });

/** Colección de Firestore → archivo de data/ y clave del arreglo de registros. */
const COLLECTIONS = {
  fixes: ['fixes.json', 'fixes'],
  procedures: ['procedures.json', 'procedures'],
  airways: ['airways.json', 'airways'],
  runways: ['runways.json', 'runways'],
  approaches: ['approaches.json', 'approaches'],
  holdings: ['holdings.json', 'holdings'],
  performance: ['performance.json', 'performance'],
  separation: ['separation.json', 'separation'],
  aircraftTypes: ['aircraft-types.json', 'aircraftTypes'],
  fleet: ['fleet.json', 'fleet'],
  operators: ['operators.json', 'operators'],
  sampleFlights: ['sample-flights.json', 'sampleFlights'],
  ssrBlocks: ['ssr.json', 'blocks'],
  units: ['units.json', 'units'],
  radars: ['radars.json', 'radars'],
  tma: ['tma.json', null],
  aerodromes: ['aerodromes.json', 'aerodromes'],
  flightRoutes: ['flight-routes.json', 'flightRoutes'],
};

/** Los registros de data/*.json de una colección, o [] si el archivo no existe. */
function localRecords(collection) {
  const entry = COLLECTIONS[collection];
  if (!entry) return [];
  const file = path.join(ROOT, 'data', entry[0]);
  if (!fs.existsSync(file)) return [];
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (entry[1] === null) return [json];
  return Array.isArray(json[entry[1]]) ? json[entry[1]] : [];
}

module.exports = { admin, db: admin.firestore(), ROOT, COLLECTIONS, localRecords };
