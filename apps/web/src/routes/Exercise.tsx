/**
 * La puerta de entrada del alumno.
 *
 * El ejercicio llega por el hash de la URL —el enlace que le pasa el instructor— y ese enlace
 * es el que decide en que modo se trabaja:
 *
 *   - practica: el sistema calcula y el alumno separa el trafico.
 *   - prueba:   el alumno calcula y nadie le dice si acierta.
 *
 * El modo viaja dentro del ejercicio y no en la URL a la vista, para que no baste con editar la
 * direccion para convertir una prueba en una practica con las respuestas hechas.
 *
 * Sin enlace se carga el ejemplo en modo practica, para poder probar la app sin que nadie te
 * mande nada.
 */

import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { decodePayload } from '../lib/share.js';
import { buildSampleScenario } from '../scenarios/sample.js';
import { useBuildContext } from '../state/buildContext.js';
import { ExamSession } from './ExamSession.js';
import { PracticeSession } from './PracticeSession.js';
import shared from './shared.module.css';

export function Exercise() {
  const [params] = useSearchParams();
  const encoded = params.get('e');
  const buildCtx = useBuildContext();

  const loaded = useMemo(() => {
    if (encoded === null) {
      return { payload: null, error: null };
    }
    const decoded = decodePayload(encoded);
    return decoded.ok
      ? { payload: decoded.payload, error: null }
      : { payload: null, error: decoded.message };
  }, [encoded]);

  const fallback = useMemo(() => buildSampleScenario(buildCtx).scenario, [buildCtx]);
  const scenario = loaded.payload?.scenario ?? fallback;
  const instructions = loaded.payload?.instructions ?? [];

  if (loaded.payload?.mode === 'exam') {
    return (
      <ExamSession
        scenario={scenario}
        allowInstructions={loaded.payload.allowInstructions ?? false}
        assumptions={loaded.payload.assumptions ?? []}
      />
    );
  }

  return (
    <>
      {loaded.error !== null ? (
        <div className={shared.notice} role="alert">
          <strong>No se pudo abrir el enlace.</strong> {loaded.error} Se cargó el ejercicio de
          ejemplo en su lugar.
        </div>
      ) : null}
      <PracticeSession scenario={scenario} initialInstructions={instructions} />
    </>
  );
}
