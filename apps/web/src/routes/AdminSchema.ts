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
  /**
   * El campo es `?:` en el tipo del dominio: vacio se OMITE del documento, no se guarda null.
   * No es lo mismo que `nullable`: `entryFix: string | null` vacio es null a proposito, pero
   * `maxAltFt?: number` en null lo lee eto.ts como techo de 0 ft (pregunta `!== undefined`).
   */
  readonly optional?: boolean;
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

/**
 * Que cambia en la app al editar una coleccion. Es lo primero que necesita saber quien edita:
 * si una correccion mueve horas de paso o solo cambia una lista de opciones.
 */
export type CollectionImpact = 'calculo' | 'armado' | 'consulta';

export const IMPACT_LABEL: Readonly<Record<CollectionImpact, string>> = {
  calculo: 'Afecta el cálculo',
  armado: 'Arma el ejercicio',
  consulta: 'Solo consulta',
};

/**
 * La explicacion de una coleccion que se muestra en /admin (N-08). Es obligatoria: una coleccion
 * nueva no compila sin ella, y test/adminSchema.test.ts comprueba que este completa.
 */
export interface CollectionDefinition {
  readonly impact: CollectionImpact;
  /** Que contiene cada documento. */
  readonly contains: string;
  /** Que calculo o que pantalla la lee. */
  readonly usedFor: string;
  /** Que pasa al editarla. */
  readonly onEdit: string;
  /** Colecciones con las que se relaciona, por su nombre en Firestore, y como. */
  readonly relations: readonly { readonly collection: string; readonly how: string }[];
}

export interface CollectionSchema {
  readonly collection: string;
  readonly label: string;
  readonly definition: CollectionDefinition;
  readonly docId: DocIdSpec;
  readonly fields: readonly FieldSchema[];
}

/*
 * Toda coleccion guarda `updatedAt` (epoch ms) en cada guardado desde /admin, y la lista lo
 * muestra y permite ordenar por el. No es opcional por coleccion: es la unica forma de saber
 * que revisó alguien (por ejemplo, el ATC al validar velocidades) sin preguntarle.
 */

/** Igual que tools/upload-firestore.js: para radars, que no trae una clave corta propia. */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

