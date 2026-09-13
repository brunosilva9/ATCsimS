/**
 * Modo prueba: el alumno calcula, el sistema no ayuda, el profesor corrige.
 *
 * Es la inversion del modo de practica. Ahi el sistema calcula las horas y el alumno trabaja el
 * trafico; aqui el alumno rellena a mano lo que el motor sabria calcular —hora de paso, nivel y
 * velocidad en cada punto— y **no se le dice si acierta**. Nada de esto se corrige en pantalla
 * mientras trabaja: la comparacion existe, pero solo la ve el profesor al abrir la entrega.
 *
 * Dos decisiones que sostienen el resto:
 *
 * 1. **Una casilla en blanco no es un error.** Se cuenta aparte. No es lo mismo equivocarse que
 *    no llegar a tiempo, y mezclarlo enturbia la correccion.
 *
 * 2. **Cuando la referencia descansa en un supuesto, se dice.** El motor declara lo que tuvo que
 *    suponer porque la base no lo trae (la elevacion del aerodromo, el nivel final de EROLO8A) y
 *    tambien sabe que niveles salen de una restriccion publicada y cuales son interpolados. Un
 *    numero interpolado es una decision de modelo, no la unica respuesta correcta, asi que la
 *    fila se marca y la ultima palabra la tiene el profesor. El sistema no da por mala una
 *    respuesta contra un valor que se invento el.
 */

import type { Flight, Scenario, UtcMinutes } from './types.js';

/** Lo que el alumno escribe en un punto. `null` = casilla en blanco. */
export interface ExamEntry {
  readonly flightId: string;
  readonly fix: string;
  readonly eto: UtcMinutes | null;
  readonly levelFt: number | null;
  readonly gsKt: number | null;
}

export interface ExamAnswers {
  readonly entries: readonly ExamEntry[];
}

export interface ExamTolerance {
  /** RNF-1 de docs/REQUISITOS.md: el ejercicio se da por reproducido con un minuto. */
  readonly etoMin: number;
  readonly levelFt: number;
  readonly gsKt: number;
}

export const DEFAULT_TOLERANCE: ExamTolerance = {
  etoMin: 1,
  levelFt: 100,
  gsKt: 10,
};

export type Verdict = 'CORRECT' | 'OUT_OF_TOLERANCE' | 'BLANK';

export interface FieldCheck {
  readonly answered: number | null;
  readonly expected: number;
  /** Cuanto se desvio, en la unidad del campo. `null` si no contesto. */
  readonly delta: number | null;
  readonly verdict: Verdict;
}

export interface LegCheck {
  readonly flightId: string;
  readonly callsign: string;
  readonly seq: number;
  readonly fix: string;
  readonly eto: FieldCheck;
  readonly levelFt: FieldCheck;
  readonly gsKt: FieldCheck;
  /**
   * La referencia de este punto no es dato puro de las planillas: o el nivel salio de
   * interpolar entre dos restricciones, o el vuelo entero arrastra un supuesto del motor.
   * El profesor lo ve marcado y decide.
   */
  readonly referenceIsAssumed: boolean;
}

export interface FieldTally {
  readonly correct: number;
  readonly outOfTolerance: number;
  readonly blank: number;
}

export interface ExamReport {
  readonly legs: readonly LegCheck[];
  readonly eto: FieldTally;
  readonly levelFt: FieldTally;
  readonly gsKt: FieldTally;
  /** Puntos cuya referencia descansa en un supuesto del motor. */
  readonly assumedReferences: number;
  readonly tolerance: ExamTolerance;
  readonly notes: readonly string[];
}

function check(
  answered: number | null,
  expected: number,
  tolerance: number
): FieldCheck {
  if (answered === null) {
    return { answered: null, expected, delta: null, verdict: 'BLANK' };
  }
  const delta = answered - expected;
  return {
    answered,
    expected,
    delta,
    verdict: Math.abs(delta) <= tolerance ? 'CORRECT' : 'OUT_OF_TOLERANCE',
  };
}

