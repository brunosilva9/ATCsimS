# `data/` — base de navegación en JSON

Generada desde [`basedatos/`](../basedatos/INVENTARIO.md). **No editar a mano:** se regenera con

```bash
node tools/build-db.js     # importa las planillas -> data/*.json
node tools/validate.js     # comprueba integridad; sale con codigo 1 si hay errores
```

Si un dato está mal, se corrige **en el Excel** y se vuelve a importar. Así la planilla sigue
siendo la fuente de verdad y el instructor no tiene que aprender JSON.

## Consultarla con SQL

Cruzar dos o tres de estos archivos a mano significa escribir un script de Node cada vez —así se
armó `entryAirways` en `procedures.json`. Para no repetir eso, hay un exportador a SQLite:

```bash
npm run data:sqlite       # genera data/atcsims.sqlite (Node 22+; ver tools/build-sqlite.js)
```

Es solo para explorar: la app y el importador siguen leyendo y escribiendo nada más que
`data/*.json`, y el `.sqlite` no se versiona (es 100% derivado, se regenera al toque). Los
arrays anidados —los tramos de un procedimiento, los fixes de una aerovía— salen en tablas
propias con una columna que apunta a la fila padre, para poder hacer `JOIN` de verdad:

```sql
-- Que STAR entra por una aerovia dada
SELECT DISTINCT p.ident FROM procedures p
JOIN procedure_entry_airways a ON a.procedure_ident = p.ident
WHERE a.airway = 'UQ808';
```

(Se descartó llevar esto a una base en la nube tipo Firebase Data Connect: además de un costo
mensual fijo por la instancia de Cloud SQL —no es gratis pasados los primeros 3 meses—, la app
dejaría de funcionar sin conexión, que es justo lo que permite imprimir un ejercicio y trabajarlo
en papel. SQLite da el mismo SQL real sin ninguna de las dos cosas.)

## Espejo en Firestore

Distinto del punto anterior: **Firestore nativo** (no Data Connect) tiene un nivel gratuito real
sin tarjeta de crédito (1 GiB, 50k lecturas/20k escrituras/20k borrados por día) y su SDK cliente
cachea localmente (IndexedDB), así que puede seguir sirviendo datos sin conexión después de la
primera sincronización. Es el primer paso hacia que la app lea de ahí en vez de los JSON
empaquetados en el build — un cambio grande aparte, todavía no hecho: **hoy la app sigue leyendo
únicamente `data/*.json`**, esto es solo la copia de consulta.

```bash
npm run data:firestore   # sube data/*.json a Firestore (ver tools/upload-firestore.js)
```

Requiere una service account key propia (`tools/serviceAccountKey.json`, gitignored — se baja de
Consola Firebase › Configuración del proyecto › Cuentas de servicio) y `firebase-admin` instalado.
Cada corrida borra y vuelve a escribir cada colección entera: si algo desapareció de un JSON,
desaparece también de Firestore.

Hay una colección por archivo, con los anidados embebidos en el documento (igual forma que en el
JSON, sin subcolecciones) y el id del documento tomado de la clave natural de cada registro:

| Colección | Doc ID | Colección | Doc ID |
|---|---|---|---|
| `fixes` | `ident` | `operators` | `icaoPrefix` |
| `procedures` | `ident` | `sampleFlights` | `callsign` |
| `airways` | `ident` | `ssrBlocks` (de `ssr.json`) | `base` |
| `runways` | `ident` | `units` | `id` |
| `approaches` | `code` | `radars` | slug de `equipment` |
| `holdings` | `fix` | `separation` | `runway`+`withDepartures`+`sivigats`+`lvp` |
| `performance` | `level` | `tma` | doc único `scel` (es un objeto, no un array) |
| `aircraftTypes` | `icao` | | |

Reglas de Firestore (solo lectura pública; las escrituras del script usan la service account, que
las ignora — se pegan a mano en Consola Firebase › Firestore Database › Reglas):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

## Convención

Todo archivo trae un bloque `_meta` con:

| Campo | Significado |
|---|---|
| `source` | Archivo y hoja de origen |
| `method` | `extracted` = leído por el script (reproducible) · `transcribed` = copiado a mano porque el layout depende de celdas combinadas |
| `note` / `limitation` | Lo que hay que saber antes de usar el archivo |

Y dentro de los registros:

| Campo | Significado |
|---|---|
| `_source` | De dónde salió ese registro concreto |
| `_inferred: true` | El registro no estaba en la base: se creó porque otro lo citaba |
| `_review` | Dato contradictorio o incompleto en la planilla. **No usar sin verificar** |

