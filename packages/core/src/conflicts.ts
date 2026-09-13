/**
 * Deteccion de conflictos.
 *
 * Dos vuelos estan en conflicto sobre un punto si no los separa ni la altura ni el tiempo.
 * La comprobacion se hace fix a fix, que es como la hace el instructor sobre la planilla de
 * horas: no hace falta geometria, y por eso funciona con los 61 fixes que no tienen coordenada.
 *
 * Las minimas vienen de dos sitios muy distintos y conviene no confundirlos:
 *
 *   - **Aproximacion**: data/separation.json, dato real de la dependencia.
 *   - **En ruta**: provisionalMinima.ts, valores genericos de OACI porque las planillas no
 *     traen los de la dependencia (P-03).
 *
 * Cuando se usa alguna minima provisional, `coverage` vale `'approachOnly'` y `notes` lo dice.
 * Un ejercicio nunca se declara limpio sin decir con que se midio.
 */

import type {
  Conflict,
  ConflictKind,
  ConflictReport,
  Flight,
  FlightLeg,
  Scenario,
  SeparationMinimum,
} from './types.js';
import { gapMinutes } from './time.js';
import {
  MARGINAL_FACTOR,
  PROVISIONAL_EN_ROUTE,
  PROVISIONAL_RADAR,
  PROVISIONAL_VERTICAL_FT,
  type Minimum,
} from './provisionalMinima.js';

export interface DetectOptions {
  /** Minimas de aproximacion de la base. */
  readonly separation: readonly SeparationMinimum[];
  /** Fixes donde rige la minima de aproximacion: los IAF. */
  readonly approachFixes: readonly string[];
  /**
   * Fixes dentro del TMA (columna `scope` de data/fixes.json). Con vigilancia disponible ahi
   * separa el radar, no la minima procedimental de ruta: son dos ordenes de magnitud distintos
   * y confundirlos llena el ejercicio de perdidas que no existen.
   */
  readonly tmaFixes: readonly string[];
  readonly runwayInUse: string;
  readonly sivigats: boolean;
  readonly lvp: boolean;
  /** Separacion vertical minima. Por defecto la provisional de 1000 ft. */
  readonly verticalFt?: number;
}

const etoOf = (leg: FlightLeg) => leg.revisedEto ?? leg.eto;

/** La minima de aproximacion que corresponde a la configuracion del ejercicio. */
function approachMinimum(options: DetectOptions): Minimum | null {
  const match = options.separation.find(
    (s) => s.runway === options.runwayInUse && s.sivigats === options.sivigats && s.lvp === options.lvp
  );
  if (!match) return null;
  return {
    value: match.value,
    unit: match.unit,
    source: `data/separation.json — RWY ${match.runway}, SIVIGATS ${match.sivigats ? 'sí' : 'no'}${
      match.lvp ? ', LVP' : ''
    }`,
  };
}

/**
 * Que tipo de encuentro es. Se deduce de por donde venia cada vuelo: si los dos llegan al fix
 * desde el mismo punto anterior van en fila; si llegan por ramas distintas, se cruzan.
 */
function kindOf(a: Flight, b: Flight, fix: string): ConflictKind {
  const previous = (flight: Flight) => {
    const i = flight.legs.findIndex((l) => l.fix === fix);
    return i > 0 ? flight.legs[i - 1]!.fix : null;
  };
  const pa = previous(a);
  const pb = previous(b);
  if (pa === null || pb === null) return 'SAME_FIX';
  return pa === pb ? 'IN_TRAIL' : 'CROSSING';
}

