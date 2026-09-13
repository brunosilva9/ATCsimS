# Inventario de `basedatos/` — ATCsimS

Referencia de los 16 archivos fuente. Ámbito: **TMA Santiago (SCEL)**, posiciones APP y ACC
(Norte / Sur), configuraciones RWY 17L (SUR) y 35R (NORTE).

Leyenda de rol:
- **BD** = datos maestros reutilizables
- **EJ** = ejercicios / simulaciones ya resueltas (material de referencia)
- **TPL** = plantilla o prototipo de cálculo
- **DOC** = documento de proyecto

---

## 1. `Especificacion_Funcional_APP_SCEL_Training_System_v1.0.docx` — DOC

Esqueleto de la especificación funcional (solo títulos, sin desarrollo).

- Propósito: herramienta didáctica para **generar, administrar y evaluar** ejercicios APP de SCEL.
- Usuarios: **Instructor** y **Alumno**.
- Módulos: Configuración · Base de Navegación · Procedimientos · Escenarios · Generador · Evaluación.
- Principios: exactitud, consistencia, trazabilidad, utilidad didáctica.
- Próximo paso declarado: escribir la **ERF** (Especificación de Requisitos Funcionales).

## 2. `APP_SCEL_Training_System_v1.0.xlsx` — BD (esquema maestro, mayormente vacío)

16 hojas que son el **modelo de datos objetivo** del sistema. Estructura definida, contenido parcial:

| Hoja | Estado | Contenido |
|---|---|---|
| `00_MENU` | ok | Metadatos del proyecto (v1.0, "Borrador") |
| `01_CONFIG` | vacía | Solo valores NORTE / SUR |
| `02_PISTAS` | **poblada** | 17L/17R curso 175, 35R/35L curso 355, 3750 m; ILS solo 17L/17R; RNAV todas |
| `03_BASE_NAVEGACION_SCEL` | **48 fijos** | 32 columnas: ID (WP000001…), FIX, tipo, lat/long, sector, flags IAF/IF/FAF/MAPt, SID/STAR/IAC asociadas, campos de conflicto (nivel, tipo, probabilidad, separación, acción, prioridad). Filas 50–200 pre-numeradas vacías |
| `04_SID` | 15 filas, incompleta | Todas las SID con RWY 17L / AMB / 10000–24000 / 280 kt (placeholder, no real) |
| `05_STAR` | **8 STAR reales** | ANDES1, EROLO6E/7F/8A, SIMOK7B, ASIMO7D, UMKAL7C, VENTANAS1D — con fijo de entrada, alt min/max, vel máx y distancia |
| `06_IAC` | 7 filas | IAC 01/03/04/06/07/11/16, RWY 17L, IAF TEGEB (VOR→PADOP), DA/MDA 2000 |
| `07_CONFLICTOS` … `10_EVENTOS` | **vacías** | Solo encabezados — es el hueco a llenar |
| `11_ESCENARIOS` | 20 filas | Escenarios 1–15 NORTE, 16–20 SUR; resto de columnas vacío |
| `12_GENERADOR`, `13_EVALUACION`, `14_ESTADISTICAS`, `15_REL_FIX_PROCEDIMIENTO`, `99_LISTAS` | vacías | Encabezados únicamente |

## 3. `Base_Navegacion_SCEL_Borrador_v1.xlsx` — BD (obsoleto)

Solo la hoja `03_BASE_NAVEGACION_SCEL`, **totalmente vacía** (200 filas numeradas 1–200).
Es la versión previa, ya superada por la hoja homónima del archivo 2. *Candidato a descartar.*

---

## 4. `01modelo FPV.xlsx` — EJ + BD (el archivo más importante: 28 hojas)

FPV = **Ficha de Progreso de Vuelo**. Contiene el diseño de la tira y ~20 ejercicios reales resueltos.

**Plantillas de tira:**

- `BLCO`, `FNEGRO`, `BLANK` — maquetas gráficas de la ficha en blanco.
- `APP`, `ACC` — plantillas de tira **con la disposición de campos por posición**.

**Anatomía del bloque de tira** (≈13 filas × ~14 columnas por aeronave, 5 tiras por hoja):

```
callsign | fix anterior | FL | fix siguiente | AWY     <- identificación y ruta
hh | mm estimada | hh | mm revisada                    <- horas de paso
A: | SSR                                               <- código transpondedor
tipo ACFT | N0450 (TAS) | altitudes asignadas          <- performance
ADEP | ADES | punto de transferencia | SID/STAR        <- plan de vuelo
```

