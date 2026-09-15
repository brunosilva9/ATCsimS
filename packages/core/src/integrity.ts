/**
 * Que hace que la base de navegacion sea calculable. Portado de tools/validate.js (que sigue
 * siendo la version que corre en CI contra data/*.json) para que el panel de administracion
 * pueda aplicar la misma vara ANTES de guardar un cambio en Firestore, en vez de descubrir el
 * problema recien cuando el motor se niega a calcular un ejercicio.
 *
 * Solo los chequeos `fail` de validate.js estan aca (los que de verdad rompen el motor). Los
 * `warn` (perfil de velocidad incompleto, redondeo de la planilla) tambien se reportan, pero no
 * bloquean: son igual que en validate.js, informativos.
 */

import type {
  Airway,
  Fix,
  HoldingPattern,
  PerformanceTable,
  Procedure,
  SeparationMinimum,
} from './types.js';

export type IntegrityLevel = 'fail' | 'warn';

export interface IntegrityIssue {
  readonly level: IntegrityLevel;
  readonly message: string;
}

export interface IntegrityDataset {
  readonly fixes: readonly Fix[];
  readonly procedures: readonly Procedure[];
  readonly airways: readonly Airway[];
  readonly holdings: readonly HoldingPattern[];
  readonly performance: PerformanceTable;
  readonly separation: readonly SeparationMinimum[];
}

export function checkIntegrity(dataset: IntegrityDataset): readonly IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const fail = (message: string) => issues.push({ level: 'fail', message });
  const warn = (message: string) => issues.push({ level: 'warn', message });

  const byIdent = new Map(dataset.fixes.map((f) => [f.ident, f]));

  // 1. Unicidad de designadores de fix
  const seenFixes = new Set<string>();
  for (const f of dataset.fixes) {
    if (seenFixes.has(f.ident)) fail(`fix duplicado: ${f.ident}`);
    seenFixes.add(f.ident);
  }

  // 2. Integridad referencial
  for (const p of dataset.procedures) {
    for (const leg of p.legs) {
      if (!byIdent.has(leg.fix)) fail(`${p.type} ${p.ident}: fix desconocido "${leg.fix}"`);
    }
  }
  for (const a of dataset.airways) {
    const flat = a.fixes ?? (a.segments ?? []).flat();
    for (const f of flat) {
      if (!byIdent.has(f)) fail(`AWY ${a.ident}: fix desconocido "${f}"`);
    }
  }
  for (const h of dataset.holdings) {
    if (!byIdent.has(h.fix)) fail(`holding: fix desconocido "${h.fix}"`);
  }
  for (const level of dataset.performance) {
    for (const f of level.fixes) {
      if (!byIdent.has(f)) warn(`performance ${level.level}: fix "${f}" no esta en la base`);
    }
  }

  // 3. Monotonia de la distancia restante (si el motor la viola, calcula tiempos negativos)
  for (const p of dataset.procedures) {
    const dist = p.legs.map((leg) => leg.distToEndNm);
    if (dist.some((v) => v === null)) {
      warn(`${p.type} ${p.ident}: distancias incompletas — el motor no puede calcular este procedimiento`);
      continue;
    }
    for (let i = 1; i < dist.length; i++) {
      if (dist[i]! >= dist[i - 1]!) {
        fail(
          `${p.type} ${p.ident}: distancia restante no decrece en ${p.legs[i]!.fix} (${dist[i - 1]} -> ${dist[i]})`
        );
      }
    }
    const last = p.legs[p.legs.length - 1];
    const lastDist = dist[dist.length - 1];
    if (last !== undefined && lastDist !== 0) {
      fail(
        `${p.type} ${p.ident}: la distancia restante del ultimo fix (${last.fix}) es ${lastDist}, deberia ser 0`
      );
    }
  }

  // 4. Holdings con nivel inferior por encima del superior
  for (const h of dataset.holdings) {
    if (h.lowerLevelFt !== null && h.upperLevelFt !== null && h.lowerLevelFt > h.upperLevelFt) {
      fail(`holding ${h.fix}: nivel inferior (${h.lowerLevelFt}) por encima del superior (${h.upperLevelFt})`);
    }
  }

  // 5. Minimas de separacion: toda combinacion debe resolver a un solo valor
  const seenSeparation = new Set<string>();
  for (const s of dataset.separation) {
    const key = `${s.runway}|${s.sivigats}|${s.withDepartures}|${s.lvp}`;
    if (seenSeparation.has(key)) fail(`separation: combinacion duplicada ${key}`);
    seenSeparation.add(key);
  }

  return issues;
}

/**
 * Solo los problemas que el chequeo `after` no tenia ya en `before` — para no bloquear un
 * guardado por un defecto preexistente que no tiene nada que ver con lo que se esta editando.
 */
export function newIssues(
  before: readonly IntegrityIssue[],
  after: readonly IntegrityIssue[],
  level: IntegrityLevel
): readonly IntegrityIssue[] {
  const seen = new Set(before.filter((i) => i.level === level).map((i) => i.message));
  return after.filter((i) => i.level === level && !seen.has(i.message));
}
