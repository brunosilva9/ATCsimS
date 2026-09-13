/**
 * Instrucciones y recalculo.
 *
 * Lo que se comprueba una y otra vez aqui es la invariante del ejercicio: la estimada original
 * sobrevive a todo. Si `eto` cambiara, el alumno perderia la referencia contra la que se mide.
 */

import { describe, expect, it } from 'vitest';

import { applyInstruction, applyInstructions, formatHhmm, parseHhmm } from '../src/index.js';
import type { Instruction, Scenario } from '../src/index.js';

import { conflictScenario, coordinates, performance } from './fixtures.js';

const context = { performance, coordinates };

const flightOf = (scenario: Scenario, id: string) => {
  const f = scenario.flights.find((x) => x.id === id);
  if (!f) throw new Error(`No hay vuelo ${id}`);
  return f;
};

const legOf = (scenario: Scenario, id: string, fix: string) => {
  const leg = flightOf(scenario, id).legs.find((l) => l.fix === fix);
  if (!leg) throw new Error(`${id} no pasa por ${fix}`);
  return leg;
};

const base = (): Instruction => ({
  id: 'i1',
  time: parseHhmm('1105'),
  flightId: 'a',
  kind: 'SPEED_RESTRICTION',
  fromFix: 'UGOLA',
  speedKt: 180,
});

describe('la estimada original no se toca nunca', () => {
  const scenario = conflictScenario();
  const original = flightOf(scenario, 'a').legs.map((l) => l.eto);

  it('tras una restriccion de velocidad', () => {
    const result = applyInstruction(scenario, base(), context);
    if (!result.ok) throw new Error(result.message);
    expect(flightOf(result.scenario, 'a').legs.map((l) => l.eto)).toEqual(original);
  });

  it('tras un cambio de nivel', () => {
    const result = applyInstruction(
      scenario,
      { ...base(), kind: 'LEVEL_CHANGE', levelFt: 9000 },
      context
    );
    if (!result.ok) throw new Error(result.message);
    expect(flightOf(result.scenario, 'a').legs.map((l) => l.eto)).toEqual(original);
  });

  it('tras dos instrucciones encadenadas', () => {
    const result = applyInstructions(
      scenario,
      [base(), { ...base(), id: 'i2', time: parseHhmm('1108'), kind: 'HOLD', fromFix: 'PUMAR', holdMinutes: 4 }],
      context
    );
    if (!result.ok) throw new Error(result.message);
    expect(flightOf(result.scenario, 'a').legs.map((l) => l.eto)).toEqual(original);
  });
});

describe('restriccion de velocidad', () => {
  const scenario = conflictScenario();

  it('retrasa los puntos posteriores al fix de la instruccion', () => {
    const before = legOf(scenario, 'a', 'TEGEB').eto;
    const result = applyInstruction(scenario, base(), context);
    if (!result.ok) throw new Error(result.message);

    const after = legOf(result.scenario, 'a', 'TEGEB');
    expect(after.revisedEto).not.toBeNull();
    expect(after.revisedEto!).toBeGreaterThan(before);
  });

  it('no toca lo que ya quedo atras', () => {
    const result = applyInstruction(scenario, base(), context);
    if (!result.ok) throw new Error(result.message);
    // UGOLA es el fix de la instruccion: el tramo que llega hasta ahi ya se volo.
    for (const fix of ['UMKAL', 'LOSAN', 'SAFEL', 'UGOLA']) {
      expect(legOf(result.scenario, 'a', fix).revisedEto).toBeNull();
    }
  });

  it('aplica la velocidad asignada, no la de la tabla', () => {
    const result = applyInstruction(scenario, base(), context);
    if (!result.ok) throw new Error(result.message);
    expect(legOf(result.scenario, 'a', 'PUMAR').gsKt).toBe(180);
  });

  it('mas lento siempre es mas tarde', () => {
    const slow = applyInstruction(scenario, { ...base(), speedKt: 160 }, context);
    const fast = applyInstruction(scenario, { ...base(), speedKt: 250 }, context);
    if (!slow.ok || !fast.ok) throw new Error('no se aplicaron');
    expect(legOf(slow.scenario, 'a', 'TEGEB').revisedEto!).toBeGreaterThan(
      legOf(fast.scenario, 'a', 'TEGEB').revisedEto!
    );
  });
});

