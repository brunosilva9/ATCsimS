#!/usr/bin/env node
/**
 * build-db.js — construye la base de datos JSON de ATCsimS desde las planillas de basedatos/.
 *
 *   node tools/build-db.js
 *
 * Cada archivo de salida lleva un bloque `_meta` con su origen y el metodo usado:
 *   "extracted"    = leido de la planilla por este script (reproducible)
 *   "transcribed"  = transcrito a mano desde la planilla, porque el layout depende de celdas
 *                    combinadas que el lector no conserva. Revisar contra el original.
 *
 * Convencion: identificadores y claves en ingles, comentarios en espanol.
 */

const fs = require('fs');
const path = require('path');
const { readWorkbook } = require('./xlsx.js');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'basedatos');
const OUT = path.join(ROOT, 'data');

const SOURCES = {
  master: path.join(SRC, 'APP_SCEL_Training_System_v1.0.xlsx'),
  tables: path.join(SRC, 'TABLAS AWY-STAR-IAC-MIN ESPAC - APP SIVIGATS 05 AGO 2026 EVAL.xlsx'),
  strips: path.join(SRC, '01modelo FPV.xlsx'),
};

// ---------------------------------------------------------------- utilidades

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const num = (s) => {
  const v = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};
const isNum = (s) => s !== '' && num(s) !== null;

/**
 * Normaliza una coordenada en grados/minutos/segundos a grados decimales.
 * Las fuentes traen, en la misma columna: 34°11'0''S · 33°25'11"S · 32°15'5,3'' S ·
 * 33°54'54.00" S · 31°53'0''S (con espacio final).
 * Devuelve null si no reconoce el formato, nunca un valor inventado.
 */
