// Builds the upload/ folder: exactly what goes into public_html (or a
// subfolder of it) on Hostinger. Run with `npm run package` (it builds first).
//
//   upload/                  the game (from dist/) + .htaccess
//   upload/api/              the PHP API (without your local config.php)
//   upload/api/_private/data the game rules the API checks saves against
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = join(ROOT, 'upload');
const DIST = join(ROOT, 'dist');

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/ is missing - run "npm run build" first (npm run package does both).');
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// 1. the game
cpSync(DIST, OUT, { recursive: true });
cpSync(join(ROOT, 'deploy', '.htaccess'), join(OUT, '.htaccess'));
cpSync(join(ROOT, 'deploy', 'assets.htaccess'), join(OUT, 'assets', '.htaccess'));

// 2. the API, minus anything local or secret
const API_SRC = join(ROOT, 'server', 'api');
cpSync(API_SRC, join(OUT, 'api'), {
  recursive: true,
  filter: (src) => {
    const rel = relative(API_SRC, src).replace(/\\/g, '/');
    return rel !== '_private/config.php' && !rel.endsWith('.log');
  },
});

// 3. the rules the API needs (same JSON the game uses)
const DATA = join(OUT, 'api', '_private', 'data');
mkdirSync(DATA, { recursive: true });
for (const name of ['balance', 'items', 'levels', 'collections', 'events']) {
  cpSync(join(ROOT, 'src', 'data', `${name}.json`), join(DATA, `${name}.json`));
}

// 4. safety checks: no local config, and none of its secret values, may ship
const secrets = [];
const localConfig = join(ROOT, 'server', 'api', '_private', 'config.php');
if (existsSync(localConfig)) {
  const text = readFileSync(localConfig, 'utf8');
  for (const m of text.matchAll(/'(?:pass|secret)'\s*=>\s*'([^']{6,})'/g)) secrets.push(m[1]);
}
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
walk(OUT);
const rels = files.map((f) => relative(OUT, f).replace(/\\/g, '/'));
const problems = [];
if (rels.includes('api/_private/config.php')) problems.push('api/_private/config.php must not be uploaded from here');
for (const f of files) {
  if (!secrets.length || !/\.(php|js|json|html|webmanifest|css)$/.test(f)) continue;
  const text = readFileSync(f, 'utf8');
  if (secrets.some((s) => text.includes(s))) problems.push(`${relative(OUT, f)} contains a value from your local config.php`);
}
if (problems.length) {
  console.error('Packaging stopped:\n - ' + problems.join('\n - '));
  process.exit(1);
}

// 5. a short report, including what a first visit downloads
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const total = files.reduce((n, f) => n + statSync(f).size, 0);
const html = readFileSync(join(OUT, 'index.html'), 'utf8');
const first = new Set(['index.html', ...[...html.matchAll(/(?:src|href)="\.?\/?([^"]+)"/g)].map((m) => m[1]).filter((p) => !p.startsWith('http'))]);
// fonts are fetched by the stylesheet
for (const r of rels) if (r.startsWith('assets/') && r.endsWith('.woff2') && r.includes('latin-wght')) first.add(r);
let firstRaw = 0;
let firstGz = 0;
for (const r of first) {
  const p = join(OUT, r);
  if (!existsSync(p)) continue;
  const buf = readFileSync(p);
  firstRaw += buf.length;
  firstGz += /\.(woff2|png)$/.test(r) ? buf.length : gzipSync(buf).length;
}
writeFileSync(join(OUT, 'api', '_private', 'data', '.htaccess'), readFileSync(join(ROOT, 'server', 'api', '_private', '.htaccess')));

console.log(`upload/ is ready: ${files.length + 1} files, ${kb(total)} in total.`);
console.log(`First visit downloads ${kb(firstGz)} compressed (${kb(firstRaw)} raw): ${[...first].join(', ')}`);
console.log('Next: upload everything inside upload/ (including the hidden .htaccess files) to public_html. See README.md.');
