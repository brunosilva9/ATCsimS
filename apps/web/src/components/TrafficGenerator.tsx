/**
 * Generar trafico.
 *
 * Vive dentro del editor y no en una pantalla propia a proposito: lo que sale de aqui es un
 * BORRADOR que el instructor revisa y corrige antes de dar. El generador acierta el numero de
 * encuentros, pero no sabe si ese encuentro enseña algo — eso sigue siendo criterio suyo, y
 * ponerlo en el editor es lo que hace que la revision sea el paso siguiente y no uno opcional.
 *
 * La semilla se enseña siempre. Es lo que convierte esto en algo usable para tomar pruebas:
 * misma semilla, mismo ejercicio; otra semilla, otra version del mismo ejercicio para el
 * alumno de al lado.
 */

import { useMemo, useState } from 'react';

import { formatHhmm, generateTraffic, parseHhmm } from '@atcsims/core';
import type { ConflictKind, GeneratorRequest, GeneratorResult } from '@atcsims/core';

import type { FlightDraft } from '../scenarios/build.js';
import { useNavdataStore } from '../state/navdata.js';
import shared from '../routes/shared.module.css';
import styles from './TrafficGenerator.module.css';

const GEOMETRY_LABEL: Record<ConflictKind, string> = {
  IN_TRAIL: 'En fila, por la misma ruta',
  CROSSING: 'Cruzándose, por ramas distintas',
  SAME_FIX: 'Sobre el mismo punto',
};

export interface TrafficGeneratorProps {
  /** La configuracion del ejercicio: los conflictos se miden con ella, no con otra. */
  readonly runwayInUse: string;
  readonly sivigats: boolean;
  readonly lvp: boolean;
  /** Reemplaza el trafico del borrador. El editor decide si ademas guarda la receta. */
  readonly onGenerate: (flights: readonly FlightDraft[], request: GeneratorRequest) => void;
  /** Lo que genero la ultima vez, si el ejercicio abierto venia del generador. */
  readonly previous?: GeneratorRequest | undefined;
}

function defaults(): GeneratorRequest {
  return {
    seed: '',
    arrivals: 5,
    departures: 1,
    targetEncounters: 2,
    startTime: parseHhmm('1100'),
    spreadMin: 12,
    focusFix: null,
    geometry: null,
  };
}

