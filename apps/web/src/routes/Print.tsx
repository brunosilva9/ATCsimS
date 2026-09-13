/**
 * Las strips en papel.
 *
 * El ejercicio se sigue haciendo sobre la hoja: esta vista existe para imprimir las tiras y que
 * el alumno escriba encima, como en basedatos/referencia.jpeg. Todo lo que no sea la tira
 * desaparece al imprimir.
 *
 * El modo cambia QUE se imprime, no solo el texto de arriba:
 *
 *   - practica: la strip ya calculada, en dos tandas (APP y ACC), como siempre.
 *   - prueba: la ficha EN BLANCO (`ExamStrip` en modo impreso, sin inputs). Antes esta vista
 *     ignoraba el modo y siempre imprimia la strip resuelta, asi que un examen impreso salia
 *     con las respuestas puestas — exactamente la ayuda que el modo prueba existe para no dar.
 *
 * En prueba, ademas, se puede pedir la clave en el mismo trabajo de impresion (una casilla,
 * apagada por defecto): sale en hojas aparte, con su propio aviso, para la copia del
 * instructor. Practica no la necesita: ahi la strip ya sale resuelta, no hay nada que separar.
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { formatHhmm } from '@atcsims/core';

import { ExamStrip } from '../components/ExamStrip.js';
import { FlightProgressStrip } from '../components/FlightProgressStrip.js';
import { decodePayload } from '../lib/share.js';
import type { ExerciseMode } from '../lib/share.js';
import { buildSampleScenario } from '../scenarios/sample.js';
import styles from './Print.module.css';

export function Print() {
  const [params] = useSearchParams();
  const encoded = params.get('e');
  const [includeSolution, setIncludeSolution] = useState(false);

  const { scenario, mode } = useMemo(() => {
    if (encoded !== null) {
      const decoded = decodePayload(encoded);
      if (decoded.ok) {
        return { scenario: decoded.payload.scenario, mode: decoded.payload.mode ?? 'practice' };
      }
    }
    return { scenario: buildSampleScenario().scenario, mode: 'practice' as ExerciseMode };
  }, [encoded]);

  useEffect(() => {
    document.title = `${scenario.name} — strips`;
  }, [scenario.name]);

  return (
    <div className={styles.sheet}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.print} onClick={() => window.print()}>
          Imprimir
        </button>
        {mode === 'exam' ? (
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={includeSolution}
              onChange={(e) => setIncludeSolution(e.target.checked)}
            />
            Incluir la clave
          </label>
        ) : null}
        <span className={styles.hint}>A4 apaisado, sin márgenes de navegador.</span>
      </div>

      <h1 className={styles.title}>
        {scenario.name.toUpperCase()} · {scenario.configuration} · RWY {scenario.runwayInUse} ·{' '}
        {formatHhmm(scenario.startTime)}
      </h1>

      {mode === 'exam' ? (
        <>
          <div className={styles.strips}>
            {scenario.flights.map((flight) => (
              <ExamStrip key={flight.id} flight={flight} />
            ))}
          </div>

          {includeSolution ? (
            <div className={styles.solution}>
              <p className={styles.solutionWarning}>
                Clave — solo para el instructor. No entregar junto con la ficha en blanco.
              </p>
              <div className={styles.strips}>
                {scenario.flights.map((flight) => (
                  <FlightProgressStrip key={flight.id} flight={flight} variant="APP" />
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className={styles.strips}>
            {scenario.flights.map((flight) => (
              <FlightProgressStrip key={flight.id} flight={flight} variant="APP" />
            ))}
          </div>

          {/* Segunda tanda: la copia del sector siguiente, como en la hoja de referencia. */}
          <h2 className={styles.subtitle}>Sector siguiente</h2>
          <div className={styles.strips}>
            {scenario.flights.map((flight) => (
              <FlightProgressStrip
                key={flight.id}
                flight={flight}
                variant="ACC"
                {...(flight.transferFix !== null ? { fromFix: flight.transferFix } : {})}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
