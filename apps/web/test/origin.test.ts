/**
 * De donde salio el trafico de un ejercicio: a mano o del generador.
 *
 * Lo que mas facil se equivoca es la receta vieja, guardada antes de que cada vuelo registrara su
 * origen: ahi se deduce, y una deduccion mal hecha diria «armado a mano» de un sorteo.
 */

import { describe, expect, it } from 'vitest';

import { parseHhmm } from '@atcsims/core';
import type { GeneratorRequest } from '@atcsims/core';

import type { FlightDraft, FlightSource, ScenarioDraft } from '../src/scenarios/build.js';
import { draftOrigin, flightSource } from '../src/scenarios/origin.js';
import { SAMPLE_DRAFT } from '../src/scenarios/sample.js';

const CATALOGUE: ReadonlySet<string> = new Set(['LAN705', 'SKU210']);

const flight = (callsign: string, source?: FlightSource): FlightDraft => ({
  id: callsign,
  callsign,
  ssr: '0000',
  icaoType: 'A320',
  registration: null,
  tasKt: 440,
  adep: 'SCFA',
  ades: 'SCEL',
  operator: null,
  kind: 'ARRIVAL',
  procedureIdent: 'UMKAL7C',
  entryTime: parseHhmm('1100'),
  levelFl: 240,
  ...(source !== undefined ? { source } : {}),
});

const GENERATOR: GeneratorRequest = {
  seed: '7K2Q',
  arrivals: 2,
  departures: 0,
  targetEncounters: 1,
  startTime: parseHhmm('1100'),
  spreadMin: 20,
  focusFix: null,
  geometry: null,
};

const draft = (flights: FlightDraft[], generator?: GeneratorRequest): ScenarioDraft => ({
  ...SAMPLE_DRAFT,
  flights,
  ...(generator !== undefined ? { generator } : {}),
});

describe('draftOrigin', () => {
  it('todo del generador: generado, con la semilla a la vista', () => {
    const o = draftOrigin(
      draft([flight('LAN705', 'generator'), flight('SKU210', 'generator')], GENERATOR),
      CATALOGUE
    );
    expect(o.kind).toBe('generated');
    expect(o.label).toBe('Generado automáticamente');
    expect(o.detail).toBe('semilla 7K2Q · 2 del generador');
  });

  it('elegido del catalogo y con «Vuelo nuevo»: armado a mano', () => {
    const o = draftOrigin(draft([flight('LAN705', 'catalogue'), flight('CCABC', 'manual')]), CATALOGUE);
    expect(o.kind).toBe('hand');
    expect(o.detail).toBe('1 del catálogo, 1 vuelo nuevo');
  });

  it('generado y despues con un vuelo agregado a mano: mezcla', () => {
    const o = draftOrigin(
      draft([flight('LAN705', 'generator'), flight('SKU210', 'catalogue')], GENERATOR),
      CATALOGUE
    );
    expect(o.kind).toBe('mixed');
    expect(o.detail).toBe('semilla 7K2Q · 1 del generador, 1 del catálogo');
  });

  it('con semilla pero sin ningun vuelo generado ya no se presenta como generado', () => {
    const o = draftOrigin(draft([flight('LAN705', 'catalogue')], GENERATOR), CATALOGUE);
    expect(o.kind).toBe('hand');
    expect(o.detail).not.toContain('semilla');
  });

  it('sin trafico', () => {
    expect(draftOrigin(draft([]), CATALOGUE).kind).toBe('empty');
  });
});

describe('flightSource en recetas guardadas sin origen', () => {
  it('con semilla: el generador reemplazo el trafico entero', () => {
    const d = draft([flight('CCABC')], GENERATOR);
    expect(flightSource(d.flights[0]!, d, CATALOGUE)).toBe('generator');
  });

  it('sin semilla: el indicativo dice si estaba en el catalogo', () => {
    const d = draft([flight('LAN705'), flight('CCABC')]);
    expect(flightSource(d.flights[0]!, d, CATALOGUE)).toBe('catalogue');
    expect(flightSource(d.flights[1]!, d, CATALOGUE)).toBe('manual');
  });

  it('el origen registrado manda sobre la deduccion', () => {
    const d = draft([flight('LAN705', 'manual')], GENERATOR);
    expect(flightSource(d.flights[0]!, d, CATALOGUE)).toBe('manual');
  });
});