describe('espera', () => {
  it('retrasa el fix y todo lo que viene detras exactamente los minutos pedidos', () => {
    const scenario = conflictScenario();
    const beforeHold = legOf(scenario, 'a', 'EL220').eto;
    const beforeEnd = legOf(scenario, 'a', 'TEGEB').eto;

    const result = applyInstruction(
      scenario,
      { ...base(), kind: 'HOLD', fromFix: 'EL220', holdMinutes: 6 },
      context
    );
    if (!result.ok) throw new Error(result.message);

    expect(legOf(result.scenario, 'a', 'EL220').revisedEto).toBe(beforeHold + 6);
    expect(legOf(result.scenario, 'a', 'TEGEB').revisedEto).toBe(beforeEnd + 6);
  });

  it('sin minutos no se aplica', () => {
    const result = applyInstruction(
      conflictScenario(),
      { ...base(), kind: 'HOLD', fromFix: 'EL220' },
      context
    );
    expect(result.ok).toBe(false);
  });
});

describe('vectores', () => {
  it('alargan el tramo siguiente y retrasan el resto', () => {
    const scenario = conflictScenario();
    const before = legOf(scenario, 'a', 'TEGEB').eto;
    const result = applyInstruction(
      scenario,
      { ...base(), kind: 'VECTOR', fromFix: 'UGOLA', extraTrackNm: 12 },
      context
    );
    if (!result.ok) throw new Error(result.message);
    expect(legOf(result.scenario, 'a', 'TEGEB').revisedEto!).toBeGreaterThan(before);
  });
});

describe('directo', () => {
  it('adelanta la llegada cuando hay coordenadas', () => {
    const scenario = conflictScenario();
    const before = legOf(scenario, 'a', 'TEGEB').eto;
    const result = applyInstruction(
      scenario,
      { ...base(), kind: 'DIRECT', fromFix: 'LOSAN', targetFix: 'PUMAR' },
      context
    );
    if (!result.ok) throw new Error(result.message);

    const legs = flightOf(result.scenario, 'a').legs;
    // Los puntos intermedios se caen del plan.
    expect(legs.map((l) => l.fix)).not.toContain('UGOLA');
    expect(legOf(result.scenario, 'a', 'TEGEB').revisedEto!).toBeLessThan(before);
  });

  it('se niega si al fix le falta la coordenada, en vez de estimar la distancia', () => {
    const result = applyInstruction(
      conflictScenario(),
      { ...base(), kind: 'DIRECT', fromFix: 'LOSAN', targetFix: 'EL220' },
      context
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('INCOMPLETE_DATA');
    expect(result.message).toContain('EL220');
  });

  it('sin mapa de coordenadas tampoco inventa nada', () => {
    const result = applyInstruction(
      conflictScenario(),
      { ...base(), kind: 'DIRECT', fromFix: 'LOSAN', targetFix: 'PUMAR' },
      { performance }
    );
    expect(result.ok).toBe(false);
  });
});

describe('transferencia', () => {
  it('marca el punto de traspaso sin cambiar ninguna hora', () => {
    const scenario = conflictScenario();
    const result = applyInstruction(
      scenario,
      { ...base(), kind: 'TRANSFER', fromFix: 'PUMAR' },
      context
    );
    if (!result.ok) throw new Error(result.message);
    expect(flightOf(result.scenario, 'a').transferFix).toBe('PUMAR');
    expect(flightOf(result.scenario, 'a').legs.map((l) => l.revisedEto)).toEqual(
      flightOf(scenario, 'a').legs.map((l) => l.revisedEto)
    );
  });
});

describe('instrucciones que no se pueden aplicar', () => {
  it('a un vuelo que no existe', () => {
    const result = applyInstruction(conflictScenario(), { ...base(), flightId: 'zz' }, context);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('UNKNOWN_FLIGHT');
  });

  it('sobre un fix por el que el vuelo no pasa', () => {
    const result = applyInstruction(conflictScenario(), { ...base(), fromFix: 'KADAK' }, context);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('UNKNOWN_FIX');
  });

  it('la cadena se corta en la primera que falla', () => {
    const result = applyInstructions(
      conflictScenario(),
      [base(), { ...base(), id: 'i2', fromFix: 'KADAK' }],
      context
    );
    expect(result.ok).toBe(false);
  });
});

describe('sin fix de referencia', () => {
  it('aplica desde el proximo punto que el vuelo no ha cruzado', () => {
    const scenario = conflictScenario();
    // LAN705 cruza UMKAL a las 1100 y LOSAN a las 1104: a las 1102 el proximo es LOSAN.
    const result = applyInstruction(
      scenario,
      { ...base(), fromFix: null, time: parseHhmm('1102'), speedKt: 200 },
      context
    );
    if (!result.ok) throw new Error(result.message);
    expect(formatHhmm(legOf(scenario, 'a', 'LOSAN').eto)).toBe('1104');
    expect(legOf(result.scenario, 'a', 'LOSAN').revisedEto).toBeNull();
    expect(legOf(result.scenario, 'a', 'SAFEL').revisedEto).not.toBeNull();
  });
});