function dmsToDecimal(text) {
  const t = clean(text);
  if (!t) return null;
  const m = t.match(
    /^(\d+)\s*°\s*(\d+)\s*['′]\s*(?:(\d+(?:[.,]\d+)?)\s*(?:''|"|″|′′)?)?\s*([NSEWO])\s*$/i
  );
  if (!m) return null;
  const [, deg, min, sec, hemi] = m;
  const dec = +deg + +min / 60 + (sec ? num(sec) / 3600 : 0);
  const sign = /[SWO]/i.test(hemi) ? -1 : 1;
  return Math.round(dec * sign * 1e6) / 1e6;
}

function write(fileName, meta, payload) {
  const doc = { _meta: meta, ...payload };
  fs.writeFileSync(path.join(OUT, fileName), JSON.stringify(doc, null, 2) + '\n', 'utf8');
  const first = Object.values(payload)[0];
  const count = Array.isArray(first) ? first.length : Object.keys(first).length;
  console.log(`  data/${fileName}  (${count} registros)`);
}

// ---------------------------------------------------------------- 1. fixes

const STARS = new Set([
  'ANDES1', 'EROLO6E', 'EROLO7F', 'EROLO8A*', 'SIMOK7B', 'ASIMO7D', 'UMKAL7C', 'VENTANAS1D',
]);
const SIDS = new Set([
  'ALBAL7A', 'ALBAL7C', 'ANGOD8B', 'ANGOD6C', 'LINER5A', 'LINER6C', 'GELUS6A', 'SABLA8',
  'DOMINGO6', 'VENTANAS6', 'DONTI6A', 'DONTI5B', 'TABON6A',
]);

function buildFixes(wbMaster, wbTables) {
  const grid = wbMaster['03_BASE_NAVEGACION_SCEL'];
  const fixes = new Map();

  for (let i = 1; i < grid.length; i++) {
    const r = grid[i] || [];
    const ident = clean(r[1]);
    if (!ident) continue;
    const latText = clean(r[4]);
    const lonText = clean(r[5]);
    fixes.set(ident, {
      id: clean(r[0]) || null,
      ident,
      name: clean(r[2]) || ident,
      type: clean(r[3]) || 'WAYPOINT',
      lat: dmsToDecimal(latText),
      lon: dmsToDecimal(lonText),
      latSource: latText || null,
      lonSource: lonText || null,
      elevationFt: null,
      scope: clean(r[9]) || 'TMA',
      roles: [],
      meaFt: null,
      mclFt: null,
      _source: 'APP_SCEL_Training_System_v1.0.xlsx!03_BASE_NAVEGACION_SCEL',
    });
  }

  // Completar con la hoja Way Points (trae algunos que la base maestra no tiene).
  const wp = wbTables['Way Points'] || [];
  for (const r of wp) {
    for (let c = 0; c < r.length - 2; c++) {
      const ident = clean(r[c]);
      if (!/^[A-Z]{3,5}(\s*\(D\d+\))?$/.test(ident)) continue;
      const lat = dmsToDecimal(r[c + 1]);
      const lon = dmsToDecimal(r[c + 2]);
      if (lat === null || lon === null) continue;
      if (!fixes.has(ident)) {
        fixes.set(ident, {
          id: null,
          ident,
          name: ident,
          type: 'WAYPOINT',
          lat, lon,
          latSource: clean(r[c + 1]),
          lonSource: clean(r[c + 2]),
          elevationFt: null,
          scope: 'TMA',
          roles: [],
          meaFt: null,
          mclFt: null,
          _source: 'TABLAS...05 AGO 2026!Way Points',
        });
      }
    }
  }

  return [...fixes.values()].sort((a, b) => a.ident.localeCompare(b.ident));
}

// ------------------------------------------------- 2. procedimientos SID/STAR

/**
 * La hoja STARs-SIDs-2 codifica cada procedimiento en una fila:
 *   col 45          designador (ancla)
 *   cols 27..44     secuencia de fixes
 *   cols 47..       bloque numerico
 * En las STAR el bloque numerico es la DISTANCIA RESTANTE al fix final (decreciente, termina en 0).
 * En las SID es la distancia de cada TRAMO (la primera, del aerodromo al primer fix).
 */
function buildProcedures(wbTables, wbMaster) {
  const grid = wbTables['STARs-SIDs-2'];
  const procedures = [];

  for (const r of grid) {
    if (!r || !r.length) continue;
    const ident = clean(r[45]);
    if (!ident || (!STARS.has(ident) && !SIDS.has(ident))) continue;

    const fixes = [];
    const altitudePoints = [];
    for (let c = 26; c < 45; c++) {
      const v = clean(r[c]);
      if (!v || v === ident) continue;
      // DONTI5B vira a una altitud, no a un fix publicado ("4.000FT"). Es un punto del
      // procedimiento igual que los demas: cuenta para las distancias y no se puede descartar.
      const alt = v.match(/^(\d[\d.,]*)\s*(?:FT|PIES)$/i);
      if (alt) {
        const normalized = alt[1].replace(/[.,]/g, '') + 'FT';
        altitudePoints.push(normalized);
        fixes.push(normalized);
        continue;
      }
      fixes.push(v);
    }

    const values = [];
    for (let c = 46; c < r.length && values.length < fixes.length; c++) {
      if (clean(r[c]) === '') continue;
      if (!isNum(r[c])) break;
      values.push(num(r[c]));
      // En las STAR la serie es la distancia restante y termina en 0: ahi corta.
      if (STARS.has(ident) && num(r[c]) === 0) break;
    }
    if (fixes.length === 0) {
      console.warn(`  ! ${ident}: sin fixes — omitido`);
      continue;
    }

    const isStar = STARS.has(ident);
    const mismatch = values.length !== fixes.length;
    if (mismatch) {
      console.warn(
        `  ! ${ident}: ${fixes.length} fixes vs ${values.length} distancias en la planilla ` +
        `— se emite con distancias en null y marca _review`
      );
    }

    let legs;
    if (isStar) {
      // values = distancia restante al fix final
      legs = fixes.map((fix, i) => ({
        seq: i + 1,
        fix,
        distToEndNm: mismatch ? null : values[i],
        legDistNm: mismatch || i === 0 ? null : Math.round((values[i - 1] - values[i]) * 10) / 10,
      }));
    } else if (mismatch) {
      legs = fixes.map((fix, i) => ({ seq: i + 1, fix, legDistNm: null, distFromOriginNm: null, distToEndNm: null }));
    } else {
      // values = distancia de cada tramo; el primero sale del aerodromo
      let cumulative = 0;
      const total = values.reduce((a, b) => a + b, 0);
      legs = fixes.map((fix, i) => {
        cumulative += values[i];
        return {
          seq: i + 1,
          fix,
          legDistNm: values[i],
          distFromOriginNm: Math.round(cumulative * 10) / 10,
          distToEndNm: Math.round((total - cumulative) * 10) / 10,
        };
      });
    }

    const procedure = {
      ident: ident.replace(/\*$/, ''),
      type: isStar ? 'STAR' : 'SID',
      runway: '17L',
      configuration: 'SUR',
      rnav: null,
      requiresSivigats: ident.endsWith('*'),
      entryFix: isStar ? fixes[0] : null,
      exitFix: fixes[fixes.length - 1],
      totalDistNm: mismatch
        ? null
        : isStar
          ? legs[0].distToEndNm
          : Math.round(values.reduce((a, b) => a + b, 0) * 10) / 10,
      legs,
      _source: 'TABLAS...05 AGO 2026!STARs-SIDs-2',
    };
    if (altitudePoints.length) procedure.altitudePoints = altitudePoints;

    // Tiempos por tramo que la planilla ya calculo (cols 67+). Revelan la GS que el instructor
    // asume en cada tramo — es decir, el perfil de descenso/ascenso del procedimiento.
    // El bloque de minutos va seguido, sin separador fiable, del mismo bloque en segundos y de
    // una tabla de velocidades. Lo que si distingue al bloque de minutos es que termina con su
    // propio total: se corta en el primer valor que iguala la suma de los anteriores.
    const raw = [];
    for (let c = 66; c < 96; c++) {
      const v = clean(r[c]);
      if (v === '') continue;
      if (!isNum(v)) break;
      raw.push(Math.round(num(v) * 1000) / 1000);
    }
    const times = [];
    let sum = 0;
    for (let k = 0; k < raw.length; k++) {
      if (k >= 1 && Math.abs(raw[k] - sum) < 0.05) {
        times.push(raw[k]); // el total cierra el bloque
        break;
      }
      times.push(raw[k]);
      sum += raw[k];
    }
    if (times.length === raw.length && raw.length) times.length = 0; // nunca cerro: no fiable
    if (times.length) {
      procedure._sourceTimesMin = times;
      const perLeg = times.slice(0, -1);
      const total = times[times.length - 1];
      // En las STAR el primer fix es la entrada y no tiene tramo previo (n-1 tramos).
      // En las SID el primer tramo va del aerodromo al primer fix, asi que hay n tramos.
      const first = isStar ? 1 : 0;
      const legCount = legs.length - first;

      let profile = null;
      if (perLeg.length === legCount && !mismatch) {
        profile = legs.slice(first).map((leg, i) => {
          const t = perLeg[i];
          return { t, gs: t > 0 && leg.legDistNm ? Math.round((leg.legDistNm / t) * 60) : null };
        });
        // Una GS fuera de rango delata que el emparejamiento es falso, no un dato real.
        if (profile.some((x) => x.gs === null || x.gs < 80 || x.gs > 600)) profile = null;
      }

      if (profile) {
        profile.forEach((x, i) => {
          legs[first + i].sourceTimeMin = x.t;
          legs[first + i].sourceGsKt = x.gs;
        });
        procedure.sourceTotalTimeMin = total;
      } else {
        procedure._timesNote =
          `La planilla trae ${perLeg.length} tiempos por tramo y el procedimiento tiene ${legCount}. ` +
          `No se pueden alinear sin suponer cual falta (o el emparejamiento daba velocidades imposibles). ` +
          `Quedan solo en _sourceTimesMin.`;
      }
    }
    if (mismatch) {
      procedure._review =
        `La planilla lista ${fixes.length} fixes pero solo ${values.length} distancias ` +
        `(${values.join(', ')}). Falta un valor y no se puede deducir a que fix corresponde cada uno. ` +
        `Corregir en el Excel y volver a ejecutar tools/build-db.js.`;
      procedure._sourceDistances = values;
    }
    procedures.push(procedure);
  }

  // Restricciones de altitud/velocidad desde la hoja 05_STAR del esquema maestro.
  //
  // Cada fila lleva un FIX en la columna D, y "Alt Min"/"Alt Max"/"Vel Max" son la ventana en
  // ESE fix, no en todo el procedimiento: UMKAL7C dice 24000/24000 sobre UMKAL, que es el nivel
  // al que se entra a la llegada. Por eso van al tramo y no al procedimiento; puestas arriba se
  // leerian como un piso de descenso y el perfil vertical saldria al reves.
  const starSheet = wbMaster['05_STAR'] || [];
  for (let i = 1; i < starSheet.length; i++) {
    const r = starSheet[i] || [];
    const ident = clean(r[0]);
    const procedure = procedures.find((x) => x.ident === ident);
    if (!procedure) continue;

    const sheetFix = clean(r[3]);
    const leg = sheetFix ? procedure.legs.find((l) => l.fix === sheetFix) : null;

    if (leg) {
      const minAltFt = num(r[4]);
      const maxAltFt = num(r[5]);
      const maxSpeedKt = num(r[6]);
      const atcRestriction = clean(r[7]) || null;
      const navaid = clean(r[8]) || null;
      if (minAltFt !== null) leg.minAltFt = minAltFt;
      if (maxAltFt !== null) leg.maxAltFt = maxAltFt;
      if (maxSpeedKt !== null) leg.maxSpeedKt = maxSpeedKt;
      if (atcRestriction) leg.atcRestriction = atcRestriction;
      if (navaid) leg.navaid = navaid;
      leg._source = '05_STAR: Alt Min / Alt Max / Vel Max';
    } else if (sheetFix) {
      procedure._reviewRestriction =
        `La hoja 05_STAR pone restricciones sobre el fix ${sheetFix}, que no esta en la ` +
        `secuencia de ${ident} segun STARs-SIDs-2. Las restricciones quedan sin aplicar.`;
    }

    const sheetDist = num(r[10]);
    if (sheetDist !== null) {
      procedure._dist05Star = { fix: sheetFix || null, distNm: sheetDist };
      if (leg && leg.distToEndNm !== null && leg.distToEndNm !== sheetDist) {
        procedure._reviewDist =
          `La hoja 05_STAR da ${sheetDist} NM desde ${sheetFix}, pero STARs-SIDs-2 da ` +
          `${leg.distToEndNm} NM de distancia restante en ese mismo fix. Aclarar cual rige.`;
      }
    }
  }

  return procedures.sort((a, b) =>
    a.type === b.type ? a.ident.localeCompare(b.ident) : a.type.localeCompare(b.type)
  );
}

// ---------------------------------------------------------------- 3. airways

// Cabeceras y unidades que comparten fila con los fixes y no son fixes.
const NOT_A_FIX = new Set(['NM', 'MIN', 'DIST', 'T', 'KT', 'FL', 'SEC', 'VELOC']);
const isFixIdent = (v) => /^[A-Z]{2,6}\d{0,3}$/.test(v) && !NOT_A_FIX.has(v);

function buildAirways(wbTables) {
  const grid = wbTables['AWYs'];
  const byIdent = new Map();

  for (const r of grid) {
    if (!r || !r.length) continue;
    const raw = (clean(r[0]) || clean(r[2])).replace(/\s/g, '');
    if (!/^U?\/?[A-Z]{1,2}\d{3}$/.test(raw)) continue;

    const fixes = [];
    for (let c = 3; c < r.length; c++) {
      const v = clean(r[c]);
      if (!v) continue;
      if (isNum(v)) break; // desde aqui empieza la tabla NM / T(Min), que no pertenece a la aerovia
      if (isFixIdent(v)) fixes.push(v);
    }
    if (!fixes.length) continue;

    const ident = raw.replace(/\//g, '');
    if (!byIdent.has(ident)) {
      byIdent.set(ident, {
        ident,
        sourceIdent: raw,
        levels: raw.includes('/') ? 'both' : raw.startsWith('U') ? 'upper' : 'lower',
        segments: [],
        _source: 'TABLAS...05 AGO 2026!AWYs',
        _review: 'La hoja no trae distancias por tramo: las columnas NM / T(Min) son una tabla de conversion aparte.',
      });
    }
    byIdent.get(ident).segments.push(fixes);
  }

  // Unir segmentos consecutivos cuando comparten extremo; si no, dejarlos separados.
  for (const airway of byIdent.values()) {
    if (airway.segments.length === 2) {
      const [a, b] = airway.segments;
      if (a[a.length - 1] === b[0]) airway.fixes = [...a, ...b.slice(1)];
      else if (b[b.length - 1] === a[0]) airway.fixes = [...b, ...a.slice(1)];
    }
    if (!airway.fixes) airway.fixes = airway.segments.length === 1 ? airway.segments[0] : null;
    if (airway.segments.length === 1) delete airway.segments;
  }

  return [...byIdent.values()].sort((x, y) => x.ident.localeCompare(y.ident));
}

/**
 * Registra como stub todo fix citado por un procedimiento o aerovia que no este en la base.
 * Sin esto la base pierde integridad referencial y el motor falla en tiempo de ejecucion.
 */
function addReferencedFixes(fixes, procedures, airways) {
  const known = new Map(fixes.map((f) => [f.ident, f]));
  const referenced = new Map();
  const cite = (ident, origin) => {
    if (!ident || known.has(ident)) return;
    if (!referenced.has(ident)) referenced.set(ident, new Set());
    referenced.get(ident).add(origin);
  };

  for (const p of procedures) for (const leg of p.legs) cite(leg.fix, `${p.type} ${p.ident}`);
  for (const a of airways) for (const f of a.fixes || a.segments?.flat() || []) cite(f, `AWY ${a.ident}`);

  for (const [ident, origins] of referenced) {
    const isDme = /^D\d{2}[A-Z]{2,3}$/.test(ident) || /^EL\d{3}$/.test(ident) || /\(D\d+\)/.test(ident);
    const isAltitudePoint = /^\d+FT$/.test(ident);
    fixes.push({
      id: null,
      ident,
      name: ident,
      type: isAltitudePoint ? 'ALTITUDE_POINT' : isDme ? 'DME_FIX' : 'WAYPOINT',
      lat: null,
      lon: null,
      latSource: null,
      lonSource: null,
      elevationFt: null,
      scope: isDme ? 'TMA' : 'ENR',
      roles: [],
      meaFt: null,
      mclFt: null,
      _inferred: true,
      _source: `citado por: ${[...origins].join(', ')}`,
      _review: isAltitudePoint
        ? 'Punto definido por altitud, no por posicion: el viraje ocurre al alcanzar esa altitud.'
        : isDme
          ? 'Punto DME: falta radial y distancia desde la radioayuda.'
          : 'Fix citado en procedimientos o aerovias pero ausente de la base de navegacion. Faltan coordenadas.',
    });
  }

  fixes.sort((a, b) => a.ident.localeCompare(b.ident));
  return referenced.size;
}

// ---------------------------------------------------------------- 4. runways

function buildRunways(wbMaster) {
  const grid = wbMaster['02_PISTAS'];
  const runways = [];
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i] || [];
    const ident = clean(r[0]);
    if (!ident) continue;
    runways.push({
      aerodrome: 'SCEL',
      ident,
      magCourse: num(r[1]),
      lengthM: num(r[2]),
      ils: clean(r[3]).toUpperCase() === 'SI',
      rnav: clean(r[4]).toUpperCase() === 'SI',
      inUse: clean(r[5]).toUpperCase() === 'SI',
      configuration: ident.startsWith('17') ? 'SUR' : 'NORTE',
      _source: 'APP_SCEL_Training_System_v1.0.xlsx!02_PISTAS',
    });
  }
  return runways;
}

