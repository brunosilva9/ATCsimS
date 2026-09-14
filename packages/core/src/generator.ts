/**
 * Generador de trafico.
 *
 * -------------------------------------------------------------------------------------------
 * QUE HACE Y QUE NO HACE. Leer esto antes de usarlo con alumnos.
 *
 * HACE: producir trafico valido —vuelos reales del catalogo, por procedimientos publicados, con
 * horas y niveles que el motor sabe calcular— y ajustarlo hasta que el detector de conflictos
 * encuentre el numero de encuentros que se le pidio.
 *
 * NO HACE: decidir si ese encuentro vale la pena enseñarlo. Eso es criterio de instructor y sale
 * del catalogo de conflictos tipo (hoja `07_CONFLICTOS`), que esta VACIA — ver MODELO_DATOS §3.5.
 * Mientras siga vacia, esto entrega un ejercicio con tres encuentros, no "el" ejercicio de tres
 * encuentros. La diferencia la tiene que poner quien lo revise antes de darlo.
 *
 * Por eso no inventa ninguna regla propia: el que dice que dos vuelos estan en conflicto es
 * `detectConflicts`, el mismo que usa el resto de la aplicacion, con las mismas minimas y los
 * mismos avisos sobre las provisionales. Esto es busqueda, no doctrina.
 *
 * -------------------------------------------------------------------------------------------
 * COMO BUSCA
 *
 * Por sorteo y descarte. Se generan candidatos completos, se calculan de verdad con el motor,
 * se miden con el detector y se queda el que mas se acerca a lo pedido. No hay formula que
 * coloque un conflicto donde uno quiere: el perfil vertical de una llegada lo fijan las
 * restricciones publicadas, asi que el unico grado de libertad real es a que hora entra cada
 * vuelo y por donde. Sortear y medir es honesto y sale barato — unas decimas de segundo.
 *
 * -------------------------------------------------------------------------------------------
 * LA SEMILLA
 *
 * El sorteo es determinista: la misma semilla produce el mismo ejercicio, hoy y en seis meses.
 * Eso es lo que convierte al generador en algo utilizable para tomar pruebas:
 *
 *   - un ejercicio generado se guarda con su semilla y se reproduce exacto sin guardar el
 *     resultado, igual que el resto del banco guarda la receta y no los numeros;
 *   - cambiar solo la semilla da otro ejercicio de la misma forma y dificultad, que es como se
 *     le da una version distinta a cada alumno de un curso.
 *
 * Se cuentan ENCUENTROS (pares de vuelos), no filas de conflicto: ver `encounters` en
 * conflicts.ts. Un par en fila sobre una STAR produce seis filas y un solo problema.
 */

import type {
  ConflictKind,
  ConflictReport,
  Flight,
  FlightKind,
  HoldingPattern,
  PerformanceTable,
  Procedure,
  Scenario,
  UtcMinutes,
} from './types.js';
import { computeFlightPlan } from './eto.js';
import { detectConflicts, encounters } from './conflicts.js';
import type { DetectOptions, Encounter } from './conflicts.js';
import { toFeet } from './performance.js';
import { transitionLevelFor } from './transitionLevel.js';
import { regionForIcao, starRegions } from './originRegions.js';

// ------------------------------------------------------------------ entradas

/** Un vuelo del catalogo: lo que la hoja ACFT aporta y el generador no inventa. */
export interface FlightTemplate {
  readonly callsign: string;
  readonly icaoType: string;
  readonly tasKt: number;
  readonly adep: string;
  readonly ades: string;
}

/** Los parametros que toca el instructor. */
export interface GeneratorRequest {
  /** Texto libre. Misma semilla, mismo ejercicio. Vacio = una al azar. */
  readonly seed: string;
  readonly arrivals: number;
  readonly departures: number;
  /** Encuentros buscados. 0 es una peticion valida: trafico sin conflicto, para practicar el calculo. */
  readonly targetEncounters: number;
  readonly startTime: UtcMinutes;
  /** Minutos dentro de los que entran todos los vuelos. Mas estrecho, mas apretado. */
  readonly spreadMin: number;
  /** Que el conflicto se materialice sobre este punto. null = donde salga. */
  readonly focusFix: string | null;
  /** Geometria pedida: en fila, cruzandose, o la que salga. */
  readonly geometry: ConflictKind | null;
}

