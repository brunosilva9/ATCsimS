/**
 * Armar un ejercicio.
 *
 * El instructor edita la receta y ve el resultado calculado al lado, en el mismo momento:
 * cuantos conflictos salen, donde, y con que minima se midieron. Es lo que hoy hace sobre la
 * planilla de horas a mano, y es la parte lenta de preparar una clase.
 *
 * Nada se guarda solo. El boton de guardar escribe en el navegador; el de enlace produce el
 * ejercicio que se le pasa al alumno.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { detectConflicts, formatHhmm, parseHhmm } from '@atcsims/core';
import type { GeneratorRequest } from '@atcsims/core';
import {
  approachFixes,
  procedures,
  sampleFlights,
  separation,
  ssrCodes,
  tmaFixes,
} from '@atcsims/navdata';

import { ConflictList } from '../components/ConflictList.js';
import { FlightProgressStrip } from '../components/FlightProgressStrip.js';
import { TimeFixDiagram } from '../components/TimeFixDiagram.js';
import { TrafficGenerator } from '../components/TrafficGenerator.js';
import { deleteDraft, getDraft, newDraftId, saveDraft } from '../lib/storage.js';
import { encodePayload, exerciseLink } from '../lib/share.js';
import { buildScenario } from '../scenarios/build.js';
import type { FlightDraft, ScenarioDraft } from '../scenarios/build.js';
import { SAMPLE_DRAFT } from '../scenarios/sample.js';
import shared from './shared.module.css';
import styles from './ScenarioEditor.module.css';

/** Solo se ofrecen los procedimientos que el motor puede calcular de verdad. */
const usable = procedures.filter((p) => p.legs.every((l) => l.distToEndNm !== null));
const stars = usable.filter((p) => p.type === 'STAR');
const sids = usable.filter((p) => p.type === 'SID');

function emptyDraft(): ScenarioDraft {
  return {
    id: newDraftId(),
    name: 'Ejercicio sin título',
    configuration: 'SUR',
    runwayInUse: '17L',
    sivigats: true,
    objective: '',
    weather: {
      qnhHpa: 1013,
      transitionLevel: 'FL150',
      vmc: true,
      visibilityM: 9999,
      ceilingFt: null,
      lvp: false,
    },
    flights: [],
  };
}

/** El primer codigo del pool que no esté ya en uso en este ejercicio. */
function freeSsr(used: readonly string[]): string {
  const taken = new Set(used);
  return ssrCodes.find((c) => !taken.has(c)) ?? '0000';
}

function parseHhmmOrNull(text: string): number | null {
  try {
    return parseHhmm(text);
  } catch {
    return null;
  }
}

function parseLevelOrNull(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

const formatLevel = (value: number): string => String(value);

interface BufferedFieldProps {
  readonly id: string;
  /** Como el className de cualquier elemento: el modulo CSS puede no traer la clase. */
  readonly className?: string | undefined;
  readonly ariaLabel: string;
  readonly value: number;
  readonly format: (value: number) => string;
  readonly parse: (text: string) => number | null;
  readonly onCommit: (value: number) => void;
}

/**
 * Un campo de texto que no se resetea en cada tecla intermedia.
 *
 * Vincular `value={format(x)}` directo contra el estado calculado tiene un problema: al
 * escribir, casi todos los estados de a medio camino no forman un valor valido ("1", "12", o
 * vacio al borrar para reescribir), y si esos casos no tocan el estado, React repinta el input
 * con el valor VIEJO en cada tecla — el campo salta hacia atras y no deja escribir nada nuevo.
 * Es justo lo que pasaba con la hora de entrada: escribir "1230" mostraba "0000" o volvia a la
 * hora anterior en cada digito.
 *
 * Aca el texto que se ve es SIEMPRE lo que el usuario escribio (un estado propio, no el
 * calculado), y el valor de verdad solo se actualiza cuando ese texto ya es valido. Al perder el
 * foco con algo invalido a medio escribir, se repone el ultimo valor bueno.
 */
function BufferedField({
  id,
  className,
  ariaLabel,
  value,
  format,
  parse,
  onCommit,
}: BufferedFieldProps) {
  const [text, setText] = useState(() => format(value));

  // Si el valor cambia por otra via mientras no se esta escribiendo aca (otro campo lo afecta,
  // se carga un borrador distinto), el texto se pone al dia. Mientras se escribe, el valor de
  // verdad no cambia por si solo, asi que esto no le pisa a nadie lo que lleva a medio escribir.
  useEffect(() => {
    setText(format(value));
  }, [value, format]);

  return (
    <input
      id={id}
      className={className}
      inputMode="numeric"
      aria-label={ariaLabel}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const parsed = parse(e.target.value);
        if (parsed !== null) onCommit(parsed);
      }}
      onBlur={() => setText(format(value))}
    />
  );
}

