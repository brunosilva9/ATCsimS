/**
 * Motor de horas de paso (ETO) y perfil vertical.
 *
 * Implementa RN-4.1 y RN-4.2 de docs/REQUISITOS.md, que es el metodo con el que el instructor
 * ya calcula a mano:
 *
 *     horaDePaso(fix) = horaInicio + (distanciaTotal - distanciaRestante) / velocidad
 *
 * La velocidad no es constante: se toma tramo a tramo segun el nivel al que se vuela ese
 * tramo. Dos niveles de precision, en este orden:
 *
 *   1. Si el tramo trae `sourceGsKt` (7 de 21 procedimientos lo traen), se usa ese valor.
 *      Reproduce la planilla exactamente, que es el criterio de aceptacion del proyecto.
 *   2. Si no, se lee la GS del nivel al que empieza el tramo.
 *
 * -------------------------------------------------------------------------------------------
 * El perfil vertical
 *
 * Una llegada y una salida no se calculan igual, y da igual cuanto se parezcan en el papel:
 *
 *   - La SALIDA sube al maximo que da el avion. Se integra `ftPerMin` hacia adelante hasta
 *     llegar al nivel de crucero. Es un problema de rendimiento.
 *
 *   - La LLEGADA baja lo justo para cumplir la siguiente restriccion publicada. No se integra
 *     nada: se fijan los niveles en los puntos donde la base dice cual es, y entre esos puntos
 *     se reparte el descenso por distancia. Es un problema de planificacion.
 *
 * Integrar el descenso hacia adelante, que es lo primero que uno escribe, produce perfiles que
 * bajan de mas en el tramo largo y luego tienen que volver a subir para cumplir un MCL. Una
 * llegada que sube a mitad de camino es una llegada mal calculada.
 *
 * Los niveles de una llegada salen de tres restricciones, todas dato de la base:
 *
 *   - la ventana del fix en la hoja 05_STAR (`minAltFt` / `maxAltFt` del tramo);
 *   - la columna FIX/MCL de la tabla de performance: el nivel al que hay que HABER BAJADO al
 *     pasar por ese punto, o sea un techo;
 *   - el MCL de la tabla de esperas: por debajo de eso no se puede estar ahi, o sea un piso.
 *     En TEGEB vale 5000 ft, y por eso una STAR termina en 5000.
 *
 * Las dos ultimas coinciden donde ambas existen (UGOLA 8000, PUMAR 7000), que es lo que se
 * espera de un perfil bien publicado: el techo de descenso y el piso se tocan.
 *
 * Las horas se acumulan sin redondear y solo se redondean al minuto al escribirlas en la
 * strip (RF-4.6), para que no se arrastre error tramo a tramo.
 */

import type {
  FlightLeg,
  HoldingPattern,
  PerformanceTable,
  Procedure,
  ProcedureLeg,
  UtcMinutes,
} from './types.js';
import { groundSpeedAt, verticalRateAt } from './performance.js';
import { minutesFor, normalize } from './time.js';

export interface ComputeOptions {
  readonly procedure: Procedure;
  readonly entryTime: UtcMinutes;
  readonly cruiseLevelFt: number;
  readonly performance: PerformanceTable;
  /**
   * Tabla de esperas. De aqui sale el MCL de cada fix, que es el piso del descenso.
   * Si no se pasa, una STAR sin `finalLevelFt` no sabe a que nivel termina y lo declara.
   */
  readonly holdings?: readonly HoldingPattern[];
  /** Nivel sobre el fix final. Si no se indica, se usa el MCL de ese fix. */
  readonly finalLevelFt?: number;
}

export interface FlightPlan {
  readonly legs: readonly FlightLeg[];
  readonly totalTimeMin: number;
  /**
   * Supuestos que hubo que hacer porque la base no trae el dato, y contradicciones que se
   * encontraron al aplicarla. Vacio = todo salio de las planillas. La interfaz los muestra en
   * vez de callarlos.
   */
  readonly assumptions: readonly string[];
}

export type ComputeResult =
  | ({ readonly ok: true } & FlightPlan)
  | { readonly ok: false; readonly reason: 'INCOMPLETE_DATA'; readonly message: string };

/** Techo por fix (columna FIX/MCL de performance): el nivel al que hay que haber bajado ahi. */
function descentGates(performance: PerformanceTable): Map<string, number> {
  const gates = new Map<string, number>();
  for (const level of performance) {
    for (const fix of level.fixes) {
      const current = gates.get(fix);
      // Si un fix aparece en dos niveles manda el mas bajo: es el que restringe.
      if (current === undefined || level.altFt < current) gates.set(fix, level.altFt);
    }
  }
  return gates;
}