// ---------------------------------------------------- 5. tipos de aeronave y flota

function buildFleet(wbTables) {
  const grid = wbTables['ACFT1 (2)'] || wbTables['ACFT1'];
  const types = new Map();
  const fleet = [];
  for (const r of grid) {
    if (!r || !r.length) continue;
    const registration = clean(r[1]);
    const icao = clean(r[2]);
    const name = clean(r[3]);
    const v1 = num(r[4]);
    const v2 = num(r[5]);
    if (!registration || !icao || v1 === null) continue;
    if (!types.has(icao)) {
      types.set(icao, {
        icao,
        name: name || icao,
        minSpeedKt: v1,
        maxSpeedKt: v2 ?? v1,
        wake: null,
        vappKt: null,
        _source: 'TABLAS...05 AGO 2026!ACFT1 (2)',
      });
    }
    fleet.push({ registration, icaoType: icao, isCallsign: !/^CC/.test(registration) });
  }
  return { types: [...types.values()], fleet };
}

// ------------------------------------------- 6. operadores y vuelos de ejemplo

function buildOperators(wbStrips) {
  const grid = wbStrips['ACFT'];
  const operators = new Map();
  const flights = [];
  for (const r of grid) {
    if (!r || !r.length) continue;
    for (const base of [1, 9, 10]) {
      const callsign = clean(r[base + 1]);
      const airline = clean(r[base + 2]);
      const type = clean(r[base + 3]);
      const speed = num(r[base + 4]);
      const dep = clean(r[base + 5]);
      const dest = clean(r[base + 6]);
      const ssr = clean(r[base + 7]);
      if (!/^[A-Z]{3}\d{1,4}$/.test(callsign) || !airline || !type) continue;
      const prefix = callsign.slice(0, 3);
      if (!operators.has(prefix)) operators.set(prefix, { icaoPrefix: prefix, name: airline, country: null });
      flights.push({ callsign, operator: prefix, icaoType: type, tasKt: speed, adep: dep, ades: dest, ssr: ssr || null });
    }
  }
  const seen = new Set();
  const unique = flights.filter((f) => (seen.has(f.callsign) ? false : seen.add(f.callsign)));
  return {
    operators: [...operators.values()].sort((a, b) => a.icaoPrefix.localeCompare(b.icaoPrefix)),
    flights: unique,
  };
}

