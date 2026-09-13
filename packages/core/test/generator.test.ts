/**
 * El generador se prueba por sus GARANTIAS, no por sus numeros.
 *
 * Un test que fije "con la semilla X sale LAN800 por UMKAL7C a las 1103" se rompe el dia que se
 * corrija una distancia en las planillas, y no habria descubierto nada: el ejercicio habria
 * cambiado porque los datos cambiaron, que es justo lo que se quiere. Lo que si tiene que
 * cumplirse pase lo que pase es esto:
 *
 *   - la misma semilla da el mismo ejercicio (sin eso no sirve para tomar pruebas);
 *   - el trafico es valido: sin indicativos repetidos, sin SSR repetidos, todo calculable;
 *   - el numero de encuentros pedido se cumple, o se dice claramente que no;
 *   - lo que no se puede hacer se rechaza con un motivo, no con un ejercicio a medias.
 */

import { describe, expect, it } from 'vitest';

import { generateTraffic } from '../src/generator.js';
import type { GeneratorCatalogue, GeneratorRequest } from '../src/generator.js';
import { encounters } from '../src/conflicts.js';
import type { DetectOptions } from '../src/conflicts.js';
import type { Conflict, ConflictReport } from '../src/types.js';

import proceduresDoc from '../../../data/procedures.json' with { type: 'json' };
import performanceDoc from '../../../data/performance.json' with { type: 'json' };
import holdingsDoc from '../../../data/holdings.json' with { type: 'json' };
import separationDoc from '../../../data/separation.json' with { type: 'json' };
import sampleFlightsDoc from '../../../data/sample-flights.json' with { type: 'json' };
import ssrDoc from '../../../data/ssr.json' with { type: 'json' };
import fixesDoc from '../../../data/fixes.json' with { type: 'json' };
import approachesDoc from '../../../data/approaches.json' with { type: 'json' };

/* eslint-disable @typescript-eslint/no-explicit-any */
const procedures = proceduresDoc.procedures as any[];

const catalogue: GeneratorCatalogue = {
  stars: procedures.filter((p) => p.type === 'STAR'),
  sids: procedures.filter((p) => p.type === 'SID'),
  templates: sampleFlightsDoc.sampleFlights as any[],
  ssrCodes: (ssrDoc.blocks as any[]).flatMap((b) => b.codes as string[]),
  performance: performanceDoc.performance as any,
  holdings: holdingsDoc.holdings as any[],
};

const detect: DetectOptions = {
  separation: separationDoc.separation as any[],
  approachFixes: [
    ...new Set(
      (approachesDoc.approaches as any[])
        .map((a) => a.iaf as string | null)
        .filter((iaf): iaf is string => iaf !== null)
    ),
  ],
  tmaFixes: (fixesDoc.fixes as any[]).filter((f) => f.scope === 'TMA').map((f) => f.ident as string),
  runwayInUse: '17L',
  sivigats: true,
  lvp: false,
};

const base: GeneratorRequest = {
  seed: 'BASE',
  arrivals: 5,
  departures: 1,
  targetEncounters: 2,
  startTime: 11 * 60,
  spreadMin: 12,
  focusFix: null,
  geometry: null,
};

const generate = (patch: Partial<GeneratorRequest> = {}) =>
  generateTraffic({ ...base, ...patch }, catalogue, detect);

describe('generateTraffic — reproducibilidad', () => {
  it('la misma semilla produce exactamente el mismo ejercicio', () => {
    const a = generate({ seed: 'PRUEBA-01' });
    const b = generate({ seed: 'PRUEBA-01' });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.flights).toEqual(b.flights);
  });

  it('semillas distintas producen ejercicios distintos', () => {
    const a = generate({ seed: 'ALFA' });
    const b = generate({ seed: 'BRAVO' });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.flights).not.toEqual(b.flights);
  });

  it('sin semilla devuelve la que uso, y repetirla reproduce el ejercicio', () => {
    const first = generate({ seed: '' });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.seed).not.toBe('');

    const again = generate({ seed: first.seed });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.flights).toEqual(first.flights);
  });
});