export function TrafficGenerator({
  runwayInUse,
  sivigats,
  lvp,
  onGenerate,
  previous,
}: TrafficGeneratorProps) {
  const procedures = useNavdataStore((s) => s.procedures);
  const sampleFlights = useNavdataStore((s) => s.sampleFlights);
  const ssrCodes = useNavdataStore((s) => s.ssrCodes);
  const performance = useNavdataStore((s) => s.performance);
  const holdings = useNavdataStore((s) => s.holdings);
  const separation = useNavdataStore((s) => s.separation);
  const approachFixes = useNavdataStore((s) => s.approachFixes);
  const tmaFixes = useNavdataStore((s) => s.tmaFixes);

  const [request, setRequest] = useState<GeneratorRequest>(() => previous ?? defaults());
  const [result, setResult] = useState<GeneratorResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startText, setStartText] = useState(() => formatHhmm((previous ?? defaults()).startTime));

  const set = <K extends keyof GeneratorRequest>(key: K, value: GeneratorRequest[K]) =>
    setRequest((r) => ({ ...r, [key]: value }));

  /** El catalogo es el mismo mientras no cambie la base (recien cargada, o editada y refrescada). */
  const usable = useMemo(
    () => procedures.filter((p) => p.legs.every((l) => l.distToEndNm !== null)),
    [procedures]
  );
  const CATALOGUE = useMemo(
    () => ({
      stars: usable.filter((p) => p.type === 'STAR'),
      sids: usable.filter((p) => p.type === 'SID'),
      templates: sampleFlights,
      ssrCodes,
      performance,
      holdings,
    }),
    [usable, sampleFlights, ssrCodes, performance, holdings]
  );

  /** Solo se ofrecen puntos por los que pasa algo: pedir un encuentro en otro sitio es imposible. */
  const FOCUS_FIXES = useMemo(
    () => [...new Set(usable.flatMap((p) => p.legs.map((l) => l.fix)))].sort(),
    [usable]
  );

  const ARRIVALS_AVAILABLE = useMemo(
    () => sampleFlights.filter((f) => f.ades === 'SCEL').length,
    [sampleFlights]
  );
  const DEPARTURES_AVAILABLE = useMemo(
    () => sampleFlights.filter((f) => f.adep === 'SCEL').length,
    [sampleFlights]
  );

  const detect = useMemo(
    () => ({ separation, approachFixes, tmaFixes, runwayInUse, sivigats, lvp }),
    [separation, approachFixes, tmaFixes, runwayInUse, sivigats, lvp]
  );

  const run = (overrideSeed?: string) => {
    const attempt: GeneratorRequest =
      overrideSeed === undefined ? request : { ...request, seed: overrideSeed };

    const outcome = generateTraffic(attempt, CATALOGUE, detect);
    if (!outcome.ok) {
      setError(outcome.message);
      setResult(null);
      return;
    }

    setError(null);
    setResult(outcome);
    // La semilla que se devuelve es la que de verdad se uso: si la peticion iba vacia, se fija
    // ahora para que el instructor pueda volver a este mismo ejercicio.
    const used: GeneratorRequest = { ...attempt, seed: outcome.seed };
    setRequest(used);

    onGenerate(
      outcome.flights.map((f) => ({
        id: crypto.randomUUID(),
        callsign: f.callsign,
        ssr: f.ssr,
        icaoType: f.icaoType,
        registration: null,
        tasKt: f.tasKt,
        adep: f.adep,
        ades: f.ades,
        kind: f.kind,
        procedureIdent: f.procedureIdent,
        entryTime: f.entryTime,
        levelFl: f.levelFl,
      })),
      used
    );
  };

  return (
    <section className={shared.section}>
      <div className={shared.sectionHead}>
        <h3 className={shared.sectionTitle}>Generar tráfico</h3>
        <div className={styles.runActions}>
          <button type="button" className={styles.primary} onClick={() => run()}>
            Generar
          </button>
          {result !== null ? (
            <button
              type="button"
              className={styles.secondary}
              onClick={() => run('')}
              title="Mismos parámetros, otro sorteo: otra versión del mismo ejercicio"
            >
              Otra variante
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.grid}>
        <label className={styles.field}>
          <span className={styles.label}>Llegadas</span>
          <input
            id="gen-arrivals"
            type="number"
            min={0}
            max={ARRIVALS_AVAILABLE}
            value={request.arrivals}
            onChange={(e) => set('arrivals', Math.max(0, Number(e.target.value) || 0))}
          />
          <em className={styles.hint}>{ARRIVALS_AVAILABLE} disponibles</em>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Salidas</span>
          <input
            id="gen-departures"
            type="number"
            min={0}
            max={DEPARTURES_AVAILABLE}
            value={request.departures}
            onChange={(e) => set('departures', Math.max(0, Number(e.target.value) || 0))}
          />
          <em className={styles.hint}>{DEPARTURES_AVAILABLE} disponibles</em>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Encuentros</span>
          <input
            id="gen-encounters"
            type="number"
            min={0}
            max={12}
            value={request.targetEncounters}
            onChange={(e) => set('targetEncounters', Math.max(0, Number(e.target.value) || 0))}
          />
          <em className={styles.hint}>Pares de vuelos a separar, no filas de conflicto</em>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Primer vuelo</span>
          <input
            id="gen-start"
            inputMode="numeric"
            value={startText}
            onChange={(e) => {
              setStartText(e.target.value);
              try {
                set('startTime', parseHhmm(e.target.value));
              } catch {
                // Se ignora mientras el texto está a medio escribir.
              }
            }}
          />
          <em className={styles.hint}>HHMM</em>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Ventana de entrada</span>
          <input
            id="gen-spread"
            type="number"
            min={0}
            max={120}
            value={request.spreadMin}
            onChange={(e) => set('spreadMin', Math.max(0, Number(e.target.value) || 0))}
          />
          <em className={styles.hint}>Minutos. Más estrecha, más apretado</em>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Semilla</span>
          <input
            id="gen-seed"
            value={request.seed}
            placeholder="al azar"
            onChange={(e) => set('seed', e.target.value)}
          />
          <em className={styles.hint}>La misma semilla da el mismo ejercicio</em>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Sobre el punto</span>
          <select
            id="gen-focus"
            value={request.focusFix ?? ''}
            onChange={(e) => set('focusFix', e.target.value === '' ? null : e.target.value)}
          >
            <option value="">Donde salga</option>
            {FOCUS_FIXES.map((fix) => (
              <option key={fix} value={fix}>
                {fix}
              </option>
            ))}
          </select>
          <em className={styles.hint}>Dónde se materializa el problema</em>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Geometría</span>
          <select
            id="gen-geometry"
            value={request.geometry ?? ''}
            onChange={(e) =>
              set('geometry', e.target.value === '' ? null : (e.target.value as ConflictKind))
            }
          >
            <option value="">La que salga</option>
            {(Object.keys(GEOMETRY_LABEL) as ConflictKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {GEOMETRY_LABEL[kind]}
              </option>
            ))}
          </select>
          <em className={styles.hint}>Cómo se encuentran</em>
        </label>
      </div>

      {error !== null ? (
        <div className={shared.notice} role="alert">
          <strong>No se pudo generar.</strong> {error}
        </div>
      ) : null}

      {result !== null ? (
        <>
          <div className={result.matched ? styles.outcome : styles.outcomeShort} role="status">
            <p className={styles.outcomeHead}>
              {result.matched
                ? `${result.encounters.length} encuentro${
                    result.encounters.length === 1 ? '' : 's'
                  } en ${result.flights.length} vuelos`
                : 'No se llegó a lo pedido'}
              <span className={styles.seed}>
                semilla <code>{result.seed}</code> · {result.attempts} sorteo
                {result.attempts === 1 ? '' : 's'}
              </span>
            </p>

            {result.shortfall.length > 0 ? (
              <ul className={styles.shortfall}>
                {result.shortfall.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}

            {result.notes.length > 0 ? (
              <ul className={styles.shortfall}>
                {result.notes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}

            {result.encounters.length > 0 ? (
              <ol className={styles.encounters}>
                {result.encounters.map((e) => {
                  const callsigns = e.flightIds.map(
                    (id) => result.flights[Number(id.slice(1)) - 1]?.callsign ?? id
                  );
                  return (
                    <li key={e.id}>
                      <span className={styles.time}>{formatHhmm(e.firstTime)}</span>
                      <strong>{callsigns.join(' / ')}</strong> sobre {e.firstFix} ·{' '}
                      {GEOMETRY_LABEL[e.kind].toLowerCase()}
                      <span className={e.severity === 'LOSS' ? styles.loss : styles.marginal}>
                        {e.severity === 'LOSS' ? 'pérdida' : 'al límite'}
                      </span>
                      {e.conflicts.length > 1 ? (
                        <span className={styles.span}>
                          se arrastra por {e.conflicts.length} puntos
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </div>

          <p className={shared.note}>
            Esto es un borrador: revísalo abajo antes de darlo. El sistema sabe poner el número
            de encuentros que le pides, pero <strong>no sabe si el que salió vale la pena
            enseñarlo</strong> — eso todavía es criterio tuyo, y lo será hasta que exista el
            catálogo de conflictos tipo.
          </p>
        </>
      ) : (
        <p className={shared.note}>
          Sorteo con los vuelos de <code>data/sample-flights.json</code> y los procedimientos
          publicados; los conflictos se miden con el mismo detector que el resto de la aplicación.
          Un <strong>encuentro</strong> es un par de vuelos que hay que separar: dos llegadas
          demasiado juntas por la misma STAR chocan sobre cada punto que comparten, pero son un
          solo problema y se resuelven con una instrucción.
        </p>
      )}
    </section>
  );
}
