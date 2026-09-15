#!/usr/bin/env node
/**
 * build-sqlite.js — exporta data/*.json a un archivo SQLite, solo para consultarlo con SQL de
 * verdad (joins, filtros) en vez de escribir un script de Node a mano cada vez que hace falta
 * cruzar dos archivos — que es exactamente como se armo `entryAirways` en build-db.js.
 *
 *   node tools/build-sqlite.js
 *
 * Genera data/atcsims.sqlite. Es una herramienta de EXPLORACION local, no parte de la
 * aplicacion: la app y el importador siguen leyendo y escribiendo unicamente data/*.json, que
 * sigue siendo la unica fuente de verdad. Este archivo se regenera entero cada vez — no se edita
 * a mano y no se sube al repo (ver .gitignore) porque es 100% derivado de los JSON.
 *
 * Requiere Node 22 o mas nuevo: usa `node:sqlite`, que en Node 20 (el minimo del resto del
 * proyecto, ver package.json > engines y .github/workflows/deploy.yml) no existe todavia. Por
 * eso este script no es parte de `npm test` ni del build de CI — es opcional, para quien lo
 * corra a mano con un Node mas nuevo.
 *
 * Cada tabla de array-de-objetos anidado (los tramos de un procedimiento, los fixes de una
 * aerovia...) sale en su propia tabla con una columna que apunta a la fila padre, para que se
 * pueda hacer join de verdad. Ejemplos para explorar:
 *
 *   -- Que STAR entra por una aerovia dada
 *   SELECT DISTINCT p.ident FROM procedures p
 *   JOIN procedure_entry_airways a ON a.procedure_ident = p.ident
 *   WHERE a.airway = 'UQ808';
 *
 *   -- Todos los fixes de una STAR, en orden, con su restriccion de altitud
 *   SELECT seq, fix, minAltFt, maxAltFt FROM procedure_legs
 *   WHERE procedure_ident = 'UMKAL7C' ORDER BY seq;
 *
 *   -- Que aerovias pasan por un fix
 *   SELECT airway_ident FROM airway_fixes WHERE fix = 'SIMOK';
 */

let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch {
  console.error(
    `node:sqlite no esta disponible en ${process.version}. Hace falta Node 22 o mas nuevo — ` +
      `este script es aparte del resto del proyecto (que sigue pidiendo Node >=20) justo por eso.`
  );
  process.exit(1);
}

const fs = require('fs');
const path = require('path');

const DATA = path.resolve(__dirname, '..', 'data');
const OUT = path.join(DATA, 'atcsims.sqlite');
const read = (name) => JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));

if (fs.existsSync(OUT)) fs.unlinkSync(OUT);
const db = new DatabaseSync(OUT);

/** Valor de columna: los objetos/arrays que no se normalizaron aparte quedan como JSON de texto. */
function scalar(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

/** Une las columnas de todas las filas (algunas planillas traen campos opcionales) y las inserta. */
function createTable(name, rows) {
  const cols = new Set();
  for (const row of rows) for (const k of Object.keys(row)) cols.add(k);
  const columns = [...cols];
  const quoted = columns.map((c) => `"${c}"`);
  db.exec(`CREATE TABLE "${name}" (${quoted.join(', ') || '_empty'});`);
  if (rows.length > 0) {
    const stmt = db.prepare(
      `INSERT INTO "${name}" (${quoted.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`
    );
    for (const row of rows) stmt.run(...columns.map((c) => scalar(row[c])));
  }
  console.log(`  ${name.padEnd(30)} ${rows.length} filas`);
}

console.log(`Exportando data/*.json a ${path.relative(process.cwd(), OUT)}...\n`);

createTable('fixes', read('fixes.json').fixes);

// procedures: los tramos y las aerovias de entrada salen en tablas propias, con FK al ident.
{
  const procedures = read('procedures.json').procedures;
  const legs = [];
  const entryAirways = [];
  const rows = procedures.map((p) => {
    const { legs: procLegs, entryAirways: airways, ...rest } = p;
    for (const leg of procLegs) legs.push({ procedure_ident: p.ident, ...leg });
    for (const airway of airways ?? []) entryAirways.push({ procedure_ident: p.ident, airway });
    return rest;
  });
  createTable('procedures', rows);
  createTable('procedure_legs', legs);
  createTable('procedure_entry_airways', entryAirways);
}

// airways: la secuencia de fixes sale como tabla propia, con el orden en que se cruzan.
{
  const airways = read('airways.json').airways;
  const airwayFixes = [];
  const rows = airways.map((a) => {
    const { fixes, ...rest } = a;
    (fixes ?? []).forEach((fix, i) => airwayFixes.push({ airway_ident: a.ident, seq: i + 1, fix }));
    return rest;
  });
  createTable('airways', rows);
  createTable('airway_fixes', airwayFixes);
}

// performance: que fixes citan cada nivel, en tabla propia.
{
  const performance = read('performance.json').performance;
  const performanceFixes = [];
  const rows = performance.map((level) => {
    const { fixes, ...rest } = level;
    (fixes ?? []).forEach((fix) => performanceFixes.push({ level: level.level, fix }));
    return rest;
  });
  createTable('performance', rows);
  createTable('performance_fixes', performanceFixes);
}

createTable('holdings', read('holdings.json').holdings);
createTable('separation', read('separation.json').separation);
createTable('approaches', read('approaches.json').approaches);
createTable('operators', read('operators.json').operators);
createTable('fleet', read('fleet.json').fleet);
createTable('aircraft_types', read('aircraft-types.json').aircraftTypes);
createTable('runways', read('runways.json').runways);
createTable('sample_flights', read('sample-flights.json').sampleFlights);
createTable('radars', read('radars.json').radars);

// ssr: cada bloque trae sus codigos individuales aparte, para buscar uno suelto.
{
  const blocks = read('ssr.json').blocks;
  const codes = [];
  const rows = blocks.map((b) => {
    const { codes: blockCodes, ...rest } = b;
    (blockCodes ?? []).forEach((code) => codes.push({ base: b.base, code }));
    return rest;
  });
  createTable('ssr_blocks', rows);
  createTable('ssr_codes', codes);
}

// units: cada frecuencia aparte, para buscar quien usa una frecuencia dada.
{
  const units = read('units.json').units;
  const frequencies = [];
  const rows = units.map((u) => {
    const { frequencies: freqs, ...rest } = u;
    (freqs ?? []).forEach((frequency) => frequencies.push({ unit_id: u.id, frequency }));
    return rest;
  });
  createTable('units', rows);
  createTable('unit_frequencies', frequencies);
}

// tma: un objeto unico, no un array — sale como tabla de una fila, con sus anidados aparte.
{
  const tma = read('tma.json').tma;
  const { configurations, runwaysByConfiguration, ...rest } = tma;
  createTable('tma', [rest]);
  createTable('tma_configurations', (configurations ?? []).map((configuration) => ({ configuration })));
  const runwaysByConfig = [];
  for (const [configuration, rwys] of Object.entries(runwaysByConfiguration ?? {})) {
    for (const runway of rwys) runwaysByConfig.push({ configuration, runway });
  }
  createTable('tma_runways_by_configuration', runwaysByConfig);
}

db.close();
console.log(`\nListo: ${path.relative(process.cwd(), OUT)}`);
