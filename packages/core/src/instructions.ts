/**
 * Instrucciones del controlador y recalculo de estimadas (RF-4.7).
 *
 * La regla que gobierna todo este archivo: **la estimada original no se toca nunca**. Una
 * instruccion escribe `revisedEto` y deja `eto` como estaba, igual que en la hoja de papel,
 * donde la hora vieja se tacha pero se sigue leyendo. Esa pareja de horas es el ejercicio: lo
 * que el alumno calculo al principio y lo que provoco con lo que hizo.
 *
 * Una instruccion solo afecta hacia adelante. Se localiza el fix desde el que aplica y se
 * recalculan los tramos posteriores; lo ya recorrido queda fijo.
 *
 * Si una instruccion no se puede calcular con lo que hay en la base —el caso tipico es un
 * directo a un fix sin coordenada— **no se aplica y se dice por que**. No se estima la
 * distancia que falta.
 */

import type {
  Flight,
  FlightLeg,
  Instruction,
  PerformanceTable,
  Scenario,
  UtcMinutes,
} from './types.js';
import type { Coordinates } from './geo.js';
import { distanceNm } from './geo.js';
import { groundSpeedAt } from './performance.js';
import { minutesFor, normalize } from './time.js';

export interface ApplyContext {
  readonly performance: PerformanceTable;
  /** Coordenadas por fix. Solo hace falta para el directo. */
  readonly coordinates?: ReadonlyMap<string, Coordinates>;
}

export type ApplyResult =
  | { readonly ok: true; readonly scenario: Scenario }
  | {
      readonly ok: false;
      readonly reason: 'UNKNOWN_FLIGHT' | 'UNKNOWN_FIX' | 'INCOMPLETE_DATA' | 'NOT_APPLICABLE';
      readonly message: string;
    };

/** Hora vigente de un tramo: la revisada si existe, la original si no. */
const currentEto = (leg: FlightLeg): UtcMinutes => leg.revisedEto ?? leg.eto;

/**
 * Desde que tramo aplica la instruccion.
 * `fromFix: null` significa "desde el proximo punto que el vuelo no haya cruzado", que es como
 * se da una instruccion de verdad: por la radio, sin nombrar el fix de referencia.
 */
function anchorIndex(flight: Flight, instruction: Instruction): number {
  if (instruction.fromFix !== null) {
    return flight.legs.findIndex((l) => l.fix === instruction.fromFix);
  }
  const next = flight.legs.findIndex((l) => currentEto(l) >= instruction.time);
  return next === -1 ? flight.legs.length - 1 : next;
}

/**
 * Recalcula las horas desde `fromIndex` hasta el final y escribe `revisedEto` solo ahi: los
 * tramos anteriores ya se volaron y no se tocan.
 *
 * El reloj se acumula SIEMPRE desde la hora de entrada, tramo a tramo, aunque los primeros no
 * se vayan a reescribir. Arrancar desde la hora del fix anterior seria mas corto, pero esa hora
 * esta redondeada al minuto y cada instruccion encadenada meteria hasta un minuto de error.
 */
function recomputeFrom(
  flight: Flight,
  legs: readonly FlightLeg[],
  fromIndex: number,
  performance: PerformanceTable
): FlightLeg[] {
  const out = legs.slice();
  let time: number = flight.entryTime;

  for (let i = 0; i < out.length; i++) {
    const leg = out[i]!;

    // La GS de un tramo es la del nivel al que se EMPIEZA a volarlo, igual que en eto.ts.
    // Tomarla del nivel de llegada hace que un directo a un punto bajo salga mas lento que la
    // ruta larga, que es justo al reves de lo que pasa en el aire.
    const levelAtStartFt = (i === 0 ? leg.levelFt : out[i - 1]!.levelFt) ?? 0;
    // Mismo orden de precedencia que eto.ts: lo que mando el controlador, luego el perfil de
    // la planilla, y solo si no hay ninguno de los dos, la tabla de performance.
    const gsKt =
      leg.assignedSpeedKt ?? leg.sourceGsKt ?? groundSpeedAt(performance, levelAtStartFt);
    const legTimeMin =
      i < fromIndex ? leg.legTimeMin : leg.legDistNm > 0 ? minutesFor(leg.legDistNm, gsKt) : 0;

    time += legTimeMin + leg.delayMin;
    if (i < fromIndex) continue;

    out[i] = {
      ...leg,
      gsKt,
      legTimeMin: Math.round(legTimeMin * 1000) / 1000,
      revisedEto: normalize(time),
    };
  }

  return out;
}

/** Sustituye un vuelo dentro del escenario sin tocar los demas. */
function replaceFlight(scenario: Scenario, flight: Flight): Scenario {
  return {
    ...scenario,
    flights: scenario.flights.map((f) => (f.id === flight.id ? flight : f)),
  };
}