Cabecera recurrente: hora UTC, **QNH** (Q1014 HPA), **TL 110**, VMC/VIS, frecuencias
(TWR 118.1 · APP 129.7 · ACC N 129.1/126.3 · ACC S 126.3/128.1).

**Ejercicios (cada uno = un escenario completo):**
`04 AGO`, `03 AGO`, `31JUL`, `EX2 08jul`, `EX02 8JUL`, `EX2`, `EX3 08jul`, `EX5`, `EX6`, `EX7`,
`ex9`, `EXE8`, `EXE5 ISA ALCANCE`, `EVA-ISA`
— y sus corridas resueltas `1RUN`…`6RUN` (mismo tráfico con horas revisadas, niveles
reasignados, restricciones de velocidad y anotaciones del instructor: `PEDIR NOTIFICACIÓN`,
`NOTIFIQUE DEJANDO`, `VELOCI / AJUSTAR`, `EAT1132`, `TEGEB<1132`, `170RLCE`, `LÍMITE / RUTA / NIVEL`).

**Hojas de datos dentro de este archivo:**

- `ACFT` — flota de ejercicio: 20+20 vuelos comerciales SCEL↔internacional con SSR asignado;
  50 vuelos LATAM/SKY/JetSMART domésticos; y el **listado de matrículas CC-XXX por tipo con
  su rango de velocidad** (PAY2 220–230, BE20 240–260, D228 200–220, C130 240–290, PC12 260–280,
  SR22 160–180, DHC6 160–180, C212 160–180, PA31 190–200, C172 120–130, C208 150–180, PA28 130–140, E55P 400).
  Indicativos militares/especiales: OGRO, TORNADO, CONDOR, ARGON, COYOTE, VIRUS, PLUTO, ATOMO, ROBOT,
  TORO, MAMUT, SATANAS, GARRA, FACH, EJERCITO, NAVAL.
- `SSR` — **pool de códigos transpondedor** organizado en bloques de 8 (1030–1037, 1240–1247,
  2010–2017 … 7640–7647). Es la tabla de asignación para el generador.
- `POSTAC` — ver sección "postación" abajo.

---

## 4b. `referencia.jpeg` — EJ (foto de un ejercicio ACC resuelto)

Escaneo de **"EXE4 SUR SUMATIVO"**: 11 fichas de progreso de vuelo de un ejercicio **ACC** (en ruta),
rellenadas y corregidas a mano por el instructor. Es la contraparte en ruta de los ejercicios APP
de `01modelo FPV.xlsx`, y confirma la anatomía de la tira:

```
┌───────────────┬──────────────┬──────────┬──────────┬──────────┬─────────────┐
│ LVCTX         │ ANGOD        │ 330→350  │  MUNEP   │   CHI    │ CHI VUMIT   │
│ A: 5427       │        15    │ 240      │   1128   │   1138   │             │
│ C560  N0430   │     11       │          │          │          │             │
│ SCEL   SAZS   │ ANDIX        │          │          │          │             │
└───────────────┴──────────────┴──────────┴──────────┴──────────┴─────────────┘
  indicativo      fijo ant.      nivel      puntos siguientes     aerovía /
  SSR             hora paso      (tachado   con hora estimada     ruta
  tipo + TAS      fijo sgte.      = cambio
  ADEP  ADES                      asignado)
```

La hora se escribe con la **hora en grande y los minutos como exponente**; cuando hay revisión,
el minuto revisado va debajo (`11²¹` sobre `20` = estimada 1121, revisada 1120). Los niveles
tachados y reescritos en otro color son las reasignaciones del instructor.

Aporta datos que no están en las planillas: tipos `DH8D` y `C650`, indicativos `LUTOR`,
`EJERCITOC`, `LVCTX`, `CCDHT`, y tráfico de sector ACC Sur entre SCEL, SCIE, SCFA, SCNT, SCBA,
SCTE, SCCH, SCVM y SAZS.

## 5–6. `Postacion ACC NORTE-SUR.xlsx` y `Postacion ACCE.xlsx` — BD (**archivos idénticos**)

Hojas `ACCE` y `NORTE`. Tabla **distancia ↔ tiempo por velocidad**, núcleo del cálculo de ETO:

```
480 | 420 | 360 | 300 | 240 | DIST | PTO | <frecuencia/dependencia> | PTO | DIST | 240 | 300 | 360 | 420 | 480
    minutos por tramo          NM    fijo      límite de sector       fijo   NM      minutos por tramo
```

