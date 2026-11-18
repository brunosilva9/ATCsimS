/**
 * Campos vacíos (null, [] o {}) por colección, separando los que ya venían así en data/*.json de
 * los que solo aparecen en Firestore: esos los introdujo una edición desde /admin.
 *
 *   node .claude/skills/firestore-auditoria/auditar.cjs [colección...]
 *
 * Solo lectura.
 */

const { db, COLLECTIONS, localRecords } = require('./conexion.cjs');

const isEmpty = (v) =>
  v === null ||
  (Array.isArray(v) && v.length === 0) ||
  (v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

/** Rutas de campo vacías dentro de un registro: `legs[].maxAltFt=null`. */
function emptyPaths(value, prefix, out) {
  if (Array.isArray(value)) {
    for (const item of value) emptyPaths(item, `${prefix}[]`, out);
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const p = prefix ? `${prefix}.${key}` : key;
      if (isEmpty(child)) out.add(`${p}=${JSON.stringify(child)}`);
      emptyPaths(child, p, out);
    }
  }
  return out;
}

async function main() {
  const wanted = process.argv.slice(2);
  const names = wanted.length > 0 ? wanted : Object.keys(COLLECTIONS);

  for (const name of names) {
    const snap = await db.collection(name).get();
    const fromJson = new Set();
    for (const r of localRecords(name)) emptyPaths(r, '', fromJson);

    const counts = new Map();
    let withoutMeta = 0;
    for (const doc of snap.docs) {
      const data = doc.data();
      if (!data._meta) withoutMeta++;
      for (const p of emptyPaths(data, '', new Set())) counts.set(p, (counts.get(p) ?? 0) + 1);
    }

    console.log(`\n${name}: ${snap.size} documentos, ${withoutMeta} editados desde /admin (sin _meta)`);
    const onlyFirestore = [...counts].filter(([p]) => !fromJson.has(p));
    if (onlyFirestore.length === 0) {
      console.log('  sin campos vacíos nuevos respecto de data/*.json');
    }
    for (const [p, n] of onlyFirestore) console.log(`  solo en Firestore  ${p}  (${n})`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
