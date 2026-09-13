# Especificación de Requisitos Funcionales (ERF) — ATCsimS

**Versión:** 0.1 (borrador para prototipo)
**Base:** `Especificacion_Funcional_APP_SCEL_Training_System_v1.0.docx` (esqueleto) + las 15 planillas
de [`basedatos/`](../basedatos/INVENTARIO.md).
**Alcance del prototipo:** TMA Santiago (SCEL), posición APP, configuración SUR (RWY 17L).

Notación: **[D]** debe · **[R]** debería · **[P]** podría (MoSCoW reducido).
`RF-x` = requisito funcional · `RN-x` = regla de negocio · `RNF-x` = requisito no funcional.

---

## 1. Propósito y contexto

El sistema reemplaza el ejercicio de simulación **en papel** que hoy se arma a mano en Excel:
el instructor define un tráfico, calcula a mano las horas de paso por cada punto de notificación,
detecta dónde se pierde la separación y produce las **fichas de progreso de vuelo (FPV)** que el
alumno trabaja.

Lo que el sistema aporta sobre la planilla:

1. Una **base de navegación única** (hoy los mismos fijos están repetidos en 5 archivos con
   formatos distintos).
2. **Cálculo automático** de horas de paso, que hoy se hace con tablas precalculadas por velocidad.
3. **Detección automática** de pérdidas de separación.
4. **Trazabilidad**: qué ejercicio, qué alumno, qué resolvió, cómo se evaluó.

Usuarios:

| Rol | Qué hace |
|---|---|
| **Instructor** | Carga y mantiene la base, arma escenarios, ejecuta, evalúa |
| **Alumno** | Recibe el escenario, resuelve, entrega |
| **Administrador** | Mantiene la base de navegación y los catálogos (puede ser el mismo instructor) |

---

## 2. Módulos

Los seis del documento original, con su alcance concretado:

| Módulo | Alcance | Prioridad prototipo |
|---|---|---|
| M1 Configuración | Config NORTE/SUR, pista en uso, SIVIGATS, LVP, met | [D] |
| M2 Base de Navegación | Fijos, aerovías, esperas, performance, postación | [D] |
| M3 Procedimientos | SID, STAR, IAC | [D] |
| M4 Escenarios | Banco de ejercicios, vuelos, fichas | [D] |
| M5 Generador | Creación automática con conflictos plantados | [R] |
| M6 Evaluación | Rúbrica, desviaciones, estadísticas | [P] |

---

## 3. M1 — Configuración

- **RF-1.1 [D]** El sistema debe permitir seleccionar la configuración operativa del TMA:
  `NORTE` (RWY 35L/35R) o `SUR` (RWY 17L/17R), y derivar de ella qué SID/STAR/IAC están disponibles.
- **RF-1.2 [D]** Debe permitir declarar si **SIVIGATS** está operativo, porque cambia las mínimas
  de espaciamiento y habilita/inhabilita procedimientos (`EROLO8A`, IAC 04/06/07/11/16 lo requieren).
- **RF-1.3 [D]** Debe permitir activar **LVP** (procedimientos de baja visibilidad).
- **RF-1.4 [D]** Debe registrar la meteorología del escenario: QNH, nivel de transición,
  condición (VMC/IMC), visibilidad y techo.
- **RF-1.5 [R]** Debe permitir definir viento por nivel, y usarlo para corregir la GS. *(Las fuentes
  actuales no lo contemplan — ver RN-4.)*
- **RN-1.1** Altitud de transición del TMA Santiago: **10 000 ft**. Nivel de transición: **FL120**.

---

## 4. M2 — Base de Navegación

- **RF-2.1 [D]** Debe mantener un registro único de fijos con designador, tipo, coordenadas
  decimales, MEA y MCL.
- **RF-2.2 [D]** Debe importar los fijos desde las planillas fuente **normalizando las coordenadas**
  GMS a decimal. Las fuentes traen tres formatos mezclados (`33°25'11"S`, `32°15'5,3'' S`, `31°53'0''S `).
