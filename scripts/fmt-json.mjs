// Pretty-prints JSON data files while keeping short arrays/objects on one line,
// so balance tables stay readable. Usage: node scripts/fmt-json.mjs <file...>
import { readFileSync, writeFileSync } from 'node:fs';

function fmt(v, indent = '') {
  const inner = indent + '  ';
  if (Array.isArray(v)) {
    const flat = JSON.stringify(v);
    if (flat.length <= 90 && v.every((x) => typeof x !== 'object' || x === null || JSON.stringify(x).length < 60)) return flat.replace(/,/g, ', ');
    return `[\n${v.map((x) => inner + fmt(x, inner)).join(',\n')}\n${indent}]`;
  }
  if (v && typeof v === 'object') {
    const flat = JSON.stringify(v);
    if (flat.length <= 70 && !Object.values(v).some((x) => x && typeof x === 'object' && Object.keys(x).length > 2)) return flat.replace(/":/g, '": ').replace(/,"/g, ', "');
    return `{\n${Object.entries(v).map(([k, x]) => `${inner}${JSON.stringify(k)}: ${fmt(x, inner)}`).join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(v);
}

for (const file of process.argv.slice(2)) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  writeFileSync(file, fmt(data) + '\n');
  console.log('formatted', file);
}
