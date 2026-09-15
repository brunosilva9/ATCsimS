/**
 * La base de navegacion, leida de Firestore una vez por sesion.
 *
 * Antes esto era `@atcsims/navdata` importando data/*.json en tiempo de build. Ahora Firestore es
 * la fuente viva (espejada originalmente desde esos mismos JSON con tools/upload-firestore.js,
 * pero editable desde /admin sin volver a compilar). La estrategia sigue siendo la misma que
 * antes: se trae TODO una vez (aca, en `loadAll`) y de ahi en mas el resto de la app lee arrays
 * sincronicos en memoria, igual que siempre — la unica diferencia es de donde salió esa foto.
 *
 * `packages/navdata` no se toca: sigue siendo el import estatico de los JSON, y lo siguen usando
 * los tests y las herramientas, que no tienen por que depender de un proyecto de Firebase real.
 */

import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { create } from 'zustand';

import type {
  AircraftType,
  Airway,
  Coordinates,
  Fix,
  HoldingPattern,
  PerformanceTable,
  Procedure,
  Runway,
  SeparationMinimum,
} from '@atcsims/core';
import { EXCLUDED_AIRWAYS, EXCLUDED_FIXES, EXCLUDED_PROCEDURES } from '@atcsims/navdata';
import type { SampleFlight } from '@atcsims/navdata';

import { db } from '../lib/firebase.js';

// ------------------------------------------------------- formas sin tipo propio en @atcsims/core
// Estos 7 archivos no los usa el motor de calculo, asi que nunca necesitaron un tipo en el
// dominio — pero el panel de administracion si necesita saber su forma para poder editarlos.

export interface Approach {
  readonly code: string;
  readonly type: string;
  readonly runway: string;
  readonly requiresSivigats: boolean;
  readonly iaf: string | null;
  readonly daMdaFt: number | null;
  readonly note: string | null;
}

export interface FleetEntry {
  readonly registration: string;
  readonly icaoType: string;
  readonly isCallsign: boolean;
}

export interface Operator {
  readonly icaoPrefix: string;
  readonly name: string;
  readonly country: string | null;
}

export interface SsrBlock {
  readonly base: string;
  readonly series: string;
  readonly codes: readonly string[];
}

export interface Unit {
  readonly id: string;
  readonly name: string;
  readonly frequencies: readonly number[];
  readonly _review?: string;
}

export interface Radar {
  readonly equipment: string;
  readonly type: string;
  readonly rangeNm: number;
  readonly rpn: number;
  readonly unit: string;
}

export interface Tma {
  readonly aerodrome: string;
  readonly name: string;
  readonly transitionAltitudeFt: number;
  readonly transitionLevel: string;
  readonly configurations: readonly string[];
  readonly runwaysByConfiguration: Readonly<Record<string, readonly string[]>>;
  readonly _review?: string;
  readonly _reviewTransitionLevel?: string;
}

// ------------------------------------------------------------------------- lectura de Firestore

/** Cada doc trae `_meta` inyectado por upload-firestore.js; no es parte del registro en si. */
async function fetchCollection<T>(name: string): Promise<T[]> {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map((d) => {
    const { _meta, ...rest } = d.data() as Record<string, unknown>;
    return rest as T;
  });
}

/** Deshace el `{ values: [...] }` con que upload-firestore.js envuelve un array-de-arrays. */
function unwrapNestedArrays(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(unwrapNestedArrays);
  if (value !== null && typeof value === 'object' && 'values' in (value as Record<string, unknown>)) {
    const values = (value as { values: unknown }).values;
    if (Array.isArray(values)) return values.map(unwrapNestedArrays);
  }
  return value;
}

function unwrapAirway(a: Airway): Airway {
  if (!a.segments) return a;
  return { ...a, segments: unwrapNestedArrays(a.segments) as readonly (readonly string[])[] };
}

// ------------------------------------------------------------------------------------- el store

export type NavdataStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface NavdataState {
  readonly status: NavdataStatus;
  readonly error: string | null;

  readonly fixes: readonly Fix[];
  readonly procedures: readonly Procedure[];
  readonly airways: readonly Airway[];
  readonly runways: readonly Runway[];
  readonly approaches: readonly Approach[];
  readonly holdings: readonly HoldingPattern[];
  readonly performance: PerformanceTable;
  readonly separation: readonly SeparationMinimum[];
  readonly aircraftTypes: readonly AircraftType[];
  readonly fleet: readonly FleetEntry[];
  readonly operators: readonly Operator[];
  readonly sampleFlights: readonly SampleFlight[];
  readonly ssrCodes: readonly string[];
  /** Los bloques crudos, para el panel de administracion — ssrCodes ya viene aplanado. */
  readonly ssrBlocks: readonly SsrBlock[];
  readonly units: readonly Unit[];
  readonly radars: readonly Radar[];
  readonly tma: Tma | null;

  // derivados, mismo criterio que packages/navdata/src/index.ts
  readonly coordinates: ReadonlyMap<string, Coordinates>;
  readonly tmaFixes: readonly string[];
  readonly approachFixes: readonly string[];

  readonly loadAll: () => Promise<void>;
  readonly findFix: (ident: string) => Fix | undefined;
  readonly findProcedure: (ident: string) => Procedure | undefined;
  readonly proceduresOfType: (type: 'STAR' | 'SID') => Procedure[];
  readonly usableProcedures: () => Procedure[];
}

