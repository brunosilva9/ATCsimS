# Modelo de datos — ATCsimS

Derivado de las 16 planillas de [`basedatos/`](../basedatos/INVENTARIO.md).
Ámbito del prototipo: **TMA Santiago (SCEL)**, posiciones APP y ACC Norte/Sur.

Convenciones:

- Distancias en **NM**, altitudes en **pies**, velocidades en **nudos**, tiempos en **minutos**.
- Horas en **UTC**, formato `HHMM` (como en las fichas) o `HH:MM:SS` en campos calculados.
- Todo campo cuyo dato falta en las fuentes se marca `null`, nunca se inventa.

> **Sobre los nombres de campo de este documento.** Están en español porque este documento
> describe el *dominio*, y se escribió para discutirlo con ATC. La implementación usa los mismos
> campos con nombre en inglés y en `camelCase` (`fijo` → `fix`, `dist_restante_nm` →
> `distToEndNm`, `pasos` → `legs`). **El contrato real de los JSON está en
> [`data/README.md`](../data/README.md)**; si los dos se contradicen, manda aquel. Lo que se lee
> aquí es qué significa cada cosa, no cómo se llama en el código.

---

## 1. Capas del modelo

```
┌─ ESTÁTICA ──────────────┐  Datos de navegación: no cambian entre ejercicios.
│  fijos, aerovías,       │  Provienen del AIP / de las tablas del instructor.
│  procedimientos, pistas,│
│  esperas, performance,  │
│  separación, radares    │
└─────────┬───────────────┘
          │
┌─ CATÁLOGO ──────────────┐  Material con que se arma un ejercicio.
│  tipos de aeronave,     │
│  flota/matrículas,      │
│  operadores, pool SSR,  │
│  conflictos tipo,       │
│  eventos                │
└─────────┬───────────────┘
          │
┌─ ESCENARIO ─────────────┐  Un ejercicio concreto: instancia del catálogo
│  escenario, vuelos,     │  proyectada sobre la capa estática.
│  pasos calculados,      │
│  conflictos plantados   │
└─────────┬───────────────┘
          │
┌─ EJECUCIÓN / EVALUACIÓN ┐  Lo que hizo el alumno y cómo se califica.
│  corrida, instrucciones,│
│  desviaciones, rúbrica  │
└─────────────────────────┘
```

---

## 2. Capa estática

### 2.1 `fijo`

Un punto de notificación. Fuente: `03_BASE_NAVEGACION_SCEL` y hoja `Way Points`.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | `WP000001`… (conservar el ID de la planilla) |
| `designador` | string | `KADAK`, `AMB`, `TBN` — clave natural |
| `nombre` | string | Nombre expandido cuando difiere (`TBN` → `TABON`) |
| `tipo` | enum | `WAYPOINT` · `VOR` · `NDB` · `DME_FIX` · `PUNTO_CALCULADO` |
| `lat` / `lon` | number | **Decimal, negativo Sur/Oeste.** Las fuentes vienen en GMS con tres formatos distintos |
| `lat_origen` / `lon_origen` | string | El texto GMS original, para trazabilidad |
| `elevacion_ft` | number\|null | Sin datos en las fuentes |
| `ambito` | enum | `TMA` · `ENR` · `AMBOS` |
| `roles` | string[] | `IAF`, `IF`, `FAF`, `MAPt`, `ENTRADA_APP`, `SALIDA_APP`, `LIMITE_SECTOR` |
| `mea_ft` | number\|null | Altitud mínima en ruta, de las tablas de postación |
| `mcl_ft` | number\|null | Nivel mínimo de cruce (hoja `HLDNG`) |

> **`tipo = DME_FIX`** cubre los puntos que aparecen en los procedimientos sin coordenada:
> `D25AMB`, `D26VTN`, `D32DGO`, `D36TBN`, `EL220`, `EL250`, `EL370`, `EL401`, `SIRUS (D40)`.
> Se definen por radial/distancia desde una radioayuda, dato que **no está en las fuentes**.

### 2.2 `aerodromo` y `pista`

