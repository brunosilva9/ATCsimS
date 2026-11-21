/**
 * Performance por categoria de aeronave (N-07).
 *
 * Lo que se comprueba: un piston o un turbohelice con su tabla completa vuela con ella (GS y
 * ascenso), una tabla a medio cargar no se usa, y un jet no cambia.
 */

import { describe, expect, it } from 'vitest';

import {
  applyInstruction,
  categoryProfile,
  computeFlightPlan,
  parseHhmm,
  profileFor,
  toFeet,
} from '../src/index.js';
import type {
  AircraftType,
  CategoryPerformanceLevel,
  CategoryProfile,
  Flight,
  Scenario,
} from '../src/index.js';

import { holdings, performance, procedureByIdent } from './fixtures.js';

const PISTON: readonly CategoryPerformanceLevel[] = [
  { category: 'piston', level: 'FL120', altFt: 12000, gsKt: 130, climbFtPerMin: 250 },
  { category: 'piston', level: '10000', altFt: 10000, gsKt: 125, climbFtPerMin: 300 },
  { category: 'piston', level: '8000', altFt: 8000, gsKt: 120, climbFtPerMin: 300 },
  { category: 'piston', level: '6000', altFt: 6000, gsKt: 120, climbFtPerMin: 300 },
];

/** Los niveles de turbohelice tal como se crearon: sin valores. */
const PENDING_TURBOPROP: readonly CategoryPerformanceLevel[] = [
  { category: 'turbohelice', level: 'FL250', altFt: 25000, gsKt: null, climbFtPerMin: null },
  { category: 'turbohelice', level: '6000', altFt: 6000, gsKt: null, climbFtPerMin: null },
];

const LEVELS = [...PISTON, ...PENDING_TURBOPROP];

const type = (icao: string, category?: AircraftType['category']): AircraftType => ({
  icao,
  name: icao,
  minSpeedKt: null,
  maxSpeedKt: null,
  wake: null,
  vappKt: null,
  ...(category !== undefined ? { category } : {}),
});

const pistonProfile = (): CategoryProfile => categoryProfile('piston', PISTON)!;

function plan(ident: string, profile?: CategoryProfile) {
  const result = computeFlightPlan({
    procedure: procedureByIdent(ident),
    entryTime: parseHhmm('1100'),
    cruiseLevelFt: toFeet(100),
    performance,
    holdings,
    ...(profile !== undefined ? { profile } : {}),
  });
  if (!result.ok) throw new Error(result.message);
  return result;
}

describe('categoryProfile', () => {
  it('arma la tabla de la categoria, de mayor a menor altitud', () => {
    const profile = categoryProfile('piston', [...PISTON].reverse());
    expect(profile?.category).toBe('piston');
    expect(profile?.levels.map((l) => l.altFt)).toEqual([12000, 10000, 8000, 6000]);
  });

  it('una tabla con un solo hueco no se usa', () => {
    const holed = PISTON.map((l, i) => (i === 2 ? { ...l, climbFtPerMin: null } : l));
    expect(categoryProfile('piston', holed)).toBeUndefined();
  });

  it('sin niveles de la categoria no hay tabla', () => {
    expect(categoryProfile('turbohelice', PISTON)).toBeUndefined();
  });
});

describe('profileFor', () => {
  it('jet, sin categoria o sin tipo: tabla comun y sin supuesto', () => {
    expect(profileFor(type('B738', 'jet'), LEVELS)).toEqual({});
    expect(profileFor(type('B738'), LEVELS)).toEqual({});
    expect(profileFor(undefined, LEVELS)).toEqual({});
  });

  it('piston con su tabla completa: esa tabla', () => {
    expect(profileFor(type('C172', 'piston'), LEVELS).profile).toEqual(pistonProfile());
  });

  it('turbohelice con la tabla incompleta: la de jet, y se declara', () => {
    const choice = profileFor(type('DHC6', 'turbohelice'), LEVELS);
    expect(choice.profile).toBeUndefined();
    expect(choice.assumption).toContain('turbohélice está incompleta');
    expect(choice.assumption).toContain('DHC6');
  });
});

describe('el perfil en el calculo', () => {
  it('una SID de piston asciende con el regimen de su categoria', () => {
    const jet = plan('ALBAL7C');
    const piston = plan('ALBAL7C', pistonProfile());

    // AMB → DESIT, 8 NM desde 6000 ft. Jet: 150 kt y 500 ft/min. Piston: 120 kt y 300 ft/min.
    const desitJet = jet.legs.find((l) => l.fix === 'DESIT')!;
    const desitPiston = piston.legs.find((l) => l.fix === 'DESIT')!;
    expect(desitPiston.gsKt).toBe(120);
    expect(desitPiston.levelFt!).toBeLessThan(desitJet.levelFt!);

    for (const [i, leg] of piston.legs.entries()) {
      expect(leg.levelFt!).toBeLessThanOrEqual(jet.legs[i]!.levelFt!);
      expect([120, 125, 130]).toContain(leg.gsKt);
    }
  });

  it('con tabla propia no se usa la GS de planilla, que es la de un jet', () => {
    const jet = plan('VENTANAS1D');
    const piston = plan('VENTANAS1D', pistonProfile());
    expect(jet.legs.find((l) => l.fix === 'TENUT')!.gsKt).toBe(360);
    expect(piston.legs.every((l) => l.sourceGsKt === null)).toBe(true);
    expect(piston.legs.every((l) => l.gsKt <= 130)).toBe(true);
  });

  it('la llegada mantiene los niveles publicados: son del procedimiento, no de la aeronave', () => {
    const jet = plan('VENTANAS1D');
    const piston = plan('VENTANAS1D', pistonProfile());
    expect(piston.legs.map((l) => l.levelFt)).toEqual(jet.legs.map((l) => l.levelFt));
  });
});

describe('el perfil en las instrucciones', () => {
  it('un cambio de nivel recalcula con la tabla del vuelo', () => {
    const profile = pistonProfile();
    const computed = plan('VENTANAS1D', profile);
    const flight: Flight = {
      id: 'a',
      callsign: 'CCABC',
      ssr: '1203',
      icaoType: 'C172',
      registration: null,
      tasKt: 120,
      adep: 'SCVM',
      ades: 'SCEL',
      operator: null,
      kind: 'ARRIVAL',
      procedureIdent: 'VENTANAS1D',
      airway: null,
      cruiseLevelFt: toFeet(100),
      entryTime: parseHhmm('1100'),
      transferFix: 'TEGEB',
      legs: computed.legs,
      profile,
    };
    const scenario: Scenario = {
      id: 's',
      name: 'Piston',
      configuration: 'SUR',
      runwayInUse: '17L',
      sivigats: true,
      startTime: flight.entryTime,
      durationMin: 30,
      weather: {
        qnhHpa: 1013,
        transitionLevel: 'FL110',
        vmc: true,
        visibilityM: 9999,
        ceilingFt: null,
        lvp: false,
      },
      objective: '',
      flights: [flight],
    };

    const result = applyInstruction(
      scenario,
      {
        id: 'i1',
        time: parseHhmm('1100'),
        flightId: 'a',
        kind: 'LEVEL_CHANGE',
        fromFix: 'TENUT',
        levelFt: 8000,
      },
      { performance }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Despues de TENUT el vuelo va a 8000 ft: 120 kt en la tabla de piston (210 en la de jet).
    const olmue = result.scenario.flights[0]!.legs.find((l) => l.fix === 'OLMUE')!;
    expect(olmue.gsKt).toBe(120);
  });
});
