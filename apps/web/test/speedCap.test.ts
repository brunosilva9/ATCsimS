/**
 * El tope de velocidad visto desde el editor (N-06): el vuelo se arma con el tope de su
 * aeronave, la strip dice de donde salio la GS, y un vuelo sin ningun dato lo declara.
 */

import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { parseHhmm } from '@atcsims/core';
import type { AircraftType } from '@atcsims/core';
import { findProcedure, holdings, performance } from '@atcsims/navdata';

import { FlightProgressStrip } from '../src/components/FlightProgressStrip.js';
import { buildScenario } from '../src/scenarios/build.js';
import type { BuildContext, FlightDraft, ScenarioDraft } from '../src/scenarios/build.js';
import { SAMPLE_DRAFT } from '../src/scenarios/sample.js';

const DHC6: AircraftType = {
  icao: 'DHC6',
  name: 'Twin Otter',
  minSpeedKt: 150,
  maxSpeedKt: 180,
  wake: 'L',
  vappKt: null,
};

const ctx: BuildContext = {
  findProcedure,
  holdings,
  performance,
  findAircraftType: (icao) => (icao === 'DHC6' ? DHC6 : undefined),
};

const coyote = (patch: Partial<FlightDraft> = {}): FlightDraft => ({
  id: 'f1',
  callsign: 'COYOTE',
  ssr: '1203',
  icaoType: 'DHC6',
  registration: null,
  tasKt: 180,
  adep: 'SCAT',
  ades: 'SCEL',
  operator: null,
  kind: 'ARRIVAL',
  procedureIdent: 'VENTANAS1D',
  entryTime: parseHhmm('1150'),
  levelFl: 100,
  ...patch,
});

const draftWith = (flight: FlightDraft): ScenarioDraft => ({ ...SAMPLE_DRAFT, flights: [flight] });

describe('armado del vuelo con tope', () => {
  it('un DHC6 con TAS de 180 kt queda con tope de TAS y ningun tramo lo supera', () => {
    const built = buildScenario(draftWith(coyote()), ctx);
    const flight = built.scenario.flights[0]!;
    expect(flight.speedCap).toEqual({ kt: 180, source: 'tas' });
    expect(flight.legs.every((l) => l.gsKt <= 180)).toBe(true);
  });

  it('con TAS por encima de la maxima del tipo, manda la maxima', () => {
    const built = buildScenario(draftWith(coyote({ tasKt: 450 })), ctx);
    expect(built.scenario.flights[0]!.speedCap).toEqual({ kt: 180, source: 'type' });
  });

  it('sin TAS ni tipo conocido no hay tope, y se declara', () => {
    const built = buildScenario(draftWith(coyote({ icaoType: 'ZZZZ', tasKt: 0 })), ctx);
    expect(built.scenario.flights[0]!.speedCap).toBeUndefined();
    expect(built.assumptions.some((a) => a.note.includes('no tiene TAS'))).toBe(true);
  });
});

describe('la strip explica el tope', () => {
  it('el tooltip dice que la GS es el tope de la TAS del plan', () => {
    const flight = buildScenario(draftWith(coyote()), ctx).scenario.flights[0]!;
    const html = renderToString(createElement(FlightProgressStrip, { flight, variant: 'APP' }));
    expect(html).toContain('180 kt (tope: TAS del plan)');
    expect(html).not.toContain('GS de planilla');
  });
});