// ---------------------------------------------------------------- 7. pool SSR

function buildSsrPool(wbStrips) {
  const grid = wbStrips['SSR'];
  const blocks = new Map();
  for (const r of grid) {
    if (!r) continue;
    for (const cell of r) {
      const v = clean(cell);
      if (!/^[0-7]{4}$/.test(v)) continue;
      const base = v.slice(0, 3) + '0';
      if (!blocks.has(base)) blocks.set(base, new Set());
      blocks.get(base).add(v);
    }
  }
  return [...blocks.entries()]
    .map(([base, set]) => ({ base, series: base[0] + 'xxx', codes: [...set].sort() }))
    .filter((b) => b.codes.length >= 4)
    .sort((a, b) => a.base.localeCompare(b.base));
}

// --------------------------------- 8. datos transcritos (layout muy combinado)

// OJO: el mismo archivo trae TRES tablas de performance que no coinciden entre si:
//   A) PERFORMANCES filas 3-6   (horizontal, un nivel por columna Q..AG)
//   B) PERFORMANCES filas 12-42 (vertical, un nivel por fila) <- la que se usa aqui
//   C) PERF2 filas 12-41        (vertical, en tres bloques)
// Donde discrepan se anota `_alternatives`. Hay que decidir cual rige antes de calcular nada.
const PERFORMANCE = [
  { level: 'FL240', altFt: 24000, iasKt: 300, gsKt: 360, nmPerMin: 6.0, ftPerMin: 2000, note: 'o superior', fixes: ['UMKAL', 'GUVOL'] },
  { level: 'FL230', altFt: 23000, iasKt: null, gsKt: null, nmPerMin: null, ftPerMin: null, note: null, fixes: ['NEBEG'] },
  { level: 'FL210', altFt: 21000, iasKt: null, gsKt: null, nmPerMin: null, ftPerMin: null, note: null, fixes: ['ALBAL', 'YESOS'] },
  { level: 'FL190', altFt: 19000, iasKt: 280, gsKt: 330, nmPerMin: 5.5, ftPerMin: 2000, note: 'aplica hasta FL180', fixes: [],
    _alternatives: { PERF2: { gsKt: 300, nmPerMin: 5, ftPerMin: 1800 } } },
  { level: 'FL170', altFt: 17000, iasKt: 260, gsKt: 300, nmPerMin: 5.0, ftPerMin: 1800, note: 'aplica hasta FL160', fixes: ['VULBI', 'DABIT'],
    _alternatives: { PERF2: { gsKt: 280, nmPerMin: 4.7, ftPerMin: 1600 } } },
  { level: 'FL150', altFt: 15000, iasKt: 290, gsKt: null, nmPerMin: 4.6, ftPerMin: 1500, note: 'aplica hasta FL140', fixes: ['MOLPU'],
    _review: 'PERFORMANCES!D25:J26 no trae GS ni Nm/Min para FL150-FL140; el 4.6 viene de la tabla horizontal (PERFORMANCES!X5).' },
  { level: 'FL130', altFt: 13000, iasKt: 250, gsKt: 270, nmPerMin: 4.5, ftPerMin: 1500, note: null, fixes: [],
    _alternatives: { PERFORMANCES_horizontal: { gsKt: 250, nmPerMin: 4.167 } },
    _review: 'Contradiccion: PERFORMANCES!Y4-Y5 dice 250 kt / 4.167; PERFORMANCES!F28-I28 y PERF2!R28-S28 dicen 270 kt / 4.5.' },
  { level: 'FL120', altFt: 12000, iasKt: 250, gsKt: 240, nmPerMin: 4.0, ftPerMin: 1300, note: 'aplica hasta FL110', fixes: ['MORPA', 'SAFEL', 'LINER', 'ANGOD', 'GELUS'] },
  { level: '10000', altFt: 10000, iasKt: 230, gsKt: 230, nmPerMin: 3.8, ftPerMin: 1000, note: 'altitud de transicion', fixes: ['UGANO', 'VUDOG', 'MAPOC', 'AMB', 'ETEMI', 'OLMUE'],
    _alternatives: { PERFORMANCES_horizontal: { nmPerMin: 3.833 } },
    _review: '230 kt son 3.833 NM/min. PERFORMANCES!I33 y PERF2!S33 dicen 3.8; PERFORMANCES!AB5 dice 3.833.' },
  { level: '9000', altFt: 9000, iasKt: 220, gsKt: 220, nmPerMin: 3.6, ftPerMin: 1000, note: null, fixes: ['SEKSU', 'KIDUG', 'DONTI'],
    _alternatives: { PERFORMANCES_horizontal: { nmPerMin: 3.667 } },
    _review: '220 kt son 3.667 NM/min. PERFORMANCES!I35 y PERF2!S35 dicen 3.6; PERFORMANCES!AC5 dice 3.667.' },
  { level: '8000', altFt: 8000, iasKt: 210, gsKt: 210, nmPerMin: 3.5, ftPerMin: 800, note: null, fixes: ['TABON', 'UGOLA', 'PULKI'] },
  { level: '7000', altFt: 7000, iasKt: 180, gsKt: 180, nmPerMin: 3.0, ftPerMin: 700, note: null, fixes: ['PUMAR'] },
  { level: '6000', altFt: 6000, iasKt: 150, gsKt: 150, nmPerMin: 2.5, ftPerMin: 500, note: 'aplica hasta 5000', fixes: [] },
];