describe('generateTraffic — trafico valido', () => {
  it('respeta cuantas llegadas y cuantas salidas se pidieron', () => {
    const r = generate({ arrivals: 4, departures: 2, targetEncounters: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.flights.filter((f) => f.kind === 'ARRIVAL')).toHaveLength(4);
    expect(r.flights.filter((f) => f.kind === 'DEPARTURE')).toHaveLength(2);
  });

  it('las llegadas llegan a SCEL y las salidas salen de SCEL', () => {
    const r = generate({ arrivals: 4, departures: 3, targetEncounters: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const f of r.flights) {
      if (f.kind === 'ARRIVAL') expect(f.ades).toBe('SCEL');
      else expect(f.adep).toBe('SCEL');
    }
  });

  it('la llegada va por una STAR y la salida por una SID', () => {
    const stars = new Set(catalogue.stars.map((p) => p.ident));
    const sids = new Set(catalogue.sids.map((p) => p.ident));
    const r = generate({ arrivals: 4, departures: 3, targetEncounters: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const f of r.flights) {
      const expected = f.kind === 'ARRIVAL' ? stars : sids;
      expect(expected.has(f.procedureIdent)).toBe(true);
    }
  });

  it('no repite indicativo ni codigo SSR', () => {
    // Dos aeronaves con el mismo codigo no se distinguen en pantalla, y dos con el mismo
    // indicativo no se distinguen en frecuencia. Ninguna de las dos cosas puede salir sorteada.
    for (const seed of ['S1', 'S2', 'S3', 'S4', 'S5']) {
      const r = generate({ seed, arrivals: 6, departures: 3, targetEncounters: 2 });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(new Set(r.flights.map((f) => f.callsign)).size).toBe(r.flights.length);
      expect(new Set(r.flights.map((f) => f.ssr)).size).toBe(r.flights.length);
    }
  });

  it('todos los vuelos entran dentro de la ventana pedida', () => {
    const r = generate({ startTime: 14 * 60, spreadMin: 8, targetEncounters: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const f of r.flights) {
      expect(f.entryTime).toBeGreaterThanOrEqual(14 * 60);
      expect(f.entryTime).toBeLessThanOrEqual(14 * 60 + 8);
      // Al minuto entero: una hora de paso con decimales no se escribe en una strip.
      expect(Number.isInteger(f.entryTime)).toBe(true);
    }
  });

  it('solo usa procedimientos que el motor puede calcular entero', () => {
    const usable = new Map(
      [...catalogue.stars, ...catalogue.sids].map((p) => [p.ident, p] as const)
    );
    const r = generate({ arrivals: 6, departures: 3, targetEncounters: 2 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const f of r.flights) {
      const procedure = usable.get(f.procedureIdent);
      expect(procedure).toBeDefined();
      expect(procedure!.legs.every((l) => l.distToEndNm !== null)).toBe(true);
    }
  });

  it('el nivel de entrada respeta la restriccion publicada del primer fix', () => {
    // UMKAL7C dice 24000/24000 sobre UMKAL. Sortear FL280 ahi daria una ficha que dice una cosa
    // y un perfil que hace otra, porque el motor recorta igual.
    const r = generate({ arrivals: 6, departures: 0, targetEncounters: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const f of r.flights) {
      const procedure = catalogue.stars.find((p) => p.ident === f.procedureIdent);
      const first = procedure?.legs[0];
      const published = first?.maxAltFt ?? first?.minAltFt;
      if (published !== undefined) expect(f.levelFl).toBe(Math.round(published / 100));
    }
  });
});

describe('generateTraffic — el objetivo de encuentros', () => {
  it('cero encuentros da trafico limpio', () => {
    const r = generate({ targetEncounters: 0 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.encounters).toHaveLength(0);
    expect(r.matched).toBe(true);
  });

  it.each([1, 2, 3])('acierta el objetivo de %i encuentros', (target) => {
    const r = generate({ seed: `OBJ${target}`, arrivals: 6, departures: 1, targetEncounters: target });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.matched).toBe(true);
    expect(r.encounters).toHaveLength(target);
  });

  it('cuando no llega, lo dice en vez de entregar el objetivo como cumplido', () => {
    // Tres vuelos dan como mucho tres pares. Ocho es imposible y hay que decirlo.
    const r = generate({ arrivals: 3, departures: 0, targetEncounters: 8 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.matched).toBe(false);
    expect(r.shortfall.join(' ')).toContain('8');
  });

  it('el informe que devuelve es el del trafico que devuelve', () => {
    const r = generate({ targetEncounters: 2 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(encounters(r.report)).toHaveLength(r.encounters.length);
  });

  it('arrastra el aviso de minimas provisionales, como el resto de la aplicacion', () => {
    // El generador no puede blanquear un ejercicio: si se midio con valores que no son de ATC,
    // el informe lo dice igual que en el editor.
    const r = generate({ targetEncounters: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.report.notes.join(' ')).toContain('P-03');
  });
});

describe('generateTraffic — las indicaciones especificas', () => {
  it('pone el encuentro sobre el punto pedido', () => {
    const r = generate({ seed: 'FOCO', arrivals: 6, departures: 0, targetEncounters: 1, focusFix: 'PUMAR' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.matched).toBe(true);
    expect(r.encounters.some((e) => e.conflicts.some((c) => c.fix === 'PUMAR'))).toBe(true);
  });

  it('rechaza un punto por el que no pasa ningun procedimiento calculable', () => {
    const r = generate({ focusFix: 'NOEXISTE' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain('NOEXISTE');
  });

  it('busca la geometria pedida', () => {
    const r = generate({ seed: 'GEOM', arrivals: 6, departures: 0, targetEncounters: 2, geometry: 'IN_TRAIL' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.encounters.some((e) => e.kind === 'IN_TRAIL')).toBe(true);
  });
});

describe('generateTraffic — lo que no se puede hacer', () => {
  it('sin vuelos no hay ejercicio', () => {
    const r = generate({ arrivals: 0, departures: 0 });
    expect(r.ok).toBe(false);
  });

  it('un vuelo solo no puede tener un encuentro', () => {
    const r = generate({ arrivals: 1, departures: 0, targetEncounters: 1 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain('dos vuelos');
  });

  it('no se piden mas vuelos de los que hay en el catalogo', () => {
    const r = generate({ arrivals: 500 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain('catálogo');
  });
});

describe('encounters — agrupar por par de vuelos', () => {
  const conflict = (
    id: string,
    flightIds: readonly [string, string],
    fix: string,
    time: number,
    severity: Conflict['severity'] = 'LOSS'
  ): Conflict => ({
    id,
    kind: 'IN_TRAIL',
    severity,
    fix,
    time,
    flightIds,
    verticalFt: 0,
    timeGapMin: 1,
    appliedMinimum: { value: 5, unit: 'MIN', source: 'test' },
    description: '',
  });

  const report = (conflicts: Conflict[]): ConflictReport => ({
    conflicts,
    coverage: 'approachOnly',
    notes: [],
  });

  it('seis conflictos del mismo par son UN encuentro', () => {
    const fixes = ['UMKAL', 'UGOLA', 'EL220', 'PUMAR', 'TEGEB', 'DOSAL'];
    const found = encounters(
      report(fixes.map((f, i) => conflict(`c${i}`, ['a', 'b'], f, 600 + i)))
    );
    expect(found).toHaveLength(1);
    expect(found[0]!.conflicts).toHaveLength(6);
    // El encuentro empieza donde empieza: es el punto en el que habia que haber hecho algo.
    expect(found[0]!.firstFix).toBe('UMKAL');
    expect(found[0]!.firstTime).toBe(600);
  });

  it('el par se identifica igual en cualquier orden', () => {
    const found = encounters(
      report([conflict('c1', ['a', 'b'], 'TEGEB', 600), conflict('c2', ['b', 'a'], 'PUMAR', 610)])
    );
    expect(found).toHaveLength(1);
  });

  it('un solo punto perdido basta para que el encuentro sea perdida', () => {
    const found = encounters(
      report([
        conflict('c1', ['a', 'b'], 'PUMAR', 600, 'MARGINAL'),
        conflict('c2', ['a', 'b'], 'TEGEB', 610, 'LOSS'),
      ])
    );
    expect(found[0]!.severity).toBe('LOSS');
  });

  it('los encuentros salen en orden de aparicion', () => {
    const found = encounters(
      report([
        conflict('c1', ['c', 'd'], 'TEGEB', 700),
        conflict('c2', ['a', 'b'], 'PUMAR', 600),
      ])
    );
    expect(found.map((e) => e.firstTime)).toEqual([600, 700]);
  });
});
