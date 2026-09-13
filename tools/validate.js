#!/usr/bin/env node
/**
 * validate.js — comprueba la integridad de la base JSON generada por build-db.js.
 *
 *   node tools/validate.js
 *
 * Sale con codigo 1 si encuentra un error; los avisos no hacen fallar.
 * Convencion: identificadores en ingles, comentarios en espanol.
 */

const fs = require('fs');
const path = require('path');

const DATA = path.resolve(__dirname, '..', 'data');
const read = (name) => JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));

const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const fixes = read('fixes.json').fixes;
const procedures = read('procedures.json').procedures;
const airways = read('airways.json').airways;
const performance = read('performance.json').performance;
const holdings = read('holdings.json').holdings;
const separation = read('separation.json').separation;
const runways = read('runways.json').runways;

const byIdent = new Map(fixes.map((f) => [f.ident, f]));

// 1. Unicidad de designadores
const seen = new Set();
for (const f of fixes) {
  if (seen.has(f.ident)) fail(`fix duplicado: ${f.ident}`);
  seen.add(f.ident);
}

// 2. Integridad referencial
for (const p of procedures) {
  for (const leg of p.legs) {
    if (!byIdent.has(leg.fix)) fail(`${p.type} ${p.ident}: fix desconocido "${leg.fix}"`);
  }
}
for (const a of airways) {
  for (const f of a.fixes || (a.segments || []).flat()) {
    if (!byIdent.has(f)) fail(`AWY ${a.ident}: fix desconocido "${f}"`);
  }
}
for (const h of holdings) {
  if (!byIdent.has(h.fix)) fail(`holding: fix desconocido "${h.fix}"`);
}
for (const level of performance) {
  for (const f of level.fixes) {
    if (!byIdent.has(f)) warn(`performance ${level.level}: fix "${f}" no esta en la base`);
  }
}

// 3. Monotonia de la distancia restante (si el motor la viola, calcula tiempos negativos)
for (const p of procedures) {
  const dist = p.legs.map((leg) => leg.distToEndNm);
  if (dist.some((v) => v === null)) {
    warn(`${p.type} ${p.ident}: distancias incompletas — el motor no puede calcular este procedimiento`);
    continue;
  }
  for (let i = 1; i < dist.length; i++) {
    if (dist[i] >= dist[i - 1]) {
      fail(`${p.type} ${p.ident}: distancia restante no decrece en ${p.legs[i].fix} (${dist[i - 1]} -> ${dist[i]})`);
    }
  }
  const last = p.legs[p.legs.length - 1];
  if (dist[dist.length - 1] !== 0) {
    fail(`${p.type} ${p.ident}: la distancia restante del ultimo fix (${last.fix}) es ${dist[dist.length - 1]}, deberia ser 0`);
  }
}

// 4. Coherencia interna del perfil de velocidad derivado de la planilla
for (const p of procedures) {
  for (const leg of p.legs) {
    if (leg.sourceGsKt === undefined || !leg.legDistNm || !leg.sourceTimeMin) continue;
    const implied = (leg.legDistNm / leg.sourceTimeMin) * 60;
    if (Math.abs(implied - leg.sourceGsKt) > 1) {
      fail(`${p.ident} / ${leg.fix}: sourceGsKt ${leg.sourceGsKt} no cuadra con ${leg.legDistNm} NM en ${leg.sourceTimeMin} min`);
    }
  }
}

// 5. Coherencia de la tabla de performance
for (const level of performance) {
  if (level.gsKt !== null && level.nmPerMin !== null) {
    const expected = level.gsKt / 60;
    if (Math.abs(expected - level.nmPerMin) > 0.01) {
      // La planilla trunca en vez de redondear (220 kt -> 3.6 en vez de 3.667).
      // Es una imprecision de la fuente, no un fallo de la importacion.
      warn(`performance ${level.level}: gs ${level.gsKt} kt son ${expected.toFixed(3)} NM/min, la planilla dice ${level.nmPerMin} (redondeo de la fuente)`);
    }
  }
}

// 6. Holdings con nivel inferior por encima del superior
for (const h of holdings) {
  if (h.lowerLevelFt !== null && h.upperLevelFt !== null && h.lowerLevelFt > h.upperLevelFt) {
    fail(`holding ${h.fix}: nivel inferior (${h.lowerLevelFt}) por encima del superior (${h.upperLevelFt})`);
  }
}

// 7. Minimas de separacion: toda combinacion debe resolver a un solo valor
const keys = new Set();
for (const s of separation) {
  const key = `${s.runway}|${s.sivigats}|${s.withDepartures}|${s.lvp}`;
  if (keys.has(key)) fail(`separation: combinacion duplicada ${key}`);
  keys.add(key);
}

// 8. Cobertura de datos
const noCoords = fixes.filter((f) => f.lat === null);
const inferred = fixes.filter((f) => f._inferred);
const withProfile = procedures.filter((p) => p.legs.some((l) => l.sourceGsKt));
const toReview = [
  ...procedures.filter((p) => p._review).map((p) => `${p.type} ${p.ident}`),
  ...airways.filter((a) => a.fixes === null).map((a) => `AWY ${a.ident} (segmentos sin unir)`),
];

// -------------------------------------------------------------------- informe

console.log('Validacion de data/\n');
console.log(`  fixes              ${fixes.length}  (${fixes.length - noCoords.length} con coordenada, ${noCoords.length} sin)`);
console.log(`  de ellos inferidos ${inferred.length}  (citados por procedimientos o aerovias, no estaban en la base)`);
console.log(`  procedures         ${procedures.length}  (${procedures.filter((p) => p.type === 'STAR').length} STAR, ${procedures.filter((p) => p.type === 'SID').length} SID)`);
console.log(`  con perfil de GS   ${withProfile.length}  (traen la velocidad por tramo de la planilla)`);
console.log(`  airways            ${airways.length}`);
console.log(`  runways            ${runways.length}`);
console.log(`  performance        ${performance.length} niveles`);
console.log(`  holdings           ${holdings.length}`);
console.log(`  separation         ${separation.length} minimas\n`);

if (toReview.length) {
  console.log(`Marcados _review (${toReview.length}):`);
  toReview.forEach((r) => console.log(`  - ${r}`));
  console.log('');
}

if (warnings.length) {
  console.log(`Avisos (${warnings.length}):`);
  warnings.forEach((w) => console.log(`  - ${w}`));
  console.log('');
}

if (errors.length) {
  console.log(`ERRORES (${errors.length}):`);
  errors.forEach((e) => console.log(`  ! ${e}`));
  process.exit(1);
}

console.log('Sin errores de integridad.');
