# ATCsimS

Simulador didáctico de ejercicios de control de tránsito aéreo para el **TMA Santiago (SCEL)**,
posiciones APP y ACC. Reemplaza el ejercicio de papel que hoy prepara el instructor a mano:
las fichas de progreso de vuelo, la planilla de horas de paso y la corrección.

Prototipo. Corre entero en el navegador y se publica como sitio estático, sin servidor propio.
El único punto que sale a la red es el login (Firebase Auth, para restringir quién entra); salvo
por eso, ningún dato sale del equipo de quien lo usa.

## Empezar

```bash
npm install
npm run dev -w @atcsims/web     # http://localhost:5173
```

Otros comandos:

```bash
npm test              # 191 pruebas: el motor contra los números de las planillas
npm run typecheck     # TypeScript estricto en los tres paquetes
npm run data:build    # reimporta data/*.json desde basedatos/
npm run data:validate # comprueba la integridad de la base
npm run data:sqlite   # exporta data/*.json a SQLite, para explorarla con SQL (Node 22+)
npm run data:firestore # sube data/*.json a Firestore como espejo de consulta (ver data/README.md)
```

## Acceso

La app pide login (Firebase Auth, email y contraseña) antes de mostrar cualquier pantalla. Es
solo para restringir quién entra — todavía no distingue rol por cuenta, eso sigue siendo una
elección de vista una vez adentro (ver más abajo).

No hay pantalla de registro propia: las cuentas se crean a mano desde **Consola Firebase >
Authentication > Users > Add user**, con el proveedor **Email/Password** habilitado en
**Authentication > Sign-in method**. Para desarrollar localmente hace falta copiar
`apps/web/.env.example` a `apps/web/.env.local` con la config del proyecto (ver el comentario del
propio archivo).

## Cómo se usa

| Vista | Rol | Qué hace |
|---|---|---|
| `/scenarios` | Instructor | Banco de ejercicios guardados en este navegador |
| `/scenarios/:id` | Instructor | Armar el ejercicio y ver los conflictos que genera |
| `/exercise` | Alumno | Trabajar el ejercicio, en práctica o en prueba |
| `/runs` | Instructor | Cargar la entrega del alumno y corregirla |
| `/navdata` | Ambos | Qué se importó de las planillas |
| `/print` | Ambos | Las strips en A4 apaisado para escribir encima |

### Dos modos, y son lo contrario el uno del otro

Lo elige el instructor al armar el ejercicio, y viaja dentro del enlace.

**Práctica.** El sistema calcula las horas y las va corrigiendo solo. El alumno separa el
tráfico y ve los conflictos aparecer y desaparecer con cada instrucción. Se practica el criterio.

**Prueba.** El alumno calcula a mano la hora de paso, el nivel y la velocidad de cada punto, y
el sistema **no le dice nada**: no hay conflictos marcados, no hay marcas en el diagrama, no hay
casillas que cambien de color. Lo único que devuelve la pantalla es su propio trabajo — el
diagrama se dibuja con sus horas, acertadas o no. Corrige el profesor, al abrir la entrega.
Opcionalmente el alumno también anota las instrucciones que daría, pero **no se aplican**:
recalcular sería resolverle la prueba.

Al corregir, la tolerancia por defecto es ±1 min en la hora (RNF-1), ±100 ft en el nivel y
±10 kt en la velocidad. Una casilla en blanco se cuenta aparte y **no es un error**. Y los
puntos cuya referencia no sale directa de las planillas —un nivel interpolado entre dos
restricciones, un vuelo que arrastra un supuesto del motor— van marcados: el sistema no da por
mala una respuesta contra un número que se inventó él.

### Generar el tráfico

En el editor hay un generador. Se le pide el número de llegadas, de salidas y de **encuentros**,
opcionalmente sobre qué punto y con qué geometría, y sortea tráfico hasta dar con un ejercicio que
cumpla. No inventa ninguna regla: quien dice que dos vuelos están en conflicto es el mismo
`detectConflicts` que usa el resto de la aplicación, con las mismas mínimas y los mismos avisos.

Un **encuentro** es un par de vuelos que hay que separar, no una fila del informe. Dos llegadas
demasiado juntas por la misma STAR pierden la separación sobre cada punto que comparten —seis
filas— pero es un solo problema y se resuelve con una instrucción. El instructor cuenta problemas,
así que el generador también.