export function applyInstruction(
  scenario: Scenario,
  instruction: Instruction,
  context: ApplyContext
): ApplyResult {
  const flight = scenario.flights.find((f) => f.id === instruction.flightId);
  if (!flight) {
    return {
      ok: false,
      reason: 'UNKNOWN_FLIGHT',
      message: `El escenario no tiene ningun vuelo con id ${instruction.flightId}.`,
    };
  }

  const at = anchorIndex(flight, instruction);
  if (at === -1) {
    return {
      ok: false,
      reason: 'UNKNOWN_FIX',
      message: `${flight.callsign} no pasa por ${instruction.fromFix}.`,
    };
  }

  const legs = flight.legs;
  const { performance } = context;

  switch (instruction.kind) {
    case 'LEVEL_CHANGE': {
      if (instruction.levelFt === undefined) {
        return { ok: false, reason: 'NOT_APPLICABLE', message: 'Falta el nivel autorizado.' };
      }
      // El nivel asignado rige desde el fix de la instruccion hasta el final del plan.
      // Se anula el perfil de la planilla desde aqui: describe el descenso publicado, y el
      // avion acaba de salir de el.
      const assigned = legs.map((leg, i) =>
        i >= at ? { ...leg, levelFt: instruction.levelFt!, sourceGsKt: null } : leg
      );
      // El tramo que llega al fix ya se vola a la velocidad vieja; cambia lo que viene despues.
      return { ok: true, scenario: replaceFlight(scenario, {
        ...flight,
        legs: recomputeFrom(flight, assigned, at + 1, performance),
      }) };
    }

    case 'SPEED_RESTRICTION': {
      if (instruction.speedKt === undefined) {
        return { ok: false, reason: 'NOT_APPLICABLE', message: 'Falta la velocidad asignada.' };
      }
      const assigned = legs.map((leg, i) =>
        i >= at ? { ...leg, assignedSpeedKt: instruction.speedKt! } : leg
      );
      return { ok: true, scenario: replaceFlight(scenario, {
        ...flight,
        legs: recomputeFrom(flight, assigned, at + 1, performance),
      }) };
    }

    case 'HOLD': {
      const minutes = instruction.holdMinutes;
      if (minutes === undefined || minutes <= 0) {
        return {
          ok: false,
          reason: 'NOT_APPLICABLE',
          message: 'Falta cuantos minutos se mantiene en espera.',
        };
      }
      // La espera ocurre SOBRE el fix: se anota como retencion de ese punto y el recalculo
      // arranca ahi mismo, para que la hora del propio fix ya la incluya.
      const held = legs.slice();
      held[at] = { ...held[at]!, delayMin: held[at]!.delayMin + minutes };
      return { ok: true, scenario: replaceFlight(scenario, {
        ...flight,
        legs: recomputeFrom(flight, held, at, performance),
      }) };
    }

    case 'VECTOR': {
      const extraNm = instruction.extraTrackNm;
      if (extraNm === undefined || extraNm <= 0) {
        return {
          ok: false,
          reason: 'NOT_APPLICABLE',
          message: 'Falta cuantas millas de mas anaden los vectores.',
        };
      }
      // Los vectores alargan el tramo siguiente: se le suman las millas ahi.
      const next = at + 1;
      if (next >= legs.length) {
        return {
          ok: false,
          reason: 'NOT_APPLICABLE',
          message: `${legs[at]!.fix} es el ultimo punto del plan: no hay tramo que alargar.`,
        };
      }
      const vectored = legs.slice();
      vectored[next] = { ...vectored[next]!, legDistNm: vectored[next]!.legDistNm + extraNm };
      return { ok: true, scenario: replaceFlight(scenario, {
        ...flight,
        legs: recomputeFrom(flight, vectored, next, performance),
      }) };
    }

    case 'DIRECT': {
      const target = instruction.targetFix;
      if (target === undefined) {
        return { ok: false, reason: 'NOT_APPLICABLE', message: 'Falta el fix de destino.' };
      }
      const to = legs.findIndex((l) => l.fix === target);
      if (to === -1) {
        return {
          ok: false,
          reason: 'UNKNOWN_FIX',
          message: `${target} no esta en el plan de ${flight.callsign}.`,
        };
      }
      if (to <= at + 1) {
        return {
          ok: false,
          reason: 'NOT_APPLICABLE',
          message: `${target} ya es el proximo punto: el directo no acorta nada.`,
        };
      }

      // Cortar de un punto a otro acorta la ruta, y esa distancia no esta tabulada en ninguna
      // planilla porque no es parte del procedimiento. Hay que medirla, y para medirla hacen
      // falta las dos coordenadas. 61 de los 107 fixes no las tienen.
      const coords = context.coordinates;
      const fromFix = legs[at]!.fix;
      const a = coords?.get(fromFix);
      const b = coords?.get(target);
      const direct = a && b ? distanceNm(a, b) : null;
      if (direct === null) {
        const missing = [
          a === undefined || a.lat === null ? fromFix : null,
          b === undefined || b.lat === null ? target : null,
        ].filter(Boolean);
        return {
          ok: false,
          reason: 'INCOMPLETE_DATA',
          message:
            `No se puede medir el directo ${fromFix} → ${target}: falta la coordenada de ` +
            `${missing.join(' y ')} en la base. Sin ella, la distancia solo se podria estimar.`,
        };
      }

      // Se caen los puntos intermedios y el tramo que llega al destino pasa a ser el directo.
      const shortened: FlightLeg[] = [
        ...legs.slice(0, at + 1),
        { ...legs[to]!, legDistNm: direct },
        ...legs.slice(to + 1),
      ];
      return { ok: true, scenario: replaceFlight(scenario, {
        ...flight,
        legs: recomputeFrom(flight, shortened, at + 1, performance),
      }) };
    }

    case 'TRANSFER': {
      // Transferir no cambia ninguna hora: marca donde deja de ser problema de este sector.
      return {
        ok: true,
        scenario: replaceFlight(scenario, { ...flight, transferFix: legs[at]!.fix }),
      };
    }
  }
}

/**
 * Aplica varias instrucciones en orden cronologico. Se para en la primera que falle, porque
 * las siguientes se calcularian sobre un estado que el controlador nunca produjo.
 */
export function applyInstructions(
  scenario: Scenario,
  instructions: readonly Instruction[],
  context: ApplyContext
): ApplyResult {
  const ordered = [...instructions].sort((a, b) => a.time - b.time);
  let current = scenario;

  for (const instruction of ordered) {
    const result = applyInstruction(current, instruction, context);
    if (!result.ok) return result;
    current = result.scenario;
  }

  return { ok: true, scenario: current };
}