Encabezado `8/' 7/' 6/' 5/' 4/'` = NM por minuto a cada GS. Cubre los límites con
SCDA ACC 128.3, SCSE APP 135.35, ACCO 124.9, SAME ACC 126.6, SCEL ACC N 126.3 / S 128.1,
SCIE APP 125.8, SCTE ACC 128.5. Fijos de ruta: OPTAN, TIMDA, TOY, NUXUP, DANLA, BUXIS, TOLAS,
VTN, KILIN, ITAVA, ETAVA, DGO, UPUSI, BOLOK, CHI, ELABA, MUNEP, KADAK, EROLO…

## 7–8. `TABLAS AWY-STAR-IAC-MIN ESPAC - APP SIVIGATS 02 JUL2026 / 05 AGO 2026 EVAL.xlsx` — BD (la más completa)

Los dos archivos son iguales salvo que el de **05 AGO** añade la hoja `ACFT1 (2)`. **Usar el de 05 AGO.**
19–20 hojas:

| Hoja | Contenido |
|---|---|
| `Way Points` | **50 fijos con coordenadas** (formato GMS mixto, hay que normalizar) |
| `CIRC-APP` | Mapa circular: fijo de entrada → AWY → SID/STAR asociadas |
| `ARR-SID N-S` | Matriz **configuración (NORTE/SUR) × AWY × waypoint × STAR/SID** |
| `CIRC-STAR-SID` | Tabla relacional AWY ↔ WAYPOINT ↔ STAR ↔ SID (la relación llave del modelo) |
| `STARs-SIDs-2` | **Secuencia de fijos y distancias por procedimiento** — el dato más valioso. Ej: `ANDES1: SIMOK→MOLPU→UGANO→TBN→D25AMB→PUMAR→TEGEB`, distancias restantes `90-60-27-19-14-9-0`, legs `33-8-5-5-9`. También SID: `ALBAL7A: AMB→DESIT→ESKUL→LINER→SUPRA→ALBAL` |
| `IACs-1` / `IACs-2` | IAC 01/03/04/06/07/09/11/14/16 por RWY (17L, 35R) y por requisito **SIVIGATS** |
| `HLDNG` | **Esperas**: DABIT FL170–FL240 · KADAK FL140–FL160 · TBN/UGOLA 9000–FL120 · TEGEB/PADOP/PEFOR 5000–8000. MCL por fijo. Nivel de transición FL120, altitud de transición 10000 |
| `ESPACIAM` | **Mínimas de espaciamiento**: sin SIVIGATS 5 MIN; con SIVIGATS 9 NM con salidas / 5 NM sin salidas; LVP activados 20 NM / 15 NM / 8 minutos |
| `Danger Zone` | Fijos 1°/2° por nivel (TBN, TEGEB, AMB, UGOLA, PADOP) |
| `RDRs` | Radares AIP Chile ENR 1.6-7: PSR Cerro Colorado 80 NM/15 RPN; MSSR Cerro Colorado 250 NM/15; MSSR Yerbas Buenas 250 NM/12 |
| `PERFORMANCES`, `PERF2`, `PERF3` | **Tabla de performance por nivel** — la clave del motor (ver abajo). Incluye el fijo donde cada nivel debe alcanzarse |
| `POSTACION` | Misma estructura que los archivos 5–6, para APP |
| `AWYs` | Aerovías con fijos y NM/minutos: U/V200, U/T200, U/L302, U/V208, U/Q802/803/805/808/810, UL322, UM799, UM529, L405, UM424, T133, B560, UL416, R683, V103, UM783, B684 |
| `ACFT`, `ACFT1`, `ACFT1 (2)` | Flota + **tabla precalculada NM → minutos y segundos** para cada tipo a sus dos velocidades típicas |
| `Hoja1` | Prototipo de cronología de eventos (hora, intervalo, hora acumulada) |

**Tabla de performance (hoja `PERFORMANCES`) — usar como motor de descenso:**

| Nivel | IAS | GS | NM/min | ft/min |
|---|---|---|---|---|
| FL240 | KT300+ | KT360+ | 6+ | 2000+ |
| FL190–FL180 | KT280 | KT330 | 5.5 | 2000 |
| FL170–FL160 | KT260 | KT300 | 5 | 1800 |
| FL150–FL140 | KT290 | — | 4.6 | 1500 |
| FL130 | KT250 | KT270 | 4.5 | 1500 |
| FL120–FL110 | — | KT240 | 4 | 1300 |
| 10000 | — | KT230 | 3.8 | 1000 |
| 9000 | KT220 | KT220 | 3.6 | 1000 |
| 8000 | KT210 | KT210 | 3.5 | 800 |
| 7000 | KT180 | KT180 | 3 | 700 |
| 6000–5000 | KT150 | KT150 | 2.5 | 500 |

