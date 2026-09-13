# ATCsimS

Simulador didáctico de ejercicios de control de tránsito aéreo para el **TMA Santiago (SCEL)**,
posiciones APP y ACC. Reemplaza el ejercicio de papel que hoy prepara el instructor a mano:
las fichas de progreso de vuelo, la planilla de horas de paso y la corrección.

Prototipo. Corre entero en el navegador y se publica como sitio estático — no hay servidor, no
hay cuentas y ningún dato sale del equipo de quien lo usa.

## Empezar

```bash
npm install
npm run dev -w @atcsims/web     # http://localhost:5173
```

Otros comandos:

```bash
npm test              # 118 pruebas: el motor contra los números de las planillas
npm run typecheck     # TypeScript estricto en los tres paquetes
npm run data:build    # reimporta data/*.json desde basedatos/
npm run data:validate # comprueba la integridad de la base
```

## Cómo se usa

| Vista | Rol | Qué hace |
|---|---|---|
| `/scenarios` | Instructor | Banco de ejercicios guardados en este navegador |
| `/scenarios/:id` | Instructor | Armar el ejercicio y ver los conflictos que genera |
| `/exercise` | Alumno | Controlar: instruir, separar, entregar |
| `/runs` | Instructor | Cargar la entrega del alumno y ver qué resolvió |
| `/navdata` | Ambos | Qué se importó de las planillas |
| `/print` | Ambos | Las strips en A4 apaisado para escribir encima |

Sin servidor, un ejercicio viaja de dos formas: **por enlace** (el escenario va comprimido en el
hash de la URL) o **por archivo `.json`**. La entrega del alumno no es un resultado, es su lista
de instrucciones con la hora de cada una: el instructor la vuelve a aplicar desde cero.

## Estructura

```
basedatos/     Las 16 planillas de ATC. Fuera del repo salvo el inventario y la foto de
               referencia; ver basedatos/INVENTARIO.md
tools/         Importador sin dependencias de .xlsx -> data/*.json, y el validador
data/          La base de navegación en JSON. Generada, no editable a mano
packages/core  El dominio: tipos, motor de horas de paso, perfil vertical, instrucciones,
               conflictos. Sin dependencias y sin saber que existe React
packages/navdata  Carga y sanea data/*.json
apps/web       Vite + React + TypeScript. Lo único que se despliega
docs/          Modelo de datos y requisitos, escritos para discutirlos con ATC
```

## La regla que gobierna el proyecto

**Los números salen de las planillas o no salen.** Cuando un dato falta, el motor se niega a
calcular y dice por qué, en vez de rellenar el hueco con una deducción que produzca horas que
parecen válidas. Lo mismo con lo que sí hay que suponer: se declara en el resultado y la interfaz
lo muestra.

Hay tres sitios donde eso es visible y conviene conocerlos antes de tocar nada:

- [`packages/navdata/src/sanitize.ts`](packages/navdata/src/sanitize.ts) — lo que se excluye a
  propósito, con el punto del informe a ATC que lo resolverá. Hoy: `ASIMO7D`, a la que le falta
  una distancia.
- [`packages/core/src/provisionalMinima.ts`](packages/core/src/provisionalMinima.ts) — las
  mínimas de separación en ruta, que **no son datos de la dependencia**. Ningún informe de
  conflictos se declara limpio sin decir con qué se midió.
- [`data/README.md`](data/README.md) — el contrato de los JSON, los defectos encontrados en las
  planillas y los dos datos que no están en ninguna.

Si un dato está mal, se corrige **en el Excel** y se reimporta. Así la planilla sigue siendo la
fuente de verdad y el instructor no tiene que aprender JSON.

## Convenciones

- **Código, identificadores y claves de JSON en inglés.** Comentarios y textos de interfaz en
  español. La terminología aeronáutica se respeta tal cual: `fix`, `STAR`, `SID`, `IAC`,
  `holding`, `MCL`, `SSR`, `TAS`, `GS`, `ETO`, `FL`.
- Distancias en NM, altitudes en pies, velocidades en nudos, tiempos en minutos.
- Las horas se guardan como minutos desde medianoche UTC; `HHMM` es solo cómo se escriben.
- Se acumulan sin redondear y se redondean únicamente al mostrarlas, para que una instrucción
  encadenada no arrastre error.

## Publicar

Cada push a `main` o `master` dispara [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
que valida la base, comprueba tipos, corre las pruebas y solo entonces publica en GitHub Pages.
Si el motor deja de reproducir los tiempos de las planillas, no se publica nada.

Para activarlo la primera vez: en **Settings › Pages**, poner *Source* en **GitHub Actions**.

Los assets se construyen con rutas relativas, así que el sitio funciona igual bajo
`/ATCsimS/` que en la raíz de un dominio, sin configurar nada.

## Lo que este prototipo no es

- **No hay cuentas ni control de acceso.** El rol es una elección de vista.
- **No hay estado compartido en vivo.** El instructor no ve al alumno trabajando; recibe su
  archivo al final.
- **No genera ejercicios solo.** Falta el catálogo de conflictos tipo. Los escenarios se arman a
  mano, igual que hoy.
- **Las mínimas de separación en ruta son provisionales** hasta que ATC responda.
- **Solo configuración SUR / pista 17L**, que es de lo único que hay procedimientos con detalle.

Detalle de lo que falta o hay que confirmar con ATC en
[`docs/MODELO_DATOS.md`](docs/MODELO_DATOS.md) §6.
