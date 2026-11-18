---
name: interfaz
description: Sistema visual y convenciones de interfaz de ATCsimS. Usar al crear o modificar cualquier pantalla, componente o estilo de apps/web (rutas, componentes, CSS Modules, strips, mapa). Tiene prioridad sobre la skill genérica frontend-design.
---

# Interfaz de ATCsimS

ATCsimS ya tiene una identidad visual definida. Para una pantalla o un componente nuevo no se
inventa una estética: se extiende la existente. La skill `frontend-design` sirve para el proceso
(plan, revisión, crítica) y para la redacción de textos de interfaz; en todo lo que contradiga
este archivo, manda este archivo.

## Dos mundos visuales

Definidos en `apps/web/src/styles/tokens.css`:

| Mundo | Qué incluye | Reglas |
|---|---|---|
| **Papel** | Strips, diagrama tiempo × punto, vista de impresión | Imita la hoja impresa: blanco, línea negra fina, `--font-strip` (IBM Plex Sans Condensed). No cambia con el tema. Tokens `--paper`, `--ink`, `--rule`, `--pen`, `--pen-red`, `--marker`. |
| **Chrome** | Todo lo demás | Sigue el tema claro u oscuro del sistema. `--font-ui` (Work Sans) para texto y `--font-data` (IBM Plex Mono) para datos tabulares. |

## Color

- Solo tokens; nunca un color fijo en un componente. Cada token del chrome tiene su variante
  oscura, definida dos veces en `tokens.css` (preferencia del sistema y `data-theme='dark'`).
- La paleta de marca está muestreada del logo de ATC Chile: `--brand` (#48A8C0), `--brand-red`,
  `--brand-pale`. `--brand` no alcanza el contraste mínimo para texto: se usa en reglas, bordes y
  superficies grandes. Para texto y enlaces se usa `--accent`.
- Significado fijo: `--warn` / `--warn-soft` para dato ausente o dudoso (ámbar, no rojo: no es un
  fallo de la app), `--danger` para errores y pérdidas de separación, `--ok` para lo correcto.
- Un token nuevo se agrega en `tokens.css` con su variante oscura y un comentario que explique su
  uso.

## Tipografía y datos

- Indicativos, horas, niveles, distancias y coordenadas van en `--font-data` con
  `font-variant-numeric: tabular-nums`. En esta aplicación los datos monoespaciados son una
  decisión de dominio, no un recurso decorativo.
- Unidades siempre visibles: NM, ft, kt, min, FL.

## Estructura

- CSS Modules: un `.module.css` por componente o ruta, junto al `.tsx`.
- Estructura de página con `routes/shared.module.css`: `page`, `pageHead`, `eyebrow`,
  `pageTitle`, `lead`, `section`, `sectionHead`, `sectionTitle`, `note`, `notice`.
- Antes de crear un componente, revisar `apps/web/src/components/`: por ejemplo,
  `StripPrimitives` para piezas de strip y `OriginTag` para etiquetas de estado.
- `--radius` (4 px) y `--gap` (12 px) como base de espaciado y esquinas.

## Calidad mínima

- Funciona en tema claro y oscuro; se revisan los dos.
- Foco visible con `:focus-visible` en todo control interactivo.
- Contraste de texto de al menos 4.5:1.
- Tablas anchas dentro de un contenedor con desplazamiento horizontal, nunca desbordando la página.
- Una vista pesada (por ejemplo, el mapa) se carga bajo demanda con `import()` dinámico.

## Textos

- En español, en el vocabulario del controlador: strip, fix, STAR, SID, nivel, hora de paso.
- Un error dice qué pasó y cómo se corrige; un estado vacío dice qué hacer.
- Si el motor tuvo que suponer un dato, la interfaz lo muestra junto al vuelo afectado: nunca se
  oculta.
