/**
 * Carga la base de navegacion desde data/*.json y la deja tipada y saneada.
 *
 * Los JSON se importan en tiempo de build: la app no pide nada por red y funciona offline.
 * Si algun dia hay servidor, este modulo es el unico que cambia.
 */

import type {
  Airway,
  Coordinates,
  AircraftType,
  Fix,
  HoldingPattern,
  PerformanceTable,
  Procedure,
  Runway,
  SeparationMinimum,
} from '@atcsims/core';

import fixesDoc from '../../../data/fixes.json' with { type: 'json' };
import proceduresDoc from '../../../data/procedures.json' with { type: 'json' };
import airwaysDoc from '../../../data/airways.json' with { type: 'json' };
import runwaysDoc from '../../../data/runways.json' with { type: 'json' };
import performanceDoc from '../../../data/performance.json' with { type: 'json' };
import holdingsDoc from '../../../data/holdings.json' with { type: 'json' };
import separationDoc from '../../../data/separation.json' with { type: 'json' };
import aircraftTypesDoc from '../../../data/aircraft-types.json' with { type: 'json' };
import approachesDoc from '../../../data/approaches.json' with { type: 'json' };

import { EXCLUDED_AIRWAYS, EXCLUDED_FIXES, EXCLUDED_PROCEDURES } from './sanitize.js';

export * from './sanitize.js';

export const fixes = (fixesDoc.fixes as unknown as Fix[]).filter((f) => !EXCLUDED_FIXES.has(f.ident));

export const procedures = (proceduresDoc.procedures as unknown as Procedure[]).filter(
  (p) => !EXCLUDED_PROCEDURES.has(p.ident)
);

export const airways = (airwaysDoc.airways as unknown as Airway[]).filter(
  (a) => !EXCLUDED_AIRWAYS.has(a.ident)
);

export const runways = runwaysDoc.runways as unknown as Runway[];
export const performance = performanceDoc.performance as unknown as PerformanceTable;
export const holdings = holdingsDoc.holdings as unknown as HoldingPattern[];
export const separation = separationDoc.separation as unknown as SeparationMinimum[];
export const aircraftTypes = aircraftTypesDoc.aircraftTypes as unknown as AircraftType[];

/** Coordenadas por fix, para el directo. 61 de los 107 fixes las traen en null. */
export const coordinates: ReadonlyMap<string, Coordinates> = new Map(
  fixes.map((f) => [f.ident, { lat: f.lat, lon: f.lon }])
);

/** Fixes dentro del TMA, segun la columna scope de la base. Ahi separa el radar. */
export const tmaFixes: readonly string[] = fixes.filter((f) => f.scope === 'TMA').map((f) => f.ident);

/** Los IAF de las aproximaciones publicadas: donde rige la minima de aproximacion. */
export const approachFixes: readonly string[] = [
  ...new Set(
    (approachesDoc.approaches as unknown as { iaf: string | null }[])
      .map((a) => a.iaf)
      .filter((iaf): iaf is string => iaf !== null)
  ),
];

const fixIndex = new Map(fixes.map((f) => [f.ident, f]));
const procedureIndex = new Map(procedures.map((p) => [p.ident, p]));

export function findFix(ident: string): Fix | undefined {
  return fixIndex.get(ident);
}

export function findProcedure(ident: string): Procedure | undefined {
  return procedureIndex.get(ident);
}

export function proceduresOfType(type: 'STAR' | 'SID'): Procedure[] {
  return procedures.filter((p) => p.type === type);
}

/** Los procedimientos que el motor puede calcular: los que traen todas sus distancias. */
export function usableProcedures(): Procedure[] {
  return procedures.filter((p) => p.legs.every((leg) => leg.distToEndNm !== null));
}

// ------------------------------------------------------- catalogo para armar ejercicios

import sampleFlightsDoc from '../../../data/sample-flights.json' with { type: 'json' };
import ssrDoc from '../../../data/ssr.json' with { type: 'json' };

export interface SampleFlight {
  readonly callsign: string;
  readonly operator: string;
  readonly icaoType: string;
  readonly tasKt: number;
  readonly adep: string;
  readonly ades: string;
  readonly ssr: string;
}

/** Vuelos comerciales reales de la hoja ACFT. Es de donde el instructor saca los indicativos. */
export const sampleFlights = sampleFlightsDoc.sampleFlights as unknown as SampleFlight[];

/** El pool de transpondedor, aplanado. En la planilla viene en bloques de 8 consecutivos. */
export const ssrCodes: readonly string[] = (
  ssrDoc.blocks as unknown as { codes: string[] }[]
).flatMap((b) => b.codes);
