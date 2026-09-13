/**
 * La correccion de una prueba.
 *
 * Lo que se comprueba aqui es sobre todo lo que el sistema NO debe hacer: no dar por buena una
 * casilla en blanco, no contarla como error, y no dar por mala una respuesta contra un numero
 * que el propio motor tuvo que suponer.
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TOLERANCE,
  answersToFlights,
  computeFlightPlan,
  gradeExam,
  parseHhmm,
  toFeet,
} from '../src/index.js';
import type { ExamAnswers, ExamEntry, Scenario } from '../src/index.js';

import { conflictScenario, holdings, performance, procedureByIdent } from './fixtures.js';

const scenario = conflictScenario();
const flight = scenario.flights[0]!;

/** Las respuestas de un alumno que lo hizo todo perfecto. */
function perfectAnswers(s: Scenario): ExamAnswers {
  const entries: ExamEntry[] = [];
  for (const f of s.flights) {
    for (const leg of f.legs) {
      if (leg.seq === 1) continue;
      entries.push({
        flightId: f.id,
        fix: leg.fix,
        eto: leg.eto,
        levelFt: leg.levelFt,
        gsKt: leg.gsKt,
      });
    }
  }
  return { entries };
}

describe('una prueba perfecta', () => {
  const report = gradeExam(scenario, perfectAnswers(scenario));

  it('no marca ningun error', () => {
    expect(report.eto.outOfTolerance).toBe(0);
    expect(report.levelFt.outOfTolerance).toBe(0);
    expect(report.gsKt.outOfTolerance).toBe(0);
  });

  it('no deja ninguna casilla en blanco', () => {
    expect(report.eto.blank).toBe(0);
  });

  it('corrige un punto por cada fix menos el de entrada, que viene dado', () => {
    const expected = scenario.flights.reduce((n, f) => n + f.legs.length - 1, 0);
    expect(report.legs).toHaveLength(expected);
    expect(report.legs.some((l) => l.seq === 1)).toBe(false);
  });
});

describe('una casilla en blanco no es un error', () => {
  const report = gradeExam(scenario, { entries: [] });

  it('se cuenta aparte', () => {
    expect(report.eto.blank).toBe(report.legs.length);
    expect(report.eto.outOfTolerance).toBe(0);
    expect(report.eto.correct).toBe(0);
  });

  it('y no se le inventa una desviacion', () => {
    for (const leg of report.legs) expect(leg.eto.delta).toBeNull();
  });
});

describe('la tolerancia', () => {
  const target = flight.legs[3]!;

  const answerWith = (offsetMin: number): ExamAnswers => ({
    entries: [
      {
        flightId: flight.id,
        fix: target.fix,
        eto: target.eto + offsetMin,
        levelFt: target.levelFt,
        gsKt: target.gsKt,
      },
    ],
  });

  const verdictAt = (offsetMin: number) =>
    gradeExam(scenario, answerWith(offsetMin)).legs.find((l) => l.fix === target.fix)!.eto.verdict;

  it('un minuto entra: es el criterio de RNF-1', () => {
    expect(DEFAULT_TOLERANCE.etoMin).toBe(1);
    expect(verdictAt(1)).toBe('CORRECT');
    expect(verdictAt(-1)).toBe('CORRECT');
  });

  it('dos minutos no', () => {
    expect(verdictAt(2)).toBe('OUT_OF_TOLERANCE');
  });

  it('guarda la desviacion con signo, para que se vea si va corto o largo', () => {
    const report = gradeExam(scenario, answerWith(3));
    expect(report.legs.find((l) => l.fix === target.fix)!.eto.delta).toBe(3);
    const early = gradeExam(scenario, answerWith(-3));
    expect(early.legs.find((l) => l.fix === target.fix)!.eto.delta).toBe(-3);
  });

  it('se puede apretar o aflojar sin tocar codigo', () => {
    const strict = gradeExam(scenario, answerWith(1), { etoMin: 0, levelFt: 0, gsKt: 0 });
    expect(strict.legs.find((l) => l.fix === target.fix)!.eto.verdict).toBe('OUT_OF_TOLERANCE');
  });
});

describe('no se corrige contra un numero que el motor se invento', () => {
  it('marca los puntos cuyo nivel salio de interpolar, no de una restriccion publicada', () => {
    const report = gradeExam(scenario, perfectAnswers(scenario));
    expect(report.assumedReferences).toBeGreaterThan(0);
    expect(report.notes.join(' ')).toContain('interpol');
  });

  it('un punto con restriccion publicada no se marca', () => {
    const report = gradeExam(scenario, perfectAnswers(scenario));
    // UGOLA tiene 8000 ft publicados en performance y en la tabla de esperas.
    const ugola = report.legs.find((l) => l.fix === 'UGOLA' && l.flightId === flight.id);
    expect(ugola?.referenceIsAssumed).toBe(false);
  });

  it('una salida arrastra el supuesto de la elevacion del aerodromo en todos sus puntos', () => {
    const sid = computeFlightPlan({
      procedure: procedureByIdent('ANGOD8B'),
      entryTime: parseHhmm('1100'),
      cruiseLevelFt: toFeet(230),
      performance,
      holdings,
    });
    if (!sid.ok) throw new Error(sid.message);
    expect(sid.assumptions.length).toBeGreaterThan(0);

    const withSid: Scenario = {
      ...scenario,
      flights: [{ ...flight, id: 'sid', callsign: 'DSM142', legs: sid.legs }],
    };
    const report = gradeExam(withSid, perfectAnswers(withSid), DEFAULT_TOLERANCE, ['sid']);
    expect(report.legs.every((l) => l.referenceIsAssumed)).toBe(true);
  });
});

describe('el diagrama del alumno se construye con SUS horas', () => {
  it('solo aparecen los puntos que ha contestado', () => {
    const answers: ExamAnswers = {
      entries: [
        { flightId: flight.id, fix: flight.legs[1]!.fix, eto: parseHhmm('1130'), levelFt: 20000, gsKt: 300 },
      ],
    };
    const flights = answersToFlights(scenario, answers);
    const shown = flights.find((f) => f.id === flight.id)!;

    // El de entrada viene dado, mas el unico contestado.
    expect(shown.legs).toHaveLength(2);
    expect(shown.legs[1]!.eto).toBe(parseHhmm('1130'));
  });

  it('usa la hora del alumno aunque este equivocada: es su trabajo, no el del motor', () => {
    const wrong = parseHhmm('1159');
    const answers: ExamAnswers = {
      entries: flight.legs
        .filter((l) => l.seq !== 1)
        .map((l) => ({ flightId: flight.id, fix: l.fix, eto: wrong, levelFt: null, gsKt: null })),
    };
    const flights = answersToFlights(scenario, answers);
    const shown = flights.find((f) => f.id === flight.id)!;
    for (const leg of shown.legs.slice(1)) expect(leg.eto).toBe(wrong);
  });

  it('sin respuestas, solo queda el punto de entrada', () => {
    const flights = answersToFlights(scenario, { entries: [] });
    for (const f of flights) expect(f.legs).toHaveLength(1);
  });
});
