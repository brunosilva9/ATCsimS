/**
 * Modo prueba, lado del alumno.
 *
 * El sistema no ayuda. No hay lista de conflictos, no hay marcas en el diagrama, no hay nada
 * que cambie de color al acertar. Lo unico que devuelve la pantalla es el trabajo del propio
 * alumno: el diagrama se dibuja con SUS horas, correctas o no.
 *
 * Si el instructor activo las instrucciones, se anotan pero **no se aplican**: recalcular seria
 * resolverle el ejercicio. Van en la entrega para que el profesor las juzgue.
 */

import { useMemo, useState } from 'react';

import { answersToFlights, formatHhmm } from '@atcsims/core';
import type { ExamAnswers, ExamEntry, Instruction, Scenario } from '@atcsims/core';

import { ExamStrip } from '../components/ExamStrip.js';
import { InstructionPanel } from '../components/InstructionPanel.js';
import { TimeFixDiagram } from '../components/TimeFixDiagram.js';
import { describeInstruction } from '../lib/instructionText.js';
import { downloadPayload } from '../lib/share.js';
import shared from './shared.module.css';
import styles from './ExamSession.module.css';

export interface ExamSessionProps {
  readonly scenario: Scenario;
  readonly allowInstructions: boolean;
  /** Supuestos del motor. Se reenvian intactos en la entrega, para que el profesor los vea. */
  readonly assumptions: readonly { readonly flightId: string; readonly note: string }[];
}

export function ExamSession({ scenario, allowInstructions, assumptions }: ExamSessionProps) {
  const [answers, setAnswers] = useState<Map<string, ExamEntry>>(new Map());
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [student, setStudent] = useState('');

  const patch = (
    flightId: string,
    fix: string,
    values: Partial<Omit<ExamEntry, 'flightId' | 'fix'>>
  ) => {
    setAnswers((current) => {
      const next = new Map(current);
      const key = `${flightId}|${fix}`;
      const existing = next.get(key) ?? {
        flightId,
        fix,
        eto: null,
        levelFt: null,
        gsKt: null,
      };
      next.set(key, { ...existing, ...values });
      return next;
    });
  };

  const examAnswers: ExamAnswers = useMemo(
    () => ({ entries: [...answers.values()] }),
    [answers]
  );

  /** El diagrama del alumno: solo lo que ha calculado, sin marcas de ninguna clase. */
  const ownFlights = useMemo(
    () => answersToFlights(scenario, examAnswers),
    [scenario, examAnswers]
  );

  const answered = examAnswers.entries.filter((e) => e.eto !== null).length;
  const total = scenario.flights.reduce((n, f) => n + Math.max(0, f.legs.length - 1), 0);

  const entriesFor = (flightId: string): ReadonlyMap<string, ExamEntry> => {
    const map = new Map<string, ExamEntry>();
    for (const e of examAnswers.entries) if (e.flightId === flightId) map.set(e.fix, e);
    return map;
  };

  const submit = () => {
    downloadPayload(
      {
        version: 1,
        scenario,
        instructions,
        mode: 'exam',
        allowInstructions,
        assumptions,
        answers: examAnswers,
        student: student.trim() === '' ? 'sin nombre' : student.trim(),
        submittedAt: new Date().toISOString(),
      },
      `prueba-${scenario.id}-${student.trim() || 'entrega'}.json`
    );
  };

  return (
    <div className={shared.page}>
      <header className={shared.pageHead}>
        <div>
          <p className={styles.eyebrow}>Prueba</p>
          <h2 className={shared.pageTitle}>{scenario.name}</h2>
          <p className={shared.lead}>{scenario.objective}</p>
        </div>
        <div className={styles.actions}>
          <label className={styles.student}>
            <span className={styles.label}>Alumno</span>
            <input
              id="exam-student"
              value={student}
              placeholder="Tu nombre"
              onChange={(e) => setStudent(e.target.value)}
            />
          </label>
          <button type="button" className={styles.primary} onClick={submit}>
            Entregar
          </button>
        </div>
      </header>

      <div className={styles.rules}>
        <strong>Calcula tú las horas de paso, el nivel y la velocidad de cada punto.</strong> El
        sistema no te va a decir si vas bien: no hay conflictos marcados ni casillas que cambien
        de color. Corrige el profesor, cuando abra tu entrega.
        <span className={styles.progress}>
          {answered} de {total} puntos con hora
        </span>
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>Configuración</dt>
          <dd>
            {scenario.configuration} · RWY {scenario.runwayInUse}
          </dd>
        </div>
        <div>
          <dt>SIVIGATS</dt>
          <dd>{scenario.sivigats ? 'Disponible' : 'No disponible'}</dd>
        </div>
        <div>
          <dt>QNH</dt>
          <dd>{scenario.weather.qnhHpa} hPa</dd>
        </div>
        <div>
          <dt>Nivel de transición</dt>
          <dd>{scenario.weather.transitionLevel}</dd>
        </div>
      </dl>

      <section className={shared.section}>
        <h3 className={shared.sectionTitle}>Fichas de progreso</h3>
        <p className={shared.note}>
          La columna sombreada es el enunciado: el punto por el que entra al sector, con su hora
          y su nivel. El resto lo rellenas tú.
        </p>
        <div className={styles.strips}>
          {scenario.flights.map((flight) => (
            <ExamStrip
              key={flight.id}
              flight={flight}
              entries={entriesFor(flight.id)}
              onChange={(fix, values) => patch(flight.id, fix, values)}
            />
          ))}
        </div>
      </section>

      {allowInstructions ? (
        <section className={shared.section}>
          <h3 className={shared.sectionTitle}>Instrucciones</h3>
          <p className={shared.note}>
            Anota las instrucciones que darías. <strong>No se aplican</strong>: si el sistema
            recalculara las horas por ti, te estaría resolviendo la prueba. Van en la entrega tal
            como las escribes.
          </p>
          <InstructionPanel
            scenario={scenario}
            error={null}
            onSubmit={(draft) =>
              setInstructions((current) => [...current, { ...draft, id: crypto.randomUUID() }])
            }
          />
          {instructions.length > 0 ? (
            <ol className={styles.log}>
              {instructions.map((i) => {
                const flight = scenario.flights.find((f) => f.id === i.flightId);
                return (
                  <li key={i.id} className={styles.logItem}>
                    <span className={styles.logTime}>{formatHhmm(i.time)}</span>
                    <span className={styles.logBody}>
                      <strong>{flight?.callsign ?? i.flightId}</strong> ·{' '}
                      {describeInstruction(i)}
                    </span>
                    <button
                      type="button"
                      className={styles.remove}
                      aria-label="Quitar esta instrucción"
                      onClick={() =>
                        setInstructions((current) => current.filter((x) => x.id !== i.id))
                      }
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : null}
        </section>
      ) : null}

      <section className={shared.section}>
        <h3 className={shared.sectionTitle}>Tu diagrama</h3>
        <p className={shared.note}>
          Construido con las horas que has escrito, no con las del motor. Aparecen solo los
          puntos que has calculado y no hay ninguna marca: si dos vuelos se juntan, lo tienes
          que ver tú.
        </p>
        <TimeFixDiagram
          flights={ownFlights}
          startTime={scenario.startTime}
          durationMin={scenario.durationMin}
          showCoincidences={false}
        />
      </section>
    </div>
  );
}