- **RF-2.3 [D]** Debe conservar la coordenada original como texto, para auditoría.
- **RF-2.4 [D]** Debe mantener las aerovías con su secuencia de fijos y la distancia de cada tramo.
- **RF-2.5 [D]** Debe mantener la **tabla de performance por nivel** (IAS, GS, NM/min, ft/min),
  que es el modelo de vuelo del sistema.
- **RF-2.6 [D]** Debe mantener las **esperas** con su nivel inferior y superior por fijo.
- **RF-2.7 [D]** Debe mantener las **tablas de postación**: distancia y MEA de cada punto respecto
  del límite de sector, con los tiempos por velocidad.
- **RF-2.8 [R]** Debe validar la integridad al importar: todo fijo citado en un procedimiento o
  aerovía existe en el registro de fijos; toda distancia restante es monótona decreciente.
- **RF-2.9 [P]** Debe permitir editar la base desde la interfaz, no solo por importación.
- **RN-2.1** Un fijo se identifica por su **designador**, no por su ID de planilla. El ID
  (`WP000001`) se conserva solo para trazar el origen.

---

## 5. M3 — Procedimientos

- **RF-3.1 [D]** Debe mantener SID y STAR como una secuencia ordenada de pasos, cada uno con
  fijo, **distancia restante al fijo final**, altitud mínima/máxima y velocidad máxima.
- **RF-3.2 [D]** Debe derivar la distancia de cada tramo de las distancias restantes, no leerla
  de una columna aparte *(las fuentes tienen ambas y no siempre coinciden)*.
- **RF-3.3 [D]** Debe mantener las IAC con tipo, pista, IAF/IF/FAF/MAPt, DA/MDA y si requiere SIVIGATS.
- **RF-3.4 [D]** Debe mantener la relación **aerovía ↔ fijo de entrada ↔ STAR** y
  **SID ↔ fijo de salida ↔ aerovía**, que es lo que permite armar un plan de vuelo coherente.
- **RF-3.5 [R]** Debe marcar los procedimientos RNAV y los que exigen SIVIGATS, y filtrarlos según M1.
- **RN-3.1** Un procedimiento pertenece a una configuración (NORTE/SUR) y a una pista.
  Si la configuración cambia, el conjunto disponible cambia entero.
- **RN-3.2** `EROLO8A` requiere SIVIGATS. Sin SIVIGATS no debe ofrecerse.

---

## 6. M4 — Escenarios y fichas

### 6.1 Escenario

- **RF-4.1 [D]** Debe permitir crear un escenario con: configuración, hora de inicio, duración,
  meteorología, objetivo didáctico y una lista de vuelos.
- **RF-4.2 [D]** Debe soportar tres tipos de vuelo: **llegada**, **salida** y **sobrevuelo**.
- **RF-4.3 [D]** Debe asignar códigos SSR desde el pool, sin repetir dentro del mismo escenario.
- **RF-4.4 [R]** Debe importar los ~20 ejercicios existentes de `01modelo FPV.xlsx` como banco inicial.

### 6.2 Cálculo de horas de paso — **el núcleo**

- **RF-4.5 [D]** Para cada vuelo, el sistema debe calcular la hora estimada de paso por cada fijo
  de su procedimiento.
- **RN-4.1** La fórmula es la que ya usa el instructor, documentada en `BUSES_horario_ver5.xlsx`:

  ```
  hora_paso(fijo) = hora_inicio + (recorrido_total − distancia_restante(fijo)) / velocidad
  ```

- **RN-4.2** La `velocidad` no es constante: se toma de la **tabla de performance por nivel**
  (`PERFORMANCES`), tramo a tramo, según el nivel al que la aeronave recorre ese tramo.
  Ejemplo real (ANDES1, de la planilla): tramo de 33 NM a 6 NM/min = 5.5 min; el siguiente,
  8 NM a 4.67 NM/min = 1.71 min; y así hasta un total de 12.29 min.
