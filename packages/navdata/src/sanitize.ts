/**
 * Datos que el prototipo deja fuera a proposito.
 *
 * Se excluyen aqui, en un solo sitio y a la vista, en vez de repartir comprobaciones por el
 * codigo. Cada entrada apunta al punto del informe de revision que la resolvera; cuando ATC
 * responda, se borra la linea y el dato vuelve solo.
 */

export interface Exclusion {
  readonly kind: 'procedure' | 'fix' | 'airway';
  readonly id: string;
  readonly reason: string;
}

export const EXCLUSIONS: readonly Exclusion[] = [
  {
    kind: 'procedure',
    id: 'ASIMO7D',
    reason:
      'P-02: la planilla lista 8 fixes y solo 7 distancias. Falta el valor de PUMAR y no se ' +
      'puede deducir a que fix corresponde cada uno.',
  },
];

const excludedByKind = (kind: Exclusion['kind']): ReadonlySet<string> =>
  new Set(EXCLUSIONS.filter((e) => e.kind === kind).map((e) => e.id));

export const EXCLUDED_PROCEDURES = excludedByKind('procedure');
export const EXCLUDED_FIXES = excludedByKind('fix');
export const EXCLUDED_AIRWAYS = excludedByKind('airway');

/** Por que se excluyo algo, para poder decirlo en la interfaz en vez de callarlo. */
export function exclusionReason(kind: Exclusion['kind'], id: string): string | null {
  return EXCLUSIONS.find((e) => e.kind === kind && e.id === id)?.reason ?? null;
}
