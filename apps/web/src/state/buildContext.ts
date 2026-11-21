/**
 * El `BuildContext` que necesita scenarios/build.ts, armado desde el store de navdata.
 *
 * Vive aparte de build.ts a proposito: build.ts no sabe de donde sale la base (por diseno, para
 * seguir siendo un util puro y testeable), y este hook es el unico puente entre eso y Firestore.
 */

import { useMemo } from 'react';

import type { BuildContext } from '../scenarios/build.js';
import { useNavdataStore } from './navdata.js';

export function useBuildContext(): BuildContext {
  const holdings = useNavdataStore((s) => s.holdings);
  const performance = useNavdataStore((s) => s.performance);
  const findProcedure = useNavdataStore((s) => s.findProcedure);
  const aircraftTypes = useNavdataStore((s) => s.aircraftTypes);
  const categoryPerformance = useNavdataStore((s) => s.categoryPerformance);
  return useMemo(() => {
    const byIcao = new Map(aircraftTypes.map((t) => [t.icao, t]));
    return {
      findProcedure,
      holdings,
      performance,
      findAircraftType: (icao: string) => byIcao.get(icao),
      categoryPerformance,
    };
  }, [findProcedure, holdings, performance, aircraftTypes, categoryPerformance]);
}
