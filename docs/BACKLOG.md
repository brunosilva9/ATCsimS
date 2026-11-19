# Backlog

Mejoras y planes de ATCsimS. Este archivo es la referencia única: lo que no está aquí no está
planificado.

## Cómo se usa

Cada ítem está en uno de dos niveles:

| Nivel | Significado |
|---|---|
| **Next** | Comprometido. Se hará, en el orden en que aparece salvo que se indique una dependencia. |
| **Maybe** | Idea evaluada pero no comprometida. Pasa a Next solo con una decisión explícita. |

- Cada ítem tiene un identificador estable (`N-xx` para Next, `M-xx` para Maybe). Si un ítem pasa
  de Maybe a Next, recibe un identificador `N-xx` nuevo y conserva el anterior entre paréntesis.
- Un ítem de Next se describe con contexto, alcance, criterios de aceptación y decisiones
  pendientes. Un ítem de Maybe basta con el problema y el valor esperado.
- Al cerrar un ítem se elimina de este archivo y se cita su identificador en el mensaje del commit
  que lo completa, que es donde queda el registro.

---

## Next

### N-01 · Firestore como única fuente de la base de navegación

**Contexto.** La base se construyó importando las planillas Excel de la dependencia
(`basedatos/`, `tools/build-db.js`) y hoy vive en Firestore, donde se edita desde `/admin`. Las
planillas traen información incorrecta o contradictoria (tres tablas de performance que no
coinciden, procedimientos con distancias incompletas, valores que hubo que corregir a mano) y ya
no son la fuente real de los datos. Sin embargo, el código, la interfaz, las pruebas, las
herramientas y la documentación siguen tratándolas como origen. El objetivo es que el proyecto
quede como si hubiera nacido directamente de las colecciones.

**Alcance.**

1. **Herramientas.** Retirar `tools/build-db.js`, `tools/xlsx.js` y el script `data:build`.
   Convertir `tools/upload-firestore.js` en una herramienta de respaldo y restauración (exportar
   Firestore a un snapshot y restaurarlo), en lugar de un espejo que siembra desde los JSON
   derivados de Excel. Revisar `tools/validate.js` y `tools/build-sqlite.js`.
2. **Datos.** Eliminar los campos de procedencia: `_source`, `_sourceTimesMin`, `_timesNote`,
   `_dist05Star`, `_sourceEntryAirways` y los bloques `_meta.source` / `_meta.method`. Renombrar
   los campos que llevan "source" en el nombre (`sourceGsKt`, `sourceTimeMin`,
   `sourceTotalTimeMin`) a nombres neutros, con migración de los documentos de Firestore. Revisar
   los textos de `_review` que citan hojas.
3. **Código e interfaz.** Reescribir comentarios y mensajes que remiten a las planillas; por
   ejemplo, el error de `eto.ts` que pide "corregir el Excel y volver a importar", el
   encabezado de Navegación ("Lo que se importó de las planillas"), el pie del sitio y la
   etiqueta "GS de planilla" de la strip.
4. **Pruebas.** Las pruebas del motor validan contra los tiempos de las planillas y el paquete
   `@atcsims/navdata` importa los JSON derivados de ellas. Sustituirlos por fixtures propios del
   repositorio, con valores esperados revisados.
5. **Documentación.** Actualizar `README.md`, `data/README.md`, `docs/MODELO_DATOS.md` y
   `docs/REQUISITOS.md` (incluido RF-4.4, importar los ejercicios desde `01modelo FPV.xlsx`), y el
   paso de validación del workflow de CI.

**Criterios de aceptación.**

- No quedan referencias a Excel, planillas ni `basedatos/` en código, interfaz, pruebas ni
  documentación vigente.
- Firestore es la única fuente de datos en tiempo de ejecución y de edición.
- Las pruebas pasan con fixtures del repositorio, sin depender de archivos derivados de Excel.
- El procedimiento de respaldo y restauración de Firestore está documentado y probado.

