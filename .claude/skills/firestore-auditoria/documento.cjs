/**
 * Muestra un documento de Firestore completo.
 *
 *   node .claude/skills/firestore-auditoria/documento.cjs <colección> <id>
 *
 * Solo lectura.
 */

const { db } = require('./conexion.cjs');

const [collection, id] = process.argv.slice(2);
if (!collection || !id) {
  console.error('Uso: node .claude/skills/firestore-auditoria/documento.cjs <colección> <id>');
  process.exit(1);
}

db.doc(`${collection}/${id}`)
  .get()
  .then((snap) => {
    if (!snap.exists) {
      console.log(`No existe ${collection}/${id}.`);
    } else {
      console.log(JSON.stringify(snap.data(), null, 2));
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