function tally(checks: readonly FieldCheck[]): FieldTally {
  return {
    correct: checks.filter((c) => c.verdict === 'CORRECT').length,
    outOfTolerance: checks.filter((c) => c.verdict === 'OUT_OF_TOLERANCE').length,
    blank: checks.filter((c) => c.verdict === 'BLANK').length,
  };
}

/**
 * El primer punto de una llegada es el dato de partida —se entra al sector ahi, a esa hora y a
 * ese nivel— asi que no se pregunta ni se corrige. En una salida, el primer punto es el
 * aerodromo y pasa lo mismo.
 */
export function isGiven(seq: number): boolean {
  return seq === 1;
}

export function gradeExam(
  scenario: Scenario,
  answers: ExamAnswers,
  tolerance: ExamTolerance = DEFAULT_TOLERANCE,
  /** Indicativos cuyo plan el motor calculo con supuestos declarados. */
  flightsWithAssumptions: readonly string[] = []
): ExamReport {
  const assumed = new Set(flightsWithAssumptions);
  const byKey = new Map(answers.entries.map((e) => [`${e.flightId}|${e.fix}`, e]));

  const legs: LegCheck[] = [];

  for (const flight of scenario.flights) {
    for (const leg of flight.legs) {
      if (isGiven(leg.seq)) continue;

      const entry = byKey.get(`${flight.id}|${leg.fix}`);
      const expectedEto = leg.revisedEto ?? leg.eto;

      legs.push({
        flightId: flight.id,
        callsign: flight.callsign,
        seq: leg.seq,
        fix: leg.fix,
        eto: check(entry?.eto ?? null, expectedEto, tolerance.etoMin),
        levelFt: check(entry?.levelFt ?? null, leg.levelFt ?? 0, tolerance.levelFt),
        gsKt: check(entry?.gsKt ?? null, leg.gsKt, tolerance.gsKt),
        // Un nivel sin restriccion publicada en su fix es un nivel interpolado.
        referenceIsAssumed: assumed.has(flight.id) || leg.restriction === null,
      });
    }
  }

  const notes: string[] = [];
  const assumedCount = legs.filter((l) => l.referenceIsAssumed).length;
  if (assumedCount > 0) {
    notes.push(
      `${assumedCount} de ${legs.length} puntos tienen una referencia que no sale directa de ` +
        `las planillas: el nivel se interpoló entre dos restricciones publicadas, o el vuelo ` +
        `arrastra un supuesto del motor. Están marcados. Conviene mirarlos antes de dar por ` +
        `mala una respuesta.`
    );
  }

  return {
    legs,
    eto: tally(legs.map((l) => l.eto)),
    levelFt: tally(legs.map((l) => l.levelFt)),
    gsKt: tally(legs.map((l) => l.gsKt)),
    assumedReferences: assumedCount,
    tolerance,
    notes,
  };
}

/**
 * Los vuelos tal como los dejan las respuestas del alumno, para poder dibujarle el diagrama con
 * SUS horas. Los puntos que no ha contestado se caen: el diagrama ensena lo que ha calculado,
 * ni una casilla mas.
 */
export function answersToFlights(
  scenario: Scenario,
  answers: ExamAnswers
): Flight[] {
  const byKey = new Map(answers.entries.map((e) => [`${e.flightId}|${e.fix}`, e]));

  return scenario.flights.map((flight) => ({
    ...flight,
    legs: flight.legs
      .map((leg) => {
        if (isGiven(leg.seq)) return leg;
        const entry = byKey.get(`${flight.id}|${leg.fix}`);
        if (entry?.eto === null || entry?.eto === undefined) return null;
        return {
          ...leg,
          eto: entry.eto,
          revisedEto: null,
          levelFt: entry.levelFt,
          gsKt: entry.gsKt ?? leg.gsKt,
        };
      })
      .filter((leg): leg is NonNullable<typeof leg> => leg !== null),
  }));
}