**Decisiones pendientes.**

- Destino de `data/*.json`: snapshot de respaldo versionado, fixtures de prueba o eliminación.
- Nombres definitivos de los campos renombrados.
- Criterio de aceptación del motor que reemplaza a "reproducir la planilla" (RN-4.1/4.2).
- Si `basedatos/referencia.jpeg` se conserva como referencia visual de la strip.

**Riesgo.** Se pierde la referencia con que hoy se validan las horas de paso. Mitigación: congelar
los valores esperados actuales como fixtures antes de retirar nada.

**Depende de.** N-03, para no consolidar como fuente datos que ya se sabe que están mal.

### N-02 · Entradas y salidas por defecto según origen y destino

**Contexto.** Al agregar un vuelo, el editor de ejercicios le asigna el primer procedimiento de la
lista, sin considerar de dónde viene ni a dónde va. El generador de tráfico filtra las STAR por
una región gruesa (NORTE, ESTE, SUR) definida en tablas fijas de `packages/core/src/originRegions.ts`
(prefijo OACI → región, aerovía → región), con casos sin asignar (UL322, UM799, UM529, L405, SK).
No existe nada equivalente para las salidas. El resultado son combinaciones poco realistas, como
un vuelo desde Madrid que entra por un corredor del sur.

**Objetivo.** Que cada vuelo reciba por defecto una entrada (o salida) plausible para su origen
(o destino): un vuelo desde LEMD, una de sus una o dos entradas habituales; una salida hacia SAEZ,
la SID hacia su punto de salida.

**Alcance.**

1. Nueva colección de reglas de enrutamiento, editable desde `/admin`: clave por aeródromo o por
   prefijo OACI (gana la más específica), con las entradas (fix o STAR) y salidas (fix o SID)
   admitidas en orden de preferencia.
2. Migrar a esa colección las tablas `AIRWAY_REGION` e `ICAO_PREFIX_REGION` de
   `originRegions.ts`.
3. Editor de ejercicios: al agregar un vuelo, proponer el procedimiento preferido según la regla y
   señalar cuándo el instructor elige uno fuera de las admitidas, sin bloquearlo.
4. Generador de tráfico: usar las reglas en lugar de las tablas fijas, para llegadas y salidas.
5. Pruebas de la resolución de reglas y de su uso en el editor y el generador.

**Criterios de aceptación.**

- Un vuelo con regla recibe por defecto un procedimiento admitido para su origen o destino.
- El generador nunca asigna un procedimiento fuera de las admitidas cuando existe una regla.
- Sin regla, el comportamiento actual se mantiene.
- Las reglas se editan desde `/admin` sin cambiar código.

**Decisiones pendientes.**

- Granularidad de la regla: por fix de entrada, por STAR o por ambos.
- Tabla inicial de entradas por aeródromo y región, a validar con un controlador.
- Si un procedimiento fuera de las admitidas se marca también en la strip o solo en el editor.

### N-03 · Corrección de datos detectados en Firestore

**Contexto.** En la revisión de noviembre de 2026 se detectaron registros que afectan el cálculo
o la integridad de la base.

| Registro | Problema | Efecto |
|---|---|---|
| ASIMO7D, fix VULBI | Alt. mín 170 y Alt. máx 210; el valor esperado es 21000 / 24000 ft | El perfil se recorta a 210 ft |
| Fixes DEP y TEGEB2 | Latitud positiva (33,40 y 33,20); en el hemisferio sur debe ser negativa | Ubicados en el hemisferio norte: un directo hacia ellos da una distancia errónea, y en el mapa (N-05) aparecerían fuera de Chile |
| Fix DEP | Elevación 1,551 ft; probable error de unidades | Dato de elevación inválido |
| Fixes DEP, TEGEB2 y D43AMB | Sin tipo ni alcance | El fix no cuenta como parte del TMA |
| Fix VANIL | Sin tipo | Clasificación incompleta |
| DONTI5B, fix DONTI, y EROLO6E, fix TEGEB | Sin número de secuencia | Orden del tramo indefinido |