Unidades: NM, pies, nudos, minutos, grados decimales (negativo S/W).

## Archivos

| Archivo | Registros | Método | Contenido |
|---|---|---|---|
| `fixes.json` | 107 | extraído | Puntos de notificación. 46 con coordenada, 61 sin |
| `procedures.json` | 21 | extraído | 8 STAR + 13 SID con secuencia de fixes y distancias |
| `airways.json` | 15 | extraído | Aerovías con su secuencia de fixes |
| `runways.json` | 4 | extraído | 17L/17R/35L/35R de SCEL |
| `approaches.json` | 9 | transcrito | IAC por pista y requisito SIVIGATS |
| `holdings.json` | 9 | transcrito | Esperas con nivel inferior/superior y MCL |
| `performance.json` | 13 | transcrito | **Velocidad por nivel: el modelo de vuelo del sistema** |
| `separation.json` | 11 | transcrito | Mínimas de espaciamiento en aproximación |
| `radars.json` | 3 | transcrito | Vigilancia ATS (AIP Chile ENR 1.6-7) |
| `units.json` | 10 | transcrito | Posiciones de control y frecuencias |
| `tma.json` | — | transcrito | Altitud/nivel de transición, configuraciones |
| `aircraft-types.json` | 18 | extraído | Rango de velocidad por tipo OACI |
| `fleet.json` | 91 | extraído | Matrículas CC-XXX e indicativos especiales |
| `operators.json` | 25 | extraído | Prefijos de indicativo |
| `sample-flights.json` | 90 | extraído | Catálogo de vuelos comerciales para armar ejercicios |
| `ssr.json` | 45 bloques | extraído | Pool de 360 códigos transpondedor, en bloques de 8 |
| `index.json` | — | — | Manifiesto |

## Cómo leer un procedimiento

```jsonc
{
  "ident": "UMKAL7C",
  "type": "STAR",
  "totalDistNm": 70,
  "sourceTotalTimeMin": 14.035,
  "legs": [
    { "seq": 1, "fix": "UMKAL", "distToEndNm": 70, "legDistNm": null },
    { "seq": 2, "fix": "LOSAN", "distToEndNm": 47, "legDistNm": 23,
      "sourceTimeMin": 3.833, "sourceGsKt": 360 },
    // ...
    { "seq": 7, "fix": "TEGEB", "distToEndNm": 0,  "legDistNm": 9,
      "sourceTimeMin": 2.571, "sourceGsKt": 210 }
  ]
}
```

- **`distToEndNm`** es el dato que usa la fórmula del instructor. El primer tramo no tiene
  `legDistNm` porque es el punto de entrada.
- **`minAltFt` / `maxAltFt` / `maxSpeedKt` van en el tramo, no en el procedimiento.** La hoja
  `05_STAR` pone esas tres columnas junto a un FIX concreto (columna D), así que son la ventana
  *en ese punto*: UMKAL7C dice 24000/24000 sobre UMKAL porque ese es el nivel al que se entra a
  la llegada, no un piso de descenso para toda la STAR.
- **`sourceGsKt`** está *derivado*: `legDistNm / sourceTimeMin × 60`. Revela la
  velocidad que el instructor asume en cada tramo, o sea **el perfil de descenso del procedimiento**.
  UMKAL7C baja 360 → 330 → 300 → 280 → 230 → 210 kt, que es exactamente la escalera de
  `performance.json`.
- Solo **7 de 21** procedimientos traen este perfil: en los otros la planilla omite el tiempo de
  algún tramo y no se puede saber cuál. Ver "Defectos" abajo.
- **`entryAirways`** (solo STAR) es la aerovía que alimenta el fijo de entrada, de la hoja
  `CIRC-STAR-SID` — antes esto solo se sabía cruzando a ojo qué fijo aparecía en qué aerovía de
  `airways.json`, y esa forma de mirarlo se quedaba ciega justo en `ASIMO7D`/`UMKAL7C`, cuyas
  aerovías (`UL322`/`UM799`/`UM529` y `L405`) no tienen geometría en `airways.json`. La hoja lo
  dice directo y cubre las 8 STAR sin excepción.

En las SID el primer tramo va del aeródromo al primer fix, por eso llevan además
`distFromOriginNm`.

## Defectos encontrados en las planillas

Están marcados en el JSON, no corregidos en silencio.