export interface GeneratorCatalogue {
  readonly stars: readonly Procedure[];
  readonly sids: readonly Procedure[];
  readonly templates: readonly FlightTemplate[];
  readonly ssrCodes: readonly string[];
  readonly performance: PerformanceTable;
  readonly holdings: readonly HoldingPattern[];
}

// ------------------------------------------------------------------ salidas

/** Un vuelo generado, en el mismo formato que escribe el instructor a mano en el editor. */
export interface GeneratedFlight {
  readonly callsign: string;
  readonly ssr: string;
  readonly icaoType: string;
  readonly tasKt: number;
  readonly adep: string;
  readonly ades: string;
  readonly kind: FlightKind;
  readonly procedureIdent: string;
  readonly entryTime: UtcMinutes;
  readonly levelFl: number;
}

export interface GeneratorResult {
  readonly flights: readonly GeneratedFlight[];
  readonly report: ConflictReport;
  readonly encounters: readonly Encounter[];
  /** La semilla efectivamente usada. Si la peticion venia vacia, aqui esta la que salio. */
  readonly seed: string;
  /** Candidatos probados hasta quedarse con este. */
  readonly attempts: number;
  /** true = cumple todo lo pedido. false = es lo mas cerca que se llego, y `shortfall` dice por que. */
  readonly matched: boolean;
  /** En que se quedo corto, en castellano y para leerlo en pantalla. Vacio si `matched`. */
  readonly shortfall: readonly string[];
  /**
   * Cuando no se pudo restringir el sorteo de STAR al corredor geografico del origen del vuelo,
   * y por que (origen sin region conocida, o STAR sin corredor conocido). Vacio = no hizo falta
   * avisar: cada llegada quedo con una STAR de su propia region.
   */
  readonly notes: readonly string[];
}

export type GenerateOutcome =
  | ({ readonly ok: true } & GeneratorResult)
  | { readonly ok: false; readonly message: string };

// ------------------------------------------------------------------ sorteo

/**
 * PRNG propio en vez de Math.random, por una sola razon: reproducibilidad. Math.random no se
 * puede sembrar, y sin semilla un ejercicio generado no se puede volver a obtener ni describir
 * — habria que guardar el resultado, que es justo lo que el banco evita.
 */
function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(state: number): () => number {
  let a = state;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Dice {
  /** Entero en [0, n). */
  readonly below: (n: number) => number;
  readonly pick: <T>(items: readonly T[]) => T;
  /** Una copia barajada. No toca el original. */
  readonly shuffle: <T>(items: readonly T[]) => T[];
}

function dice(random: () => number): Dice {
  const below = (n: number) => Math.floor(random() * n);
  const pick = <T,>(items: readonly T[]): T => items[below(items.length)]!;
  const shuffle = <T,>(items: readonly T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = below(i + 1);
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  };
  return { below, pick, shuffle };
}

/** Semilla legible cuando el instructor no escribe ninguna. Corta, para poder dictarla. */
function randomSeed(random: () => number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(random() * alphabet.length)];
  return out;
}

// ------------------------------------------------------- armar un candidato

/**
 * A que nivel entra un vuelo al sector.
 *
 * En una llegada el nivel de entrada casi nunca es libre: la hoja 05_STAR lo fija sobre el
 * primer fix (UMKAL7C dice 24000/24000 sobre UMKAL) y el motor lo recorta ahi de todos modos.
 * Sortear un nivel que el motor va a ignorar produciria una ficha que dice FL280 y un perfil
 * que empieza en 24000: se respeta la restriccion publicada y solo se sortea cuando no la hay.
 */