const HOLDINGS = [
  { fix: 'DABIT', lowerLevelFt: 17000, upperLevelFt: 24000, mclFt: 16000, note: 'en STAR' },
  { fix: 'KADAK', lowerLevelFt: 14000, upperLevelFt: 16000, mclFt: null, note: null },
  { fix: 'TBN', lowerLevelFt: 9000, upperLevelFt: 12000, mclFt: 8000, note: null },
  { fix: 'UGOLA', lowerLevelFt: 9000, upperLevelFt: 12000, mclFt: 8000, note: 'comparte con TBN' },
  { fix: 'TEGEB', lowerLevelFt: 5000, upperLevelFt: 8000, mclFt: 5000, note: null },
  { fix: 'PADOP', lowerLevelFt: 5000, upperLevelFt: 8000, mclFt: null, note: 'comparte con TEGEB' },
  { fix: 'PEFOR', lowerLevelFt: 5000, upperLevelFt: 8000, mclFt: null, note: null },
  { fix: 'AMB', lowerLevelFt: null, upperLevelFt: null, mclFt: 10000, note: 'en STAR, solo MCL' },
  { fix: 'LINER', lowerLevelFt: null, upperLevelFt: null, mclFt: 11000, note: 'solo MCL' },
];

const SEPARATION = [
  { runway: '17L', sivigats: false, withDepartures: true, lvp: false, value: 5, unit: 'MIN' },
  { runway: '17L', sivigats: false, withDepartures: false, lvp: false, value: 5, unit: 'MIN' },
  { runway: '35R', sivigats: false, withDepartures: true, lvp: false, value: 5, unit: 'MIN' },
  { runway: '35R', sivigats: false, withDepartures: false, lvp: false, value: 5, unit: 'MIN' },
  { runway: '17L', sivigats: true, withDepartures: true, lvp: false, value: 9, unit: 'NM' },
  { runway: '17L', sivigats: true, withDepartures: false, lvp: false, value: 5, unit: 'NM' },
  { runway: '35R', sivigats: true, withDepartures: true, lvp: false, value: 9, unit: 'NM' },
  { runway: '35R', sivigats: true, withDepartures: false, lvp: false, value: 5, unit: 'NM' },
  { runway: '17L', sivigats: true, withDepartures: true, lvp: true, value: 20, unit: 'NM' },
  { runway: '17L', sivigats: true, withDepartures: false, lvp: true, value: 15, unit: 'NM' },
  { runway: '17L', sivigats: false, withDepartures: null, lvp: true, value: 8, unit: 'MIN' },
];

