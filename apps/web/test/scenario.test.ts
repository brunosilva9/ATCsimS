/**
 * El camino que recorre un ejercicio: receta → calculado → enlace/archivo → de vuelta.
 *
 * Es donde se pierden las cosas sin que nadie se entere: un campo que no sobrevive al viaje no
 * rompe nada, solo hace que el alumno vea un ejercicio distinto del que armo el instructor.
 */

import { describe, expect, it } from 'vitest';

import { formatHhmm, gradeExam, parseHhmm } from '@atcsims/core';
import { ssrCodes } from '@atcsims/navdata';

import { decodePayload, encodePayload, parsePayload } from '../src/lib/share.js';
import { buildScenario } from '../src/scenarios/build.js';
import type { ScenarioDraft } from '../src/scenarios/build.js';
import { SAMPLE_DRAFT, buildSampleScenario } from '../src/scenarios/sample.js';

describe('de receta a ejercicio', () => {
  const built = buildSampleScenario();

  it('calcula los cinco vuelos del ejemplo', () => {
    expect(built.scenario.flights).toHaveLength(5);
    expect(built.rejected).toHaveLength(0);
  });

  it('la ventana cubre desde el primero que entra hasta el ultimo que sale', () => {
    const { scenario } = built;
    const entries = scenario.flights.map((f) => f.entryTime);
    expect(scenario.startTime).toBe(Math.min(...entries));

    const lastEto = Math.max(...scenario.flights.map((f) => f.legs[f.legs.length - 1]!.eto));
    expect(scenario.startTime + scenario.durationMin).toBeGreaterThanOrEqual(lastEto);
  });

  it('el conflicto del ejemplo esta puesto a proposito: LAN705 y SKU621 sobre TEGEB', () => {
    const at = (callsign: string) =>
      built.scenario.flights
        .find((f) => f.callsign === callsign)!
        .legs.find((l) => l.fix === 'TEGEB')!.eto;
    expect(formatHhmm(at('LAN705'))).toBe(formatHhmm(at('SKU621')));
  });

  it('un procedimiento inexistente se rechaza con motivo, no se cuela vacio', () => {
    const broken: ScenarioDraft = {
      ...SAMPLE_DRAFT,
      flights: [{ ...SAMPLE_DRAFT.flights[0]!, procedureIdent: 'NO_EXISTE' }],
    };
    const result = buildScenario(broken);
    expect(result.scenario.flights).toHaveLength(0);
    expect(result.rejected[0]?.reason).toBeTruthy();
  });

  it('ASIMO7D queda excluida: el motor se niega y el ejercicio lo dice', () => {
    const withAsimo: ScenarioDraft = {
      ...SAMPLE_DRAFT,
      flights: [{ ...SAMPLE_DRAFT.flights[0]!, procedureIdent: 'ASIMO7D' }],
    };
    const result = buildScenario(withAsimo);
    expect(result.rejected).toHaveLength(1);
  });

  it('un ejercicio sin trafico no revienta', () => {
    const result = buildScenario({ ...SAMPLE_DRAFT, flights: [] });
    expect(result.scenario.flights).toHaveLength(0);
    expect(result.scenario.durationMin).toBeGreaterThan(0);
  });
});

