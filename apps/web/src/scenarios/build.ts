/**
 * De receta a ejercicio.
 *
 * Un `ScenarioDraft` es lo que el instructor escribe: quien vuela, por donde, a que hora y a
 * que nivel. Las horas de paso no estan ahi — las pone el motor. Por eso el banco de ejercicios
 * guarda la receta y no el resultado: el dia que se corrija un dato de las planillas, los
 * ejercicios guardados se recalculan solos en vez de quedarse con los numeros viejos.
 */

import { computeFlightPlan, toFeet } from '@atcsims/core';
import type { Configuration, Flight, FlightKind, Scenario, UtcMinutes, Weather } from '@atcsims/core';
import { findProcedure, holdings, performance } from '@atcsims/navdata';

export interface FlightDraft {
  readonly id: string;
  readonly callsign: string;
  readonly ssr: string;
  readonly icaoType: string;
  readonly registration: string | null;
  readonly tasKt: number;
  readonly adep: string;
  readonly ades: string;
  readonly kind: FlightKind;
  readonly procedureIdent: string;
  readonly entryTime: UtcMinutes;
  readonly levelFl: number;
}

/** Como se trabaja el ejercicio. Lo elige el instructor al armarlo. */
export type ExerciseMode = 'practice' | 'exam';

export interface ScenarioDraft {
  readonly id: string;
  readonly name: string;
  /** Ausente = practica, para las recetas guardadas antes de que existiera el modo prueba. */
  readonly mode?: ExerciseMode;
  /** Solo en prueba: si ademas de calcular, el alumno tiene que separar el trafico. */
  readonly allowInstructions?: boolean;
  readonly configuration: Configuration;
  readonly runwayInUse: string;
  readonly sivigats: boolean;
  readonly objective: string;
  readonly weather: Weather;
  readonly flights: readonly FlightDraft[];
}

/** Un vuelo que el motor no pudo calcular, con el motivo a la vista. */
export interface RejectedFlight {
  readonly callsign: string;
  readonly procedureIdent: string;
  readonly reason: string;
}

/** Lo que el motor tuvo que suponer, atribuido al vuelo que lo provoco. */
export interface FlightAssumption {
  readonly flightId: string;
  readonly callsign: string;
  readonly note: string;
}

export interface BuiltScenario {
  readonly scenario: Scenario;
  readonly rejected: readonly RejectedFlight[];
  readonly assumptions: readonly FlightAssumption[];
}

interface BuiltFlight {
  readonly flight: Flight;
  readonly assumptions: readonly string[];
}

export function buildFlight(draft: FlightDraft): BuiltFlight | RejectedFlight {
  const procedure = findProcedure(draft.procedureIdent);
  if (!procedure) {
    return {
      callsign: draft.callsign,
      procedureIdent: draft.procedureIdent,
      reason:
        'El procedimiento no está en la base, o quedó excluido porque su planilla está incompleta.',
    };
  }

  const cruiseLevelFt = toFeet(draft.levelFl);
  const result = computeFlightPlan({
    procedure,
    entryTime: draft.entryTime,
    cruiseLevelFt,
    performance,
    holdings,
  });

  if (!result.ok) {
    return {
      callsign: draft.callsign,
      procedureIdent: draft.procedureIdent,
      reason: result.message,
    };
  }

  const legs = result.legs;
  return {
    flight: {
      id: draft.id,
      callsign: draft.callsign,
      ssr: draft.ssr,
      icaoType: draft.icaoType,
      registration: draft.registration,
      tasKt: draft.tasKt,
      adep: draft.adep,
      ades: draft.ades,
      kind: draft.kind,
      procedureIdent: draft.procedureIdent,
      airway: null,
      cruiseLevelFt,
      entryTime: draft.entryTime,
      transferFix: legs[legs.length - 1]?.fix ?? null,
      legs,
    },
    assumptions: result.assumptions,
  };
}

export function buildScenario(draft: ScenarioDraft): BuiltScenario {
  const flights: Flight[] = [];
  const rejected: RejectedFlight[] = [];
  const assumptions: FlightAssumption[] = [];

  for (const seed of draft.flights) {
    const built = buildFlight(seed);
    if ('flight' in built) {
      flights.push(built.flight);
      for (const note of built.assumptions) {
        assumptions.push({ flightId: built.flight.id, callsign: built.flight.callsign, note });
      }
    } else {
      rejected.push(built);
    }
  }

  // La ventana del ejercicio la fijan los propios vuelos: desde el primero que entra hasta el
  // ultimo que sale, mas dos minutos de margen para que el diagrama no corte la ultima fila.
  const starts = flights.map((f) => f.entryTime);
  const ends = flights.map((f) => f.legs[f.legs.length - 1]?.eto ?? f.entryTime);
  const startTime = starts.length > 0 ? Math.min(...starts) : 0;
  const endTime = ends.length > 0 ? Math.max(...ends) : startTime;

  return {
    scenario: {
      id: draft.id,
      name: draft.name,
      configuration: draft.configuration,
      runwayInUse: draft.runwayInUse,
      sivigats: draft.sivigats,
      startTime,
      durationMin: Math.max(1, Math.ceil(endTime - startTime) + 2),
      weather: draft.weather,
      objective: draft.objective,
      flights,
    },
    rejected,
    assumptions,
  };
}