const RADARS = [
  { equipment: 'PSR Santiago - Cerro Colorado', type: 'PSR', rangeNm: 80, rpn: 15, unit: 'Santiago APP/ACC' },
  { equipment: 'MSSR Santiago - Cerro Colorado', type: 'MSSR', rangeNm: 250, rpn: 15, unit: 'Santiago APP/ACC' },
  { equipment: 'MSSR Santiago - Yerbas Buenas', type: 'MSSR', rangeNm: 250, rpn: 12, unit: 'Santiago APP/ACC' },
];

const UNITS = [
  { id: 'SCEL_TWR', name: 'Santiago Torre', frequencies: [118.1] },
  { id: 'SCEL_APP', name: 'Santiago Aproximacion', frequencies: [129.7] },
  { id: 'SCEL_ACC_N', name: 'Santiago ACC Norte', frequencies: [129.1, 126.3], _review: 'dos frecuencias distintas segun la hoja' },
  { id: 'SCEL_ACC_S', name: 'Santiago ACC Sur', frequencies: [126.3, 128.1], _review: 'dos frecuencias distintas segun la hoja' },
  { id: 'SCDA_ACC', name: 'Antofagasta ACC', frequencies: [128.3] },
  { id: 'SCSE_APP', name: 'La Serena Aproximacion', frequencies: [135.35] },
  { id: 'SCIE_APP', name: 'Concepcion Aproximacion', frequencies: [125.8] },
  { id: 'SCTE_ACC', name: 'Puerto Montt ACC', frequencies: [128.5] },
  { id: 'ACCO', name: 'ACC Oceanico', frequencies: [124.9] },
  { id: 'SAME_ACC', name: 'Mendoza ACC', frequencies: [126.6] },
];

