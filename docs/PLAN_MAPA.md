# Plan: mapa de aerovías

Plan de implementación del ítem N-05 del [backlog](BACKLOG.md). Se empieza por Chile y se diseña
desde el principio para crecer en dos direcciones: ver un ejercicio en vivo sobre el mapa, y
extender la cobertura a otras regiones del mundo.

## 1. Objetivo

Un mapa interactivo y de alta calidad visual del espacio aéreo chileno: aeródromos, aerovías,
fixes, el TMA Santiago y sus procedimientos. Debe cumplir tres funciones:

1. **Didáctica.** Que el alumno vea la geometría que hoy solo existe como tablas de distancias.
2. **Calidad de datos.** Mostrar qué le falta a cada aeródromo, fix y aerovía, y detectar datos
   inconsistentes (apoya N-01 y N-03).
3. **Base para el modo en vivo.** Reproducir un ejercicio sobre el mapa, sincronizado con las
   strips.

Fuera de alcance en esta etapa: uso operacional o de navegación. El mapa lleva la advertencia
"no apto para navegación".

## 2. Referencias

| Referencia | Qué tomar de ella |
|---|---|
| [openScope](https://github.com/openscope/openscope) | Simulador ATC web de código abierto (MIT). Representación de radar, etiquetas de tráfico, formato de datos de aeródromos por archivo. |
| [SkyVector](https://skyvector.com) | Cartas en ruta sobre mapa: jerarquía visual de aerovías superiores e inferiores, fixes y navaids. |
| Flightradar24 / ADS-B Exchange | Reproducción de tráfico en el tiempo: línea de tiempo, velocidad de reproducción, estela del vuelo, ficha al seleccionar. |
| [deck.gl ArcLayer](https://deck.gl/gallery/arc-layer) | Arcos ortodrómicos origen–destino, para la etapa mundial. |
| [AIP Chile (DGAC)](https://aipchile.dgac.gob.cl) | Fuente oficial: ENR 3 (rutas ATS), ENR 4 (navaids y puntos significativos), ENR 2 (espacios aéreos), AD 2 (aeródromos). |

## 3. Tecnología propuesta

| Componente | Elección | Motivo |
|---|---|---|
| Motor de mapa | [MapLibre GL JS](https://maplibre.org) v5 | Código abierto (BSD), vectorial con WebGL, proyección de globo desde la v5 ([tutorial](https://docs.stadiamaps.com/tutorials/3d-globe-view-with-maplibre-gl-js/)) y estilos totalmente configurables. |
| Capas de datos | [deck.gl](https://deck.gl) con `MapboxOverlay` | Capas GPU para miles de elementos: `ScatterplotLayer`/`IconLayer` (aeródromos, fixes), `PathLayer` (aerovías, procedimientos), `TextLayer` (etiquetas), `TripsLayer` (vuelos animados, modo en vivo), `ArcLayer` (rutas mundiales). Funciona sobre el globo de MapLibre ([FOSS4G 2025](https://talks.osgeo.org/foss4g-2025/talk/8JFWXD/)). |
| Mapa base | [OpenFreeMap](https://openfreemap.org) | Teselas vectoriales gratuitas, sin clave de API ni registro. Se usa con un estilo propio oscuro tipo pantalla radar y otro claro. |

Alternativas descartadas: Leaflet (raster, menor calidad visual y sin globo), CesiumJS (3D
completo, más pesado de lo necesario), Mapbox GL JS (licencia propietaria y clave de pago).

**Consideraciones.**

- **Tamaño del bundle.** MapLibre y deck.gl suman varios cientos de kB. La vista del mapa se carga
  bajo demanda (`import()` dinámico en su ruta), para no penalizar al resto de la aplicación, que
  ya supera el umbral de 500 kB.
- **Disponibilidad del mapa base.** OpenFreeMap se ofrece "tal cual". El estilo se define en un
  solo archivo, de modo que cambiar de proveedor (por ejemplo, teselas propias con Protomaps) no
  afecte al resto.

## 4. Inventario de datos actual

Estado de la base en noviembre de 2026, para Chile:

| Entidad | Registros | Con coordenadas | Qué falta |
|---|---|---|---|
| Aeródromos | 32 (12 chilenos) | 0 | Coordenadas, elevación, tipo, nombre en la mayoría; los aeródromos chilenos que no están en la base |
| Pistas | 4 (solo SCEL) | 0 | Coordenadas de umbrales; pistas del resto de los aeródromos |
| Fixes | 107 | 46 | Coordenadas de 61 fixes |
| Fixes de aerovías | 58 | 14 | Coordenadas de 44 fixes; sin ellas no se puede dibujar casi ninguna aerovía completa |
| Fixes de procedimientos | 49 | 33 | Coordenadas de 16 fixes |
| Aerovías | 15 | — | Solo las del entorno del TMA; faltan el resto de las rutas ATS de Chile |
| Radares | 3 | 0 | Ubicación de cada sensor |
| Espacios aéreos | 0 | — | Límites de FIR, TMA y CTR |

Conclusión: el mapa de Chile depende sobre todo de recolectar datos, no de programar.

## 5. Qué recolectar y de dónde

| Dato | Fuente principal | Fuente de contraste | Licencia |
|---|---|---|---|
| Aeródromos (coordenadas, elevación, tipo, IATA) | [OurAirports](https://ourairports.com/data/) `airports.csv`, filtrado por `iso_country = CL` | AIP Chile, AD 2 | Dominio público ([about](https://ourairports.com/about.html)); sin garantía de exactitud |
| Pistas (umbrales, rumbo, largo) | OurAirports `runways.csv` | AIP Chile, AD 2 | Dominio público |
| Navaids (VOR, DME, NDB) | OurAirports `navaids.csv` | AIP Chile, ENR 4.1 | Dominio público |
| Puntos significativos (fixes) | AIP Chile, ENR 4.4 | [OpenAIP](https://openaip.net) | AIP: publicación oficial; OpenAIP: verificar condiciones en openaip.net/legal |
| Rutas ATS (aerovías) | AIP Chile, ENR 3.1 y 3.3 | — | Publicación oficial |
| Espacios aéreos (FIR, TMA, CTR) | AIP Chile, ENR 2.1 | OpenAIP | Igual que la fila anterior |
| Ubicación de radares | Dependencia (ATC) | — | A solicitar |

**Etapa mundial.** OurAirports cubre aeródromos y navaids de todo el mundo. No existe una fuente
abierta y oficial que consolide las aerovías mundiales: las opciones son el AIP de cada estado,
OpenAIP (cobertura y licencia por verificar) o un proveedor comercial de datos ARINC 424, con
costo de licencia. Es una decisión a tomar antes de esa etapa.

## 6. Modelo de datos

Los cambios se diseñan para el mundo, aunque se carguen solo datos de Chile:

- **Coordenadas en grados decimales WGS84**, latitud sur y longitud oeste negativas, como hoy en
  `fixes`.
- **`aerodromes`** pasa de `{ icao, name }` a `{ icao, iata, name, country, type, lat, lon,
  elevationFt }`.
- **`runways`** agrega las coordenadas de ambos umbrales.
- **`fixes`, `airways`, `aerodromes`** agregan `country` (ISO 3166) y, donde aplique, `fir`. Permite
  cargar por región en lugar de traer la base completa, como hace hoy `loadAll`.
- **Nueva colección `airspaces`**: `{ id, type: FIR | TMA | CTR, name, polygon, lowerFt, upperFt }`.
- **`radars`** agrega `lat` y `lon`.
- **Procedencia.** Cada registro importado de una fuente externa indica su fuente en un campo
  `source` (por ejemplo, `ourairports` o `aip-cl`). Ver decisiones pendientes: debe ser coherente
  con N-01.

## 7. Funcionalidades por etapa

### Etapa 1 · Chile estático

- Vista `/map`, con globo al alejar y proyección plana al acercar.
- Aeródromos chilenos con icono por tipo y tamaño por categoría. Al seleccionarlo, una ficha con
  sus datos y un **indicador de completitud** que lista lo que falta.
- Aerovías como líneas, diferenciadas entre superiores e inferiores, con su designador.
- Fixes con su tipo (waypoint, VOR, DME). Los fixes sin coordenadas aparecen en un panel lateral
  "sin ubicar", con acceso directo a su edición en `/admin`.
- TMA Santiago resaltado.
- Panel de capas (aeródromos, aerovías, fixes, espacios aéreos) y estilo oscuro tipo radar o claro.

### Etapa 2 · Procedimientos y calidad de datos

- Dibujar cada STAR y SID con sus restricciones de altitud por fix.
- **Contraste de distancias.** Comparar la distancia tabulada de cada tramo con la ortodrómica
  entre sus fixes y marcar las diferencias mayores a un umbral. Es la forma más directa de detectar
  datos erróneos antes de N-01.

### Etapa 3 · Ejercicio en vivo

- Reproducir un ejercicio sobre el mapa: la posición de cada vuelo se interpola entre fixes según
  sus horas de paso (`TripsLayer`).
- Reloj con reproducción, pausa y velocidad (×1 a ×60).
- Etiqueta tipo radar por vuelo: indicativo, nivel y GS.
- Conflictos resaltados en el fix y en el momento en que ocurren.
- Sincronización con las strips: seleccionar una strip resalta el vuelo, y viceversa.
- Requiere coordenadas de todos los fixes de los procedimientos usados y de los umbrales de SCEL
  para las salidas.

### Etapa 4 · Otras regiones

- Carga de datos por región o FIR, bajo demanda.
- Arcos ortodrómicos del aeródromo de origen al fix de entrada. Muestra por qué un vuelo desde
  LEMD entra por el norte, y conecta con las reglas de N-02.

## 8. Cimientos técnicos

Decisiones que se toman en la etapa 1 para no rehacer trabajo después:

1. **Geometría en `packages/core`.** Junto a `distanceNm` (`geo.ts`) se agregan funciones puras y
   probadas: rumbo inicial, punto intermedio sobre la ortodrómica y `positionAt(flight, time)`,
   que da la posición de un vuelo a una hora. La etapa 3 solo consume esa función.
2. **Mapa aislado en `apps/web/src/map/`.** La conversión de colecciones a capas (GeoJSON y capas
   de deck.gl) se hace en funciones propias, sin lógica de cálculo en los componentes.
3. **Completitud como función reutilizable.** La regla de "qué le falta a este registro" vive en
   `packages/core`, junto a `integrity.ts`, para usarla en el mapa y en `/admin`.
4. **Importadores reproducibles.** Cada fuente externa tiene un script en `tools/` que genera los
   documentos y los sube a una colección, con la misma lógica de subida por colección que
   `upload-firestore.js`.

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| Datos externos con errores (OurAirports no garantiza exactitud) | Contrastar con el AIP; el indicador de completitud y el contraste de distancias los hacen visibles |
| Interrupción del mapa base gratuito | Estilo en un solo archivo; alternativa de teselas propias |
| Licencia de aerovías mundiales | Decidir la fuente antes de la etapa 4 |
| Tamaño de la aplicación | Carga bajo demanda de la vista del mapa |

## 10. Decisiones pendientes

- Fuente de los fixes y aerovías chilenos: transcripción del AIP Chile u OpenAIP.
- Alcance de aeródromos: todos los de Chile (incluye pistas privadas pequeñas) o solo los públicos
  con código OACI.
- Cómo registrar la procedencia de los datos externos, en coherencia con N-01.
- Si el mapa es visible para todos los roles o solo para instructores.

## Fuentes

- [OurAirports, descargas de datos abiertos](https://ourairports.com/data/) y [About](https://ourairports.com/about.html)
- [openScope en GitHub](https://github.com/openscope/openscope)
- [MapLibre GL JS, vista de globo (Stadia Maps)](https://docs.stadiamaps.com/tutorials/3d-globe-view-with-maplibre-gl-js/)
- [deck.gl sobre el globo de MapLibre (FOSS4G 2025)](https://talks.osgeo.org/foss4g-2025/talk/8JFWXD/)
- [deck.gl ArcLayer](https://deck.gl/gallery/arc-layer)
- [OpenFreeMap](https://openfreemap.org)
- [OpenAIP](https://openaip.net)
- [AIP Chile, DGAC](https://aipchile.dgac.gob.cl)
