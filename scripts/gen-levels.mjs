// One-off helper that (re)generates src/data/levels.json from a formula.
// The JSON file is the source of truth at runtime; edit it by hand freely, or
// tweak the formula here and run:  node scripts/gen-levels.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const CAP = 100;
const levels = [];
for (let level = 1; level <= CAP; level++) {
  const n = level - 1;
  const xp = level === 1 ? 0 : Math.round((8 * Math.pow(n, 2.35) + 7 * n) / 5) * 5;
  const reward = { coins: 50 + level * 25 };
  if (level > 1 && level % 3 === 0) reward.volunteers = 1;
  if (level > 1 && level % 5 === 0) reward.permits = 1;
  if (level > 1 && level % 10 === 0) reward.parts = { key: 1 };
  levels.push(level === 1 ? { level, xp } : { level, xp, reward });
}
writeFileSync(join(here, '..', 'src', 'data', 'levels.json'), JSON.stringify({ levels }, null, 0).replace(/},{/g, '},\n{') + '\n');
console.log('wrote', levels.length, 'levels; L100 xp =', levels[CAP - 1].xp);