const APPROACHES = [
  { code: 'IAC 01', type: 'ILS-Z', runway: '17L', requiresSivigats: false, iaf: 'TEGEB', daMdaFt: 2000, note: 'Operaciones ILS CAT II/III' },
  { code: 'IAC 03', type: 'ILS-Y', runway: '17L', requiresSivigats: false, iaf: 'TEGEB', daMdaFt: 2000, note: null },
  { code: 'IAC 04', type: 'ILS-T', runway: '17L', requiresSivigats: true, iaf: 'TEGEB', daMdaFt: 2000, note: null },
  { code: 'IAC 06', type: 'ILS-X', runway: '17L', requiresSivigats: true, iaf: 'TEGEB', daMdaFt: 2000, note: null },
  { code: 'IAC 07', type: 'VOR', runway: '17L', requiresSivigats: true, iaf: 'PADOP', daMdaFt: 2000, note: null },
  { code: 'IAC 09', type: 'VOR', runway: '35R', requiresSivigats: false, iaf: null, daMdaFt: null, note: null },
  { code: 'IAC 11', type: 'RNP-Y', runway: '17L', requiresSivigats: true, iaf: 'TEGEB', daMdaFt: 2000, note: null },
  { code: 'IAC 14', type: 'RNP', runway: '35R', requiresSivigats: false, iaf: null, daMdaFt: null, note: null },
  { code: 'IAC 16', type: 'RNP-X', runway: '17L', requiresSivigats: true, iaf: 'TEGEB', daMdaFt: 2000, note: null },
];

const TMA = {
  aerodrome: 'SCEL',
  name: 'TMA Santiago',
  transitionAltitudeFt: 10000,
  transitionLevel: 'FL120',
  configurations: ['NORTE', 'SUR'],
  runwaysByConfiguration: { NORTE: ['35L', '35R'], SUR: ['17L', '17R'] },
  _review:
    'Las fuentes usan NORTE/SUR con dos sentidos distintos: configuracion de pista (02_PISTAS, ' +
    'IACs, ESPACIAM) y sector de espacio aereo (ARR-SID N-S, postacion, ACC NORTE / ACC SUR). ' +
    'El mapeo runway<->configuration de arriba vale para el primer sentido. En 11_ESCENARIOS ' +
    'columna C no se puede determinar cual de los dos se usa. Pendiente de confirmar con ATC.',
};