---

## 9–10. `Planilla Nav Flight Log.xlsx` / `Planilla_Navegacion_Flight_Log.xlsx` — TPL

Flight log: `Nº | Punto | Identificador | Minutos del tramo | Hora estimada | Hora real | Diferencia | Obs`.
La segunda versión está poblada con una ruta real: `EROLO → KADAK → MAPOC → AMB → TEGEB` (14 min
totales, salida 15:01) y una `Hoja1` con la STAR EROLO6E y sus tiempos por tramo.
**Es el formato de salida "esquema de ruta" que el sistema debe generar.**

## 11–13. `Plantilla_Secuencia_Horas.xlsx`, `Plantilla Secuencia Horas Prof.xlsx`, `Plantilla_Lineal_Horarios.xlsx` — TPL

Generadores de secuencias horarias: hora base + minutos a sumar → hora acumulada.
Mecánica de programación de eventos (arribos/salidas escalonados). Utilidad conceptual, no datos.

## 14–16. `BUSES_horario ver2 / ver3 / ver5.xlsx` — TPL (**el prototipo del motor**)

Analogía didáctica: **cada STAR es una "ruta de bus", cada fijo una parada, cada "bus" una aeronave**
a distinta velocidad. `ver5` es la versión funcional y documenta su propia fórmula:

> la posición se calcula con el último fijo cuya hora de paso
> `HORA_INICIO + (RECORRIDO_TOTAL − DISTANCIA_RESTANTE)/VELOCIDAD` ya ocurrió

Contiene:

- 8 rutas: AND1, SMK7B, ASM7D, UMK7C, VTN1D, ERL6E, ERL7F, ERL8A (= las 8 STAR de SCEL abreviadas)
- Secuencia de hasta 8 fijos por ruta
- **Tabla de distancia restante a cada fijo**: AND1 `90-60-27-19-14-9-0`, SMK7B `90-60-40-30-19-14-9-0`,
  ASM7D `90-60-39-29-19-14-0`, UMK7C `70-47-28-19-14-9-0`, VTN1D `55-39-29-19-14-9-0`,
  ERL6E `91-47-21-11-0`, ERL7F `140-96-50-29-19-14-9-0`, ERL8A `102-58-29-19-9-0`
- 8 velocidades: 360, 330, 300, 270, 250, 240, 210, 180 kt
- Salida: **matriz hora × aeronave mostrando en qué fijo está cada una minuto a minuto**

`ver2` y `ver3` son iteraciones previas del mismo prototipo.

---

## Síntesis: qué hay y qué falta

**Está completo y es reutilizable:**

- Fijos con coordenadas (50) · 8 STAR + ~15 SID + 9 IAC con secuencia y distancias
- Tabla de performance por nivel (GS, NM/min, ft/min)
- Mínimas de separación y espaciamiento (con y sin SIVIGATS, con LVP)
- Esperas con niveles inferior/superior por fijo
- Postación / distancias entre fijos con tiempos precalculados a 180–480 kt
- Pool de códigos SSR · flota comercial y de aviación general con velocidades reales
- ~20 ejercicios resueltos como material de validación

**Falta (huecos declarados en el esquema maestro):**

- `07_CONFLICTOS` — catálogo de conflictos tipo (el corazón del generador)
- `08_AERONAVES` — performance normalizada por tipo (los datos existen dispersos en ACFT/ACFT1)
- `09_CALLSIGN` — prefijos de operador (existen en ACFT, sin normalizar)
- `10_EVENTOS` — eventos aleatorios (emergencias, WX, fallas)
- `12_GENERADOR` — parámetros del generador
- `13_EVALUACION` / `14_ESTADISTICAS` — rúbrica de competencias e indicadores
- `15_REL_FIX_PROCEDIMIENTO` — relación normalizada fijo↔procedimiento (los datos están en `CIRC-STAR-SID` y `STARs-SIDs-2`)
- Coordenadas en formato GMS inconsistente (`33°25'11"S`, `32°15'5,3'' S`, `31°53'0''S `) — **normalizar a decimal**
- Las SID en `04_SID` del esquema maestro son placeholders; las reales están en `STARs-SIDs-2`
