---
name: nueva-coleccion
description: Checklist para agregar una colección nueva a la base de navegación de ATCsimS en Firestore, o un campo nuevo a una existente. Usar cuando una tarea requiera guardar un tipo de dato nuevo editable desde /admin.
---

# Agregar una colección a la base

Una colección nueva toca varios archivos y ninguno avisa si falta otro. Recorrer la lista completa
y, al terminar, informar al usuario qué se hizo en cada punto.

## Lista

1. **Tipo de dominio.** Si el motor la usa, en `packages/core/src/types.ts`; si no, como interfaz en
   `apps/web/src/state/navdata.ts`. Distinguir `campo?: T` (puede faltar) de `campo: T | null`
   (siempre presente, vacío a propósito).
2. **Datos semilla.** `data/<nombre>.json` con el bloque `_meta` y el arreglo de registros; agregar
   el archivo a `data/index.json`.
3. **Subida.** Bloque `if (wants('<colección>'))` en `tools/upload-firestore.js` con la función que
   calcula el ID de documento, y actualizar el conteo de colecciones en su comentario y en la ayuda.
4. **Esquema de /admin.** Entrada en `ADMIN_SCHEMAS` de `apps/web/src/routes/AdminSchema.ts`:
   `docId` igual al del punto 3, y cada campo con `nullable` u `optional` según el punto 1.
5. **Lectura.** En `apps/web/src/state/navdata.ts`: campo en `NavdataState`, valor vacío en `EMPTY`,
   `fetchCollection` en `loadAll` y el `set` correspondiente.
6. **Integridad.** Si la colección referencia a otras (fixes, procedimientos), agregar la regla en
   `packages/core/src/integrity.ts` y su conexión en `apps/web/src/routes/AdminValidation.ts`.
7. **Reglas de Firestore.** Línea `match /<colección>/{doc}` en `firestore.rules`.
8. **Documentación.** Tabla de archivos y sección de la colección en `data/README.md`.
9. **Pruebas.** Al menos de la lógica que la consume.
10. **Verificación.** `npm run typecheck`, `npm test` y `npm run build -w @atcsims/web`.

## Después de la verificación

- Indicar al usuario que pegue `firestore.rules` completo en Consola Firebase › Firestore › Reglas.
  Sin ese paso, la aplicación recibe errores de permisos.
- Subir solo la colección nueva: `node tools/upload-firestore.js <colección>`. Nunca el comando sin
  argumentos, que pisa lo editado desde /admin en todas las colecciones. Pedir confirmación antes
  de ejecutarlo: escribe en producción.

## Campo nuevo en una colección existente

Puntos 1, 4 y 8 como mínimo; el 6 si el campo referencia a otra colección. Los documentos ya
existentes en Firestore no tienen el campo: el código que lo lee debe tolerar su ausencia.
