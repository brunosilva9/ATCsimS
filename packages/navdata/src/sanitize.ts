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

/*
 * ASIMO7D estuvo aca (P-02: le faltaba la distancia de PUMAR). Se corrigio a mano en
 * data/procedures.json —ver el campo `_manualFix` de esa entrada— cruzando SIMOK7B, que
 * comparte la misma cola final UGOLA-EL220-PUMAR-TEGEB y trae la secuencia completa. Sigue
 * pendiente corregir la celda en el Excel; hasta entonces, una reimportacion con
 * tools/build-db.js pisa la correccion y esto habria que volver a excluirlo.
 */
export const EXCLUSIONS: readonly Exclusion[] = [];

const excludedByKind = (kind: Exclusion['kind']): ReadonlySet<string> =>
  new Set(EXCLUSIONS.filter((e) => e.kind === kind).map((e) => e.id));

export const EXCLUDED_PROCEDURES = excludedByKind('procedure');
export const EXCLUDED_FIXES = excludedByKind('fix');
export const EXCLUDED_AIRWAYS = excludedByKind('airway');

/** Por que se excluyo algo, para poder decirlo en la interfaz en vez de callarlo. */
export function exclusionReason(kind: Exclusion['kind'], id: string): string | null {
  return EXCLUSIONS.find((e) => e.kind === kind && e.id === id)?.reason ?? null;
}