export function ScenarioEditor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [draft, setDraft] = useState<ScenarioDraft>(emptyDraft);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);

  useEffect(() => {
    if (id === undefined) return;
    if (id === 'nuevo') {
      setDraft(emptyDraft());
      return;
    }
    if (id === 'ejemplo') {
      setDraft({ ...SAMPLE_DRAFT, id: newDraftId(), name: `${SAMPLE_DRAFT.name} (copia)` });
      return;
    }
    const stored = getDraft(id);
    if (stored) setDraft(stored);
  }, [id]);

  const mode = draft.mode ?? 'practice';
  const built = useMemo(() => buildScenario(draft), [draft]);

  const report = useMemo(
    () =>
      detectConflicts(built.scenario, {
        separation,
        approachFixes,
        tmaFixes,
        runwayInUse: draft.runwayInUse,
        sivigats: draft.sivigats,
        lvp: draft.weather.lvp,
      }),
    [built.scenario, draft.runwayInUse, draft.sivigats, draft.weather.lvp]
  );

  const set = <K extends keyof ScenarioDraft>(key: K, value: ScenarioDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setWeather = <K extends keyof ScenarioDraft['weather']>(
    key: K,
    value: ScenarioDraft['weather'][K]
  ) => setDraft((d) => ({ ...d, weather: { ...d.weather, [key]: value } }));

  const patchFlight = (flightId: string, patch: Partial<FlightDraft>) =>
    setDraft((d) => ({
      ...d,
      flights: d.flights.map((f) => (f.id === flightId ? { ...f, ...patch } : f)),
    }));

  const addFlight = (callsign: string) => {
    const catalogue = sampleFlights.find((f) => f.callsign === callsign);
    if (!catalogue) return;

    // Llegada o salida se deduce del propio vuelo: si sale de SCEL, es una salida.
    const isDeparture = catalogue.adep === 'SCEL';
    const procedure = isDeparture ? sids[0] : stars[0];
    if (!procedure) return;

    const last = draft.flights[draft.flights.length - 1];
    setDraft((d) => ({
      ...d,
      flights: [
        ...d.flights,
        {
          id: crypto.randomUUID(),
          callsign: catalogue.callsign,
          ssr: freeSsr(d.flights.map((f) => f.ssr)),
          icaoType: catalogue.icaoType,
          registration: null,
          tasKt: catalogue.tasKt,
          adep: catalogue.adep,
          ades: catalogue.ades,
          kind: isDeparture ? 'DEPARTURE' : 'ARRIVAL',
          procedureIdent: procedure.ident,
          // Cada vuelo nuevo entra tres minutos después del anterior: un punto de partida
          // razonable que el instructor ajusta, no una decisión oculta.
          entryTime: last !== undefined ? last.entryTime + 3 : parseHhmm('1100'),
          levelFl: isDeparture ? 230 : 240,
        },
      ],
    }));
  };

  const removeFlight = (flightId: string) =>
    setDraft((d) => ({ ...d, flights: d.flights.filter((f) => f.id !== flightId) }));

  /**
   * El generador REEMPLAZA el trafico, no lo añade. Mezclar vuelos sorteados con vuelos puestos
   * a mano daria un ejercicio que ya no se reproduce con su semilla, y la semilla es lo unico
   * que hace util al generador para tomar pruebas.
   */
  const applyGenerated = (flights: readonly FlightDraft[], request: GeneratorRequest) =>
    setDraft((d) => ({
      ...d,
      flights: [...flights],
      generator: request,
      // Solo se renombra si el instructor no le puso nombre: es su ejercicio, no del sorteo.
      name:
        d.name === 'Ejercicio sin título'
          ? `Generado ${request.seed} — ${request.targetEncounters} encuentro${
              request.targetEncounters === 1 ? '' : 's'
            }`
          : d.name,
    }));

  const save = () => {
    const ok = saveDraft(draft);
    setStorageFailed(!ok);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  // El modo viaja dentro del ejercicio: el alumno recibe una prueba, no un enlace que pueda
  // convertir en practica quitando un parametro de la URL.
  const payload = {
    version: 1 as const,
    scenario: built.scenario,
    instructions: [],
    mode,
    allowInstructions: draft.allowInstructions ?? false,
    assumptions: built.assumptions.map((a) => ({ flightId: a.flightId, note: a.note })),
  };

  const copyLink = () => {
    void navigator.clipboard.writeText(exerciseLink(payload)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const remove = () => {
    deleteDraft(draft.id);
    navigate('/scenarios');
  };

  const duplicateSsr = useMemo(() => {
    const seen = new Set<string>();
    return draft.flights.filter((f) => (seen.has(f.ssr) ? true : (seen.add(f.ssr), false)));
  }, [draft.flights]);

  return (
    <div className={shared.page}>
      {/*
        La unica pantalla del instructor a la que se llega desde una lista (/scenarios) y no
        directo desde el menu de arriba. Sin esto, la unica vuelta al banco era editar la URL a
        mano: el enlace "Ejercicios" del menu tambien sirve, pero nada en esta pantalla lo dice.
      */}
      <Link to="/scenarios" className={styles.back}>
        ← Ejercicios
      </Link>

      <header className={shared.pageHead}>
        <div className={styles.titleBlock}>
          <p className={shared.eyebrow}>Instructor · armar ejercicio</p>
          <input
            id="scenario-name"
            className={styles.titleInput}
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            aria-label="Nombre del ejercicio"
          />
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={save}>
            {saved ? 'Guardado' : 'Guardar'}
          </button>
          {/*
            Abre el ejercicio en una pestaña nueva de esta misma app, sin copiar ni pegar nada
            a mano: es la manera de probarlo uno mismo, en el modo que sea, sin pasar por
            "copiar enlace" y pegarlo en otra ventana. Pestaña nueva y no la misma, para no
            perder lo que hay a medio editar aqui.
          */}
          <a
            className={styles.secondary}
            href={`#/exercise?e=${encodePayload(payload)}`}
            target="_blank"
            rel="noreferrer"
          >
            Probar aquí
          </a>
          <button
            type="button"
            className={styles.secondary}
            onClick={copyLink}
            disabled={built.scenario.flights.length === 0}
          >
            {copied ? 'Enlace copiado' : 'Copiar enlace'}
          </button>
          <a
            className={styles.secondary}
            href={`#/print?e=${encodePayload(payload)}`}
            target="_blank"
            rel="noreferrer"
          >
            Imprimir
          </a>
          <button type="button" className={styles.danger} onClick={remove}>
            Borrar
          </button>
        </div>
      </header>

      {storageFailed ? (
        <div className={shared.notice} role="alert">
          <strong>No se pudo guardar en este navegador.</strong> Puede ser una ventana privada o
          tener el almacenamiento bloqueado. Usa «Copiar enlace» o «Imprimir»: ese contenido no
          depende del navegador.
        </div>
      ) : null}

      <div className={styles.split}>
        <div className={styles.left}>
          <section className={shared.section}>
            <h3 className={shared.sectionTitle}>Cómo se trabaja</h3>
            <div className={styles.modes} role="group" aria-label="Modo del ejercicio">
              <button
                type="button"
                aria-pressed={mode === 'practice'}
                className={mode === 'practice' ? styles.modeOn : styles.mode}
                onClick={() => set('mode', 'practice')}
              >
                <span className={styles.modeName}>Práctica</span>
                <span className={styles.modeHint}>
                  El sistema calcula las horas y las va corrigiendo. El alumno separa el tráfico y
                  ve los conflictos aparecer y desaparecer.
                </span>
              </button>
              <button
                type="button"
                aria-pressed={mode === 'exam'}
                className={mode === 'exam' ? styles.modeOn : styles.mode}
                onClick={() => set('mode', 'exam')}
              >
                <span className={styles.modeName}>Prueba</span>
                <span className={styles.modeHint}>
                  El alumno calcula a mano la hora, el nivel y la velocidad de cada punto. El
                  sistema no le dice nada. Corriges tú al abrir la entrega.
                </span>
              </button>
            </div>

            {mode === 'exam' ? (
              <label className={styles.check}>
                <input
                  type="checkbox"
                  id="cfg-allow-instructions"
                  checked={draft.allowInstructions ?? false}
                  onChange={(e) => set('allowInstructions', e.target.checked)}
                />
                <span>
                  Además de calcular, tiene que instruir
                  <em className={styles.checkHint}>
                    Las instrucciones se anotan pero no se aplican: recalcular sería resolverle la
                    prueba. Te llegan en la entrega para que las juzgues.
                  </em>
                </span>
              </label>
            ) : null}
          </section>

          <section className={shared.section}>
            <h3 className={shared.sectionTitle}>Configuración</h3>
            <div className={styles.grid}>
              <label className={styles.field}>
                <span className={styles.label}>Pista en uso</span>
                <select
                  id="cfg-runway"
                  value={draft.runwayInUse}
                  onChange={(e) => set('runwayInUse', e.target.value)}
                >
                  <option value="17L">17L</option>
                  <option value="17R">17R</option>
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>QNH (hPa)</span>
                <input
                  id="cfg-qnh"
                  inputMode="numeric"
                  value={draft.weather.qnhHpa}
                  onChange={(e) => setWeather('qnhHpa', Number(e.target.value) || 0)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Nivel de transición</span>
                <input
                  id="cfg-trl"
                  value={draft.weather.transitionLevel}
                  onChange={(e) => setWeather('transitionLevel', e.target.value)}
                />
              </label>

              <label className={styles.check}>
                <input
                  type="checkbox"
                  id="cfg-sivigats"
                  checked={draft.sivigats}
                  onChange={(e) => set('sivigats', e.target.checked)}
                />
                <span>
                  SIVIGATS disponible
                  <em className={styles.checkHint}>
                    Con vigilancia separa el radar; sin ella, la mínima procedimental
                  </em>
                </span>
              </label>

              <label className={styles.check}>
                <input
                  type="checkbox"
                  id="cfg-lvp"
                  checked={draft.weather.lvp}
                  onChange={(e) => setWeather('lvp', e.target.checked)}
                />
                <span>
                  Procedimientos de baja visibilidad
                  <em className={styles.checkHint}>Cambia la mínima de espaciamiento</em>
                </span>
              </label>

              <label className={styles.check}>
                <input
                  type="checkbox"
                  id="cfg-vmc"
                  checked={draft.weather.vmc}
                  onChange={(e) => setWeather('vmc', e.target.checked)}
                />
                <span>Condiciones visuales</span>
              </label>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Objetivo del ejercicio</span>
              <textarea
                id="cfg-objective"
                rows={2}
                value={draft.objective}
                placeholder="Qué tiene que conseguir el alumno"
                onChange={(e) => set('objective', e.target.value)}
              />
            </label>
          </section>

          <TrafficGenerator
            runwayInUse={draft.runwayInUse}
            sivigats={draft.sivigats}
            lvp={draft.weather.lvp}
            previous={draft.generator}
            onGenerate={applyGenerated}
          />

          <section className={shared.section}>
            <div className={shared.sectionHead}>
              <h3 className={shared.sectionTitle}>Tráfico ({draft.flights.length})</h3>
              <label className={styles.add}>
                <span className={styles.label}>Añadir del catálogo</span>
                <select
                  id="add-flight"
                  value=""
                  onChange={(e) => {
                    addFlight(e.target.value);
                    e.target.value = '';
                  }}
                >
                  <option value="">Elegir vuelo…</option>
                  {sampleFlights.map((f) => (
                    <option key={f.callsign} value={f.callsign}>
                      {f.callsign} · {f.icaoType} · {f.adep}→{f.ades}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {draft.flights.length === 0 ? (
              <p className={shared.note}>
                Sin tráfico todavía. Los indicativos del selector salen de{' '}
                <code>data/sample-flights.json</code>, que es el catálogo de la hoja ACFT.
              </p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Indicativo</th>
                      <th>Tipo</th>
                      <th>SSR</th>
                      <th>Procedimiento</th>
                      <th>Entrada</th>
                      <th>Nivel</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {draft.flights.map((f) => (
                      <tr key={f.id}>
                        <td>
                          <span className={styles.callsign}>{f.callsign}</span>
                          <span className={styles.route}>
                            {f.adep}→{f.ades}
                          </span>
                        </td>
                        <td className={styles.mono}>{f.icaoType}</td>
                        <td>
                          <input
                            className={styles.cellInput}
                            value={f.ssr}
                            aria-label={`Código SSR de ${f.callsign}`}
                            onChange={(e) => patchFlight(f.id, { ssr: e.target.value })}
                          />
                        </td>
                        <td>
                          <select
                            className={styles.cellSelect}
                            value={f.procedureIdent}
                            aria-label={`Procedimiento de ${f.callsign}`}
                            onChange={(e) => {
                              // El tipo de vuelo lo decide el procedimiento: cambiar a una SID
                              // convierte la llegada en salida, o el motor calcularia un
                              // descenso sobre una trayectoria de ascenso.
                              const chosen = usable.find((p) => p.ident === e.target.value);
                              patchFlight(f.id, {
                                procedureIdent: e.target.value,
                                ...(chosen
                                  ? { kind: chosen.type === 'SID' ? 'DEPARTURE' : 'ARRIVAL' }
                                  : {}),
                              });
                            }}
                          >
                            <optgroup label="Llegadas">
                              {stars.map((p) => (
                                <option key={p.ident} value={p.ident}>
                                  {p.ident}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Salidas">
                              {sids.map((p) => (
                                <option key={p.ident} value={p.ident}>
                                  {p.ident}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </td>
                        <td>
                          <BufferedField
                            id={`entry-${f.id}`}
                            className={styles.cellInput}
                            ariaLabel={`Hora de entrada de ${f.callsign}`}
                            value={f.entryTime}
                            format={formatHhmm}
                            parse={parseHhmmOrNull}
                            onCommit={(entryTime) => patchFlight(f.id, { entryTime })}
                          />
                        </td>
                        <td>
                          <BufferedField
                            id={`level-${f.id}`}
                            className={styles.cellInput}
                            ariaLabel={`Nivel de ${f.callsign}`}
                            value={f.levelFl}
                            format={formatLevel}
                            parse={parseLevelOrNull}
                            onCommit={(levelFl) => patchFlight(f.id, { levelFl })}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.remove}
                            aria-label={`Quitar ${f.callsign}`}
                            onClick={() => removeFlight(f.id)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {duplicateSsr.length > 0 ? (
              <div className={shared.notice} role="alert">
                <strong>Códigos SSR repetidos.</strong> {duplicateSsr.map((f) => f.callsign).join(', ')}{' '}
                comparten código con otro vuelo. En el aire, dos aeronaves con el mismo código no
                se distinguen en pantalla.
              </div>
            ) : null}

            {built.rejected.length > 0 ? (
              <div className={shared.notice} role="alert">
                <strong>Vuelos que no se pueden calcular.</strong>
                <ul>
                  {built.rejected.map((r) => (
                    <li key={r.callsign}>
                      <code>{r.callsign}</code> por <code>{r.procedureIdent}</code> — {r.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>

        <aside className={styles.right}>
          <section className={shared.section}>
            <h3 className={shared.sectionTitle}>Cómo queda</h3>
            {built.scenario.flights.length === 0 ? (
              <p className={shared.note}>Añade tráfico para ver el ejercicio.</p>
            ) : (
              <>
                <dl className={styles.facts}>
                  <div>
                    <dt>Ventana</dt>
                    <dd>
                      {formatHhmm(built.scenario.startTime)}–
                      {formatHhmm(built.scenario.startTime + built.scenario.durationMin)}
                    </dd>
                  </div>
                  <div>
                    <dt>Duración</dt>
                    <dd>{built.scenario.durationMin} min</dd>
                  </div>
                </dl>
                <ConflictList report={report} scenario={built.scenario} />
              </>
            )}
          </section>

          {built.assumptions.length > 0 ? (
            <section className={shared.section}>
              <h3 className={shared.sectionTitle}>Supuestos del motor</h3>
              <ul className={styles.assumptions}>
                {[...new Set(built.assumptions.map((a) => a.note))].map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

      {built.scenario.flights.length > 0 ? (
        <section className={shared.section}>
          <h3 className={shared.sectionTitle}>Diagrama tiempo × punto</h3>
          <TimeFixDiagram
            flights={built.scenario.flights}
            startTime={built.scenario.startTime}
            durationMin={built.scenario.durationMin}
          />
        </section>
      ) : null}

      {built.scenario.flights.length > 0 ? (
        /*
         * La clave. Esta pantalla es solo del instructor, asi que no hay nada que ocultar: lo
         * que el motor calcula para este ejercicio ya esta en `built.scenario` y solo hacia
         * falta mostrarlo, con la misma strip de siempre. Sirve para comprobar un ejercicio
         * antes de darlo, y para corregir en el momento sin esperar a que alguien entregue.
         * Cerrada por defecto (<details> sin `open`): son varias strips anchas y no hace falta
         * verlas cada vez que se toca el editor.
         */
        <details className={styles.solution}>
          <summary className={shared.sectionTitle}>
            Clave — la solución que calcula el motor
          </summary>
          <p className={shared.note}>
            Para comprobar el ejercicio antes de darlo, o para corregirlo sin esperar una
            entrega. {mode === 'exam' ? 'El alumno nunca ve esta pantalla.' : ''}
          </p>
          <div className={styles.strips}>
            {built.scenario.flights.map((flight) => (
              <FlightProgressStrip key={flight.id} flight={flight} variant="APP" />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