function entryLevelFl(procedure: Procedure, d: Dice): number {
  const first = procedure.legs[0];
  const published = first?.maxAltFt ?? first?.minAltFt;
  if (published !== undefined) return Math.round(published / 100);

  if (procedure.type === 'SID') {
    // Niveles de crucero de salida habituales en el TMA, en pasos de 10.
    return 190 + d.below(8) * 10;
  }
  return 200 + d.below(11) * 10;
}

/** Las plantillas se reparten por su propio plan: quien sale de SCEL es una salida. */
function splitTemplates(templates: readonly FlightTemplate[]) {
  return {
    arrivals: templates.filter((t) => t.ades === 'SCEL'),
    departures: templates.filter((t) => t.adep === 'SCEL'),
  };
}

/**
 * Los procedimientos que sirven para lo pedido. Con `focusFix` solo valen los que pasan por
 * ese punto: pedir un conflicto sobre PUMAR y sortear entre STAR que no lo tocan es gastar
 * intentos en candidatos que no pueden cumplirlo.
 */
function usableFor(procedures: readonly Procedure[], focusFix: string | null): readonly Procedure[] {
  const complete = procedures.filter((p) => p.legs.every((l) => l.distToEndNm !== null));
  if (focusFix === null) return complete;
  const through = complete.filter((p) => p.legs.some((l) => l.fix === focusFix));
  // Si ninguno pasa por el punto no se fuerza: se devuelven todos y el aviso lo da el resultado.
  return through.length > 0 ? through : complete;
}

/**
 * De las STAR disponibles, las que le sirven a un vuelo que llega desde `adep`: mismo corredor
 * geografico (originRegions.ts), no cualquiera. Nunca deja `stars` en cero: sin corredor
 * conocido para el origen o sin ninguna STAR de ese corredor, se sortea sin esta restriccion y
 * se anota por que — un vuelo domestico o de un origen sin mapear no puede dejar sin ejercicio
 * al instructor.
 */
function starsForOrigin(
  stars: readonly Procedure[],
  adep: string,
  notes: Set<string>
): readonly Procedure[] {
  const region = regionForIcao(adep);
  if (region === null) return stars;

  const matching = stars.filter((s) => {
    const regions = starRegions(s);
    return regions.size === 0 || regions.has(region);
  });
  if (matching.length === 0) {
    notes.add(
      `Sin STAR de corredor conocido para vuelos desde ${adep}: se sorteó sin esa restricción.`
    );
    return stars;
  }
  return matching;
}

function buildCandidate(
  request: GeneratorRequest,
  catalogue: GeneratorCatalogue,
  stars: readonly Procedure[],
  sids: readonly Procedure[],
  pools: ReturnType<typeof splitTemplates>,
  d: Dice,
  notes: Set<string>
): readonly GeneratedFlight[] {
  const flights: GeneratedFlight[] = [];
  const usedSsr = new Set<string>();

  const takeSsr = (): string => {
    const free = catalogue.ssrCodes.filter((c) => !usedSsr.has(c));
    const code = free.length > 0 ? d.pick(free) : '0000';
    usedSsr.add(code);
    return code;
  };

  const add = (
    template: FlightTemplate,
    kind: FlightKind,
    procedure: Procedure
  ) => {
    flights.push({
      callsign: template.callsign,
      ssr: takeSsr(),
      icaoType: template.icaoType,
      tasKt: template.tasKt,
      adep: template.adep,
      ades: template.ades,
      kind,
      procedureIdent: procedure.ident,
      // La hora de entrada es el unico grado de libertad de verdad, y es donde se juega que
      // haya conflicto o no. Se sortea al minuto: media hora no vale, no es como se escribe.
      entryTime: request.startTime + d.below(Math.max(1, request.spreadMin) + 1),
      levelFl: entryLevelFl(procedure, d),
    });
  };

  const arrivals = d.shuffle(pools.arrivals).slice(0, request.arrivals);
  for (const template of arrivals) {
    add(template, 'ARRIVAL', d.pick(starsForOrigin(stars, template.adep, notes)));
  }

  const departures = d.shuffle(pools.departures).slice(0, request.departures);
  for (const template of departures) add(template, 'DEPARTURE', d.pick(sids));

  return flights;
}