/** Piso por fix (tabla de esperas): por debajo de eso no se puede estar en ese punto. */
function minimumLevels(holdings: readonly HoldingPattern[]): Map<string, number> {
  const floors = new Map<string, number>();
  for (const h of holdings) {
    const value = h.mclFt ?? h.lowerLevelFt;
    if (value !== null) floors.set(h.fix, value);
  }
  return floors;
}

/**
 * De donde arranca una salida. La elevacion de SCEL no esta en las planillas, asi que se usa
 * el nivel mas bajo que modela la tabla de performance. Es un supuesto y se declara como tal.
 */
function departureStart(performance: PerformanceTable): number {
  const alts = performance.map((l) => l.altFt);
  return alts.length > 0 ? Math.min(...alts) : 0;
}

interface Bounds {
  readonly ceilingFt: number | null;
  readonly floorFt: number | null;
}

/** Todas las restricciones publicadas de un fix, reducidas a un techo y un piso. */
function boundsAt(
  leg: ProcedureLeg,
  gates: Map<string, number>,
  floors: Map<string, number>
): Bounds {
  const ceilings: number[] = [];
  const mins: number[] = [];

  if (leg.maxAltFt !== undefined) ceilings.push(leg.maxAltFt);
  const gate = gates.get(leg.fix);
  if (gate !== undefined) ceilings.push(gate);

  if (leg.minAltFt !== undefined) mins.push(leg.minAltFt);
  const floor = floors.get(leg.fix);
  if (floor !== undefined) mins.push(floor);

  return {
    ceilingFt: ceilings.length > 0 ? Math.min(...ceilings) : null,
    floorFt: mins.length > 0 ? Math.max(...mins) : null,
  };
}

function clamp(valueFt: number, bounds: Bounds): number {
  let out = valueFt;
  if (bounds.ceilingFt !== null && out > bounds.ceilingFt) out = bounds.ceilingFt;
  if (bounds.floorFt !== null && out < bounds.floorFt) out = bounds.floorFt;
  return out;
}

/** Como se rotula la restriccion en la strip. null si el fix no tiene ninguna publicada. */
function restrictionLabel(bounds: Bounds): string | null {
  if (bounds.ceilingFt !== null && bounds.floorFt !== null) {
    return bounds.ceilingFt === bounds.floorFt
      ? `${bounds.ceilingFt} ft`
      : `${bounds.floorFt}–${bounds.ceilingFt} ft`;
  }
  if (bounds.ceilingFt !== null) return `≤ ${bounds.ceilingFt} ft`;
  if (bounds.floorFt !== null) return `≥ ${bounds.floorFt} ft`;
  return null;
}

/**
 * Perfil de una llegada: niveles fijos donde la base los publica, y entre medio el descenso
 * repartido por distancia. Nunca sube.
 */
function arrivalProfile(
  legs: readonly ProcedureLeg[],
  entryLevelFt: number,
  endLevelFt: number | null,
  bounds: readonly Bounds[],
  assumptions: string[]
): number[] {
  const last = legs.length - 1;
  const anchors: (number | null)[] = legs.map((_, i) => {
    const b = bounds[i]!;
    if (i === 0) return clamp(entryLevelFt, b);
    if (i === last && endLevelFt !== null) return clamp(endLevelFt, b);
    // Un fix con restriccion publicada fija el nivel; uno sin ella se interpola.
    if (b.ceilingFt !== null) return clamp(b.ceilingFt, b);
    if (b.floorFt !== null) return b.floorFt;
    return null;
  });

  // Posicion de cada fix sobre el procedimiento. distToEndNm decrece hasta 0 en el final.
  const remaining = legs.map((l) => l.distToEndNm ?? 0);

  const levels: number[] = anchors.map((a) => a ?? Number.NaN);
  for (let i = 0; i < levels.length; i++) {
    if (!Number.isNaN(levels[i]!)) continue;

    let before = i - 1;
    while (before >= 0 && Number.isNaN(levels[before]!)) before--;
    let after = i + 1;
    while (after < levels.length && anchors[after] === null) after++;

    const from = before >= 0 ? levels[before]! : entryLevelFt;
    if (after >= levels.length || anchors[after] === null) {
      // No hay restriccion mas adelante: se mantiene el ultimo nivel conocido.
      levels[i] = from;
      continue;
    }

    const to = anchors[after]!;
    const dFrom = before >= 0 ? remaining[before]! : remaining[0]!;
    const dTo = remaining[after]!;
    const span = dFrom - dTo;
    levels[i] =
      span <= 0 ? to : to + ((from - to) * (remaining[i]! - dTo)) / span;
  }

  // Una llegada no sube. Si una restriccion publicada obliga a subir es que dos tablas de la
  // base se contradicen, y eso se dice en vez de dibujar un perfil imposible.
  for (let i = 1; i < levels.length; i++) {
    if (levels[i]! > levels[i - 1]! + 1) {
      assumptions.push(
        `${legs[i]!.fix} exige ${Math.round(levels[i]!)} ft pero el fix anterior ` +
          `(${legs[i - 1]!.fix}) queda en ${Math.round(levels[i - 1]!)} ft: la llegada tendria ` +
          `que subir. Se mantiene el nivel anterior; hay que revisar las restricciones.`
      );
      levels[i] = levels[i - 1]!;
    }
  }

  return levels;
}