const EMPTY: Pick<
  NavdataState,
  | 'fixes'
  | 'procedures'
  | 'airways'
  | 'runways'
  | 'approaches'
  | 'holdings'
  | 'performance'
  | 'separation'
  | 'aircraftTypes'
  | 'fleet'
  | 'operators'
  | 'sampleFlights'
  | 'ssrCodes'
  | 'ssrBlocks'
  | 'units'
  | 'radars'
  | 'tma'
  | 'coordinates'
  | 'tmaFixes'
  | 'approachFixes'
> = {
  fixes: [],
  procedures: [],
  airways: [],
  runways: [],
  approaches: [],
  holdings: [],
  performance: [],
  separation: [],
  aircraftTypes: [],
  fleet: [],
  operators: [],
  sampleFlights: [],
  ssrCodes: [],
  ssrBlocks: [],
  units: [],
  radars: [],
  tma: null,
  coordinates: new Map(),
  tmaFixes: [],
  approachFixes: [],
};

export const useNavdataStore = create<NavdataState>((set, get) => ({
  status: 'idle',
  error: null,
  ...EMPTY,

  loadAll: async () => {
    set({ status: 'loading', error: null });
    try {
      const [
        rawFixes,
        rawProcedures,
        rawAirways,
        runways,
        approaches,
        holdings,
        performance,
        separation,
        aircraftTypes,
        fleet,
        operators,
        sampleFlights,
        ssrBlocks,
        units,
        radars,
        tmaSnap,
      ] = await Promise.all([
        fetchCollection<Fix>('fixes'),
        fetchCollection<Procedure>('procedures'),
        fetchCollection<Airway>('airways'),
        fetchCollection<Runway>('runways'),
        fetchCollection<Approach>('approaches'),
        fetchCollection<HoldingPattern>('holdings'),
        fetchCollection<PerformanceTable[number]>('performance'),
        fetchCollection<SeparationMinimum>('separation'),
        fetchCollection<AircraftType>('aircraftTypes'),
        fetchCollection<FleetEntry>('fleet'),
        fetchCollection<Operator>('operators'),
        fetchCollection<SampleFlight>('sampleFlights'),
        fetchCollection<SsrBlock>('ssrBlocks'),
        fetchCollection<Unit>('units'),
        fetchCollection<Radar>('radars'),
        getDoc(doc(db, 'tma', 'scel')),
      ]);

      const fixes = rawFixes.filter((f) => !EXCLUDED_FIXES.has(f.ident));
      const procedures = rawProcedures.filter((p) => !EXCLUDED_PROCEDURES.has(p.ident));
      const airways = rawAirways.filter((a) => !EXCLUDED_AIRWAYS.has(a.ident)).map(unwrapAirway);

      const tmaData = tmaSnap.exists() ? (tmaSnap.data() as Record<string, unknown>) : null;
      const tma = tmaData ? ((({ _meta, ...rest }) => rest)(tmaData) as unknown as Tma) : null;

      const coordinates = new Map(fixes.map((f) => [f.ident, { lat: f.lat, lon: f.lon }]));
      const tmaFixes = fixes.filter((f) => f.scope === 'TMA').map((f) => f.ident);
      const approachFixes = [
        ...new Set(approaches.map((a) => a.iaf).filter((iaf): iaf is string => iaf !== null)),
      ];

      set({
        status: 'ready',
        error: null,
        fixes,
        procedures,
        airways,
        runways,
        approaches,
        holdings,
        performance,
        separation,
        aircraftTypes,
        fleet,
        operators,
        sampleFlights,
        ssrCodes: ssrBlocks.flatMap((b) => b.codes),
        ssrBlocks,
        units,
        radars,
        tma,
        coordinates,
        tmaFixes,
        approachFixes,
      });
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'No se pudo cargar la base de navegación.',
      });
    }
  },

  findFix: (ident) => get().fixes.find((f) => f.ident === ident),
  findProcedure: (ident) => get().procedures.find((p) => p.ident === ident),
  proceduresOfType: (type) => get().procedures.filter((p) => p.type === type),
  usableProcedures: () => get().procedures.filter((p) => p.legs.every((l) => l.distToEndNm !== null)),
}));