`aerodromo`: `oaci` (`SCEL`, `SCFA`, `SAEZ`…), `nombre`, `es_principal`.
Los aeródromos que solo aparecen como origen/destino en los planes se registran con OACI y nada más.

`pista` (fuente `02_PISTAS`, solo SCEL):

| Campo | Ejemplo |
|---|---|
| `designador` | `17L` |
| `curso_mag` | `175` |
| `longitud_m` | `3750` |
| `ils` / `rnav` | `true` / `true` |
| `en_uso_config` | `SUR` (17L/17R) · `NORTE` (35L/35R) |

### 2.3 `aerovia`

Fuente: hoja `AWYs`. Una aerovía es un designador + una secuencia ordenada de fijos.

```
aerovia { designador, fijos: [designador…], tramos: [ { desde, hasta, dist_nm, tiempo_min } ] }
```

Designadores presentes: `U/V200`, `U/T200`, `U/V204`, `U/V208`, `U/L302`, `U/L405`, `U/L780`,
`U/Q800`, `U/Q802`, `U/Q803`, `U/Q805`, `U/Q808`, `U/Q809`, `U/Q810`, `UL322`, `UL416`, `UM424`,
`UM529`, `UM783`, `UM799`, `UN527`, `UT107`, `UT129`, `UT200`, `T107`, `T112`, `T133`, `T200`,
`V103`, `V551`, `B560`, `B684`, `R683`.

> La barra en `U/V200` significa que la aerovía existe en versión superior (`UV200`) e inferior
> (`V200`). **Decisión de modelo:** guardar `designador` normalizado sin barra y un campo
> `niveles: "superior" | "inferior" | "ambos"`.

### 2.4 `procedimiento` (SID / STAR)

Fuente principal: hoja `STARs-SIDs-2`; complementos en `05_STAR`, `CIRC-STAR-SID`, `ARR-SID N-S`.

```
procedimiento {
  designador,            // "EROLO6E", "ALBAL7A"
  tipo,                  // SID | STAR
  pista,                 // "17L" (las fuentes solo cubren config SUR)
  configuracion,         // NORTE | SUR
  rnav,                  // bool
  requiere_sivigats,     // bool  (EROLO8A* lo exige)
  fijo_entrada,          // STAR: primer fijo. SID: fijo de salida del TMA
  fijo_salida,           // STAR: TEGEB / ISILO. SID: ALBAL, ANGOD…
  aerovias: [ … ],       // enlaces desde CIRC-STAR-SID
  pasos: [ paso_procedimiento ]
}
```

`paso_procedimiento` — **la estructura clave del motor**:

| Campo | Notas |
|---|---|
| `orden` | 1…n |
| `fijo` | Designador |
| `dist_restante_nm` | Distancia al fijo final del procedimiento. **Es el dato que usan las planillas** |
| `dist_tramo_nm` | Derivado: `dist_restante[i-1] − dist_restante[i]` |
| `alt_min_ft` / `alt_max_ft` | De `05_STAR`; incompletos |
| `vel_max_kt` | De `05_STAR` |
| `restriccion_atc` | Texto libre |

Ejemplo real (ANDES1, STAR):

```
SIMOK(90) → MOLPU(60) → UGANO(27) → TBN(19) → D25AMB(14) → PUMAR(9) → TEGEB(0)
tramos:      30          33          8          5            5          9
```

> **Inconsistencia detectada:** la planilla lista los tramos de ANDES1 como `33-8-5-5-9`
> (suma 60), omitiendo el primer tramo SIMOK→MOLPU de 30 NM. El total en `BUSES_horario_ver5`
> sí es 90. **El modelo deriva los tramos de `dist_restante_nm`**, que es autoconsistente.

Para SID la planilla usa tramos + acumulada en lugar de distancia restante; se convierte a la
misma estructura invirtiendo el sentido. Ejemplo `ALBAL7A`:
`DEP→AMB 1 · AMB→DESIT 8 · DESIT→ESKUL 3 · ESKUL→LINER 19 · LINER→SUPRA 13 · SUPRA→ALBAL 36` (total 80).

> **Segunda inconsistencia:** la tabla resumen de la misma hoja da 78 NM para ALBAL7A, no 80.
> Ambos valores se conservan (`dist_total_nm` y `dist_total_resumen_nm`) hasta que se aclare cuál rige.

