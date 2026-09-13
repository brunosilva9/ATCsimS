/**
 * Correccion: el instructor carga la entrega del alumno y ve que hizo.
 *
 * La entrega no es un resultado, es la lista de instrucciones. Aqui se reaplica sobre el
 * escenario original y se compara el antes con el despues, que es lo que se corrige: no si el
 * ejercicio quedo limpio, sino que conflictos habia y cuales resolvio.
 */

import { useMemo, useState } from 'react';

import { applyInstructions, detectConflicts, formatHhmm } from '@atcsims/core';
import type { Conflict } from '@atcsims/core';
import { approachFixes, coordinates, performance, separation, tmaFixes } from '@atcsims/navdata';

import { ConflictList } from '../components/ConflictList.js';
import { TimeFixDiagram } from '../components/TimeFixDiagram.js';
import { parsePayload } from '../lib/share.js';
import type { Payload } from '../lib/share.js';
import shared from './shared.module.css';
import styles from './Runs.module.css';

const KIND_LABEL: Record<string, string> = {
  LEVEL_CHANGE: 'Nivel',
  SPEED_RESTRICTION: 'Velocidad',
  HOLD: 'Espera',
  VECTOR: 'Vectores',
  DIRECT: 'Directo',
  TRANSFER: 'Transferencia',
};

export function Runs() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const review = useMemo(() => {
    if (!payload) return null;

    const detectOptions = {
      separation,
      approachFixes,
      tmaFixes,
      runwayInUse: payload.scenario.runwayInUse,
      sivigats: payload.scenario.sivigats,
      lvp: payload.scenario.weather.lvp,
    };

    const before = detectConflicts(payload.scenario, detectOptions);
    const applied = applyInstructions(payload.scenario, payload.instructions, {
      performance,
      coordinates,
    });

    if (!applied.ok) {
      return { before, failure: applied.message } as const;
    }

    const after = detectConflicts(applied.scenario, detectOptions);
    const stillThere = new Set(after.conflicts.map((c) => c.id));
    const solved = before.conflicts.filter((c) => !stillThere.has(c.id));
    const introduced = after.conflicts.filter(
      (c) => !before.conflicts.some((b) => b.id === c.id)
    );

    return { before, after, solved, introduced, scenario: applied.scenario } as const;
  }, [payload]);

  const openFile = async (file: File) => {
    const parsed = parsePayload(await file.text());
    if (!parsed.ok) {
      setError(parsed.message);
      setPayload(null);
      return;
    }
    setError(null);
    setPayload(parsed.payload);
  };

  const renderConflict = (c: Conflict) => (
    <li key={c.id}>
      <span className={styles.time}>{formatHhmm(c.time)}</span> {c.fix} — {c.description}
    </li>
  );

  return (
    <div className={shared.page}>
      <header className={shared.pageHead}>
        <div>
          <p className={shared.eyebrow}>Corrección</p>
          <h2 className={shared.pageTitle}>Revisar la entrega de un alumno</h2>
          <p className={shared.lead}>
            Carga el <code>.json</code> que descargó al entregar. Trae el ejercicio y cada
            instrucción que dio, con su hora: se vuelven a aplicar aquí desde cero.
          </p>
        </div>
        <label className={styles.upload}>
          <span>Abrir entrega…</span>
          <input
            type="file"
            id="run-file"
            accept="application/json,.json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void openFile(file);
            }}
          />
        </label>
      </header>

      {error !== null ? (
        <div className={shared.notice} role="alert">
          <strong>No se pudo leer el archivo.</strong> {error}
        </div>
      ) : null}

      {payload && review ? (
        <>
          <dl className={styles.facts}>
            <div>
              <dt>Alumno</dt>
              <dd>{payload.student ?? '—'}</dd>
            </div>
            <div>
              <dt>Entregado</dt>
              <dd>
                {payload.submittedAt ? new Date(payload.submittedAt).toLocaleString('es-CL') : '—'}
              </dd>
            </div>
            <div>
              <dt>Ejercicio</dt>
              <dd>{payload.scenario.name}</dd>
            </div>
            <div>
              <dt>Instrucciones</dt>
              <dd>{payload.instructions.length}</dd>
            </div>
          </dl>

          {'failure' in review ? (
            <div className={shared.notice} role="alert">
              <strong>La entrega no se puede reproducir.</strong> {review.failure}
            </div>
          ) : (
            <>
              <section className={shared.section}>
                <h3 className={shared.sectionTitle}>Qué resolvió</h3>
                <div className={styles.scoreboard}>
                  <div className={styles.scoreOk}>
                    <span className={styles.scoreNumber}>{review.solved.length}</span>
                    <span className={styles.scoreLabel}>resueltos</span>
                  </div>
                  <div className={styles.scoreOpen}>
                    <span className={styles.scoreNumber}>{review.after.conflicts.length}</span>
                    <span className={styles.scoreLabel}>sin resolver</span>
                  </div>
                  <div className={styles.scoreBad}>
                    <span className={styles.scoreNumber}>{review.introduced.length}</span>
                    <span className={styles.scoreLabel}>provocados</span>
                  </div>
                </div>

                {review.solved.length > 0 ? (
                  <>
                    <h4 className={styles.subhead}>Resueltos</h4>
                    <ul className={styles.conflictLines}>{review.solved.map(renderConflict)}</ul>
                  </>
                ) : null}
                {review.introduced.length > 0 ? (
                  <>
                    <h4 className={styles.subhead}>Provocados por sus propias instrucciones</h4>
                    <ul className={styles.conflictLines}>
                      {review.introduced.map(renderConflict)}
                    </ul>
                  </>
                ) : null}
              </section>

              <section className={shared.section}>
                <h3 className={shared.sectionTitle}>Instrucciones, en orden</h3>
                <ol className={styles.log}>
                  {[...payload.instructions]
                    .sort((a, b) => a.time - b.time)
                    .map((i) => {
                      const flight = payload.scenario.flights.find((f) => f.id === i.flightId);
                      return (
                        <li key={i.id}>
                          <span className={styles.time}>{formatHhmm(i.time)}</span>
                          <strong>{flight?.callsign ?? i.flightId}</strong>{' '}
                          {KIND_LABEL[i.kind] ?? i.kind}
                          {i.levelFt !== undefined ? ` a FL${Math.round(i.levelFt / 100)}` : ''}
                          {i.speedKt !== undefined ? ` ${i.speedKt} kt` : ''}
                          {i.holdMinutes !== undefined ? ` ${i.holdMinutes} min` : ''}
                          {i.extraTrackNm !== undefined ? ` +${i.extraTrackNm} NM` : ''}
                          {i.targetFix !== undefined ? ` a ${i.targetFix}` : ''}
                          {i.fromFix !== null ? ` desde ${i.fromFix}` : ''}
                        </li>
                      );
                    })}
                </ol>
              </section>

              <section className={shared.section}>
                <h3 className={shared.sectionTitle}>Cómo quedó</h3>
                <ConflictList report={review.after} scenario={review.scenario} />
              </section>

              <section className={shared.section}>
                <h3 className={shared.sectionTitle}>Diagrama final</h3>
                <TimeFixDiagram
                  flights={review.scenario.flights}
                  startTime={review.scenario.startTime}
                  durationMin={review.scenario.durationMin}
                />
              </section>
            </>
          )}
        </>
      ) : (
        <p className={shared.note}>
          Sin entrega cargada. También puedes abrir un enlace de ejercicio y entregarlo tú desde{' '}
          <code>Ejercicio</code> para ver cómo se ve una corrección.
        </p>
      )}
    </div>
  );
}
