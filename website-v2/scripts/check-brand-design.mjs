import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceFiles = [
  'index.html',
  'styles.css',
  'script.js',
  'assets/js/liquid-ether.js',
];
const approvedColours = new Set(['#000000', '#5256e0', '#eeeeee', '#ffffff']);
const approvedWeights = new Set(['400', '600']);
const approvedGlassValues = new Set([
  'rgba(82, 86, 224, 0.92)',
  'rgba(82, 86, 224, 0.24)',
  'rgba(255, 255, 255, 0.38)',
]);
const failures = [];

for (const relativePath of sourceFiles) {
  const source = readFileSync(resolve(root, relativePath), 'utf8');
  const colours = source.match(/#[0-9a-f]{6}\b/gi) ?? [];
  const weights = [...source.matchAll(/font-weight:\s*(\d+)/g)].map((match) => match[1]);
  const functionalColours = source.match(/(?:rgba?|hsla?)\(\s*\d[^)]*\)/gi) ?? [];

  for (const colour of colours) {
    if (!approvedColours.has(colour.toLowerCase())) {
      failures.push(`${relativePath}: non-brand colour ${colour}`);
    }
  }

  for (const colour of functionalColours) {
    if (relativePath !== 'styles.css' || !approvedGlassValues.has(colour)) {
      failures.push(`${relativePath}: unapproved functional colour ${colour}`);
    }
  }

  if (/color-mix\(/i.test(source)) {
    failures.push(`${relativePath}: mixed colours are not permitted`);
  }

  for (const weight of weights) {
    if (!approvedWeights.has(weight)) {
      failures.push(`${relativePath}: unapproved font weight ${weight}`);
    }
  }

  if (/(satoshi|ibm plex)/i.test(source)) {
    failures.push(`${relativePath}: legacy font reference found`);
  }
}

const index = readFileSync(resolve(root, 'index.html'), 'utf8');
if (!/family=Outfit:wght@400;600/.test(index)) {
  failures.push('index.html: Outfit 400/600 stylesheet is missing');
}

if (failures.length) {
  console.error('Website v2 brand check failed:\n' + failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log(`Website v2 brand check passed across ${sourceFiles.length} first-party files.`);
