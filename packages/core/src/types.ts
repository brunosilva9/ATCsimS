/**
 * Tipos del dominio. Traduccion de docs/MODELO_DATOS.md.
 *
 * Regla: los campos que la planilla puede no traer son `| null` explicito, nunca un cero
 * silencioso. Si a un procedimiento le falta una distancia, el tipo lo dice y el motor se
 * niega a calcular (fue el caso de ASIMO7D hasta que se corrigio, ver data/README.md).
 */

// ---------------------------------------------------------------- primitivas

/** Minutos desde medianoche UTC. Las strips trabajan en HHMM y los ejercicios no cruzan husos. */
export type UtcMinutes = number;

export type Configuration = 'NORTE' | 'SUR';
export type ProcedureType = 'STAR' | 'SID';

export type FixType =
  | 'WAYPOINT'
  | 'VOR'
  | 'NDB'
  | 'DME_FIX'
  // Punto definido por altitud, no por posicion: el viraje ocurre al alcanzarla (DONTI5B).
  | 'ALTITUDE_POINT';

// ------------------------------------------------------------- base estatica

export interface Fix {
  readonly id: string | null;
  readonly ident: string;
  readonly name: string;
  readonly type: FixType;
  readonly lat: number | null;
  readonly lon: number | null;
  readonly elevationFt: number | null;
  readonly scope: string;
  readonly meaFt: number | null;
  readonly mclFt: number | null;
  /** true = no venia en la base; se creo porque un procedimiento o aerovia lo citaba. */
  readonly _inferred?: boolean;
}

export interface ProcedureLeg {
  readonly seq: number;
  readonly fix: string;
  /** Distancia restante al fix final. Es el dato con el que calcula la planilla. */
  readonly distToEndNm: number | null;
  /** Derivada de distToEndNm. En una STAR el primer tramo es null: no hay tramo previo. */
  readonly legDistNm: number | null;
  readonly distFromOriginNm?: number | null;
  /** Minutos que la planilla asigna a este tramo, cuando se pudieron alinear. */
  readonly sourceTimeMin?: number;
  /** GS que implican legDistNm y sourceTimeMin. Es el perfil real del instructor. */
  readonly sourceGsKt?: number;
  /**
   * Ventana de altitud publicada SOBRE ESTE FIX (hoja 05_STAR, columnas Alt Min / Alt Max).
   * No es un piso ni un techo del procedimiento entero: en UMKAL7C vale 24000/24000 sobre
   * UMKAL porque ese es el nivel al que se entra a la llegada.
   */
  readonly minAltFt?: number;
  readonly maxAltFt?: number;
  /** Velocidad maxima publicada en el fix. Se guarda pero el motor todavia no la impone. */
  readonly maxSpeedKt?: number;
  readonly atcRestriction?: string;
  readonly navaid?: string;
}

export interface Procedure {
  readonly ident: string;
  readonly type: ProcedureType;
  readonly runway: string;
  readonly configuration: Configuration;
  readonly requiresSivigats: boolean;
  readonly entryFix: string | null;
  readonly exitFix: string;
  readonly totalDistNm: number | null;
  readonly legs: readonly ProcedureLeg[];
  readonly sourceTotalTimeMin?: number;
  /** Presente = la planilla tiene un problema en este procedimiento. */
  readonly _review?: string;
}

export interface PerformanceLevel {
  readonly level: string;
  readonly altFt: number;
  readonly iasKt: number | null;
  readonly gsKt: number | null;
  readonly nmPerMin: number | null;
  readonly ftPerMin: number | null;
  readonly note: string | null;
  /** Fixes donde ese nivel debe estar alcanzado. */
  readonly fixes: readonly string[];
}

/** La tabla completa, ordenada de mayor a menor altitud. El motor la recibe como parametro. */
export type PerformanceTable = readonly PerformanceLevel[];

export interface HoldingPattern {
  readonly fix: string;
  readonly lowerLevelFt: number | null;
  readonly upperLevelFt: number | null;
  readonly mclFt: number | null;
  readonly note: string | null;
}

export interface SeparationMinimum {
  readonly runway: string;
  readonly sivigats: boolean;
  readonly withDepartures: boolean | null;
  readonly lvp: boolean;
  readonly value: number;
  readonly unit: 'NM' | 'MIN';
}

export interface AircraftType {
  readonly icao: string;
  readonly name: string;
  readonly minSpeedKt: number;
  readonly maxSpeedKt: number;
  readonly wake: string | null;
  readonly vappKt: number | null;
}

export interface Airway {
  readonly ident: string;
  readonly levels: 'upper' | 'lower' | 'both';
  readonly fixes: readonly string[] | null;
  readonly segments?: readonly (readonly string[])[];
}

export interface Runway {
  readonly aerodrome: string;
  readonly ident: string;
  readonly magCourse: number | null;
  readonly lengthM: number | null;
  readonly ils: boolean;
  readonly rnav: boolean;
  readonly configuration: Configuration;
}

// ----------------------------------------------------------------- escenario

export type FlightKind = 'ARRIVAL' | 'DEPARTURE' | 'OVERFLIGHT';

