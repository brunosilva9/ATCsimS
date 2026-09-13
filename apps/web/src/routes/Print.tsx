/**
 * Las strips en papel.
 *
 * El ejercicio se sigue haciendo sobre la hoja: esta vista existe para imprimir las tiras y que
 * el alumno escriba encima, como en basedatos/referencia.jpeg. Todo lo que no sea la tira
 * desaparece al imprimir.
 *
 * El modo cambia QUE se imprime, no solo el texto de arriba:
 *
 *   - practica: la strip ya calculada, en dos tandas (APP y ACC), y el diagrama tiempo × punto.
 *   - prueba: la ficha EN BLANCO (`ExamStrip` en modo impreso, sin inputs), sin diagrama —
 *     el diagrama sale con las horas ya calculadas, y eso es exactamente la respuesta. Antes
 *     esta vista ignoraba el modo y siempre imprimia la strip resuelta, asi que un examen
 *     impreso salia con las respuestas puestas.
 *
 * En prueba, ademas, se puede pedir la clave en el mismo trabajo de impresion (una casilla,
 * apagada por defecto): sale en hojas aparte, con su propio aviso, con las strips resueltas Y
 * el diagrama — ahi si corresponde, es la copia del instructor. Practica no necesita una clave
 * separada: ahi la strip ya sale resuelta, no hay nada que separar.
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { formatHhmm } from '@atcsims/core';
import type { Flight, Scenario } from '@atcsims/core';

import { ExamStrip } from '../components/ExamStrip.js';
import { FlightProgressStrip } from '../components/FlightProgressStrip.js';
import { TimeFixDiagram } from '../components/TimeFixDiagram.js';
import { decodePayload } from '../lib/share.js';
import type { ExerciseMode } from '../lib/share.js';
import { buildSampleScenario } from '../scenarios/sample.js';
import styles from './Print.module.css';

/*
 * En pantalla el diagrama vive en una caja con scroll: cabe cualquier duracion. En papel no hay
 * scroll, asi que se corta en hojas de un largo que quepa en una A4 apaisada. 45 filas (45
 * minutos, una fila por minuto) es lo que entra con margen para el encabezado y el titulo.
 */
const DIAGRAM_ROWS_PER_PAGE = 45;

interface DiagramPage {
  readonly startTime: number;
  readonly durationMin: number;
}

function diagramPages(scenario: Scenario): readonly DiagramPage[] {
  const totalRows = scenario.durationMin + 1; // TimeFixDiagram dibuja durationMin+1 filas
  const pageCount = Math.max(1, Math.ceil(totalRows / DIAGRAM_ROWS_PER_PAGE));
  return Array.from({ length: pageCount }, (_, i) => {
    const offset = i * DIAGRAM_ROWS_PER_PAGE;
    const rows = Math.min(DIAGRAM_ROWS_PER_PAGE, totalRows - offset);
    return { startTime: scenario.startTime + offset, durationMin: rows - 1 };
  });
}

function DiagramSection({ flights, scenario }: { flights: readonly Flight[]; scenario: Scenario }) {
  return (
    <section className={styles.diagramSection}>
      <h2 className={styles.subtitle}>Diagrama tiempo × punto</h2>
      {diagramPages(scenario).map((page, i) => (
        <div key={i} className={styles.diagramPage}>
          <TimeFixDiagram
            flights={flights}
            startTime={page.startTime}
            durationMin={page.durationMin}
            printable
          />
        </div>
      ))}
    </section>
  );
}

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
              <DiagramSection flights={scenario.flights} scenario={scenario} />
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

          <DiagramSection flights={scenario.flights} scenario={scenario} />
        </>
      )}
    </div>
  );
}
