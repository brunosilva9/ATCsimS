/**
 * Performance por categoria vista desde el editor (N-07): el vuelo se arma con la tabla de su
 * categoria, la strip dice de que tabla salio la GS, y una tabla incompleta se declara.
 */

import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { parseHhmm } from '@atcsims/core';
import type { AircraftType, CategoryPerformanceLevel } from '@atcsims/core';
import { findProcedure, holdings, performance } from '@atcsims/navdata';

import { FlightProgressStrip } from '../src/components/FlightProgressStrip.js';
import { buildScenario } from '../src/scenarios/build.js';
import type { BuildContext, FlightDraft, ScenarioDraft } from '../src/scenarios/build.js';
import { SAMPLE_DRAFT } from '../src/scenarios/sample.js';

const TYPES: Record<string, AircraftType> = {
  C172: { icao: 'C172', name: 'Cessna 172', minSpeedKt: null, maxSpeedKt: null, wake: 'L', vappKt: null, category: 'piston' },
  DHC6: { icao: 'DHC6', name: 'Twin Otter', minSpeedKt: null, maxSpeedKt: null, wake: 'L', vappKt: null, category: 'turbohelice' },
};

const LEVELS: readonly CategoryPerformanceLevel[] = [
  { category: 'piston', level: '10000', altFt: 10000, gsKt: 125, climbFtPerMin: 300 },
  { category: 'piston', level: '6000', altFt: 6000, gsKt: 120, climbFtPerMin: 300 },
  { category: 'turbohelice', level: '6000', altFt: 6000, gsKt: null, climbFtPerMin: null },
];

const ctx: BuildContext = {
  findProcedure,
  holdings,
  performance,
  findAircraftType: (icao) => TYPES[icao],
  categoryPerformance: LEVELS,
};

const arrival = (icaoType: string): FlightDraft => ({
  id: 'f1',
  callsign: 'CCABC',
  ssr: '1203',
  icaoType,
  registration: null,
  tasKt: 0,
  adep: 'SCVM',
  ades: 'SCEL',
  operator: null,
  kind: 'ARRIVAL',
  procedureIdent: 'VENTANAS1D',
  entryTime: parseHhmm('1150'),
  levelFl: 100,
});

const draftWith = (flight: FlightDraft): ScenarioDraft => ({ ...SAMPLE_DRAFT, flights: [flight] });

describe('armado del vuelo por categoria', () => {
  it('un piston con su tabla completa vuela con ella', () => {
    const built = buildScenario(draftWith(arrival('C172')), ctx);
    const flight = built.scenario.flights[0]!;
    expect(flight.profile?.category).toBe('piston');
    expect(flight.legs.every((l) => l.gsKt <= 125)).toBe(true);
    expect(built.assumptions.some((a) => a.note.includes('incompleta'))).toBe(false);
  });

  it('un turbohelice con la tabla incompleta vuela como jet, y se declara', () => {
    const built = buildScenario(draftWith(arrival('DHC6')), ctx);
    expect(built.scenario.flights[0]!.profile).toBeUndefined();
    expect(
      built.assumptions.some((a) => a.note.includes('turbohélice está incompleta'))
    ).toBe(true);
  });
});

describe('la strip dice de que tabla salio la GS', () => {
  it('el tooltip nombra la tabla de piston', () => {
    const flight = buildScenario(draftWith(arrival('C172')), ctx).scenario.flights[0]!;
    const html = renderToString(createElement(FlightProgressStrip, { flight, variant: 'APP' }));
    expect(html).toContain('GS de la tabla de pistón');
    expect(html).not.toContain('GS de planilla');
  });
});
