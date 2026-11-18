# AGENTS.md

Instrucciones para agentes de código (Claude Code, Codex y similares) que trabajen en este
repositorio. Para personas, el punto de entrada es [README.md](README.md).

## El proyecto

ATCsimS es un simulador didáctico de ejercicios de control de tránsito aéreo para el TMA Santiago
(SCEL), posiciones APP y ACC. Reemplaza el ejercicio en papel del instructor: fichas de progreso
de vuelo (strips), planilla de horas de paso y corrección. Es una aplicación web estática con
Firebase (Auth y Firestore) y sin servidor propio.

| Ruta | Contenido |
|---|---|
| `packages/core` | Motor de cálculo puro: horas de paso, perfil vertical, instrucciones, conflictos, generador de tráfico, examen. Sin dependencias de interfaz ni de Firebase. |
| `packages/navdata` | Base de navegación estática (`data/*.json`). Solo la usan las pruebas y las herramientas. |
| `apps/web` | Aplicación React + Vite. Lee la base desde Firestore (`src/state/navdata.ts`). |
| `data/` | Base de navegación en JSON y su documentación (`data/README.md`). |
| `tools/` | Scripts de Node: importación, validación y subida a Firestore. |
| `docs/` | Backlog, planes, requisitos y modelo de datos. |
| `firestore.rules` | Reglas de seguridad de Firestore. Se aplican a mano en la consola. |

## Todo el trabajo pasa por el backlog

[docs/BACKLOG.md](docs/BACKLOG.md) es la única referencia de lo planificado.

1. **Antes de empezar**, identificar el ítem del backlog al que corresponde la tarea. Si no existe,
   proponer agregarlo (en Next o Maybe) antes de implementar.
2. **Al implementar**, respetar el alcance y los criterios de aceptación del ítem. Si aparece
   trabajo fuera del alcance, se registra como ítem nuevo en lugar de hacerlo en silencio.
3. **Al hacer commit**, citar el identificador del ítem en el mensaje (por ejemplo, `N-03`).
4. **Al cerrar un ítem**, eliminarlo del backlog en el mismo commit que lo completa.
5. **Correcciones menores** (un error puntual, un texto) no requieren ítem, pero si revelan un
   problema mayor, ese problema se registra en el backlog.

Los ítems Maybe no se implementan sin una decisión explícita que los pase a Next.

## Comandos

```bash
npm install
npm run dev -w @atcsims/web    # http://localhost:5173 (requiere apps/web/.env.local)
npm run typecheck              # TypeScript estricto en los tres paquetes
npm test                       # pruebas de core y web
npm run build -w @atcsims/web
node tools/validate.js         # integridad de data/*.json
```

Antes de dar una tarea por terminada deben pasar `typecheck`, `test` y `build`: son los mismos
pasos que ejecuta el workflow de CI (`.github/workflows/deploy.yml`).

## Datos y Firestore

- **Firestore es la fuente de verdad en ejecución.** La base se edita desde `/admin`, no en
  `data/*.json`.
- **`npm run data:firestore` sin argumentos borra y reescribe las 18 colecciones** y pisa todo lo
  editado desde `/admin`. No ejecutarlo nunca sin confirmación explícita. Para una sola colección:
  `node tools/upload-firestore.js <colección>`.
- `tools/serviceAccountKey.json` es una credencial con permisos de administrador. No se versiona,
  no se copia y no se muestra su contenido.
- Leer Firestore para diagnosticar está permitido. **Escribir en Firestore de producción requiere
  confirmación previa**, también para corregir datos.
- Un cambio en `firestore.rules` no se aplica solo: hay que indicarle al usuario que lo pegue en
  Consola Firebase › Firestore › Reglas.
- Una colección nueva toca varios archivos a la vez: tipo de dominio, `AdminSchema.ts`,
  `state/navdata.ts`, `tools/upload-firestore.js`, `firestore.rules` y `data/README.md`.

## Convenciones de código

- **TypeScript estricto**, con `exactOptionalPropertyTypes` y `noUncheckedIndexedAccess`. Los
  imports relativos llevan extensión `.js`.
- **Campo opcional (`?:`) y campo nulo (`| null`) no son lo mismo.** Un opcional ausente no se
  guarda como `null`; ver `omitEmptyOptionals` en `apps/web/src/routes/AdminSchema.ts`.
- **El motor no inventa datos.** Si falta un dato, el cálculo se rechaza o declara el supuesto que
  hizo; nunca rellena un hueco en silencio.
- **El cálculo de horas de paso replica el método del instructor**: hora de entrada + distancia del
  tramo ÷ velocidad sobre el suelo. No se sustituye por otro método.
- **Estilos** con CSS Modules y los tokens de `apps/web/src/styles/tokens.css`. Sin colores fijos:
  cada color se define con un token que tiene su variante oscura.
- **Comentarios en español**, explicando el porqué y no el qué.
- Cada cambio de comportamiento lleva su prueba.

## Documentación y estilo

- Todo en español.
- Los informes, planes y documentos del proyecto se escriben como archivos `.md` en `docs/`. No se
  crean documentos ni páginas fuera del repositorio sin autorización.
- Tono profesional en el backlog, los documentos y los mensajes de commit, con independencia del
  tono de la conversación.
- Mensajes de commit en español, en tercera persona del presente ("Corrige…", "Agrega…"), con una
  primera línea breve y un cuerpo que explica el motivo.

## Skills del proyecto

En `.claude/skills/`:

| Skill | Cuándo |
|---|---|
| `backlog` | Agregar, promover o cerrar ítems de `docs/BACKLOG.md`, y ubicar una tarea en él. |
| `interfaz` | Cualquier cambio de pantalla, componente o estilo. Prima sobre `frontend-design`. |
| `frontend-design` | Proceso de diseño y redacción de textos de interfaz (skill oficial de Anthropic, Apache-2.0). |
| `nueva-coleccion` | Agregar una colección o un campo a la base de Firestore. |
| `firestore-auditoria` | Diagnóstico de solo lectura de Firestore: campos vacíos, documentos y reglas. |

## Git

- La rama de trabajo es `main`: cada push a `main` publica el sitio en GitHub Pages.
- Commit y push solo cuando el usuario lo pide.