- **RN-4.3** Si no hay dato de viento, GS = valor de la tabla. Con viento (RF-1.5),
  `GS = tabla ± componente`.
- **RF-4.6 [D]** Debe redondear las horas al minuto, que es la resolución de las fichas.
- **RF-4.7 [D]** Debe recalcular todas las estimadas posteriores cuando se cambia el nivel,
  la velocidad o la ruta de un vuelo, y conservar la estimada original junto a la revisada
  *(las fichas muestran ambas: la de arriba y la de abajo)*.

### 6.3 Detección de conflictos

- **RF-4.8 [D]** Debe detectar, para cada par de vuelos, los puntos donde no se cumple la
  separación, indicando fijo, hora y magnitud del incumplimiento.
- **RF-4.9 [D]** Debe aplicar las **mínimas de espaciamiento en aproximación** según SIVIGATS,
  presencia de salidas y LVP (tabla de `ESPACIAM`).
- **RF-4.10 [R]** Debe aplicar separación vertical y longitudinal en ruta. *(Pendiente de dato —
  ver §10, punto 2.)*
- **RN-4.4** Dos vuelos están en conflicto si convergen al mismo fijo con separación vertical
  insuficiente y su diferencia de hora de paso es menor que la mínima aplicable.

### 6.4 Fichas de progreso de vuelo

- **RF-4.11 [D]** Debe generar la FPV de cada vuelo con el formato de las planillas: indicativo,
  SSR, tipo, TAS, ADEP/ADES, procedimiento, nivel, aerovía, fijo de transferencia y la grilla de
  fijos con estimada y revisada.
- **RF-4.12 [D]** Debe generar la salida **imprimible** — el instructor sigue trabajando con tiras
  de papel, y el prototipo no puede quitarle eso.
- **RF-4.13 [R]** Debe generar el **esquema de ruta** en el formato de `Planilla_Navegacion_Flight_Log`:
  `Nº · Punto · Identificador · Minutos del tramo · Hora estimada · Hora real · Diferencia · Obs`.
- **RF-4.14 [P]** Debe permitir anotar la ficha con el vocabulario del instructor
  (`PEDIR NOTIFICACIÓN`, `NOTIFIQUE DEJANDO`, `VELOCI/AJUSTAR`, `EAT`, `RLCE`, `MCL`, `LÍMITE/RUTA/NIVEL`).

---

## 7. M5 — Generador

- **RF-5.1 [R]** Debe generar un escenario a partir de parámetros: nº de llegadas, nº de salidas,
  configuración, densidad, dificultad y tipos de conflicto deseados.
- **RF-5.2 [R]** Debe plantar conflictos **deliberadamente**, no dejarlos al azar: el valor
  didáctico está en que el conflicto sea el que el instructor quiere enseñar.
- **RF-5.3 [R]** Debe elegir indicativos y tipos coherentes con la ruta (un `CC-XXX` PA28 no vuela
  SCEL–LEMD; un A350 no usa una STAR a 130 kt).
- **RF-5.4 [P]** Debe inyectar eventos aleatorios (meteorología, emergencia, falla, tráfico no programado).
- **RF-5.5 [D]** Todo escenario generado debe ser **reproducible**: misma semilla, mismo escenario.
- **RN-5.1** El generador no puede producir un escenario sin solución. Debe verificar que existe
  al menos una secuencia de instrucciones que resuelve todos los conflictos plantados.

> **Bloqueado:** este módulo necesita el catálogo de conflictos tipo (hoja `07_CONFLICTOS`, vacía).
> Ver §10, punto 1.

---

## 8. M6 — Evaluación

- **RF-6.1 [P]** Debe registrar las instrucciones que dio el alumno, con hora.
- **RF-6.2 [P]** Debe comparar el resultado contra los conflictos plantados y listar cuáles se
  resolvieron, cuáles no y cuáles se crearon nuevos.