### 2.5 `procedimiento_aproximacion` (IAC)

Fuentes: `06_IAC`, `IACs-1`, `IACs-2`.

```
iac { codigo: "IAC 01", tipo: "ILS-Z", pista: "17L", requiere_sivigats: bool,
      iaf, if_, faf, mapt, da_mda_ft, curso_final, min_cat, observaciones }
```

Inventario: 17L → IAC 01 (ILS-Z, CAT II/III), 03 (ILS-Y), 04 (ILS-T\*), 06 (ILS-X\*),
07 (VOR-17L\*), 11 (RNP-Y\*), 16 (RNP-X\*). 35R → IAC 09 (VOR), 14 (RNP).
`*` = requiere SIVIGATS. IAF predominante: `TEGEB`; para el VOR-17L: `PADOP`.

### 2.6 `espera` (holding)

Fuente: hoja `HLDNG`.

| Fijo | Nivel inferior | Nivel superior |
|---|---|---|
| `DABIT` | FL170 | FL240 |
| `KADAK` | FL140 | FL160 |
| `TBN` / `UGOLA` | 9000 ft | FL120 |
| `TEGEB` / `PADOP` | 5000 ft | 8000 ft |
| `PEFOR` | 5000 ft | 8000 ft |

```
espera { fijo, nivel_inferior_ft, nivel_superior_ft, fijos_alternos: [], observaciones }
```

Constantes del TMA que acompañan: **nivel de transición FL120**, **altitud de transición 10000 ft**.
Van en `configuracion_tma`, no en `espera`.

### 2.7 `perfil_performance`

Fuente: hoja `PERFORMANCES` (confirmada por `PERF2`). Es el **modelo de descenso/ascenso del sistema**:
una tabla por nivel, no una curva por tipo de aeronave.

| nivel | ias_kt | gs_kt | nm_min | ft_min | fijos_asociados |
|---|---|---|---|---|---|
| FL240 | 300+ | 360+ | 6.0 | 2000+ | UMKAL, GUVOL |
| FL230 | — | — | — | — | NEBEG |
| FL210 | — | — | — | — | ALBAL, YESOS |
| FL190–FL180 | 280 | 330 | 5.5 | 2000 | — |
| FL170–FL160 | 260 | 300 | 5.0 | 1800 | VULBI, DABIT |
| FL150–FL140 | 290 | — | 4.6 | 1500 | MOLPU |
| FL130 | 250 | 270 | 4.5 | 1500 | — |
| FL120–FL110 | 250 | 240 | 4.0 | 1300 | MORPA, SAFEL, LINER, ANGOD, GELUS |
| 10000 | — | 230 | 3.8 | 1000 | UGANO, VUDOG, MAPOC, AMB, ETEMI, OLMUE |
| 9000 | 220 | 220 | 3.6 | 1000 | SEKSU\*, KIDUG\*, DONTI |
| 8000 | 210 | 210 | 3.5 | 800 | TABON, UGOLA, PULKI |
| 7000 | 180 | 180 | 3.0 | 700 | PUMAR |
| 6000–5000 | 150 | 150 | 2.5 | 500 | — |

`fijos_asociados` = el fijo donde ese nivel debe estar alcanzado. Es una **restricción vertical
por procedimiento**, no una propiedad del nivel; en el JSON se replica también en `paso_procedimiento`.

### 2.8 `minima_separacion`

Fuente: hoja `ESPACIAM`. La mínima depende de tres condiciones, no de una:

```
minima_separacion {
  pista,                  // 17L | 35R
  sivigats,               // bool — vigilancia ATS disponible
  con_salidas,            // bool — hay salidas intercaladas
  lvp,                    // bool — procedimientos de baja visibilidad activados
  valor, unidad           // 5 / "MIN"  ·  9 / "NM"  ·  20 / "NM"
}
```

