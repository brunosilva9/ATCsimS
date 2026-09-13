/**
 * Deteccion de conflictos.
 *
 * El escenario de prueba es el caso de clase: dos llegadas por STAR distintas que confluyen en
 * UGOLA y siguen juntas hasta TEGEB. Si el detector no lo ve, no sirve para nada.
 */

import { describe, expect, it } from 'vitest';

import { applyInstruction, detectConflicts, parseHhmm } from '../src/index.js';
import type { DetectOptions, Instruction } from '../src/index.js';

import { conflictScenario, performance, separation, tmaFixes } from './fixtures.js';

const options: DetectOptions = {
  separation,
  approachFixes: ['TEGEB', 'PADOP', 'PEFOR'],
  tmaFixes,
  runwayInUse: '17L',
  sivigats: true,
  lvp: false,
};

describe('el caso de clase', () => {
  const report = detectConflicts(conflictScenario(), options);

  it('detecta que los dos vuelos confluyen', () => {
    expect(report.conflicts.length).toBeGreaterThan(0);
  });

  it('lo detecta en UGOLA, donde se juntan las dos llegadas', () => {
    expect(report.conflicts.map((c) => c.fix)).toContain('UGOLA');
  });

  it('lo llama cruce: llegan por ramas distintas', () => {
    const ugola = report.conflicts.find((c) => c.fix === 'UGOLA');
    expect(ugola?.kind).toBe('CROSSING');
  });

  it('en TEGEB ya van en fila: vienen los dos de PUMAR', () => {
    const tegeb = report.conflicts.find((c) => c.fix === 'TEGEB');
    expect(tegeb?.kind).toBe('IN_TRAIL');
  });

  it('cada conflicto dice con que minima se midio y de donde salio', () => {
    for (const c of report.conflicts) {
      expect(c.appliedMinimum.source).toBeTruthy();
      expect(c.appliedMinimum.value).toBeGreaterThan(0);
    }
  });

  it('los ordena por hora', () => {
    const times = report.conflicts.map((c) => c.time);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

describe('no se declara limpio sin decir con que se midio', () => {
  it('avisa de que las minimas en ruta son provisionales', () => {
    const report = detectConflicts(conflictScenario(), options);
    expect(report.coverage).toBe('approachOnly');
    expect(report.notes.join(' ')).toContain('P-03');
  });

  it('usa la minima de la base en el IAF, no la provisional', () => {
    const report = detectConflicts(conflictScenario(), options);
    const tegeb = report.conflicts.find((c) => c.fix === 'TEGEB');
    expect(tegeb?.appliedMinimum.source).toContain('data/separation.json');
  });

  it('usa la provisional fuera del IAF, y lo dice', () => {
    const report = detectConflicts(conflictScenario(), options);
    const ugola = report.conflicts.find((c) => c.fix === 'UGOLA');
    expect(ugola?.appliedMinimum.source).toContain('Provisional');
  });
});

describe('separacion vertical', () => {
  it('mil pies limpian el conflicto sin tocar las horas', () => {
    const scenario = conflictScenario();
    const before = detectConflicts(scenario, options).conflicts.length;

    // SKU621 baja a 9000 mientras LAN705 sigue a 8000 sobre UGOLA.
    const climb: Instruction = {
      id: 'i1',
      time: parseHhmm('1105'),
      flightId: 'b',
      kind: 'LEVEL_CHANGE',
      fromFix: 'OLMUE',
      levelFt: 12000,
    };
    const applied = applyInstruction(scenario, climb, { performance });
    if (!applied.ok) throw new Error(applied.message);

    const after = detectConflicts(applied.scenario, options).conflicts.length;
    expect(after).toBeLessThan(before);
  });
});

describe('una espera resuelve el conflicto', () => {
  it('separar en el tiempo hace desaparecer el conflicto en TEGEB', () => {
    const scenario = conflictScenario();
    const before = detectConflicts(scenario, options).conflicts;
    expect(before.some((c) => c.fix === 'TEGEB')).toBe(true);

    const hold: Instruction = {
      id: 'i1',
      time: parseHhmm('1104'),
      flightId: 'b',
      kind: 'HOLD',
      fromFix: 'OLMUE',
      holdMinutes: 10,
    };
    const applied = applyInstruction(scenario, hold, { performance });
    if (!applied.ok) throw new Error(applied.message);

    const after = detectConflicts(applied.scenario, options).conflicts;
    expect(after.some((c) => c.fix === 'TEGEB')).toBe(false);
  });
});

describe('un escenario de un solo vuelo no tiene conflictos', () => {
  it('no inventa pares', () => {
    const scenario = conflictScenario();
    const single = { ...scenario, flights: [scenario.flights[0]!] };
    expect(detectConflicts(single, options).conflicts).toHaveLength(0);
  });
});
