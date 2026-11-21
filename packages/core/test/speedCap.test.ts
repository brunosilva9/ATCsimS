/**
 * Tope de velocidad por aeronave (N-06).
 *
 * El perfil de las planillas es el de un jet. Lo que se comprueba aqui son las dos caras del
 * tope: un avion lento deja de volar a velocidades que no puede alcanzar, y un jet sigue
 * reproduciendo la planilla exacta, porque el tope solo recorta.
 */

import { describe, expect, it } from 'vitest';

import {
  aircraftSpeedCap,
  applyInstruction,
  computeFlightPlan,
  parseHhmm,
  speedRangeOf,
  toFeet,
} from '../src/index.js';
import type { AircraftType, Flight, Scenario } from '../src/index.js';

import { holdings, performance, procedureByIdent, procedures } from './fixtures.js';

const DHC6: AircraftType = {
  icao: 'DHC6',
  name: 'Twin Otter',
  minSpeedKt: 150,
  maxSpeedKt: 180,
  wake: 'L',
  vappKt: null,
};

const A320: AircraftType = {
  icao: 'A320',
  name: 'Airbus A320',
  minSpeedKt: 420,
  maxSpeedKt: 440,
  wake: 'M',
  vappKt: null,
};

/** Un vuelo calculado con tope, como lo arma el editor. */
function cappedFlight(icaoType: string, tasKt: number, type: AircraftType): Flight {
  const procedure = procedureByIdent('VENTANAS1D');
  const speedCap = aircraftSpeedCap(tasKt, type)!;
  const entryTime = parseHhmm('1150');
  const plan = computeFlightPlan({
    procedure,
    entryTime,
    cruiseLevelFt: toFeet(100),
    performance,
    holdings,
    speedCapKt: speedCap.kt,
  });
  if (!plan.ok) throw new Error(plan.message);
  return {
    id: 'a',
    callsign: 'COYOTE',
    ssr: '1203',
    icaoType,
    registration: null,
    tasKt,
    adep: 'SCAT',
    ades: 'SCEL',
    operator: null,
    kind: 'ARRIVAL',
    procedureIdent: procedure.ident,
    airway: null,
    cruiseLevelFt: toFeet(100),
    entryTime,
    transferFix: 'TEGEB',
    legs: plan.legs,
    speedCap,
  };
}

const scenarioWith = (flight: Flight): Scenario => ({
  id: 's',
  name: 'Tope',
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
});

describe('aircraftSpeedCap', () => {
  it('toma la TAS del plan cuando no supera la maxima del tipo', () => {
    expect(aircraftSpeedCap(170, DHC6)).toEqual({ kt: 170, source: 'tas' });
  });

  it('toma la maxima del tipo cuando la TAS la supera', () => {
    expect(aircraftSpeedCap(450, DHC6)).toEqual({ kt: 180, source: 'type' });
  });

  it('sin TAS, la maxima del tipo', () => {
    expect(aircraftSpeedCap(null, DHC6)).toEqual({ kt: 180, source: 'type' });
    expect(aircraftSpeedCap(0, DHC6)).toEqual({ kt: 180, source: 'type' });
  });

  it('sin tipo, la TAS', () => {
    expect(aircraftSpeedCap(180, undefined)).toEqual({ kt: 180, source: 'tas' });
  });

  it('sin ningun dato no hay tope', () => {
    expect(aircraftSpeedCap(null, undefined)).toBeUndefined();
  });

  it('un tipo a medio cargar no cuenta: el tope sale solo de la TAS', () => {
    const pending: AircraftType = { ...DHC6, icao: 'L410', minSpeedKt: null, maxSpeedKt: null };
    expect(speedRangeOf(pending)).toBeUndefined();
    expect(aircraftSpeedCap(200, pending)).toEqual({ kt: 200, source: 'tas' });
    expect(aircraftSpeedCap(null, pending)).toBeUndefined();
  });

  it('un rango incoherente tampoco cuenta', () => {
    expect(speedRangeOf({ ...DHC6, minSpeedKt: 200, maxSpeedKt: 180 })).toBeUndefined();
    expect(speedRangeOf({ ...DHC6, minSpeedKt: 150, maxSpeedKt: null })).toBeUndefined();
  });
});

