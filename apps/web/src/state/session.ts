/**
 * La sesion de trabajo: un escenario, las instrucciones que se le han dado y el resultado.
 *
 * El escenario original nunca se muta. Cada instruccion se guarda en una lista y el estado
 * visible se obtiene reaplicando la lista entera sobre el original. Sale gratis deshacer, y
 * sobre todo sale gratis **entregar el ejercicio**: lo que el alumno manda al instructor es esa
 * lista, no el resultado. El instructor puede volver a reproducirla paso a paso.
 */

import { create } from 'zustand';

import { applyInstructions, detectConflicts } from '@atcsims/core';
import type { ConflictReport, Instruction, Scenario } from '@atcsims/core';

import { useNavdataStore } from './navdata.js';

export interface SessionState {
  /** El ejercicio tal como lo armo el instructor. Solo se reemplaza al cargar otro. */
  readonly base: Scenario | null;
  readonly instructions: readonly Instruction[];
  /** Resultado de aplicar `instructions` sobre `base`. */
  readonly current: Scenario | null;
  readonly conflicts: ConflictReport | null;
  /** Por que no se pudo aplicar la ultima instruccion. Se limpia al siguiente intento. */
  readonly error: string | null;

  readonly load: (scenario: Scenario, instructions?: readonly Instruction[]) => void;
  readonly add: (instruction: Omit<Instruction, 'id'>) => void;
  readonly remove: (id: string) => void;
  readonly reset: () => void;
}

function evaluate(base: Scenario, instructions: readonly Instruction[]) {
  // Se lee en el momento, no se captura al cargar el modulo: la base viene de Firestore y solo
  // esta lista despues de que App.tsx resuelve el gate de carga (ver state/navdata.ts).
  const navdata = useNavdataStore.getState();
  const applied = applyInstructions(base, instructions, {
    performance: navdata.performance,
    coordinates: navdata.coordinates,
  });
  if (!applied.ok) return { error: applied.message };

  const conflicts = detectConflicts(applied.scenario, {
    separation: navdata.separation,
    approachFixes: navdata.approachFixes,
    tmaFixes: navdata.tmaFixes,
    runwayInUse: applied.scenario.runwayInUse,
    sivigats: applied.scenario.sivigats,
    lvp: applied.scenario.weather.lvp,
  });

  return { scenario: applied.scenario, conflicts };
}

export const useSession = create<SessionState>((set, get) => ({
  base: null,
  instructions: [],
  current: null,
  conflicts: null,
  error: null,

  load: (scenario, instructions = []) => {
    const result = evaluate(scenario, instructions);
    set({
      base: scenario,
      instructions,
      current: result.scenario ?? scenario,
      conflicts: result.conflicts ?? null,
      error: result.error ?? null,
    });
  },

  add: (draft) => {
    const { base, instructions } = get();
    if (!base) return;

    const instruction: Instruction = { ...draft, id: crypto.randomUUID() };
    const next = [...instructions, instruction];
    const result = evaluate(base, next);

    // Una instruccion que no se puede calcular no entra en la lista: si entrara, el ejercicio
    // quedaria en un estado que el controlador nunca produjo.
    if (result.error !== undefined) {
      set({ error: result.error });
      return;
    }

    set({
      instructions: next,
      current: result.scenario ?? base,
      conflicts: result.conflicts ?? null,
      error: null,
    });
  },

  remove: (id) => {
    const { base, instructions } = get();
    if (!base) return;
    const next = instructions.filter((i) => i.id !== id);
    const result = evaluate(base, next);
    set({
      instructions: next,
      current: result.scenario ?? base,
      conflicts: result.conflicts ?? null,
      error: result.error ?? null,
    });
  },

  reset: () => {
    const { base } = get();
    if (base) get().load(base, []);
  },
}));
