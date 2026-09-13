/**
 * El perfil vertical.
 *
 * Estos tests existen porque el motor llego a producir llegadas que bajaban a 5000 ft a mitad
 * de camino y volvian a subir a 8000 para cumplir un MCL, y salidas que despegaban ya a
 * 10000 ft. Ninguno de los tests de horas lo detectaba: los tiempos salian bien porque los
 * siete procedimientos con perfil de planilla traen su propia GS por tramo.
 *
 * Lo que se comprueba aqui no es un numero copiado: es que el perfil sea coherente con lo que
 * la base publica.
 */

import { describe, expect, it } from 'vitest';

import { computeFlightPlan, parseHhmm, toFeet } from '../src/index.js';
import type { HoldingPattern, PerformanceTable, Procedure } from '../src/index.js';

import proceduresDoc from '../../../data/procedures.json' with { type: 'json' };
import performanceDoc from '../../../data/performance.json' with { type: 'json' };
import holdingsDoc from '../../../data/holdings.json' with { type: 'json' };

const performance = performanceDoc.performance as unknown as PerformanceTable;
const holdings = holdingsDoc.holdings as unknown as HoldingPattern[];

/** Los que el motor puede calcular: los que traen todas sus distancias. */
const usable = (proceduresDoc.procedures as unknown as Procedure[]).filter((p) =>
  p.legs.every((l) => l.distToEndNm !== null)
);

const stars = usable.filter((p) => p.type === 'STAR');
const sids = usable.filter((p) => p.type === 'SID');

const plan = (procedure: Procedure, levelFl = 240) => {
  const result = computeFlightPlan({
    procedure,
    entryTime: parseHhmm('1100'),
    cruiseLevelFt: toFeet(levelFl),
    performance,
    holdings,
  });
  if (!result.ok) throw new Error(result.message);
  return result;
};

const mclOf = (fix: string): number | null => {
  const h = holdings.find((x) => x.fix === fix);
  return h ? h.mclFt ?? h.lowerLevelFt : null;
};

describe('las llegadas bajan y solo bajan', () => {
  it('hay STAR calculables', () => {
    expect(stars.length).toBeGreaterThan(0);
  });

  it.each(stars.map((p) => [p.ident, p] as const))('%s nunca sube', (_ident, procedure) => {
    const levels = plan(procedure).legs.map((l) => l.levelFt ?? 0);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]!).toBeLessThanOrEqual(levels[i - 1]!);
    }
  });

  it.each(stars.map((p) => [p.ident, p] as const))(
    '%s no entra por encima del nivel de crucero',
    (_ident, procedure) => {
      const first = plan(procedure).legs[0]!;
      expect(first.levelFt!).toBeLessThanOrEqual(toFeet(240));
    }
  );

  it.each(stars.map((p) => [p.ident, p] as const))(
    '%s respeta el MCL publicado de cada fix que lo tiene',
    (_ident, procedure) => {
      for (const leg of plan(procedure).legs) {
        const mcl = mclOf(leg.fix);
        if (mcl === null) continue;
        expect(leg.levelFt!).toBeGreaterThanOrEqual(mcl);
      }
    }
  );
});

describe('las salidas suben y solo suben', () => {
  it.each(sids.map((p) => [p.ident, p] as const))('%s nunca baja', (_ident, procedure) => {
    const levels = plan(procedure).legs.map((l) => l.levelFt ?? 0);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]!).toBeGreaterThanOrEqual(levels[i - 1]!);
    }
  });

  it.each(sids.map((p) => [p.ident, p] as const))(
    '%s arranca por debajo de 10000 ft: el MCL de AMB es para quien llega, no para quien sale',
    (_ident, procedure) => {
      expect(plan(procedure).legs[0]!.levelFt!).toBeLessThan(10000);
    }
  );

  it('declara que la elevacion del aerodromo no esta en la base', () => {
    const result = plan(sids[0]!);
    expect(result.assumptions.join(' ')).toContain('elevacion del aerodromo');
  });
});

describe('UMKAL7C, perfil contra lo publicado', () => {
  const procedure = stars.find((p) => p.ident === 'UMKAL7C')!;

  it('entra a FL240 sobre UMKAL, que es lo que exige la hoja 05_STAR', () => {
    const first = plan(procedure).legs[0]!;
    expect(first.fix).toBe('UMKAL');
    expect(first.levelFt).toBe(24000);
  });

  it('cruza UGOLA a 8000 y PUMAR a 7000, los dos niveles publicados', () => {
    const legs = plan(procedure).legs;
    expect(legs.find((l) => l.fix === 'UGOLA')?.levelFt).toBe(8000);
    expect(legs.find((l) => l.fix === 'PUMAR')?.levelFt).toBe(7000);
  });

  it('termina a 5000 sobre TEGEB, el MCL de la tabla de esperas', () => {
    const legs = plan(procedure).legs;
    expect(mclOf('TEGEB')).toBe(5000);
    expect(legs[legs.length - 1]!.levelFt).toBe(5000);
  });

  it('sin tabla de esperas no se inventa el nivel final: lo declara', () => {
    const result = computeFlightPlan({
      procedure,
      entryTime: parseHhmm('1100'),
      cruiseLevelFt: toFeet(240),
      performance,
    });
    if (!result.ok) throw new Error(result.message);
    expect(result.assumptions.join(' ')).toContain('TEGEB');
  });
});