| sivigats | salidas | LVP | 17L | 35R |
|---|---|---|---|---|
| no | sí | no | 5 MIN | 5 MIN |
| no | no | no | 5 MIN | 5 MIN |
| sí | sí | no | 9 NM | 9 NM |
| sí | no | no | 5 NM | 5 NM |
| sí | sí | sí | 20 NM | — |
| sí | no | sí | 15 NM | — |
| no | — | sí | 8 MIN | — |

> Estas son mínimas de **espaciamiento en aproximación**. Las mínimas de separación en ruta
> (vertical 1000/2000 ft, longitudinal 10/5 min, radar 5/3 NM) **no están en las fuentes**
> y hay que confirmarlas contra AIP Chile antes de codificarlas. Ver §6.

### 2.9 `radar`

Fuente: hoja `RDRs` (cita AIP Chile ENR 1.6-7).

| equipo | alcance_nm | rpn | dependencia |
|---|---|---|---|
| PSR Santiago — Cerro Colorado | 80 | 15 | Santiago APP/ACC |
| MSSR Santiago — Cerro Colorado | 250 | 15 | Santiago APP/ACC |
| MSSR Santiago — Yerbas Buenas | 250 | 12 | Santiago APP/ACC |

### 2.10 `dependencia` y `postacion`

`dependencia`: una posición de control con su frecuencia.

| dependencia | frecuencia |
|---|---|
| SCEL TWR | 118.1 |
| SCEL APP | 129.7 |
| SCEL ACC Norte | 129.1 / 126.3 |
| SCEL ACC Sur | 126.3 / 128.1 |
| SCDA ACC | 128.3 |
| SCSE APP | 135.35 |
| SCIE APP | 125.8 |
| SCTE ACC | 128.5 |
| ACCO | 124.9 |
| SAME ACC | 126.6 |

> El ACC Norte aparece con 129.1 en una hoja y 126.3 en otra; el ACC Sur con 126.3 y 128.1.
> **Requiere confirmación** — se guardan ambas como `frecuencias: []`.

`postacion`: la tabla distancia↔tiempo entre fijos que enmarcan un límite de sector.

```
postacion {
  limite,                 // "SCEL ACC N 126.3 / SCIE APP 125.8"
  dependencia_a, dependencia_b,
  entradas: [ { fijo, dist_nm, mea_ft, tiempos: { "180": min, "240": min, … } } ],
  salidas:  [ … igual … ]
}
```

Los encabezados `8/'  7/'  6/'  5/'  4/'` de estas hojas son NM por minuto a GS 480/420/360/300/240.
Los minutos están precalculados: `tiempo_min = dist_nm / (gs_kt / 60)`.

> **Advertencia de fidelidad:** la correspondencia izquierda/derecha de estas tablas depende de
> celdas combinadas que el extractor no conserva. El JSON las emite con `"revisar": true`
> y hay que validarlas contra la planilla abierta antes de usarlas en producción.

---

## 3. Capa de catálogo

### 3.1 `tipo_aeronave`

Fuente: hojas `ACFT` y `ACFT1`. Las planillas dan **dos velocidades típicas** por tipo (rango de uso),
no una curva de performance.

```
tipo_aeronave { oaci, nombre, categoria, wake, vel_min_kt, vel_max_kt, vapp_kt }
```

| oaci | nombre | vel_min | vel_max |
|---|---|---|---|
| C172 | Cessna 172 | 120 | 130 |
| PA28 | Piper PA-28 | 130 | 140 |
| C208 | Cessna 208 | 180 | 200 |
| DHC6 | Twin Otter | 150 | 180 |
| C212 | CASA C-212 Aviocar | 170 | 190 |
| SR22 | Cirrus SR22 | 160 | 180 |
| D228 | Dornier 228 | 200 | 220 |
| PA31 | Piper Navajo | 190 | 200 |
| PAY2 | Piper Cheyenne | 220 | 230 |
| BE20 | King Air 200 | 240 | 260 |
| PC12 | Pilatus PC-12 | 260 | 280 |
| C130 | Hercules | 240 | 290 |
| E55P | Phenom 300 | 400 | 400 |

Jets comerciales (de la hoja `ACFT`, una sola velocidad): `A319` 440 · `A320`/`A20N` 450 ·
`A321` 455 · `B737`/`B39M` 445 · `E190`/`E195` 430 · `B767` 460 · `A330` 470 ·
`B777`/`B787`/`B788`/`B789` 480 · `A350`/`A359` 485.