1. ~~`ASIMO7D` tiene 8 fijos y solo 7 distancias.~~ **Corregido a mano, confirmado.** Faltaba
   `PUMAR`; comparando con las otras STAR que comparten cola (`UGOLA 19 → EL220 14 → PUMAR 9 →
   TEGEB 0`) ya se sospechaba `PUMAR = 9`, y se confirmó cruzando `SIMOK7B` —misma cola, secuencia
   completa y limpia. El detalle de qué celdas están corridas en el Excel (y que la corrección
   vive solo en el JSON hasta que se arreglen) está en el campo `_manualFix` de esa entrada en
   `procedures.json`. Mismo defecto de origen en `BUSES_horario_ver5.xlsx`, sin corregir ahí.

2. **14 de 21 procedimientos omiten el tiempo de algún tramo** (normalmente el primero). No afecta
   al cálculo — el motor calcula el tiempo desde la distancia y la performance — pero impide
   reconstruir el perfil de velocidad que el instructor tenía en mente.

3. **`EROLO6E`: 55 NM en la hoja `05_STAR` desde KADAK, 47 NM en `STARs-SIDs-2`.** Marcado con
   `_reviewDist`.

4. **`ALBAL7A`: 80 NM sumando tramos, 78 NM en la tabla resumen de la misma hoja.**

5. **Hay tres tablas de performance en el mismo archivo fuente y no coinciden.** Para FL130 una
   dice 250 kt y las otras dos 270 kt. `performance.json` usa la tabla vertical de la hoja
   `PERFORMANCES` y anota las discrepancias en `_alternatives` y `_review` de cada nivel.
   Es el punto P-01 del informe a ATC, y hasta que se resuelva el motor recibe la tabla como
   parámetro para poder cambiarla sin tocar código.

6. **61 fixes sin coordenada.** Son de tres clases: puntos DME (`D25AMB`, `EL220`), fijos en ruta
   fuera del TMA (`TOY`, `OPTAN`, `CHI`) y un punto definido por altitud (`4000FT`, en DONTI5B:
   el viraje ocurre al alcanzar esa altitud, no sobre una posición). No impiden calcular tiempos
   —que salen de las distancias tabuladas— pero sí cualquier representación gráfica.

## Datos que no están en ninguna planilla

No son defectos: simplemente no aparecen. El motor los suple y **declara el supuesto** en cada
cálculo, para que la interfaz pueda decirlo en vez de callarlo.

1. **La elevación del aeródromo.** Una salida tiene que arrancar de algún sitio. A falta del
   dato, arranca a 6000 ft, que es el nivel más bajo de `performance.json`.
2. **El nivel al que termina una llegada.** Sale del MCL del último fix en `holdings.json`
   (TEGEB = 5000 ft), que es dato real. `EROLO8A` termina en `ISILO`, que no tiene MCL
   publicado: ese procedimiento se calcula con el último nivel conocido y lo avisa.
3. **De qué dirección del mundo viene cada aerovía de entrada, y a qué región pertenece cada
   aeropuerto de origen.** A diferencia de los dos puntos anteriores, esto no es un dato que
   ATC Chile vaya a tener nunca: una planilla de TMA describe el espacio local, no el ruteo
   internacional. `packages/core/src/originRegions.ts` trae, con el mismo tipo de encabezado de
   advertencia que `packages/core/src/provisionalMinima.ts`, una tabla chica anotada a mano solo
   para las aerovías que ya aparecen en `entryAirways` — de qué corredor real vienen (público,
   no inventado) — y otra por prefijo ICAO para el origen del vuelo. La usa el generador de
   tráfico para no asignarle a una llegada una STAR de un corredor geográficamente imposible.
   Dos aerovías (`UL322`/`UM799`/`UM529` de ASIMO7D y `L405` de UMKAL7C) quedan sin región
   asignada a propósito hasta que se confirme con un controlador.

## Limitaciones de alcance

- **Solo configuración SUR (RWY 17L).** Las fuentes no traen procedimientos detallados para NORTE,
  aunque 15 de los 20 escenarios previstos son NORTE.
- **Solo mínimas de espaciamiento en aproximación.** Las de separación en ruta (vertical,
  longitudinal, radar) no están en las planillas.
- **Sin viento.** El modelo asume GS = valor de tabla.
- **Sin categoría de estela** ni velocidad de aproximación por tipo.
- **Los conflictos y los eventos no existen todavía**: las hojas correspondientes del esquema
  maestro están vacías.

Detalle en [`docs/MODELO_DATOS.md`](../docs/MODELO_DATOS.md) §6 y
[`docs/REQUISITOS.md`](../docs/REQUISITOS.md) §10.