/** Epoch ms (`updatedAt`, sellado en cada guardado) a texto legible, en hora de Chile. */
export function formatUpdatedAt(value: unknown): string {
  if (typeof value !== 'number') return '—';
  return new Date(value).toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

const isEmpty = (value: unknown) =>
  value === null || value === undefined || (Array.isArray(value) && value.length === 0);

/**
 * Saca los campos `optional` vacios del registro, tambien dentro de cada fila de un nestedArray
 * (los tramos de un procedimiento). Se usa en los dos sentidos: al guardar desde /admin, para no
 * escribir el null, y al leer de Firestore (state/navdata.ts), para que lo que ya quedo grabado
 * con null antes de este arreglo no rompa nada aunque nadie lo vuelva a guardar.
 */
export function omitEmptyOptionals(
  fields: readonly FieldSchema[],
  record: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...record };
  for (const field of fields) {
    const value = out[field.key];
    if (field.optional === true && isEmpty(value)) {
      delete out[field.key];
    } else if (field.type === 'nestedArray' && Array.isArray(value)) {
      const { itemFields } = field as NestedArrayFieldSchema;
      out[field.key] = value.map((row: unknown) =>
        row !== null && typeof row === 'object'
          ? omitEmptyOptionals(itemFields, row as Record<string, unknown>)
          : row
      );
    }
  }
  return out;
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
    definition: {
      impact: 'calculo',
      contains:
        'Puntos de notificación: designador, nombre, tipo, coordenadas, alcance (TMA o ruta), elevación, MEA y MCL.',
      usedFor:
        'Las coordenadas miden la distancia de un directo: sin ellas, el directo se rechaza. El alcance TMA marca dónde rige la separación radar en la detección de conflictos. Elevación, MEA y MCL solo se consultan en Navegación.',
      onEdit:
        'Un cambio de coordenadas o de alcance se aplica a los ejercicios al abrirlos. No se puede guardar un designador que deje sin fix a un procedimiento, una aerovía o una espera.',
      relations: [
        { collection: 'procedures', how: 'Cada tramo nombra un fix por su designador.' },
        { collection: 'airways', how: 'La secuencia de cada aerovía.' },
        { collection: 'holdings', how: 'Cada espera está sobre un fix.' },
        { collection: 'performance', how: 'Los fixes donde cada nivel debe estar alcanzado.' },
        { collection: 'approaches', how: 'El IAF de cada aproximación.' },
      ],
    },
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
    definition: {
      impact: 'calculo',
      contains:
        'STAR y SID: pista, configuración, fix de entrada y de salida, y sus tramos con distancia, GS de planilla y restricciones de altitud y velocidad.',
      usedFor:
        'Es la base de las horas de paso: hora de entrada + distancia del tramo ÷ GS. Las restricciones de altitud fijan el perfil de descenso de las STAR. Las aerovías de entrada le indican al generador por qué STAR llega el tráfico de cada origen.',
      onEdit:
        'Cambia las horas y los niveles de todos los vuelos que usan el procedimiento. Un tramo sin distancia deja el procedimiento fuera del cálculo, y no se puede guardar un tramo con un fix que no existe.',
      relations: [
        { collection: 'fixes', how: 'Cada tramo nombra un fix.' },
        { collection: 'performance', how: 'La GS cuando el tramo no trae GS de planilla, y los techos de descenso por fix.' },
        { collection: 'holdings', how: 'El MCL del fix: el piso del descenso.' },
        { collection: 'airways', how: 'Las aerovías de entrada de cada STAR, por designador.' },
      ],
    },
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
      nm('sourceTotalTimeMin', 'Tiempo de la planilla (min)', { nullable: true, optional: true }),
      sa('entryAirways', 'Aerovías de entrada', { nullable: true, optional: true }),
      tx('_review', 'Aviso de revisión', { nullable: true, optional: true }),
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
          nm('sourceTimeMin', 'Tiempo planilla (min)', { nullable: true, optional: true }),
          nm('sourceGsKt', 'GS planilla (kt)', { nullable: true, optional: true }),
          nm('minAltFt', 'Alt. mín (ft)', { nullable: true, optional: true }),
          nm('maxAltFt', 'Alt. máx (ft)', { nullable: true, optional: true }),
          nm('maxSpeedKt', 'Vel. máx (kt)', { nullable: true, optional: true }),
          tx('atcRestriction', 'Restricción ATC', { nullable: true, optional: true }),
          tx('navaid', 'Navaid', { nullable: true, optional: true }),
        ],
      },
    ],
  },
  {
    collection: 'airways',
    label: 'Aerovías',
    definition: {
      impact: 'consulta',
      contains:
        'Aerovías con su secuencia de fixes y sus niveles: superior, inferior o ambos.',
      usedFor:
        'Se consultan en Navegación. El motor no las usa: el recorrido de cada vuelo sale de su procedimiento.',
      onEdit:
        'No cambia ningún cálculo. No se puede guardar una aerovía con un fix que no existe.',
      relations: [
        { collection: 'fixes', how: 'La secuencia de fixes.' },
        { collection: 'procedures', how: 'Las STAR nombran sus aerovías de entrada.' },
      ],
    },
    docId: { kind: 'field', field: 'ident' },
    fields: [
      tx('ident', 'Ident'),
      sel('levels', 'Niveles', ['upper', 'lower', 'both']),
      sa('fixes', 'Fixes en orden', { nullable: true }),
      { key: 'segments', label: 'Segmentos (una línea por tramo, fixes separados por coma)', type: 'segments', nullable: true, optional: true },
    ],
  },
  {
    collection: 'runways',
    label: 'Pistas',
    definition: {
      impact: 'consulta',
      contains:
        'Pistas de SCEL: rumbo magnético, largo, ILS, RNAV y configuración.',
      usedFor:
        'Referencia. La pista en uso de cada ejercicio se elige en el editor y no se lee de aquí.',
      onEdit:
        'No cambia ningún cálculo.',
      relations: [
        { collection: 'procedures', how: 'Cada procedimiento indica su pista.' },
        { collection: 'approaches', how: 'Cada aproximación es a una pista.' },
        { collection: 'separation', how: 'Las mínimas se definen por pista.' },
      ],
    },
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
    definition: {
      impact: 'calculo',
      contains:
        'Aproximaciones por pista: código, tipo, IAF, DA/MDA y si requieren SIVIGATS.',
      usedFor:
        'Los IAF marcan dónde rige la mínima de aproximación en la detección de conflictos. El resto de los campos solo se consulta.',
      onEdit:
        'Cambiar un IAF cambia en qué fix se aplica la mínima de aproximación. No cambia horas.',
      relations: [
        { collection: 'fixes', how: 'El IAF.' },
        { collection: 'runways', how: 'La pista.' },
        { collection: 'separation', how: 'La mínima que rige en el IAF.' },
      ],
    },
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
    definition: {
      impact: 'calculo',
      contains:
        'Esperas publicadas: fix, nivel inferior y superior, y MCL.',
      usedFor:
        'El MCL, o el nivel inferior si no hay MCL, es el piso del descenso de una STAR en ese fix: por eso una STAR termina a 5000 ft sobre TEGEB. La instrucción de espera no usa esta tabla: los minutos los indica el alumno.',
      onEdit:
        'Cambia los niveles calculados de las llegadas que pasan por ese fix, y con ellos la GS de los tramos siguientes.',
      relations: [
        { collection: 'fixes', how: 'El fix de la espera.' },
        { collection: 'procedures', how: 'Las STAR que pasan por ese fix.' },
      ],
    },
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
    definition: {
      impact: 'calculo',
      contains:
        'Tabla de performance por nivel: IAS, GS, NM/min, régimen vertical y los fixes donde ese nivel debe estar alcanzado.',
      usedFor:
        'Da la GS de cada tramo cuando el procedimiento no trae GS de planilla, el régimen de ascenso de las SID y los techos de descenso de las STAR. Una salida arranca en el nivel más bajo de la tabla. Describe un jet: la GS se recorta después al tope de cada aeronave.',
      onEdit:
        'Cambia horas y niveles de todos los vuelos. El motor toma el nivel tabulado más cercano por debajo, así que un nivel sin GS se salta.',
      relations: [
        { collection: 'procedures', how: 'Los tramos sin GS de planilla.' },
        { collection: 'fixes', how: 'Los fixes donde se exige cada nivel.' },
        { collection: 'aircraftTypes', how: 'La velocidad máxima de cada tipo limita la GS de esta tabla.' },
      ],
    },
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
    definition: {
      impact: 'calculo',
      contains:
        'Mínimas de espaciamiento en aproximación por pista, con o sin SIVIGATS, con o sin salidas y con o sin LVP, en NM o en minutos.',
      usedFor:
        'Detección de conflictos: la mínima que rige en los IAF según la pista en uso y las condiciones del ejercicio.',
      onEdit:
        'Cambia qué pares de vuelos se marcan como conflicto. No cambia horas. No se puede guardar una combinación repetida.',
      relations: [
        { collection: 'approaches', how: 'Rige en los IAF.' },
        { collection: 'runways', how: 'Se define por pista.' },
      ],
    },
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
    definition: {
      impact: 'calculo',
      contains:
        'Tipos de aeronave por designador OACI: nombre, velocidad mínima y máxima, estela y Vapp.',
      usedFor:
        'La velocidad máxima, junto con la TAS del vuelo, es el tope de su GS. El rango mínimo–máximo valida las instrucciones de velocidad. Al crear un vuelo nuevo, la TAS se propone con la máxima del tipo. Estela y Vapp solo se consultan.',
      onEdit:
        'Cambia las horas de los vuelos de ese tipo que el perfil de jet haría ir más rápido que su máxima. Un tipo sin sus dos velocidades no se usa en el cálculo.',
      relations: [
        { collection: 'sampleFlights', how: 'Cada vuelo de ejemplo nombra su tipo.' },
        { collection: 'fleet', how: 'Cada matrícula tiene su tipo.' },
        { collection: 'performance', how: 'Recorta la GS de la tabla.' },
      ],
    },
    docId: { kind: 'field', field: 'icao' },
    fields: [
      tx('icao', 'OACI'),
      tx('name', 'Nombre'),
      nm('minSpeedKt', 'Vel. mín (kt)', { nullable: true }),
      nm('maxSpeedKt', 'Vel. máx (kt)', { nullable: true }),
      tx('wake', 'Estela', { nullable: true }),
      nm('vappKt', 'Vapp (kt)', { nullable: true }),
    ],
  },
  {
    collection: 'fleet',
    label: 'Flota',
    definition: {
      impact: 'consulta',
      contains:
        'Matrículas nacionales (CC-XXX) con su tipo, e indicativos especiales.',
      usedFor:
        'Referencia. Ninguna pantalla la lee hoy.',
      onEdit:
        'No cambia nada en la aplicación.',
      relations: [
        { collection: 'aircraftTypes', how: 'El tipo de cada matrícula.' },
      ],
    },
    docId: { kind: 'field', field: 'registration' },
    fields: [tx('registration', 'Matrícula'), tx('icaoType', 'Tipo OACI'), bo('isCallsign', 'Es indicativo especial')],
  },
  {
    collection: 'operators',
    label: 'Operadores',
    definition: {
      impact: 'armado',
      contains:
        'Operadores por prefijo OACI de indicativo, con nombre y país.',
      usedFor:
        'La lista de operadores al crear un vuelo nuevo en el editor de ejercicios.',
      onEdit:
        'Cambia las opciones del formulario. No cambia horas.',
      relations: [
        { collection: 'sampleFlights', how: 'El prefijo de cada indicativo.' },
        { collection: 'flightRoutes', how: 'El operador de cada ruta fija.' },
      ],
    },
    docId: { kind: 'field', field: 'icaoPrefix' },
    fields: [tx('icaoPrefix', 'Prefijo OACI'), tx('name', 'Nombre'), tx('country', 'País', { nullable: true })],
  },
  {
    collection: 'sampleFlights',
    label: 'Vuelos de ejemplo',
    definition: {
      impact: 'armado',
      contains:
        'Catálogo de vuelos de ejemplo: indicativo, operador, tipo, TAS, origen, destino y matrícula. El campo SSR no se usa: el código se asigna desde Bloques SSR.',
      usedFor:
        '«Añadir del catálogo» en el editor y plantillas del generador de tráfico. Identifica al vuelo en la strip, y su TAS interviene en el tope de velocidad.',
      onEdit:
        'Afecta a los vuelos que se agreguen desde ahora. Un ejercicio guardado conserva los datos con que se armó.',
      relations: [
        { collection: 'aircraftTypes', how: 'El tipo de cada vuelo.' },
        { collection: 'flightRoutes', how: 'Si el indicativo tiene ruta fija, esa ruta manda sobre el origen y el destino de aquí. No se sincronizan solas.' },
        { collection: 'operators', how: 'El operador.' },
        { collection: 'aerodromes', how: 'Origen y destino.' },
      ],
    },
    docId: { kind: 'field', field: 'callsign' },
    fields: [
      tx('callsign', 'Indicativo'),
      tx('operator', 'Operador'),
      tx('icaoType', 'Tipo OACI'),
      nm('tasKt', 'TAS (kt)'),
      tx('adep', 'Origen'),
      tx('ades', 'Destino'),
      tx('ssr', 'SSR'),
      // La planilla ACFT no trae matricula: queda vacia salvo que el instructor la cargue aca.
      tx('registration', 'Matrícula', { nullable: true }),
    ],
  },
  {
    collection: 'ssrBlocks',
    label: 'Bloques SSR',
    definition: {
      impact: 'armado',
      contains:
        'Bloques de códigos transpondedor, de 8 códigos cada uno.',
      usedFor:
        'Son los códigos que se asignan a cada vuelo que se agrega, en el editor y en el generador, sin repetir dentro del ejercicio.',
      onEdit:
        'Cambia los códigos disponibles para los vuelos que se agreguen desde ahora.',
      relations: [
        { collection: 'sampleFlights', how: 'Su campo SSR no se usa: el código sale de aquí.' },
      ],
    },
    docId: { kind: 'field', field: 'base' },
    fields: [tx('base', 'Código base'), tx('series', 'Serie'), sa('codes', 'Códigos del bloque')],
  },
  {
    collection: 'units',
    label: 'Unidades',
    definition: {
      impact: 'consulta',
      contains:
        'Posiciones de control y sus frecuencias.',
      usedFor:
        'Referencia. Ninguna pantalla la lee hoy.',
      onEdit:
        'No cambia nada en la aplicación.',
      relations: [
        { collection: 'radars', how: 'Cada radar indica su unidad.' },
      ],
    },
    docId: { kind: 'field', field: 'id' },
    fields: [
      tx('id', 'ID'),
      tx('name', 'Nombre'),
      sa('frequencies', 'Frecuencias', { numericArray: true }),
      tx('_review', 'Aviso de revisión', { nullable: true, optional: true }),
    ],
  },
  {
    collection: 'radars',
    label: 'Radares',
    definition: {
      impact: 'consulta',
      contains:
        'Radares de vigilancia: equipo, tipo, alcance, RPN y unidad.',
      usedFor:
        'Referencia. La detección de conflictos no usa el alcance radar: la separación radar rige en los fixes con alcance TMA.',
      onEdit:
        'No cambia nada en la aplicación.',
      relations: [
        { collection: 'units', how: 'La unidad del radar.' },
        { collection: 'fixes', how: 'El alcance TMA de cada fix.' },
      ],
    },
    docId: { kind: 'computed', compute: (r) => slugify(String(r.equipment ?? '')) },
    fields: [tx('equipment', 'Equipo'), tx('type', 'Tipo'), nm('rangeNm', 'Alcance (NM)'), nm('rpn', 'RPN'), tx('unit', 'Unidad')],
  },
  {
    collection: 'tma',
    label: 'TMA',
    definition: {
      impact: 'consulta',
      contains:
        'Datos generales del TMA Santiago en un solo documento: aeródromo, altitud y nivel de transición, configuraciones y pistas por configuración.',
      usedFor:
        'Referencia. El nivel de transición de cada ejercicio se calcula desde su QNH (FL110 con 1013 hPa o más, FL115 por debajo) y no se lee de aquí.',
      onEdit:
        'No cambia ningún cálculo.',
      relations: [
        { collection: 'runways', how: 'Las pistas de cada configuración.' },
      ],
    },
    docId: { kind: 'fixed', value: 'scel' },
    fields: [
      tx('aerodrome', 'Aeródromo'),
      tx('name', 'Nombre'),
      nm('transitionAltitudeFt', 'Altitud de transición (ft)'),
      tx('transitionLevel', 'Nivel de transición (informativo)'),
      sa('configurations', 'Configuraciones'),
      { key: 'runwaysByConfiguration', label: 'Pistas por configuración (una línea "CONFIG: pista, pista")', type: 'stringArrayMap' },
      tx('_review', 'Aviso de revisión', { nullable: true, optional: true }),
      tx('_reviewTransitionLevel', 'Aviso sobre el nivel de transición', { nullable: true, optional: true }),
    ],
  },
  {
    collection: 'aerodromes',
    label: 'Aeródromos',
    definition: {
      impact: 'armado',
      contains:
        'Códigos OACI de los aeródromos de origen y destino, con su nombre cuando está confirmado.',
      usedFor:
        'Las listas de origen y destino del editor de ejercicios y del formulario de vuelo nuevo.',
      onEdit:
        'Cambia las opciones de esas listas. No cambia horas.',
      relations: [
        { collection: 'sampleFlights', how: 'Origen y destino de cada vuelo.' },
        { collection: 'flightRoutes', how: 'Origen y destino de cada ruta fija.' },
      ],
    },
    docId: { kind: 'field', field: 'icao' },
    fields: [
      tx('icao', 'OACI'),
      // No sale de ninguna planilla: son los codigos que aparecen como origen/destino en los
      // vuelos de ejemplo, para elegirlos de una lista en el editor de ejercicios en vez de
      // escribirlos a mano. El nombre queda en null hasta que alguien lo confirme.
      tx('name', 'Nombre', { nullable: true }),
    ],
  },
  {
    collection: 'flightRoutes',
    label: 'Rutas de vuelo',
    definition: {
      impact: 'armado',
      contains:
        'La ruta fija de cada indicativo: operador, origen, destino y categoría (comercial o privado).',
      usedFor:
        'En el editor, un indicativo comercial con ruta fija deja su operador, origen y destino de solo lectura: un LAN601 siempre es la misma ruta. El generador la usa para el operador de cada vuelo. Se crea al guardar un vuelo nuevo en el catálogo.',
      onEdit:
        'Cambia la ruta de ese indicativo en los vuelos que se agreguen desde ahora. No se sincroniza con Vuelos de ejemplo.',
      relations: [
        { collection: 'sampleFlights', how: 'El mismo indicativo en el catálogo.' },
        { collection: 'operators', how: 'El operador.' },
        { collection: 'aerodromes', how: 'Origen y destino.' },
      ],
    },
    docId: { kind: 'field', field: 'callsign' },
    // La identidad FIJA de un indicativo comercial (LAN601 siempre es la misma ruta): separado
    // de sampleFlights, que es solo el tipo de aeronave de ejemplo — eso si varia vuelo a vuelo.
    fields: [
      tx('callsign', 'Indicativo'),
      tx('operator', 'Operador'),
      tx('adep', 'Origen'),
      tx('ades', 'Destino'),
      sel('category', 'Categoría', ['comercial', 'privado']),
    ],
  },
];

export function schemaFor(collection: string): CollectionSchema | undefined {
  return ADMIN_SCHEMAS.find((s) => s.collection === collection);
}
