/**
 * La sesion del alumno: donde se controla.
 *
 * El ejercicio llega por el hash de la URL (el enlace que pasa el instructor) o, si no hay
 * ninguno, se carga el de ejemplo para poder probar la app sin que nadie te mande nada.
 *
 * La pantalla es una sola cosa repetida en tres formas: las strips dicen que lleva cada vuelo,
 * el diagrama dice donde se van a encontrar, y la lista de conflictos dice cuales de esos
 * encuentros son un problema. Instruir cambia las tres a la vez.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { formatHhmm } from '@atcsims/core';

import { ConflictList } from '../components/ConflictList.js';
import { FlightProgressStrip } from '../components/FlightProgressStrip.js';
import { InstructionPanel } from '../components/InstructionPanel.js';
import { TimeFixDiagram } from '../components/TimeFixDiagram.js';
import { decodePayload, downloadPayload } from '../lib/share.js';
import { buildSampleScenario } from '../scenarios/sample.js';
import { useSession } from '../state/session.js';
import shared from './shared.module.css';
import styles from './Exercise.module.css';

const KIND_LABEL: Record<string, string> = {
  LEVEL_CHANGE: 'Nivel',
  SPEED_RESTRICTION: 'Velocidad',
  HOLD: 'Espera',
  VECTOR: 'Vectores',
  DIRECT: 'Directo',
  TRANSFER: 'Transferencia',
};

export function Exercise() {
  const [params] = useSearchParams();
  const encoded = params.get('e');

  const { base, current, conflicts, instructions, error, load, add, remove, reset } = useSession();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [student, setStudent] = useState('');

  useEffect(() => {
    if (encoded === null) {
      setLoadError(null);
      load(buildSampleScenario().scenario);
      return;
    }
    const decoded = decodePayload(encoded);
    if (!decoded.ok) {
      setLoadError(decoded.message);
      load(buildSampleScenario().scenario);
      return;
    }
    setLoadError(null);
    load(decoded.payload.scenario, decoded.payload.instructions);
  }, [encoded, load]);

  if (!base || !current) {
    return (
      <div className={shared.page}>
        <p className={shared.note}>Cargando el ejercicio…</p>
      </div>
    );
  }

  const callsignOf = (id: string) =>
    current.flights.find((f) => f.id === id)?.callsign ?? id;

  const submit = () => {
    downloadPayload(
      {
        version: 1,
        scenario: base,
        instructions,
        student: student.trim() === '' ? 'sin nombre' : student.trim(),
        submittedAt: new Date().toISOString(),
      },
      `${base.id}-${student.trim() || 'entrega'}.json`
    );
  };

  return (
    <div className={shared.page}>
      <header className={shared.pageHead}>
        <div>
          <p className={shared.eyebrow}>Sesión de control</p>
          <h2 className={shared.pageTitle}>{base.name}</h2>
          <p className={shared.lead}>{base.objective}</p>
        </div>
        <div className={styles.actions}>
          <label className={styles.student}>
            <span className={styles.studentLabel}>Alumno</span>
            <input
              id="student-name"
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

      {loadError !== null ? (
        <div className={shared.notice} role="alert">
          <strong>No se pudo abrir el enlace.</strong> {loadError} Se cargó el ejercicio de
          ejemplo en su lugar.
        </div>
      ) : null}

      <div className={styles.split}>
        <div className={styles.left}>
          <section className={shared.section}>
            <h3 className={shared.sectionTitle}>Fichas de progreso</h3>
            <div className={styles.strips}>
              {current.flights.map((flight) => (
                <FlightProgressStrip key={flight.id} flight={flight} variant="APP" />
              ))}
            </div>
          </section>

          <section className={shared.section}>
            <h3 className={shared.sectionTitle}>Diagrama tiempo × punto</h3>
            <TimeFixDiagram
              flights={current.flights}
              startTime={current.startTime}
              durationMin={current.durationMin}
            />
          </section>
        </div>

        <aside className={styles.right}>
          <section className={shared.section}>
            <h3 className={shared.sectionTitle}>Instruir</h3>
            <InstructionPanel scenario={current} onSubmit={add} error={error} />
          </section>

          <section className={shared.section}>
            <div className={shared.sectionHead}>
              <h3 className={shared.sectionTitle}>Instrucciones dadas</h3>
              {instructions.length > 0 ? (
                <button type="button" className={styles.link} onClick={reset}>
                  Empezar de nuevo
                </button>
              ) : null}
            </div>
            {instructions.length === 0 ? (
              <p className={shared.note}>
                Todavía no has instruido nada. Las horas que ves son las del plan.
              </p>
            ) : (
              <ol className={styles.log}>
                {instructions.map((i) => (
                  <li key={i.id} className={styles.logItem}>
                    <span className={styles.logTime}>{formatHhmm(i.time)}</span>
                    <span className={styles.logBody}>
                      <strong>{callsignOf(i.flightId)}</strong> · {KIND_LABEL[i.kind] ?? i.kind}
                      {i.levelFt !== undefined ? ` a FL${Math.round(i.levelFt / 100)}` : ''}
                      {i.speedKt !== undefined ? ` ${i.speedKt} kt` : ''}
                      {i.holdMinutes !== undefined ? ` ${i.holdMinutes} min` : ''}
                      {i.extraTrackNm !== undefined ? ` +${i.extraTrackNm} NM` : ''}
                      {i.targetFix !== undefined ? ` a ${i.targetFix}` : ''}
                      {i.fromFix !== null ? ` desde ${i.fromFix}` : ''}
                    </span>
                    <button
                      type="button"
                      className={styles.remove}
                      aria-label={`Deshacer instrucción de las ${formatHhmm(i.time)}`}
                      onClick={() => remove(i.id)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className={shared.section}>
            <h3 className={shared.sectionTitle}>Conflictos</h3>
            {conflicts ? <ConflictList report={conflicts} scenario={current} /> : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
