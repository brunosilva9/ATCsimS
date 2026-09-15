/**
 * Que campos tiene cada una de las 16 colecciones y como se arma su ID de documento.
 *
 * Un formulario a mano por coleccion habria sido enorme e inconsistente. En vez de eso, esto
 * describe la FORMA de cada una y AdminRecordForm.tsx la renderiza generica — mismo espiritu que
 * el mapa colección→doc-ID de tools/upload-firestore.js, que es justo lo que este archivo refleja
 * del lado del navegador (las 3 colecciones con ID calculado usan la MISMA fórmula que ese script,
 * a propósito, para que un documento creado desde /admin conviva con uno subido desde ahí).
 */

export type FieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'select'
  | 'stringArray'
  | 'nestedArray'
  | 'segments'
  | 'stringArrayMap';

export interface FieldSchemaBase {
  readonly key: string;
  readonly label: string;
  readonly type: FieldType;
  /** Vacio se guarda como null en vez de string vacio / 0. */
  readonly nullable?: boolean;
  /** Solo stringArray: cada línea se guarda como number en vez de string (ej. frequencies). */
  readonly numericArray?: boolean;
}

export interface SelectFieldSchema extends FieldSchemaBase {
  readonly type: 'select';
  readonly options: readonly string[];
}

export interface NestedArrayFieldSchema extends FieldSchemaBase {
  readonly type: 'nestedArray';
  readonly itemFields: readonly FieldSchema[];
}

export type FieldSchema = FieldSchemaBase | SelectFieldSchema | NestedArrayFieldSchema;

export type DocIdSpec =
  | { readonly kind: 'field'; readonly field: string }
  | { readonly kind: 'fixed'; readonly value: string }
  | { readonly kind: 'computed'; readonly compute: (record: Record<string, unknown>) => string };

export interface CollectionSchema {
  readonly collection: string;
  readonly label: string;
  readonly docId: DocIdSpec;
  readonly fields: readonly FieldSchema[];
}

/** Igual que tools/upload-firestore.js: para radars, que no trae una clave corta propia. */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

export function computeDocId(schema: CollectionSchema, record: Record<string, unknown>): string {
  switch (schema.docId.kind) {
    case 'field':
      return String(record[schema.docId.field] ?? '');
    case 'fixed':
      return schema.docId.value;
    case 'computed':
      return schema.docId.compute(record);
  }
}

const nm = (key: string, label: string, opts: Partial<FieldSchemaBase> = {}): FieldSchema => ({
  key,
  label,
  type: 'number',
  ...opts,
});
const tx = (key: string, label: string, opts: Partial<FieldSchemaBase> = {}): FieldSchema => ({
  key,
  label,
  type: 'text',
  ...opts,
});
const bo = (key: string, label: string): FieldSchema => ({ key, label, type: 'boolean' });
const sa = (key: string, label: string, opts: Partial<FieldSchemaBase> = {}): FieldSchema => ({
  key,
  label,
  type: 'stringArray',
  ...opts,
});
const sel = (key: string, label: string, options: readonly string[]): FieldSchema => ({
  key,
  label,
  type: 'select',
  options,
});