export interface Weather {
  readonly qnhHpa: number;
  readonly transitionLevel: string;
  readonly vmc: boolean;
  readonly visibilityM: number | null;
  readonly ceilingFt: number | null;
  readonly lvp: boolean;
}

/** Un paso calculado del vuelo: el fix, el nivel y las horas. */
export interface FlightLeg {
  readonly seq: number;
  readonly fix: string;
  readonly levelFt: number | null;
  /** Estimada original, la de arriba en la strip. Nunca se sobrescribe. */
  readonly eto: UtcMinutes;
  /** Estimada tras una instruccion, la de abajo en la strip. null mientras no cambie nada. */
  readonly revisedEto: UtcMinutes | null;
  /** Hora real de paso, la anota el alumno. */
  readonly ato: UtcMinutes | null;
  readonly gsKt: number;
  /**
   * GS que la planilla asigna a este tramo, cuando la trae (7 de 21 procedimientos).
   * Se conserva para que un recalculo posterior siga reproduciendo los numeros de ATC en vez
   * de caer a la tabla de performance. Un cambio de nivel la anula: el perfil publicado deja
   * de aplicar en cuanto el avion sale de el.
   */
  readonly sourceGsKt: number | null;
  /** Millas de este tramo. 0 en el fix de entrada de una STAR. Un directo la acorta. */
  readonly legDistNm: number;
  /** Minutos exactos de este tramo, sin redondear. 0 en el fix de entrada de una STAR. */
  readonly legTimeMin: number;
  /**
   * Minutos detenido SOBRE este fix: una espera. Normalmente 0.
   *
   * Va aparte de `legTimeMin` para que la hora de cualquier punto se pueda reconstruir desde
   * la hora de entrada sumando valores exactos. Si el recalculo arrancara desde una hora ya
   * redondeada al minuto, cada instruccion meteria hasta un minuto de error.
   */
  readonly delayMin: number;
  readonly assignedSpeedKt: number | null;
  readonly restriction: string | null;
}

export interface Flight {
  readonly id: string;
  readonly callsign: string;
  readonly ssr: string;
  readonly icaoType: string;
  readonly registration: string | null;
  readonly tasKt: number;
  readonly adep: string;
  readonly ades: string;
  readonly kind: FlightKind;
  readonly procedureIdent: string | null;
  readonly airway: string | null;
  readonly cruiseLevelFt: number;
  readonly entryTime: UtcMinutes;
  readonly transferFix: string | null;
  readonly legs: readonly FlightLeg[];
}

export interface Scenario {
  readonly id: string;
  readonly name: string;
  readonly configuration: Configuration;
  readonly runwayInUse: string;
  readonly sivigats: boolean;
  readonly startTime: UtcMinutes;
  readonly durationMin: number;
  readonly weather: Weather;
  readonly objective: string;
  readonly flights: readonly Flight[];
}

// ------------------------------------------------------------- instrucciones

export type InstructionKind =
  | 'LEVEL_CHANGE'
  | 'SPEED_RESTRICTION'
  | 'VECTOR'
  | 'DIRECT'
  | 'HOLD'
  | 'TRANSFER';

export interface Instruction {
  readonly id: string;
  readonly time: UtcMinutes;
  readonly flightId: string;
  readonly kind: InstructionKind;
  /** Desde que fix aplica. null = desde el proximo que el vuelo no haya cruzado. */
  readonly fromFix: string | null;
  readonly levelFt?: number;
  readonly speedKt?: number;
  /** Fix al que se manda directo (DIRECT). */
  readonly targetFix?: string;
  /** Minutos de espera (HOLD). Un circuito estandar son 4. */
  readonly holdMinutes?: number;
  /** Millas de mas que anaden los vectores (VECTOR). */
  readonly extraTrackNm?: number;
  readonly note?: string;
}

// ---------------------------------------------------------------- conflictos

export type ConflictKind = 'SAME_FIX' | 'IN_TRAIL' | 'CROSSING';
export type ConflictSeverity = 'LOSS' | 'MARGINAL';

export interface Conflict {
  readonly id: string;
  readonly kind: ConflictKind;
  readonly severity: ConflictSeverity;
  readonly fix: string;
  readonly time: UtcMinutes;
  readonly flightIds: readonly [string, string];
  readonly verticalFt: number;
  readonly timeGapMin: number;
  /** Que minima se aplico y de donde salio. */
  readonly appliedMinimum: {
    readonly value: number;
    readonly unit: 'NM' | 'MIN';
    readonly source: string;
  };
  readonly description: string;
}

/**
 * Que alcance tuvo la deteccion. `approachOnly` significa que los conflictos en ruta se
 * verificaron con valores provisionales porque faltan las minimas reales (P-03 del informe
 * a ATC): la interfaz tiene que decirlo en vez de dar por limpio el ejercicio.
 */
export interface ConflictReport {
  readonly conflicts: readonly Conflict[];
  readonly coverage: 'approachOnly' | 'full';
  readonly notes: readonly string[];
}

// ------------------------------------------------------------------ corrida

export interface Run {
  readonly id: string;
  readonly scenarioId: string;
  readonly student: string;
  readonly startedAt: string;
  readonly submittedAt: string | null;
  readonly instructions: readonly Instruction[];
}