export function detectConflicts(scenario: Scenario, options: DetectOptions): ConflictReport {
  const verticalFt = options.verticalFt ?? PROVISIONAL_VERTICAL_FT;
  const approach = approachMinimum(options);
  const approachFixes = new Set(options.approachFixes);
  const tmaFixes = new Set(options.tmaFixes);

  /**
   * Que minima rige en un punto. Tres casos, de mas fiable a menos:
   *   1. un IAF con minima publicada: dato real de la dependencia;
   *   2. dentro del TMA con vigilancia: separacion radar, provisional;
   *   3. el resto: minima procedimental de ruta, provisional.
   */
  const minimumAt = (fix: string): { minimum: Minimum; provisional: boolean } => {
    if (approachFixes.has(fix) && approach !== null) return { minimum: approach, provisional: false };
    if (tmaFixes.has(fix) && options.sivigats) {
      return { minimum: PROVISIONAL_RADAR, provisional: true };
    }
    return { minimum: PROVISIONAL_EN_ROUTE, provisional: true };
  };

  const conflicts: Conflict[] = [];
  const notes: string[] = [];
  let usedProvisional = options.verticalFt === undefined;

  const flights = scenario.flights;

  for (let i = 0; i < flights.length; i++) {
    for (let j = i + 1; j < flights.length; j++) {
      const a = flights[i]!;
      const b = flights[j]!;

      for (const legA of a.legs) {
        const legB = b.legs.find((l) => l.fix === legA.fix);
        if (!legB) continue;

        const vertical = Math.abs((legA.levelFt ?? 0) - (legB.levelFt ?? 0));
        if (vertical >= verticalFt) continue;

        const timeGapMin = gapMinutes(etoOf(legA), etoOf(legB));

        const { minimum, provisional } = minimumAt(legA.fix);
        if (provisional) usedProvisional = true;

        // Para comparar contra una minima en millas hay que convertir el hueco de tiempo a
        // distancia. Se usa la GS media de los dos, que es lo que separa a un par en fila.
        const averageGsKt = (legA.gsKt + legB.gsKt) / 2;
        const observed =
          minimum.unit === 'MIN' ? timeGapMin : (timeGapMin / 60) * averageGsKt;

        if (observed >= minimum.value * MARGINAL_FACTOR) continue;

        const severity = observed < minimum.value ? 'LOSS' : 'MARGINAL';
        const shown =
          minimum.unit === 'MIN' ? `${observed.toFixed(1)} min` : `${observed.toFixed(1)} NM`;

        conflicts.push({
          id: `${a.id}-${b.id}-${legA.fix}`,
          kind: kindOf(a, b, legA.fix),
          severity,
          fix: legA.fix,
          time: etoOf(legA),
          flightIds: [a.id, b.id],
          verticalFt: vertical,
          timeGapMin: Math.round(timeGapMin * 10) / 10,
          appliedMinimum: minimum,
          description:
            `${a.callsign} y ${b.callsign} sobre ${legA.fix} con ${vertical} ft de diferencia ` +
            `y ${shown} de separacion; la minima aplicable es ${minimum.value} ${minimum.unit}.`,
        });
      }
    }
  }

  if (usedProvisional) {
    notes.push(
      `Fuera de los IAF se midió con valores provisionales: ` +
        `${PROVISIONAL_RADAR.value} ${PROVISIONAL_RADAR.unit} de separación radar dentro del TMA ` +
        `con vigilancia, ${PROVISIONAL_EN_ROUTE.value} ${PROVISIONAL_EN_ROUTE.unit} en ruta, y ` +
        `${PROVISIONAL_VERTICAL_FT} ft de separación vertical. No son las mínimas de la ` +
        `dependencia: las planillas no las traen. Pendiente P-03 con ATC.`
    );
  }
  if (approach === null) {
    notes.push(
      `No hay minima de aproximacion en data/separation.json para RWY ${options.runwayInUse} ` +
        `con SIVIGATS ${options.sivigats ? 'disponible' : 'no disponible'}` +
        `${options.lvp ? ' y LVP' : ''}: tambien esos puntos se midieron con la provisional.`
    );
  }

  conflicts.sort((x, y) => x.time - y.time);

  return {
    conflicts,
    coverage: usedProvisional ? 'approachOnly' : 'full',
    notes,
  };
}
