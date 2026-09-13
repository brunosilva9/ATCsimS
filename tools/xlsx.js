// Lector mínimo de .xlsx sin dependencias: descomprime el paquete OOXML y parsea el XML.
// Devuelve { nombreHoja: [[celda, ...], ...] } con celdas como string ('' si vacía).
//
// Requiere `unzip` en el PATH (viene con Git Bash en Windows).

const fs = require('fs');
const cp = require('child_process');
const os = require('os');
const path = require('path');

function unesc(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&amp;/g, '&');
}

// "BC12" -> 54 (índice de columna, base 0)
function colIndex(ref) {
  let n = 0;
  for (const ch of ref.replace(/\d/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

// Serial de Excel -> texto. <1 es una hora del día; >=1 es una fecha.
function serialToText(n) {
  if (n < 1) {
    const tot = Math.round(n * 86400);
    const h = Math.floor(tot / 3600);
    const m = Math.floor((tot % 3600) / 60);
    const s = tot % 60;
    return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
  }
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n * 86400000));
  const iso = d.toISOString();
  return n % 1 === 0 ? iso.slice(0, 10) : iso.slice(0, 19).replace('T', ' ');
}

function readSharedStrings(dir) {
  const p = path.join(dir, 'xl', 'sharedStrings.xml');
  if (!fs.existsSync(p)) return [];
  const t = fs.readFileSync(p, 'utf8');
  return (t.match(/<si>[\s\S]*?<\/si>|<si\/>/g) || []).map((si) =>
    unesc(
      (si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [])
        .map((x) => x.replace(/<[^>]+>/g, ''))
        .join('')
    )
  );
}

// Índices de estilo cuyo formato numérico es una fecha u hora.
function readDateStyles(dir) {
  const out = new Set();
  const p = path.join(dir, 'xl', 'styles.xml');
  if (!fs.existsSync(p)) return out;
  const st = fs.readFileSync(p, 'utf8');

  const fmts = {};
  for (const f of st.match(/<numFmt[^>]*\/>/g) || []) {
    const id = f.match(/numFmtId="(\d+)"/);
    const code = f.match(/formatCode="([^"]*)"/);
    if (id && code) fmts[id[1]] = unesc(code[1]);
  }

  const block = st.match(/<cellXfs[\s\S]*?<\/cellXfs>/);
  if (!block) return out;
  const xfs = block[0].match(/<xf[^>]*(?:\/>|>[\s\S]*?<\/xf>)/g) || [];
  xfs.forEach((xf, i) => {
    const m = xf.match(/numFmtId="(\d+)"/);
    if (!m) return;
    const n = +m[1];
    const code = fmts[m[1]] || '';
    const builtinDate = (n >= 14 && n <= 22) || (n >= 45 && n <= 47);
    const customDate = /[hmsyd]/i.test(code) && /[:/\-]/.test(code);
    if (builtinDate || customDate) out.add(i);
  });
  return out;
}

function readSheet(xmlPath, shared, dateStyles) {
  const x = fs.readFileSync(xmlPath, 'utf8');
  const rows = [];
  for (const r of x.match(/<row[^>]*>[\s\S]*?<\/row>/g) || []) {
    const rowNum = +((r.match(/ r="(\d+)"/) || [])[1] || rows.length + 1);
    const arr = [];
    for (const c of r.match(/<c[^>]*(?:\/>|>[\s\S]*?<\/c>)/g) || []) {
      const ref = (c.match(/r="([A-Z]+\d+)"/) || [])[1];
      const t = (c.match(/t="([^"]+)"/) || [])[1];
      const s = (c.match(/s="(\d+)"/) || [])[1];
      let v = '';
      if (t === 'inlineStr') {
        v = unesc(
          (c.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [])
            .map((z) => z.replace(/<[^>]+>/g, ''))
            .join('')
        );
      } else {
        const vm = c.match(/<v>([\s\S]*?)<\/v>/);
        if (vm) {
          v = unesc(vm[1]);
          if (t === 's') v = shared[+v] ?? '';
          else if (t === 'b') v = v === '1' ? 'TRUE' : 'FALSE';
          else if (!t || t === 'n') {
            if (s !== undefined && dateStyles.has(+s) && v !== '' && !isNaN(+v)) {
              v = serialToText(+v);
            }
          }
        }
      }
      if (ref) arr[colIndex(ref)] = v;
    }
    // Rellenar huecos con '' y ubicar la fila en su posición real (1-based -> 0-based).
    for (let i = 0; i < arr.length; i++) if (arr[i] === undefined) arr[i] = '';
    rows[rowNum - 1] = arr;
  }
  for (let i = 0; i < rows.length; i++) if (rows[i] === undefined) rows[i] = [];
  return rows;
}

/** Lee un .xlsx completo. Devuelve { hoja: grid }. */
function readWorkbook(file) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xlsx-'));
  try {
    cp.execSync(`unzip -o -q "${file}" -d "${dir}"`);
    const shared = readSharedStrings(dir);
    const dateStyles = readDateStyles(dir);

    const wb = fs.readFileSync(path.join(dir, 'xl', 'workbook.xml'), 'utf8');
    const rels = fs.readFileSync(path.join(dir, 'xl', '_rels', 'workbook.xml.rels'), 'utf8');

    const relMap = {};
    for (const r of rels.match(/<Relationship[^>]*>/g) || []) {
      const id = r.match(/Id="([^"]+)"/);
      const tg = r.match(/Target="([^"]+)"/);
      if (id && tg) relMap[id[1]] = tg[1].replace(/^\/?xl\//, '');
    }

    const out = {};
    for (const s of wb.match(/<sheet [^>]*\/>/g) || []) {
      const name = unesc((s.match(/name="([^"]*)"/) || [])[1] || '');
      const rid = (s.match(/r:id="([^"]+)"/) || [])[1];
      const target = relMap[rid];
      const p = target && path.join(dir, 'xl', target);
      out[name] = p && fs.existsSync(p) ? readSheet(p, shared, dateStyles) : [];
    }
    return out;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { readWorkbook };