export const ADMIN_SCHEMAS: readonly CollectionSchema[] = [
  {
    collection: 'fixes',
    label: 'Fixes',
    docId: { kind: 'field', field: 'ident' },
    fields: [
      tx('ident', 'Ident'),
      tx('name', 'Nombre'),
      sel('type', 'Tipo', ['WAYPOINT', 'VOR', 'NDB', 'DME_FIX', 'ALTITUDE_POINT']),
      nm('lat', 'Latitud', { nullable: true }),
      nm('lon', 'Longitud', { nullable: true }),
      nm('elevationFt', 'Elevación (ft)', { nullable: true }),
      tx('scope', 'Alcance'),
      nm('meaFt', 'MEA (ft)', { nullable: true }),
      nm('mclFt', 'MCL (ft)', { nullable: true }),
      bo('_inferred', 'Inferido (no estaba en la base)'),
    ],
  },
  {
    collection: 'procedures',
    label: 'Procedimientos',
    docId: { kind: 'field', field: 'ident' },
    fields: [
      tx('ident', 'Ident'),
      sel('type', 'Tipo', ['STAR', 'SID']),
      tx('runway', 'Pista'),
      sel('configuration', 'Configuración', ['NORTE', 'SUR']),
      bo('requiresSivigats', 'Requiere SIVIGATS'),
      tx('entryFix', 'Fix de entrada', { nullable: true }),
      tx('exitFix', 'Fix de salida'),
      nm('totalDistNm', 'Distancia total (NM)', { nullable: true }),
      nm('sourceTotalTimeMin', 'Tiempo de la planilla (min)', { nullable: true }),
      sa('entryAirways', 'Aerovías de entrada', { nullable: true }),
      tx('_review', 'Aviso de revisión', { nullable: true }),
      {
        key: 'legs',
        label: 'Tramos',
        type: 'nestedArray',
        itemFields: [
          nm('seq', 'Seq'),
          tx('fix', 'Fix'),
          nm('distToEndNm', 'Dist. restante (NM)', { nullable: true }),
          nm('legDistNm', 'Dist. del tramo (NM)', { nullable: true }),
          nm('distFromOriginNm', 'Dist. desde origen (NM)', { nullable: true }),
          nm('sourceTimeMin', 'Tiempo planilla (min)', { nullable: true }),
          nm('sourceGsKt', 'GS planilla (kt)', { nullable: true }),
          nm('minAltFt', 'Alt. mín (ft)', { nullable: true }),
          nm('maxAltFt', 'Alt. máx (ft)', { nullable: true }),
          nm('maxSpeedKt', 'Vel. máx (kt)', { nullable: true }),
          tx('atcRestriction', 'Restricción ATC', { nullable: true }),
          tx('navaid', 'Navaid', { nullable: true }),
        ],
      },
    ],
  },
  {
    collection: 'airways',
    label: 'Aerovías',
    docId: { kind: 'field', field: 'ident' },
    fields: [
      tx('ident', 'Ident'),
      sel('levels', 'Niveles', ['upper', 'lower', 'both']),
      sa('fixes', 'Fixes en orden', { nullable: true }),
      { key: 'segments', label: 'Segmentos (una línea por tramo, fixes separados por coma)', type: 'segments', nullable: true },
    ],
  },
  {
    collection: 'runways',
    label: 'Pistas',
    docId: { kind: 'field', field: 'ident' },
    fields: [
      tx('aerodrome', 'Aeródromo'),
      tx('ident', 'Ident'),
      nm('magCourse', 'Rumbo magnético', { nullable: true }),
      nm('lengthM', 'Largo (m)', { nullable: true }),
      bo('ils', 'ILS'),
      bo('rnav', 'RNAV'),
      sel('configuration', 'Configuración', ['NORTE', 'SUR']),
    ],
  },
  {
    collection: 'approaches',
    label: 'Aproximaciones',
    docId: { kind: 'field', field: 'code' },
    fields: [
      tx('code', 'Código'),
      tx('type', 'Tipo'),
      tx('runway', 'Pista'),
      bo('requiresSivigats', 'Requiere SIVIGATS'),
      tx('iaf', 'IAF', { nullable: true }),
      nm('daMdaFt', 'DA/MDA (ft)', { nullable: true }),
      tx('note', 'Nota', { nullable: true }),
    ],
  },
  {
    collection: 'holdings',
    label: 'Esperas',
    docId: { kind: 'field', field: 'fix' },
    fields: [
      tx('fix', 'Fix'),
      nm('lowerLevelFt', 'Nivel inferior (ft)', { nullable: true }),
      nm('upperLevelFt', 'Nivel superior (ft)', { nullable: true }),
      nm('mclFt', 'MCL (ft)', { nullable: true }),
      tx('note', 'Nota', { nullable: true }),
    ],
  },
  {
    collection: 'performance',
    label: 'Performance',
    docId: { kind: 'field', field: 'level' },
    fields: [
      tx('level', 'Nivel'),
      nm('altFt', 'Altitud (ft)'),
      nm('iasKt', 'IAS (kt)', { nullable: true }),
      nm('gsKt', 'GS (kt)', { nullable: true }),
      nm('nmPerMin', 'NM/min', { nullable: true }),
      nm('ftPerMin', 'ft/min', { nullable: true }),
      tx('note', 'Nota', { nullable: true }),
      sa('fixes', 'Fixes donde se exige'),
    ],
  },
  {
    collection: 'separation',
    label: 'Espaciamiento',
    docId: {
      kind: 'computed',
      compute: (r) => `${r.runway}-dep${r.withDepartures}-sivigats${r.sivigats}-lvp${r.lvp}`,
    },
    fields: [
      tx('runway', 'Pista'),
      bo('sivigats', 'SIVIGATS'),
      sel('withDepartures', 'Con salidas', ['true', 'false', '']),
      bo('lvp', 'LVP'),
      nm('value', 'Mínima'),
      sel('unit', 'Unidad', ['NM', 'MIN']),
    ],
  },
  {
    collection: 'aircraftTypes',
    label: 'Tipos de aeronave',
    docId: { kind: 'field', field: 'icao' },
    fields: [
      tx('icao', 'OACI'),
      tx('name', 'Nombre'),
      nm('minSpeedKt', 'Vel. mín (kt)'),
      nm('maxSpeedKt', 'Vel. máx (kt)'),
      tx('wake', 'Estela', { nullable: true }),
      nm('vappKt', 'Vapp (kt)', { nullable: true }),
    ],
  },
  {
    collection: 'fleet',
    label: 'Flota',
    docId: { kind: 'field', field: 'registration' },
    fields: [tx('registration', 'Matrícula'), tx('icaoType', 'Tipo OACI'), bo('isCallsign', 'Es indicativo especial')],
  },
  {
    collection: 'operators',
    label: 'Operadores',
    docId: { kind: 'field', field: 'icaoPrefix' },
    fields: [tx('icaoPrefix', 'Prefijo OACI'), tx('name', 'Nombre'), tx('country', 'País', { nullable: true })],
  },
  {
    collection: 'sampleFlights',
    label: 'Vuelos de ejemplo',
    docId: { kind: 'field', field: 'callsign' },
    fields: [
      tx('callsign', 'Indicativo'),
      tx('operator', 'Operador'),
      tx('icaoType', 'Tipo OACI'),
      nm('tasKt', 'TAS (kt)'),
      tx('adep', 'Origen'),
      tx('ades', 'Destino'),
      tx('ssr', 'SSR'),
    ],
  },
  {
    collection: 'ssrBlocks',
    label: 'Bloques SSR',
    docId: { kind: 'field', field: 'base' },
    fields: [tx('base', 'Código base'), tx('series', 'Serie'), sa('codes', 'Códigos del bloque')],
  },
  {
    collection: 'units',
    label: 'Unidades',
    docId: { kind: 'field', field: 'id' },
    fields: [
      tx('id', 'ID'),
      tx('name', 'Nombre'),
      sa('frequencies', 'Frecuencias', { numericArray: true }),
      tx('_review', 'Aviso de revisión', { nullable: true }),
    ],
  },
  {
    collection: 'radars',
    label: 'Radares',
    docId: { kind: 'computed', compute: (r) => slugify(String(r.equipment ?? '')) },
    fields: [tx('equipment', 'Equipo'), tx('type', 'Tipo'), nm('rangeNm', 'Alcance (NM)'), nm('rpn', 'RPN'), tx('unit', 'Unidad')],
  },
  {
    collection: 'tma',
    label: 'TMA',
    docId: { kind: 'fixed', value: 'scel' },
    fields: [
      tx('aerodrome', 'Aeródromo'),
      tx('name', 'Nombre'),
      nm('transitionAltitudeFt', 'Altitud de transición (ft)'),
      tx('transitionLevel', 'Nivel de transición (informativo)'),
      sa('configurations', 'Configuraciones'),
      { key: 'runwaysByConfiguration', label: 'Pistas por configuración (una línea "CONFIG: pista, pista")', type: 'stringArrayMap' },
      tx('_review', 'Aviso de revisión', { nullable: true }),
      tx('_reviewTransitionLevel', 'Aviso sobre el nivel de transición', { nullable: true }),
    ],
  },
];

export function schemaFor(collection: string): CollectionSchema | undefined {
  return ADMIN_SCHEMAS.find((s) => s.collection === collection);
}