export function computeFlightPlan(options: ComputeOptions): ComputeResult {
  const { procedure, entryTime, cruiseLevelFt, performance } = options;
  const legs = procedure.legs;

  if (legs.length === 0) {
    return { ok: false, reason: 'INCOMPLETE_DATA', message: `${procedure.ident} no tiene tramos.` };
  }

  // Si la planilla dejo huecos (caso ASIMO7D, P-02 del informe a ATC) no se calcula nada.
  // Es preferible a rellenar el hueco por deduccion y producir horas que parecen validas.
  const missing = legs.find((leg) => leg.distToEndNm === null);
  if (missing) {
    return {
      ok: false,
      reason: 'INCOMPLETE_DATA',
      message:
        `${procedure.ident}: falta la distancia del fix ${missing.fix} en la planilla. ` +
        `Corregir el Excel y volver a importar con tools/build-db.js.`,
    };
  }

  const isStar = procedure.type === 'STAR';
  const gates = isStar ? descentGates(performance) : new Map<string, number>();
  const floors = isStar ? minimumLevels(options.holdings ?? []) : new Map<string, number>();
  const assumptions: string[] = [];

  // Las dos restricciones de descenso describen una llegada. Aplicadas a una salida obligarian
  // a despegar ya a 10000 ft sobre AMB, que es el MCL de AMB para el trafico que llega.
  const bounds = legs.map((leg) => boundsAt(leg, gates, floors));

  let levels: number[];

  if (isStar) {
    const lastFix = legs[legs.length - 1]!.fix;
    const endLevelFt = options.finalLevelFt ?? floors.get(lastFix) ?? null;
    if (endLevelFt === null) {
      assumptions.push(
        `No hay nivel publicado para ${lastFix}: el descenso se reparte hasta la ultima ` +
          `restriccion conocida y despues se mantiene. Falta el MCL de ese fix en la base.`
      );
    }
    levels = arrivalProfile(legs, cruiseLevelFt, endLevelFt, bounds, assumptions);
  } else {
    const startFt = departureStart(performance);
    assumptions.push(
      `La elevacion del aerodromo no esta en las planillas: la salida arranca a ${startFt} ft, ` +
        `el nivel mas bajo de la tabla de performance.`
    );
    // La salida si se integra hacia adelante: sube al maximo que da la tabla hasta el crucero.
    levels = [];
    let levelFt = clamp(startFt, bounds[0]!);
    for (let i = 0; i < legs.length; i++) {
      if (i > 0) {
        const gsKt = legs[i]!.sourceGsKt ?? groundSpeedAt(performance, levelFt);
        const minutes = minutesFor(legs[i]!.legDistNm ?? 0, gsKt);
        levelFt = Math.min(cruiseLevelFt, levelFt + verticalRateAt(performance, levelFt) * minutes);
      }
      levelFt = clamp(levelFt, bounds[i]!);
      levels.push(levelFt);
    }
  }

  const out: FlightLeg[] = [];
  let time = entryTime;

  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i]!;

    // El primer punto de una STAR es la entrada al sector: se cruza a la hora de inicio, sin
    // tramo previo que recorrer. En una SID el primer tramo sale del aerodromo.
    const legDistNm = isStar && i === 0 ? 0 : leg.legDistNm ?? 0;

    // La GS de un tramo es la del nivel al que se empieza a volarlo, no la del nivel al que
    // se termina: es lo que hace la planilla y lo que reproducen los tests.
    const levelAtStartFt = i === 0 ? levels[0]! : levels[i - 1]!;
    const gsKt = leg.sourceGsKt ?? groundSpeedAt(performance, levelAtStartFt);
    const legMinutes = legDistNm > 0 ? minutesFor(legDistNm, gsKt) : 0;
    time += legMinutes;

    out.push({
      seq: leg.seq,
      fix: leg.fix,
      levelFt: Math.round(levels[i]! / 100) * 100,
      eto: normalize(time),
      revisedEto: null,
      ato: null,
      gsKt,
      sourceGsKt: leg.sourceGsKt ?? null,
      legDistNm,
      legTimeMin: Math.round(legMinutes * 1000) / 1000,
      delayMin: 0,
      assignedSpeedKt: null,
      restriction: restrictionLabel(bounds[i]!),
    });
  }

  return {
    ok: true,
    legs: out,
    totalTimeMin: Math.round((time - entryTime) * 1000) / 1000,
    assumptions,
  };
}
