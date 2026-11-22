/**
 * Los ejercicios con que arranca el editor: uno en blanco o una copia del ejemplo.
 *
 * Los dos nacen en modo prueba (N-10): es el uso principal del banco, y un instructor que olvida
 * cambiar el modo reparte una prueba, que es el error inofensivo. Al reves, el alumno recibiria
 * las horas resueltas. Un ejercicio guardado sin modo sigue siendo practica (ver ScenarioDraft).
 *
 * El ejemplo en si (SAMPLE_DRAFT) sigue en practica: es el que se abre en /exercise sin enlace,
 * para probar la app sin que nadie te mande nada.
 *
 * El ID se recibe de fuera para que esto no dependa del banco (lib/storage.ts, que trae Firebase).
 */

import type { ScenarioDraft } from './build.js';
import { SAMPLE_DRAFT } from './sample.js';

export function emptyDraft(id: string): ScenarioDraft {
  return {
    id,
    mode: 'exam',
    name: 'Ejercicio sin título',
    configuration: 'SUR',
    runwayInUse: '17L',
    sivigats: true,
    objective: '',
    weather: {
      qnhHpa: 1013,
      transitionLevel: 'FL110', // 1013+ hPa -> FL110, ver transitionLevelFor()
      vmc: true,
      visibilityM: 9999,
      ceilingFt: null,
      lvp: false,
    },
    flights: [],
  };
}

export function sampleCopy(id: string): ScenarioDraft {
  return {
    ...SAMPLE_DRAFT,
    id,
    mode: 'exam',
    name: `${SAMPLE_DRAFT.name} (copia)`,
    flights: SAMPLE_DRAFT.flights.map((f) => ({ ...f, source: 'sample' as const })),
  };
}