/** Calcula el candidato con el motor de verdad. null si algun vuelo no se pudo calcular. */
function computeCandidate(
  generated: readonly GeneratedFlight[],
  catalogue: GeneratorCatalogue,
  byIdent: ReadonlyMap<string, Procedure>
): Flight[] | null {
  const out: Flight[] = [];

  for (let i = 0; i < generated.length; i++) {
    const g = generated[i]!;
    const procedure = byIdent.get(g.procedureIdent);
    if (!procedure) return null;

    const cruiseLevelFt = toFeet(g.levelFl);
    const plan = computeFlightPlan({
      procedure,
      entryTime: g.entryTime,
      cruiseLevelFt,
      performance: catalogue.performance,
      holdings: catalogue.holdings,
    });
    // Un candidato con un vuelo incalculable se descarta entero: no se entrega un ejercicio al
    // que le falta un avion sin decirlo.
    if (!plan.ok) return null;

    const legs = plan.legs;
    out.push({
      id: `g${i + 1}`,
      callsign: g.callsign,
      ssr: g.ssr,
      icaoType: g.icaoType,
      registration: null,
      tasKt: g.tasKt,
      adep: g.adep,
      ades: g.ades,
      kind: g.kind,
      procedureIdent: g.procedureIdent,
      airway: null,
      cruiseLevelFt,
      entryTime: g.entryTime,
      transferFix: legs[legs.length - 1]?.fix ?? null,
      legs,
    });
  }

  return out;
}

// ------------------------------------------------------------------ puntuar

interface Score {
  readonly value: number;
  readonly shortfall: readonly string[];
}

/**
 * Cuanto se desvia un candidato de lo pedido. Menor es mejor; 0 es exacto.
 *
 * El numero de encuentros pesa mucho mas que el resto porque es lo unico que el instructor
 * pidio en firme. El punto y la geometria son preferencias: acercarse a ellas no justifica
 * entregar cinco encuentros cuando se pidieron dos.
 */
function score(
  found: readonly Encounter[],
  request: GeneratorRequest
): Score {
  const shortfall: string[] = [];
  let value = Math.abs(found.length - request.targetEncounters) * 100;

  if (found.length !== request.targetEncounters) {
    shortfall.push(
      `Se pidieron ${request.targetEncounters} encuentro${
        request.targetEncounters === 1 ? '' : 's'
      } y salieron ${found.length}.`
    );
  }

  if (request.focusFix !== null && found.length > 0) {
    const onFix = found.filter((e) => e.conflicts.some((c) => c.fix === request.focusFix));
    if (onFix.length === 0) {
      value += 30;
      shortfall.push(`Ningún encuentro se materializa sobre ${request.focusFix}.`);
    }
  }

  if (request.geometry !== null && found.length > 0) {
    const matching = found.filter((e) => e.kind === request.geometry);
    if (matching.length === 0) {
      value += 20;
      shortfall.push(`Ningún encuentro salió con la geometría pedida.`);
    }
  }

  // Desempate: a igualdad de todo lo anterior, mejor que los encuentros esten repartidos entre
  // vuelos distintos. Un ejercicio donde los tres problemas son del mismo avion enseña uno.
  const involved = new Set(found.flatMap((e) => e.flightIds));
  value -= involved.size;

  return { value, shortfall };
}

// ------------------------------------------------------------------ publico

/** Cuantos candidatos se prueban antes de rendirse y entregar el mejor que haya salido. */
const MAX_ATTEMPTS = 600;