**Criterios de aceptación.** Todos los registros de la tabla corregidos y verificados en Navegación,
y una nueva auditoría (skill `firestore-auditoria`) sin campos obligatorios vacíos en `fixes` ni en
`procedures`.

### N-04 · Consistencia de los datos editados desde /admin

**Contexto.** Si Firestore pasa a ser la única fuente (N-01), `/admin` debe impedir que se guarden
datos inconsistentes. Hoy hay cuatro brechas conocidas.

**Alcance.**

1. En una STAR, la distancia del tramo se deriva de la distancia restante al importar, pero no al
   editar: un cambio en una deja la otra desactualizada. Derivarla al guardar, o validar que
   ambas coincidan.
2. Validar los campos obligatorios: hoy se pueden guardar fixes sin tipo ni alcance.
3. Numerar la secuencia de los tramos según su orden, en lugar de pedirla a mano.
4. Verificar la edición de aerovías con segmentos: Firestore no admite arreglos anidados y el
   formulario no los envuelve, por lo que probablemente falla al guardar.

**Criterios de aceptación.** Ninguno de los cuatro casos puede producir un registro inconsistente;
cada uno con su prueba.

### N-05 (M-01) · Mapa de aerovías, comenzando por Chile

**Contexto.** La geometría del espacio aéreo solo existe hoy como tablas de distancias. Un mapa
interactivo la hace visible para el alumno, expone los datos faltantes o erróneos y es la base para
reproducir un ejercicio en vivo.

**Alcance.** Cuatro etapas: Chile estático, procedimientos y calidad de datos, ejercicio en vivo y
otras regiones. El detalle (tecnología, inventario de datos, fuentes, modelo de datos y riesgos)
está en [PLAN_MAPA.md](PLAN_MAPA.md).

**Criterios de aceptación de la etapa 1.**

- Vista `/map` con los aeródromos de Chile, las aerovías y los fixes con coordenadas.
- Cada aeródromo muestra su ficha y lo que le falta.
- Los fixes sin coordenadas se listan con acceso a su edición en `/admin`.
- La vista se carga bajo demanda y no aumenta el tamaño inicial de la aplicación.

**Decisiones pendientes.** Las de la sección 10 del plan.

---

## Maybe

### M-02 · Configuración NORTE

Incorporar los procedimientos de la configuración NORTE. Hoy solo la configuración SUR, pista 17L,
tiene procedimientos con detalle, y la mayoría de los escenarios previstos son NORTE.

### M-03 · Viento en el cálculo de la velocidad sobre el suelo

Hoy la GS es la velocidad de la tabla de performance. Modelar viento por nivel permitiría
ejercicios más realistas, a costa de más datos por ejercicio.

### M-04 · Performance por tipo de aeronave

La velocidad depende solo del nivel; el tipo y la TAS del vuelo no cambian ninguna hora. Una tabla
por categoría de aeronave diferenciaría, por ejemplo, un turbohélice de un reactor.

### M-05 · Velocidad máxima publicada por fix

La velocidad máxima de cada tramo se guarda pero el motor no la impone.

### M-06 · Mínimas de separación de la dependencia

Reemplazar las mínimas provisionales (OACI) en ruta, radar y vertical por las de la dependencia,
cuando ATC las entregue (pendiente P-03).

### M-07 · Gestión de cuentas y roles desde la aplicación

Hoy las cuentas y los roles se crean a mano en la consola de Firebase.

### M-08 · Seguimiento del alumno en vivo

Que el instructor vea el avance del alumno durante el ejercicio, en lugar de recibir la entrega al
final.

### M-09 · Catálogo de conflictos tipo para el generador

El generador acierta el número de encuentros pedido, pero no distingue si el ejercicio resultante
tiene valor didáctico. Un catálogo de conflictos tipo permitiría pedir situaciones concretas.