- **RF-6.3 [P]** Debe calificar según una rúbrica de competencias definida por el instructor.
- **RF-6.4 [P]** Debe producir indicadores: nº de pérdidas de separación, tiempo de reacción,
  eficiencia de la secuencia, demoras generadas.

---

## 9. Requisitos no funcionales

- **RNF-1 [D] Exactitud.** Los cálculos del sistema deben reproducir los de las planillas.
  **Criterio de aceptación:** recalcular los ~20 ejercicios de `01modelo FPV.xlsx` y obtener las
  mismas horas de paso, con tolerancia de ±1 minuto.
- **RNF-2 [D] Trazabilidad.** Todo dato importado debe conservar su origen (archivo, hoja, fila).
- **RNF-3 [D] Consistencia.** Un mismo fijo tiene un solo registro, aunque aparezca en 5 planillas.
- **RNF-4 [D] Datos separados del código.** La base de navegación vive en archivos de datos
  editables, no incrustada en el programa.
- **RNF-5 [R] Sin dependencia de internet.** Los ejercicios se hacen en sala; el sistema debe
  funcionar sin conexión.
- **RNF-6 [R] Utilidad didáctica.** La salida debe parecerse a lo que el alumno verá en operación
  real: si la ficha en pantalla no se parece a la tira de papel, no sirve.
- **RNF-7 [P] Importación repetible.** Cuando el instructor actualice una planilla, reimportar
  debe ser un comando, no una transcripción manual.

---

## 10. Riesgos y datos faltantes

| # | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| 1 | **No existe catálogo de conflictos** | Alta | Derivarlo de los 20 ejercicios resueltos: cada `nRUN` muestra un conflicto y su solución. Trabajo de ingeniería inversa con el instructor |
| 2 | **Faltan mínimas de separación en ruta** | Alta | Solo hay mínimas de espaciamiento en aproximación. Confirmar contra AIP Chile ENR antes de usar el detector en ruta |
| 3 | **Configuración NORTE casi sin datos** | Alta | Todos los procedimientos detallados son de 17L (SUR), pero 15 de los 20 escenarios previstos son NORTE. **El prototipo debe limitarse a SUR** y declararlo |
| 4 | **Falta categoría de estela** | Media | Es dato público OACI por tipo; se puede completar sin el instructor |
| 5 | **Sin modelo de viento** | Media | Las planillas asumen GS de tabla. Aceptable para el prototipo; declararlo como limitación |
| 6 | **Contradicciones en las fuentes** | Baja | Frecuencias ACC N/S, y ALBAL7A 78 vs 80 NM. Conservar ambos valores y marcar `revisar` |
| 7 | **Vigencia AIRAC no declarada** | Baja | Las tablas dicen "02 JUL 2026" / "05 AGO 2026" sin ciclo AIRAC. Preguntar al instructor |
| 8 | **Tablas de postación con celdas combinadas** | Media | El extractor pierde el emparejamiento izquierda/derecha. Validar contra la planilla abierta |

---

## 11. Alcance mínimo del prototipo

Lo que debe estar para que el prototipo sea demostrable:

1. Base de navegación en JSON, importada y normalizada. ✅ *(entregado)*
2. Motor de cálculo de horas de paso con la tabla de performance por nivel. **(RF-4.5, RN-4.1/4.2)**
3. Un escenario cargado a mano con 5–6 vuelos, en configuración SUR.
4. Salida en formato ficha + esquema de ruta.
5. Detección de conflictos con las mínimas de aproximación disponibles.

Fuera de alcance del prototipo: generador automático, evaluación, configuración NORTE,
viento, y toda vista gráfica del sector.

**Criterio de éxito:** reproducir el ejercicio `EX5` de `01modelo FPV.xlsx` —sus horas de paso y
su conflicto— sin intervención manual.