> `wake` y `vapp_kt` **no están en las fuentes**. La hoja `08_AERONAVES` del esquema maestro
> los contempla pero está vacía. Quedan `null`.

### 3.2 `aeronave` (flota / matrícula)

```
aeronave { matricula, tipo_oaci, indicativo_especial }
```

Matrículas chilenas `CC-XXX` agrupadas por tipo (46 registradas).
Indicativos especiales usados en los ejercicios: `OGRO`, `TORNADO`, `CONDOR`, `ARGON`, `COYOTE`,
`VIRUS`, `PLUTO`, `ATOMO`, `ROBOT`, `TORO`, `MAMUT`, `SATANAS`, `GARRA`, `FACH`, `EJERCITO`,
`NAVAL`, `E-TAROT`, `MIL`.

### 3.3 `operador`

```
operador { prefijo_oaci, nombre, pais }
```

Presentes en las fuentes: `LAN`/`TAM` (LATAM), `LPE` (LATAM Perú), `SKU`/`SKY` (SKY),
`JAT` (JetSMART), `LXP` (LATAM Express), `CMP` (Copa), `AVA` (Avianca), `ARG` (Aerolíneas),
`AZU` (Azul), `GOL` (GOL), `DAL`, `AAL`, `UAL`, `JBU`, `ACA`, `BAW`, `IBE`, `AFR`, `KLM`,
`DLH`, `UAE`, `QFA`, `THY`, `VOI`.

> `pais` no está en las fuentes; se deja `null` salvo los evidentes.

### 3.4 `bloque_ssr`

Fuente: hoja `SSR`. Códigos organizados en **bloques de 8 consecutivos**, que es como se asignan.

```
bloque_ssr { base: "1030", codigos: ["1030"…"1037"], serie: "1xxx" }
```

Bloques presentes: 1030, 1240, 1340, 1350, 1360, 1370, 1400, 1450, 1500, 1570, 1620, 1650, 1740,
2010, 2140, 2310, 2410, 2500, 2510, 2530, 2710, 2750, 3170, 3470, 3620, 3670, 4250, 4260, 4650,
5120, 5210, 5310, 5420, 5710, 6130, 6170, 6410, 6430, 6720, 7140, 7230, 7310, 7360, 7540, 7640.
**360 códigos en total.**

### 3.5 `conflicto_tipo` — ⚠ sin datos

La hoja `07_CONFLICTOS` está vacía. Estructura propuesta, a validar con el instructor:

```
conflicto_tipo {
  id, nombre,
  geometria,              // CONVERGENTE | ALCANCE | OPUESTO | CRUCE_NIVEL | INTEGRACION_STAR
  fijo_o_zona,            // punto donde se materializa
  nivel_ft,
  procedimientos: [],     // STAR/SID implicados
  separacion_comprometida,// referencia a minima_separacion
  acciones_validas: [],   // NIVEL | VELOCIDAD | VECTOR | ESPERA | RUTA_DIRECTA
  dificultad,             // 1-5
  probabilidad            // peso para el generador
}
```

Los ~20 ejercicios de `01modelo FPV.xlsx` son la fuente para poblarla por ingeniería inversa:
cada corrida `nRUN` muestra el conflicto y la resolución que aplicó el instructor.

### 3.6 `evento` — ⚠ sin datos

Hoja `10_EVENTOS` vacía. Propuesta: `{ id, nombre, categoria, probabilidad, descripcion, efecto }`
con `categoria ∈ { METEOROLOGIA, EMERGENCIA, FALLA_TECNICA, TRAFICO_NO_PROGRAMADO, COMUNICACIONES }`.

---

## 4. Capa de escenario

### 4.1 `escenario`

```
escenario {
  id, nombre,                    // "EX5", "04 AGO", "EVA-ISA"
  nivel_dificultad,
  configuracion,                 // NORTE | SUR
  pista_en_uso,
  hora_inicio_utc,               // "1100"
  duracion_min,
  meteorologia: { qnh_hpa, nivel_transicion, condicion, visibilidad_m, techo_ft, lvp },
  sivigats,                      // bool
  objetivo_didactico,
  n_llegadas, n_salidas,
  vuelos: [ vuelo ],
  conflictos_plantados: [ … ]
}
```

