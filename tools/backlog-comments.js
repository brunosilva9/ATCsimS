#!/usr/bin/env node
/**
 * backlog-comments.js — los comentarios que deja el ATC en /backlog (N-09). Solo lectura.
 *
 *   node tools/backlog-comments.js            # todos, agrupados por item
 *   node tools/backlog-comments.js N-07       # solo los de N-07
 *   node tools/backlog-comments.js N-06 N-07  # varios
 *
 * Quien trabaja un item los lee antes de empezar (skill `backlog`): ahi estan las fuentes y los
 * valores que el ATC no puede dejar en el repositorio. Marca como cerrado el item que ya no esta
 * en docs/BACKLOG.md, porque sus comentarios se conservan.
 *
 * Usa la service account (tools/serviceAccountKey.json, ver upload-firestore.js), que no pasa
 * por firestore.rules: lee aunque la regla de backlogComments no este publicada. No escribe nada.
 */

const fs = require('fs');
const path = require('path');

const KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(KEY_PATH)) {
  console.error(`Falta ${path.relative(process.cwd(), KEY_PATH)} (ver upload-firestore.js).`);
  process.exit(1);
}

const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });

const BACKLOG = path.resolve(__dirname, '..', 'docs', 'BACKLOG.md');
const openItems = new Set(
  [...fs.readFileSync(BACKLOG, 'utf8').matchAll(/^### ([NM]-\d+)/gm)].map((m) => m[1])
);

const wanted = new Set(process.argv.slice(2).map((a) => a.toUpperCase()));

const stamp = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

async function main() {
  const snap = await admin.firestore().collection('backlogComments').get();
  const byItem = new Map();
  for (const d of snap.docs) {
    const c = d.data();
    if (wanted.size > 0 && !wanted.has(c.itemId)) continue;
    if (!byItem.has(c.itemId)) byItem.set(c.itemId, []);
    byItem.get(c.itemId).push(c);
  }

  if (byItem.size === 0) {
    console.log(
      wanted.size > 0 ? `Sin comentarios para ${[...wanted].join(', ')}.` : 'Sin comentarios.'
    );
    return;
  }

  const ids = [...byItem.keys()].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  for (const id of ids) {
    const list = byItem.get(id).sort((a, b) => a.createdAt - b.createdAt);
    const state = openItems.has(id) ? '' : ' (cerrado)';
    console.log(`\n${id}${state} · ${list.length} comentario${list.length === 1 ? '' : 's'}`);
    for (const c of list) {
      const edited = c.updatedAt - c.createdAt > 1000 ? `, editado ${stamp(c.updatedAt)}` : '';
      console.log(`\n  ${stamp(c.createdAt)} · ${c.authorEmail || 'sin autor'}${edited}`);
      for (const line of String(c.text).split('\n')) console.log(`    ${line}`);
    }
  }
  console.log('');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