El sorteo es **determinista y lleva semilla**. La misma semilla da el mismo ejercicio hoy y en seis
meses, así que el banco guarda la semilla y no el resultado, igual que guarda la receta y no los
números. Y cambiar solo la semilla produce otra versión del mismo ejercicio: es como se le da una
prueba distinta a cada alumno de un curso sin volver a armarla.

Lo que el generador **no** sabe es si el encuentro que salió vale la pena enseñarlo. Eso sale del
catálogo de conflictos tipo, la hoja `07_CONFLICTOS`, que está vacía (ver
[`docs/MODELO_DATOS.md`](docs/MODELO_DATOS.md) §3.5). Mientras siga vacía, lo que entrega es un
borrador con el número de encuentros pedido, y hay que revisarlo antes de darlo.

### Cómo viaja un ejercicio

Sin servidor, un ejercicio viaja de dos formas: **por enlace** (el escenario va comprimido en el
hash de la URL) o **por archivo `.json`**. La entrega del alumno no es un resultado: en práctica
es su lista de instrucciones con la hora de cada una, que el instructor vuelve a aplicar desde
cero; en prueba, lo que escribió en cada casilla.

Para probarlo uno mismo sin repartir nada, el editor tiene **«Probar aquí»**: abre el ejercicio
en una pestaña nueva de la misma app, en el modo que tenga puesto, sin copiar ningún enlace.

Y para comprobar un ejercicio antes de darlo —o corregirlo sin esperar ninguna entrega— el
editor también tiene, al final, **«Clave»**: la solución que calcula el motor, en las mismas
fichas de progreso de siempre. Es la única pantalla que la muestra sin haber recibido nada del
alumno, y solo la ve el instructor.

### Imprimir

`/print` también respeta el modo: en **práctica** imprime la strip ya resuelta, en dos tandas
(APP y ACC), como siempre; en **prueba** imprime la ficha **en blanco** —sin ninguna hora
puesta— para que el alumno la trabaje a mano en papel, exactamente como en pantalla.

Ahí mismo hay una casilla, apagada por defecto, **«Incluir la clave»**: si se marca, el mismo
trabajo de impresión agrega después la solución completa, en una hoja aparte con un aviso en
rojo — para la copia del instructor, no para repartir junto con la ficha en blanco.

También imprime el **diagrama tiempo × punto** (en práctica siempre; en prueba, solo dentro de
la clave, porque el diagrama sale con las horas correctas y eso ya es la respuesta). El papel no
tiene scroll, así que se corta en hojas de 45 minutos cada una — lo que entra en una A4 apaisada
— y sigue en la hoja siguiente sin perder el hilo.

Se llega a `/print` desde el editor de un ejercicio (**«Imprimir»**) o directo desde el banco
(**Ejercicios → Imprimir**, sin abrir cada uno).

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
  propósito, con el punto del informe a ATC que lo resolverá. Vacío por ahora: la última exclusión
  (`ASIMO7D`, le faltaba una distancia) se corrigió a mano — ver `_manualFix` en
  `data/procedures.json` y el punto 1 de [`data/README.md`](data/README.md#defectos-encontrados-en-las-planillas).
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

- **El login restringe el acceso, pero no distingue rol todavía.** Adentro, el rol sigue siendo
  una elección de vista libre, no una propiedad de la cuenta — eso es lo próximo por agregar.
- **No hay estado compartido en vivo.** El instructor no ve al alumno trabajando; recibe su
  archivo al final.
- **Genera tráfico, no didáctica.** El generador acierta el número de encuentros que se le pide,
  pero no sabe si el que salió enseña algo: falta el catálogo de conflictos tipo. Lo que produce
  es un borrador para revisar, no un ejercicio listo.
- **La prueba no pone nota.** Da aciertos, desviaciones y blancos; la nota la pone el profesor.
- **Las mínimas de separación en ruta son provisionales** hasta que ATC responda.
- **Solo configuración SUR / pista 17L**, que es de lo único que hay procedimientos con detalle.

Detalle de lo que falta o hay que confirmar con ATC en
[`docs/MODELO_DATOS.md`](docs/MODELO_DATOS.md) §6.