Cabecera real de un ejercicio: `Q1014 HPA · TL 110 · VMC` o `VIS 8000 BKN2500`.

### 4.2 `vuelo`

Es el contenido de una **ficha de progreso de vuelo (FPV)**.

| Campo | Origen en la tira | Ejemplo |
|---|---|---|
| `indicativo` | fila 1, col 1 | `LXP903` |
| `ssr` | fila `A:` | `2317` |
| `tipo_oaci` | fila 4 | `A321` |
| `matricula` | — | `CC-...` (solo AG) |
| `tas` | fila 4, `N0450` | `450` |
| `adep` / `ades` | fila 5 | `SCDA` / `SCEL` |
| `regla` | — | `IFR` (implícito en todas las fuentes) |
| `tipo_operacion` | derivado | `LLEGADA` · `SALIDA` · `SOBREVUELO` |
| `procedimiento` | fila 5 | `SIMOK7B` |
| `nivel_solicitado` / `nivel_crucero` | fila 1 | `240` |
| `aerovia` | fila 1 | `UQ803` |
| `fijo_transferencia` | fila 5 | `UGOLA` / `TEGEB` |
| `dependencia_anterior` / `siguiente` | — | ACC Sur / TWR |
| `pasos` | filas 2 y 3 | ver abajo |

`paso_vuelo`:

```
paso_vuelo {
  orden, fijo,
  nivel_ft,
  eto,            // hora estimada calculada  "1125"
  eto_revisada,   // segunda línea de la tira, tras instrucción ATC
  ato,            // hora real de paso
  vel_asignada_kt,
  restriccion     // "EAT1132", "TEGEB<1132", "170RLCE"
}
```

**Variante ACC.** La ficha de ruta (confirmada por `basedatos/referencia.jpeg`, ejercicio
"EXE4 SUR SUMATIVO") usa los mismos campos con dos diferencias: el bloque de nivel muestra el
nivel tachado y el reasignado (`330 → 350`), y en vez de procedimiento y fijo de transferencia
lleva la **aerovía y el tramo de ruta** (`CHI VUMIT`, `UQ802`). El modelo los cubre con
`aerovia` + `fijo_transferencia`; el nivel reasignado es `paso_vuelo.nivel_ft` sobre el
`nivel_crucero` original.

> `N0450` es la notación OACI de velocidad crucero del campo 15 del plan de vuelo (TAS en nudos).
> Las planillas la usan indistintamente como TAS y como GS; **el motor usa la GS de la tabla de
> performance por nivel**, no este valor. Se conserva por fidelidad a la ficha.

### 4.3 Anotaciones del instructor

Vocabulario recogido de las corridas `nRUN`, a modelar como enum en `instruccion`:

`PEDIR NOTIFICACIÓN` · `NOTIFIQUE DEJANDO` · `VELOCI/AJUSTAR` · `LÍMITE` · `RUTA` · `NIVEL` ·
`PTO SGTE` · `ESTIMADA` · `POSICIÓN` · `SUBSIGTE` · `RLCE` (release) · `EAT` (expected approach time) ·
`MCL` (mínimo nivel de cruce) · `EDC` (estimated departure clearance) · `SCR`.

---

## 5. Capa de ejecución y evaluación

```
corrida {
  id, escenario_id, alumno, instructor, fecha,
  instrucciones: [ { hora, indicativo, tipo, parametro, fijo } ],
  desviaciones: [ { hora, tipo, severidad, descripcion, vuelos: [] } ],
  evaluacion: { competencias: [ { nombre, resultado, observacion } ], indicadores: {} }
}
```

`tipo` de instrucción: `CAMBIO_NIVEL` · `RESTRICCION_VELOCIDAD` · `VECTOR` · `DIRECTO` ·
`ESPERA` · `TRANSFERENCIA` · `AUTORIZACION_APROXIMACION`.

