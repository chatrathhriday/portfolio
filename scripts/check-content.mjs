// Lists unfinished content in src/content/portfolio.ts and checks link formats.
// Usage: npm run check:content   (add --online to also request every link)
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/content/portfolio.ts', import.meta.url), 'utf8');
const lines = src.split('\n');
let warnings = 0, errors = 0;

lines.forEach((line, i) => {
  const m = line.match(/(PLACEHOLDER|CONFIRM|DRAFT)/);
  if (m && !line.trim().startsWith('*') && !line.includes('isPlaceholder')) {
    warnings++;
    console.log(`  ${m[1].padEnd(11)} line ${String(i + 1).padStart(3)}: ${line.trim().slice(0, 110)}`);
  }
});

const urls = [...src.matchAll(/url:\s*'([^']*)'/g)].map((m) => m[1]).filter(Boolean);
for (const u of urls) {
  if (!/^(https:\/\/|mailto:|\.\/)/.test(u)) {
    errors++;
    console.log(`  BAD LINK   ${u} (use https://, mailto: or ./file)`);
  }
}
const email = src.match(/email:\s*'([^']*)'/)?.[1] ?? '';
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  errors++;
  console.log(`  BAD EMAIL  "${email}"`);
}

if (process.argv.includes('--online')) {
  for (const u of urls.filter((x) => x.startsWith('https://'))) {
    try {
      const r = await fetch(u, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(60000) });
      const ok = r.status < 400;
      if (!ok) errors++;
      console.log(`  ${ok ? 'OK ' : 'ERR'} ${r.status} ${u}`);
    } catch (e) {
      errors++;
      console.log(`  ERR ---  ${u} (${e.message})`);
    }
  }
}

console.log(`\n${urls.length} links · ${warnings} items to fill in or confirm · ${errors} errors`);
process.exit(errors ? 1 : 0);
