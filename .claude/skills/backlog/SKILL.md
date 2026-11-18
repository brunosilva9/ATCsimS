---
name: backlog
description: Gestionar docs/BACKLOG.md de ATCsimS. Usar para agregar un ítem nuevo, pasar un ítem de Maybe a Next, cambiar su alcance, cerrarlo al completar el trabajo o consultar qué está planificado. También antes de empezar cualquier tarea, para ubicar a qué ítem corresponde.
---

# Backlog de ATCsimS

`docs/BACKLOG.md` es la única referencia de lo planificado. Leerlo completo antes de modificarlo.

## Reglas

- Dos niveles: **Next** (comprometido) y **Maybe** (evaluado, no comprometido).
- Identificadores estables: `N-xx` en Next y `M-xx` en Maybe, correlativos. Nunca se reutiliza un
  identificador, aunque el ítem se haya cerrado o eliminado: antes de asignar uno nuevo, revisar el
  historial con `git log --all --oneline | grep -E "N-[0-9]+|M-[0-9]+"`.
- Tono profesional e impersonal, con independencia del tono de la conversación.
- Un ítem Maybe no se implementa sin una decisión explícita del usuario que lo pase a Next.

## Agregar un ítem

**Next**, con esta plantilla:

```markdown
### N-xx · Título breve en sustantivo

**Contexto.** El problema actual y por qué importa, con datos concretos (archivos, cantidades).

**Alcance.**

1. Pasos numerados, cada uno verificable.

**Criterios de aceptación.**

- Condiciones observables que permiten dar el ítem por terminado.

**Decisiones pendientes.**

- Lo que debe decidir el usuario antes o durante el trabajo.

**Depende de.** N-yy, si aplica.
```

**Maybe**: título, el problema y el valor esperado en dos o tres líneas.

Antes de escribir el contexto, verificar los datos en el código o en la base; no describir el
estado actual de memoria.

## Pasar de Maybe a Next

Solo con una decisión explícita del usuario. El ítem recibe el siguiente `N-xx` y conserva el
anterior entre paréntesis (`N-05 (M-01)`). Se completa con la plantilla de Next y se elimina de
Maybe.

## Trabajar un ítem

1. Releer su alcance y sus criterios de aceptación.
2. Si aparece trabajo fuera del alcance, proponer un ítem nuevo en lugar de hacerlo.
3. Si una decisión pendiente se resuelve en la conversación, registrarla en el ítem.

## Cerrar un ítem

1. Comprobar cada criterio de aceptación y decirle al usuario cuáles se cumplen.
2. Eliminar el ítem de `docs/BACKLOG.md` en el mismo commit que completa el trabajo.
3. Citar el identificador en el mensaje del commit, por ejemplo: `Corrige los datos de ASIMO7D y DONTI5B (N-03)`.
4. Si otros ítems dependían de él, actualizar su línea **Depende de**.
