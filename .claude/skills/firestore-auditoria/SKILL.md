---
name: firestore-auditoria
description: Diagnóstico de solo lectura de la base de ATCsimS en Firestore de producción. Usar para investigar un error que puede venir de los datos (una pantalla que se cae, un cálculo raro), revisar registros puntuales, detectar campos nulos o vacíos, comparar Firestore con data/*.json o verificar que las reglas activas coinciden con firestore.rules.
---

# Auditoría de Firestore (solo lectura)

Los scripts de esta carpeta leen Firestore con la service account (`tools/serviceAccountKey.json`)
y **no escriben nunca**. Corregir un dato es otra tarea: se propone al usuario y se hace desde /admin
o con su confirmación explícita.

## Requisitos

- `tools/serviceAccountKey.json` presente (no se versiona). Si falta, pedirle al usuario que la
  descargue de Consola Firebase › Configuración del proyecto › Cuentas de servicio.
- No mostrar, copiar ni leer el contenido de la credencial.

## Scripts

Ejecutar desde la raíz del repositorio:

```bash
# Campos null, [] o {} por colección, comparados con data/*.json: lo que solo aparece en
# Firestore lo introdujo una edición desde /admin.
node .claude/skills/firestore-auditoria/auditar.cjs              # todas las colecciones
node .claude/skills/firestore-auditoria/auditar.cjs procedures   # una o varias

# Un documento completo.
node .claude/skills/firestore-auditoria/documento.cjs procedures ASIMO7D

# Reglas activas frente a firestore.rules (ignora comentarios).
node .claude/skills/firestore-auditoria/reglas.cjs
```

## Cómo interpretar

- **Documento sin `_meta`**: se editó o creó desde /admin; los subidos con `upload-firestore.js`
  lo traen.
- **Opcional en `null`** (`maxAltFt`, `sourceGsKt`, `_review`…): en el dominio son `?:`. La app los
  limpia al leer (`omitEmptyOptionals`), pero conviene saber que están.
- **Obligatorio en `null`** (`type`, `scope`, `seq`): dato incompleto. Proponer su corrección y, si
  corresponde, registrarla en el backlog.
- **Valor distinto del JSON**: puede ser una corrección legítima hecha desde /admin. No asumir que
  el JSON tiene razón; preguntar.

Informar los hallazgos con el registro, el campo, el valor y el efecto en el cálculo.