describe('el ejercicio viaja por enlace', () => {
  const { scenario } = buildSampleScenario();
  const payload = { version: 1 as const, scenario, instructions: [] };

  it('vuelve entero', () => {
    const decoded = decodePayload(encodePayload(payload));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.payload.scenario).toEqual(scenario);
  });

  it('cabe en una URL que se pueda pegar en un chat', () => {
    expect(encodePayload(payload).length).toBeLessThan(8000);
  });

  it('un enlace cortado no se abre a medias: lo dice', () => {
    const truncated = encodePayload(payload).slice(0, 40);
    const decoded = decodePayload(truncated);
    expect(decoded.ok).toBe(false);
  });

  it('un archivo de otra version no se lee como si fuera de esta', () => {
    const result = parsePayload(JSON.stringify({ ...payload, version: 99 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('99');
  });

  it('un archivo que no es un ejercicio se rechaza', () => {
    expect(parsePayload('{"hola":1}').ok).toBe(false);
    expect(parsePayload('esto no es json').ok).toBe(false);
  });
});

describe('importar reconstruye la receta', () => {
  it('el viaje receta → ejercicio → archivo → receta conserva lo editable', () => {
    const { scenario } = buildScenario(SAMPLE_DRAFT);
    const reloaded = parsePayload(
      JSON.stringify({ version: 1, scenario, instructions: [] })
    );
    if (!reloaded.ok) throw new Error(reloaded.message);

    // Es lo que hace la pantalla de ejercicios al importar un archivo.
    const rebuilt: ScenarioDraft = {
      ...SAMPLE_DRAFT,
      flights: reloaded.payload.scenario.flights.map((f) => ({
        id: f.id,
        callsign: f.callsign,
        ssr: f.ssr,
        icaoType: f.icaoType,
        registration: f.registration,
        tasKt: f.tasKt,
        adep: f.adep,
        ades: f.ades,
        kind: f.kind,
        procedureIdent: f.procedureIdent ?? '',
        entryTime: f.entryTime,
        levelFl: Math.round(f.cruiseLevelFt / 100),
      })),
    };

    // Recalcular la receta reconstruida tiene que dar el mismo ejercicio.
    expect(buildScenario(rebuilt).scenario.flights).toEqual(scenario.flights);
  });
});

describe('codigos de transpondedor', () => {
  it('el pool existe y no tiene repetidos', () => {
    expect(ssrCodes.length).toBeGreaterThan(100);
    expect(new Set(ssrCodes).size).toBe(ssrCodes.length);
  });

  it('el ejemplo no repite ningun codigo entre sus vuelos', () => {
    const used = SAMPLE_DRAFT.flights.map((f) => f.ssr);
    expect(new Set(used).size).toBe(used.length);
  });
});

describe('horas', () => {
  it('la receta guarda minutos, no texto: HHMM es solo como se escribe', () => {
    expect(SAMPLE_DRAFT.flights[0]!.entryTime).toBe(parseHhmm('1100'));
    expect(formatHhmm(SAMPLE_DRAFT.flights[0]!.entryTime)).toBe('1100');
  });
});

describe('modo prueba', () => {
  const { scenario } = buildSampleScenario();

  it('el modo viaja dentro del ejercicio, no como parametro de la URL', () => {
    const encoded = encodePayload({
      version: 1,
      scenario,
      instructions: [],
      mode: 'exam',
      allowInstructions: true,
    });
    // El hash no deja leer a simple vista que es una prueba ni convertirla en practica.
    expect(encoded).not.toContain('exam');

    const decoded = decodePayload(encoded);
    if (!decoded.ok) throw new Error(decoded.message);
    expect(decoded.payload.mode).toBe('exam');
    expect(decoded.payload.allowInstructions).toBe(true);
  });

  it('un enlace sin modo se abre como practica: los ya repartidos siguen valiendo', () => {
    const decoded = decodePayload(
      encodePayload({ version: 1, scenario, instructions: [] })
    );
    if (!decoded.ok) throw new Error(decoded.message);
    expect(decoded.payload.mode).toBeUndefined();
  });

  it('las respuestas del alumno sobreviven al archivo de entrega', () => {
    const flight = scenario.flights[0]!;
    const answers = {
      entries: flight.legs
        .filter((l) => l.seq !== 1)
        .map((l) => ({
          flightId: flight.id,
          fix: l.fix,
          eto: l.eto,
          levelFt: l.levelFt,
          gsKt: l.gsKt,
        })),
    };

    const reloaded = parsePayload(
      JSON.stringify({
        version: 1,
        scenario,
        instructions: [],
        mode: 'exam',
        answers,
        student: 'Bruno',
      })
    );
    if (!reloaded.ok) throw new Error(reloaded.message);
    expect(reloaded.payload.answers).toEqual(answers);
    expect(reloaded.payload.student).toBe('Bruno');
  });

  it('una entrega sin respuestas se corrige igual: todo en blanco, ningun error', () => {
    const report = gradeExam(scenario, { entries: [] });
    expect(report.eto.outOfTolerance).toBe(0);
    expect(report.eto.blank).toBeGreaterThan(0);
  });
});
