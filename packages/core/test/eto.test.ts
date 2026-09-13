/**
 * Criterio de aceptacion del proyecto (docs/REQUISITOS.md §11 y RNF-1):
 * el motor tiene que reproducir los numeros que la planilla ya calcula.
 *
 * Los valores de referencia no estan escritos a mano aqui: salen de `sourceTimeMin` y
 * `sourceTotalTimeMin` de data/procedures.json, que son los que el instructor uso.
 * Si alguien reimporta los Excel y un numero cambia, este test lo detecta.
 */

import { describe, expect, it } from 'vitest';

import { computeFlightPlan, formatHhmm, parseHhmm, toFeet } from '../src/index.js';
import type { PerformanceTable, Procedure } from '../src/index.js';

import proceduresDoc from '../../../data/procedures.json' with { type: 'json' };
import performanceDoc from '../../../data/performance.json' with { type: 'json' };

const procedures = proceduresDoc.procedures as unknown as Procedure[];
const performance = performanceDoc.performance as unknown as PerformanceTable;

const byIdent = (ident: string): Procedure => {
  const found = procedures.find((p) => p.ident === ident);
  if (!found) throw new Error(`No existe el procedimiento ${ident} en data/procedures.json`);
  return found;
};

/** Procedimientos cuyo perfil de velocidad quedo alineado al importar. */
const withSourceProfile = procedures.filter(
  (p) => p.sourceTotalTimeMin !== undefined && p.legs.some((l) => l.sourceGsKt !== undefined)
);

describe('computeFlightPlan contra los tiempos de la planilla', () => {
  it('encuentra procedimientos con perfil de velocidad de la planilla', () => {
    expect(withSourceProfile.length).toBeGreaterThan(0);
  });

  it.each(withSourceProfile.map((p) => [p.ident, p] as const))(
    '%s reproduce el tiempo total de la planilla',
    (_ident, procedure) => {
      const result = computeFlightPlan({
        procedure,
        entryTime: parseHhmm('1100'),
        cruiseLevelFt: toFeet(240),
        performance,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // La planilla omite el primer tramo en varias STAR, asi que su total cubre solo los
      // tramos que si tiene alineados: se suma exactamente esos mismos.
      const computed = result.legs
        .filter((_, i) => procedure.legs[i]!.sourceTimeMin !== undefined)
        .reduce((acc, leg) => acc + leg.legTimeMin, 0);

      expect(computed).toBeCloseTo(procedure.sourceTotalTimeMin!, 2);
    }
  );

  it.each(withSourceProfile.map((p) => [p.ident, p] as const))(
    '%s reproduce el tiempo de cada tramo',
    (_ident, procedure) => {
      const result = computeFlightPlan({
        procedure,
        entryTime: parseHhmm('1100'),
        cruiseLevelFt: toFeet(240),
        performance,
      });
      if (!result.ok) throw new Error(result.message);

      for (let i = 0; i < procedure.legs.length; i++) {
        const expected = procedure.legs[i]!.sourceTimeMin;
        if (expected === undefined) continue;
        expect(result.legs[i]!.legTimeMin).toBeCloseTo(expected, 2);
      }
    }
  );
});

describe('UMKAL7C en detalle', () => {
  const procedure = byIdent('UMKAL7C');

  it('recorre los siete fixes en orden', () => {
    const result = computeFlightPlan({
      procedure,
      entryTime: parseHhmm('1100'),
      cruiseLevelFt: toFeet(240),
      performance,
    });
    if (!result.ok) throw new Error(result.message);

    expect(result.legs.map((l) => l.fix)).toEqual([
      'UMKAL', 'LOSAN', 'SAFEL', 'UGOLA', 'EL220', 'PUMAR', 'TEGEB',
    ]);
  });

  it('da 14.035 minutos, el total de la planilla', () => {
    const result = computeFlightPlan({
      procedure,
      entryTime: parseHhmm('1100'),
      cruiseLevelFt: toFeet(240),
      performance,
    });
    if (!result.ok) throw new Error(result.message);
    expect(result.totalTimeMin).toBeCloseTo(14.035, 2);
  });

  it('cruza TEGEB a las 1114', () => {
    const result = computeFlightPlan({
      procedure,
      entryTime: parseHhmm('1100'),
      cruiseLevelFt: toFeet(240),
      performance,
    });
    if (!result.ok) throw new Error(result.message);
    const last = result.legs[result.legs.length - 1]!;
    expect(formatHhmm(last.eto)).toBe('1114');
  });

  it('desciende: la velocidad nunca sube a lo largo de la llegada', () => {
    const result = computeFlightPlan({
      procedure,
      entryTime: parseHhmm('1100'),
      cruiseLevelFt: toFeet(240),
      performance,
    });
    if (!result.ok) throw new Error(result.message);

    const speeds = result.legs.slice(1).map((l) => l.gsKt);
    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i]!).toBeLessThanOrEqual(speeds[i - 1]!);
    }
  });
});

describe('datos incompletos', () => {
  it('ASIMO7D no se calcula: se niega en vez de inventar la distancia que falta', () => {
    const asimo = procedures.find((p) => p.ident === 'ASIMO7D');
    expect(asimo).toBeDefined();

    const result = computeFlightPlan({
      procedure: asimo!,
      entryTime: parseHhmm('1100'),
      cruiseLevelFt: toFeet(240),
      performance,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('INCOMPLETE_DATA');
    expect(result.message).toContain('ASIMO7D');
  });
});
