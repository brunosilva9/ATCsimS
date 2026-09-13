/**
 * Escenario de prueba armado desde data/, no a mano.
 *
 * Dos llegadas que comparten la cola UGOLA > EL220 > PUMAR > TEGEB y entran con tres minutos de
 * diferencia: es el caso que el instructor plantea en clase y el que tienen que resolver tanto
 * la deteccion de conflictos como las instrucciones.
 */

import { computeFlightPlan, parseHhmm, toFeet } from '../src/index.js';
import type {
  Coordinates,
  Flight,
  HoldingPattern,
  PerformanceTable,
  Procedure,
  Scenario,
  SeparationMinimum,
} from '../src/index.js';

import proceduresDoc from '../../../data/procedures.json' with { type: 'json' };
import performanceDoc from '../../../data/performance.json' with { type: 'json' };
import holdingsDoc from '../../../data/holdings.json' with { type: 'json' };
import separationDoc from '../../../data/separation.json' with { type: 'json' };
import fixesDoc from '../../../data/fixes.json' with { type: 'json' };

export const performance = performanceDoc.performance as unknown as PerformanceTable;
export const holdings = holdingsDoc.holdings as unknown as HoldingPattern[];
export const separation = separationDoc.separation as unknown as SeparationMinimum[];

const procedures = proceduresDoc.procedures as unknown as Procedure[];

export const coordinates: ReadonlyMap<string, Coordinates> = new Map(
  (fixesDoc.fixes as unknown as { ident: string; lat: number | null; lon: number | null }[]).map(
    (f) => [f.ident, { lat: f.lat, lon: f.lon }]
  )
);

/** Fixes dentro del TMA: donde separa el radar en vez de la minima procedimental de ruta. */
export const tmaFixes: readonly string[] = (
  fixesDoc.fixes as unknown as { ident: string; scope: string }[]
)
  .filter((f) => f.scope === 'TMA')
  .map((f) => f.ident);

export function procedureByIdent(ident: string): Procedure {
  const found = procedures.find((p) => p.ident === ident);
  if (!found) throw new Error(`No existe ${ident} en data/procedures.json`);
  return found;
}

export function makeFlight(
  id: string,
  callsign: string,
  procedureIdent: string,
  entry: string,
  levelFl: number
): Flight {
  const procedure = procedureByIdent(procedureIdent);
  const entryTime = parseHhmm(entry);
  const result = computeFlightPlan({
    procedure,
    entryTime,
    cruiseLevelFt: toFeet(levelFl),
    performance,
    holdings,
  });
  if (!result.ok) throw new Error(result.message);

  return {
    id,
    callsign,
    ssr: '2506',
    icaoType: 'A320',
    registration: null,
    tasKt: 440,
    adep: 'SCFA',
    ades: 'SCEL',
    kind: 'ARRIVAL',
    procedureIdent,
    airway: null,
    cruiseLevelFt: toFeet(levelFl),
    entryTime,
    transferFix: result.legs[result.legs.length - 1]?.fix ?? null,
    legs: result.legs,
  };
}

/** Dos llegadas en conflicto: cruzan UGOLA, EL220 y TEGEB al mismo minuto y al mismo nivel. */
export function conflictScenario(): Scenario {
  return {
    id: 'test',
    name: 'Dos llegadas convergiendo a TEGEB',
    configuration: 'SUR',
    runwayInUse: '17L',
    sivigats: true,
    startTime: parseHhmm('1100'),
    durationMin: 20,
    weather: {
      qnhHpa: 1013,
      transitionLevel: 'FL150',
      vmc: true,
      visibilityM: 9999,
      ceilingFt: null,
      lvp: false,
    },
    objective: 'Separar dos llegadas que confluyen en UGOLA.',
    flights: [
      makeFlight('a', 'LAN705', 'UMKAL7C', '1100', 240),
      makeFlight('b', 'SKU621', 'VENTANAS1D', '1103', 200),
    ],
  };
}