`tipo` de desviación: `PERDIDA_SEPARACION` · `DESVIO_MEA` · `INCUMPLE_RESTRICCION` ·
`TRANSFERENCIA_TARDIA` · `SATURACION`.

> Hojas `13_EVALUACION` y `14_ESTADISTICAS` vacías: la rúbrica y los indicadores concretos
> los tiene que definir el instructor. Estructura lista, contenido pendiente.

---

## 6. Lo que falta o hay que confirmar

| # | Asunto | Estado | Impacto |
|---|---|---|---|
| 1 | **Catálogo de conflictos tipo** | Sin datos | Bloquea el generador automático. Se puede derivar de los 20 ejercicios resueltos |
| 2 | **Mínimas de separación en ruta** | Sin datos | Solo hay mínimas de espaciamiento en aproximación. Confirmar contra AIP Chile ENR |
| 3 | **Categoría de estela por tipo** | Sin datos | Necesaria para separación por estela turbulenta |
| 4 | **Coordenadas de DME-fixes** | Sin datos | `D25AMB`, `EL220`, etc. sin radial/distancia. No bloquea el cálculo de tiempos (que usa NM de las tablas) pero sí cualquier vista gráfica |
| 5 | **SID reales en el esquema maestro** | Placeholders | La hoja `04_SID` tiene valores idénticos para las 15 SID. Los reales están en `STARs-SIDs-2` |
| 6 | **Qué significa NORTE / SUR** | **Ambiguo** | Las fuentes usan las dos palabras con dos sentidos: configuración de pista (`02_PISTAS`, `IACs`, `ESPACIAM` → 17 vs 35) y sector de espacio aéreo (`ARR-SID N-S`, postación, `ACC NORTE`/`ACC SUR`). En `11_ESCENARIOS` columna C no se puede saber cuál de los dos. **Resolver antes de modelar**: si son dos conceptos, necesitan dos nombres |
| 6b | **Configuración de pista NORTE (RWY 35)** | Casi sin datos | Todos los procedimientos con detalle son de 17L. Cuánto importa depende de la respuesta a la fila anterior |
| 7 | **Frecuencias de ACC Norte/Sur** | Contradictorias | 129.1 vs 126.3 y 126.3 vs 128.1 |
| 8 | **ALBAL7A: 78 u 80 NM** | Contradictorio | Dos valores en la misma hoja |
| 9 | **Viento** | Sin datos | Las planillas asumen GS = performance por nivel, sin componente de viento. Si se quiere realismo hay que añadir `viento` al escenario |
| 10 | **Vigencia AIRAC** | Sin datos | Las tablas dicen "02 JUL 2026" / "05 AGO 2026" pero no citan ciclo AIRAC |
| 11 | **Elevación de SCEL** | Sin datos | Ninguna planilla la trae, y una salida tiene que arrancar de algún sitio. El motor usa 6000 ft (el nivel más bajo de `PERFORMANCES`) y lo declara como supuesto en cada cálculo |
| 12 | **Nivel al final de `EROLO8A`** | Sin datos | Las demás STAR terminan en TEGEB, cuyo MCL de 5000 ft sí está en `HLDNG`. `EROLO8A` termina en `ISILO`, que no tiene MCL publicado |

### Una lectura que había que corregir

En la hoja `05_STAR`, las columnas **Alt Min / Alt Max / Vel Max** van junto al FIX de la
columna D, así que son la ventana **en ese punto concreto**, no del procedimiento entero.
`UMKAL7C` dice `24000 / 24000` sobre `UMKAL` porque ése es el nivel al que se entra a la
llegada. Interpretadas como piso de descenso de toda la STAR, el perfil vertical sale al revés.
Está corregido, pero conviene confirmarlo con ATC: si la intención era otra, cambia el perfil de
las ocho llegadas.

**Sobre estándares chilenos:** las fuentes citan explícitamente el **AIP Chile (ENR 1.6-7)** para
radares y usan nomenclatura DGAC (SIVIGATS como sistema de vigilancia, postación, MCL, EAT, RLCE).
Los puntos 2, 3 y 10 son los que conviene validar contra AIP vigente antes de que el prototipo
pase a uso didáctico real — no bloquean el prototipo.