export function generateTraffic(
  request: GeneratorRequest,
  catalogue: GeneratorCatalogue,
  detect: DetectOptions
): GenerateOutcome {
  const total = request.arrivals + request.departures;
  if (total < 1) {
    return { ok: false, message: 'Un ejercicio necesita al menos un vuelo.' };
  }
  if (request.targetEncounters > 0 && total < 2) {
    return {
      ok: false,
      message: 'Para que haya un encuentro hacen falta dos vuelos: sube el tráfico o pide cero.',
    };
  }

  const pools = splitTemplates(catalogue.templates);
  if (request.arrivals > pools.arrivals.length) {
    return {
      ok: false,
      message: `El catálogo solo tiene ${pools.arrivals.length} llegadas distintas; no se pueden generar ${request.arrivals} sin repetir indicativo.`,
    };
  }
  if (request.departures > pools.departures.length) {
    return {
      ok: false,
      message: `El catálogo solo tiene ${pools.departures.length} salidas distintas; no se pueden generar ${request.departures} sin repetir indicativo.`,
    };
  }

  const stars = usableFor(catalogue.stars, request.focusFix);
  const sids = usableFor(catalogue.sids, request.focusFix);
  if (request.arrivals > 0 && stars.length === 0) {
    return { ok: false, message: 'No hay ninguna STAR completa en la base para generar llegadas.' };
  }
  if (request.departures > 0 && sids.length === 0) {
    return { ok: false, message: 'No hay ninguna SID completa en la base para generar salidas.' };
  }

  // Un punto que no toca ningun procedimiento elegible no se puede cumplir de ninguna manera.
  // Vale mas decirlo que devolver seiscientos intentos y un ejercicio que no es lo que se pidio.
  const focus = request.focusFix;
  if (focus !== null && ![...stars, ...sids].some((p) => p.legs.some((l) => l.fix === focus))) {
    return {
      ok: false,
      message:
        `Ningún procedimiento de los que el motor puede calcular pasa por ${focus}: ` +
        `no hay forma de poner un encuentro ahí.`,
    };
  }

  const byIdent = new Map([...stars, ...sids].map((p) => [p.ident, p]));

  // La semilla vacia se resuelve UNA vez y se devuelve: el instructor puede volver a escribirla
  // para recuperar el mismo ejercicio.
  const requested = request.seed.trim();
  const effectiveSeed =
    requested !== '' ? requested : randomSeed(mulberry32(seedFrom(String(Date.now()))));

  const random = mulberry32(seedFrom(effectiveSeed));
  const d = dice(random);

  let best: {
    flights: readonly GeneratedFlight[];
    report: ConflictReport;
    found: readonly Encounter[];
    score: Score;
  } | null = null;
  let attempts = 0;
  const notes = new Set<string>();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    attempts = attempt + 1;

    const generated = buildCandidate(request, catalogue, stars, sids, pools, d, notes);
    const flights = computeCandidate(generated, catalogue, byIdent);
    if (flights === null) continue;

    const starts = flights.map((f) => f.entryTime);
    const ends = flights.map((f) => f.legs[f.legs.length - 1]?.eto ?? f.entryTime);
    const startTime = Math.min(...starts);
    const scenario: Scenario = {
      id: 'generated',
      name: 'Generado',
      configuration: 'SUR',
      runwayInUse: detect.runwayInUse,
      sivigats: detect.sivigats,
      startTime,
      durationMin: Math.max(1, Math.ceil(Math.max(...ends) - startTime) + 2),
      weather: {
        qnhHpa: 1013,
        transitionLevel: transitionLevelFor(1013),
        vmc: true,
        visibilityM: 9999,
        ceilingFt: null,
        lvp: detect.lvp,
      },
      objective: '',
      flights,
    };

    const report = detectConflicts(scenario, detect);
    const found = encounters(report);
    const candidateScore = score(found, request);

    if (best === null || candidateScore.value < best.score.value) {
      best = { flights: generated, report, found, score: candidateScore };
    }
    // Objetivo cumplido y sin nada pendiente: no se sigue sorteando.
    if (candidateScore.shortfall.length === 0) break;
  }

  if (best === null) {
    return {
      ok: false,
      message:
        'Ningún candidato se pudo calcular con la base actual. Revisa que los procedimientos ' +
        'elegibles tengan todas sus distancias.',
    };
  }

  return {
    ok: true,
    flights: best.flights,
    report: best.report,
    encounters: best.found,
    seed: effectiveSeed,
    attempts,
    matched: best.score.shortfall.length === 0,
    shortfall: best.score.shortfall,
    notes: [...notes],
  };
}
