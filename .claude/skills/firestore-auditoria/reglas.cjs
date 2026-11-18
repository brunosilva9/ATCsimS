/**
 * Compara las reglas activas en Firebase con firestore.rules, sin contar comentarios ni líneas
 * en blanco.
 *
 *   node .claude/skills/firestore-auditoria/reglas.cjs
 *
 * Solo lectura: no publica reglas.
 */

const fs = require('fs');
const path = require('path');

const { admin, ROOT } = require('./conexion.cjs');

const normalize = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s*\/\/.*$/, '').trimEnd())
    .filter((line) => line.trim() !== '');

async function main() {
  const ruleset = await admin.securityRules().getFirestoreRuleset();
  const live = normalize(ruleset.source[0].content);
  const repo = normalize(fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8'));

  const onlyLive = live.filter((l) => !repo.includes(l));
  const onlyRepo = repo.filter((l) => !live.includes(l));

  if (onlyLive.length === 0 && onlyRepo.length === 0) {
    console.log('Las reglas activas coinciden con firestore.rules.');
    return;
  }
  console.log('Las reglas activas NO coinciden con firestore.rules.');
  for (const l of onlyRepo) console.log(`  solo en firestore.rules: ${l.trim()}`);
  for (const l of onlyLive) console.log(`  solo en Firebase:        ${l.trim()}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