describe('el tope en el calculo de horas', () => {
  it('un DHC6 a 180 kt no vuela VENTANAS1D a la GS de planilla', () => {
    const flight = cappedFlight('DHC6', 180, DHC6);
    const flown = flight.legs.slice(1);

    for (const leg of flown) {
      expect(leg.gsKt).toBeLessThanOrEqual(180);
    }
    // VTN → TENUT: 16 NM. A la GS de planilla (360 kt) serian 2,7 min; a 180 kt, 5,3.
    const tenut = flight.legs.find((l) => l.fix === 'TENUT')!;
    expect(tenut.gsKt).toBe(180);
    expect(tenut.speedCapped).toBe(true);
    expect(tenut.legTimeMin).toBeCloseTo((tenut.legDistNm / 180) * 60, 3);
  });

  it('un jet da las mismas horas con y sin tope en todos los procedimientos', () => {
    for (const procedure of procedures) {
      if (procedure.legs.some((l) => l.distToEndNm === null)) continue;
      const options = {
        procedure,
        entryTime: parseHhmm('1100'),
        cruiseLevelFt: toFeet(240),
        performance,
        holdings,
      };
      const free = computeFlightPlan(options);
      const capped = computeFlightPlan({ ...options, speedCapKt: 440 });
      if (!free.ok || !capped.ok) continue;
      expect(capped.legs.map((l) => l.eto)).toEqual(free.legs.map((l) => l.eto));
      expect(capped.legs.every((l) => l.speedCapped === false)).toBe(true);
    }
  });
});

describe('el tope en las instrucciones', () => {
  it('un cambio de nivel recalcula sin superar el tope', () => {
    const flight = cappedFlight('DHC6', 180, DHC6);
    const result = applyInstruction(
      scenarioWith(flight),
      {
        id: 'i1',
        time: parseHhmm('1150'),
        flightId: 'a',
        kind: 'LEVEL_CHANGE',
        fromFix: 'TENUT',
        levelFt: 9000,
      },
      { performance }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const leg of result.scenario.flights[0]!.legs) {
      expect(leg.gsKt).toBeLessThanOrEqual(180);
    }
  });

  it('rechaza una velocidad asignada fuera del rango del tipo', () => {
    const flight = cappedFlight('DHC6', 180, DHC6);
    const result = applyInstruction(
      scenarioWith(flight),
      {
        id: 'i1',
        time: parseHhmm('1150'),
        flightId: 'a',
        kind: 'SPEED_RESTRICTION',
        fromFix: 'TENUT',
        speedKt: 300,
      },
      { performance, aircraftTypes: [DHC6, A320] }
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('entre 150 y 180 kt');
  });

  it('con el tipo a medio cargar, la velocidad asignada no se valida', () => {
    const flight = cappedFlight('DHC6', 180, DHC6);
    const pending: AircraftType = { ...DHC6, minSpeedKt: null, maxSpeedKt: null };
    const result = applyInstruction(
      scenarioWith(flight),
      {
        id: 'i1',
        time: parseHhmm('1150'),
        flightId: 'a',
        kind: 'SPEED_RESTRICTION',
        fromFix: 'TENUT',
        speedKt: 300,
      },
      { performance, aircraftTypes: [pending] }
    );
    expect(result.ok).toBe(true);
  });

  it('acepta una velocidad asignada dentro del rango del tipo', () => {
    const flight = cappedFlight('DHC6', 180, DHC6);
    const result = applyInstruction(
      scenarioWith(flight),
      {
        id: 'i1',
        time: parseHhmm('1150'),
        flightId: 'a',
        kind: 'SPEED_RESTRICTION',
        fromFix: 'TENUT',
        speedKt: 160,
      },
      { performance, aircraftTypes: [DHC6, A320] }
    );
    expect(result.ok).toBe(true);
  });
});