// ---------------------------------------------------------------- main

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log('Leyendo planillas...');
  const wbMaster = readWorkbook(SOURCES.master);
  const wbTables = readWorkbook(SOURCES.tables);
  const wbStrips = readWorkbook(SOURCES.strips);

  console.log('Escribiendo data/:');

  const fixes = buildFixes(wbMaster, wbTables);
  const procedures = buildProcedures(wbTables, wbMaster);
  const airways = buildAirways(wbTables);
  const stubCount = addReferencedFixes(fixes, procedures, airways);

  write('fixes.json', {
    source: ['APP_SCEL_Training_System_v1.0.xlsx!03_BASE_NAVEGACION_SCEL', 'TABLAS...05 AGO 2026 EVAL.xlsx!Way Points'],
    method: 'extracted',
    note: 'Coordenadas normalizadas de grados/minutos/segundos a decimales (negativo S/W). lat/lon null = la fuente no traia coordenada o el formato no se reconocio.',
    inferred: `${stubCount} fixes citados por procedimientos o aerovias se agregaron como stub (_inferred: true) para no romper la integridad referencial.`,
  }, { fixes });

  write('procedures.json', {
    source: ['TABLAS...05 AGO 2026 EVAL.xlsx!STARs-SIDs-2', 'APP_SCEL_Training_System_v1.0.xlsx!05_STAR'],
    method: 'extracted',
    note: 'STAR: distToEndNm es el dato de la planilla; legDistNm se deriva. SID: legDistNm es el dato; el primer tramo va del aerodromo al primer fix.',
    limitation: 'Solo configuracion SUR / RWY 17L. No hay procedimientos detallados para NORTE en las fuentes.',
  }, { procedures });

  write('airways.json', {
    source: 'TABLAS...05 AGO 2026 EVAL.xlsx!AWYs',
    method: 'extracted',
    note: 'Solo secuencia de fixes. La hoja no trae distancias por tramo. Cuando la planilla parte una aerovia en dos filas y los extremos no coinciden, se emite `segments` en vez de `fixes`.',
  }, { airways });

  write('runways.json', {
    source: 'APP_SCEL_Training_System_v1.0.xlsx!02_PISTAS',
    method: 'extracted',
  }, { runways: buildRunways(wbMaster) });

  const { types, fleet } = buildFleet(wbTables);
  write('aircraft-types.json', {
    source: 'TABLAS...05 AGO 2026 EVAL.xlsx!ACFT1 (2)',
    method: 'extracted',
    note: 'minSpeedKt/maxSpeedKt son las dos velocidades tipicas de uso de la planilla, no envolvente de performance. wake y vapp no estan en las fuentes.',
  }, { aircraftTypes: types });

  write('fleet.json', {
    source: 'TABLAS...05 AGO 2026 EVAL.xlsx!ACFT1 (2)',
    method: 'extracted',
    note: 'Matriculas CC-XXX e indicativos especiales (militares y de ejercicio).',
  }, { fleet });

  const { operators, flights } = buildOperators(wbStrips);
  write('operators.json', { source: '01modelo FPV.xlsx!ACFT', method: 'extracted', note: 'country no esta en las fuentes' }, { operators });
  write('sample-flights.json', {
    source: '01modelo FPV.xlsx!ACFT',
    method: 'extracted',
    note: 'Catalogo de vuelos comerciales usado para armar ejercicios. tasKt es el N0xxx del campo 15 del plan de vuelo.',
  }, { sampleFlights: flights });

  write('ssr.json', {
    source: '01modelo FPV.xlsx!SSR',
    method: 'extracted',
    note: 'Pool de codigos transpondedor en bloques de 8 consecutivos, que es como se asignan.',
  }, { blocks: buildSsrPool(wbStrips) });

  write('performance.json', {
    source: 'TABLAS...05 AGO 2026 EVAL.xlsx!PERFORMANCES (bloque vertical, filas 12-42)',
    method: 'transcribed',
    note: 'Modelo de vuelo del sistema: velocidad por NIVEL, no por tipo de aeronave. fixes = punto donde ese nivel debe estar alcanzado.',
    limitation: 'El archivo trae tres tablas de performance que no coinciden (ver _review por nivel). Pendiente P-01 con ATC.',
  }, { performance: PERFORMANCE });

  write('holdings.json', { source: 'TABLAS...05 AGO 2026 EVAL.xlsx!HLDNG', method: 'transcribed' }, { holdings: HOLDINGS });

  write('separation.json', {
    source: 'TABLAS...05 AGO 2026 EVAL.xlsx!ESPACIAM',
    method: 'transcribed',
    limitation: 'Son minimas de ESPACIAMIENTO EN APROXIMACION. Las minimas de separacion en ruta (vertical, longitudinal, radar) NO estan en las fuentes.',
  }, { separation: SEPARATION });

  write('radars.json', { source: 'TABLAS...05 AGO 2026 EVAL.xlsx!RDRs (cita AIP Chile ENR 1.6-7)', method: 'transcribed' }, { radars: RADARS });
  write('units.json', { source: 'varias hojas de postacion y cabeceras de ejercicios', method: 'transcribed' }, { units: UNITS });
  write('approaches.json', { source: 'TABLAS...05 AGO 2026 EVAL.xlsx!IACs-1, IACs-2 + 06_IAC', method: 'transcribed' }, { approaches: APPROACHES });
  write('tma.json', { source: 'HLDNG, 01_CONFIG, 02_PISTAS', method: 'transcribed' }, { tma: TMA });

  // Manifiesto
  const files = fs.readdirSync(OUT).filter((f) => f.endsWith('.json') && f !== 'index.json').sort();
  fs.writeFileSync(
    path.join(OUT, 'index.json'),
    JSON.stringify({
      project: 'ATCsimS',
      description: 'Base de datos de navegacion del TMA Santiago (SCEL) para simulacion ATC',
      generated: new Date().toISOString().slice(0, 10),
      generator: 'tools/build-db.js',
      scope: 'TMA Santiago - APP y ACC - configuracion SUR (RWY 17L) unicamente',
      files,
    }, null, 2) + '\n',
    'utf8'
  );
  console.log('  data/index.json');
  console.log('\nListo.');
}

main();
