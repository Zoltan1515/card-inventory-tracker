const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const outDir = path.join(root, '.tmp-psa-import-test');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

execFileSync('npx', [
  'tsc',
  '--target', 'ES2020',
  '--module', 'commonjs',
  '--moduleResolution', 'node',
  '--esModuleInterop',
  '--skipLibCheck',
  '--outDir', outDir,
  path.join(root, 'lib', 'psaImport.ts'),
  path.join(root, 'lib', 'card.ts'),
], { cwd: root, stdio: 'inherit' });

const { parsePsaOrderCsv, psaCsvLooksLikeOrderExport } = require(path.join(outDir, 'psaImport.js'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const psaCsv = fs.readFileSync('/Users/zoltan/.hermes/cache/documents/doc_c5e645246287_psa-order-26013709.csv', 'utf8');
const parsed = parsePsaOrderCsv(psaCsv, { idFactory: (rowNumber) => `psa-row-${rowNumber}`, now: '2026-06-08T00:00:00.000Z', today: '2026-06-08' });

assert(psaCsvLooksLikeOrderExport(psaCsv), 'The real PSA order export should be detected from Cert #, Description, Grade, and Images headers.');
assert(parsed.length === 22, `Expected 22 PSA card rows, got ${parsed.length}.`);

const first = parsed[0];
assert(first.id === 'psa-row-2', 'Preview id should be stable when an idFactory is provided.');
assert(first.sourceRow === 2, 'First PSA data row should report CSV row 2.');
assert(first.selected === true, 'PSA rows should be selected by default even when purchase price is blank.');
assert(first.card.name === 'SABO 2ND ANNIVERSARY TOURNAMENT-WINNER', `Expected parsed player/card name, got ${first.card.name}.`);
assert(first.card.category === 'One Piece', `Expected One Piece category, got ${first.card.category}.`);
assert(first.card.year === '2024', `Expected year 2024, got ${first.card.year}.`);
assert(first.card.setName === 'ONE PIECE PROMOS', `Expected set name, got ${first.card.setName}.`);
assert(first.card.cardNumber === '001', `Expected card number 001, got ${first.card.cardNumber}.`);
assert(first.card.gradingCompany === 'PSA', 'PSA import should set grading company to PSA.');
assert(first.card.grade === '10', `Expected numeric grade 10, got ${first.card.grade}.`);
assert(first.card.status === 'Not Listed', 'PSA shipped-to-you rows are inventory, not Sold cards.');
assert(first.card.frontPhotoUrl === '' && first.card.backPhotoUrl === '', 'PSA image ZIP links should not be used as direct front/back image URLs.');
assert(first.card.notes.includes('PSA Cert #: 142250342'), 'Notes should preserve PSA cert number.');
assert(first.card.notes.includes('PSA Cert URL: https://www.psacard.com/cert/142250342'), 'Notes should include the public PSA cert URL.');
assert(first.card.notes.includes('PSA image ZIP:'), 'Notes should preserve the PSA image ZIP link for later photo import.');
assert(first.warnings.some((warning) => warning.includes('image ZIP')), 'Preview should warn that PSA image ZIP photos need a later photo upload/import step.');

const charizard = parsed.find((preview) => preview.card.name === 'CHARIZARD EX HYPER RARE');
assert(charizard, 'Should parse Charizard row by card subject.');
assert(charizard.card.category === 'Pokemon', 'Pokemon rows should be categorized as Pokemon.');
assert(charizard.card.cardNumber === '228', `Expected Charizard card number 228, got ${charizard.card.cardNumber}.`);
assert(charizard.card.grade === '8', `Expected Charizard grade 8, got ${charizard.card.grade}.`);

const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
assert(page.includes('parsePsaOrderCsv'), 'Add Inventory CSV handler should use the PSA parser for PSA exports.');
assert(page.includes('PrimeLot or PSA CSV'), 'Import panel should tell users PSA CSV files are supported.');

fs.rmSync(outDir, { recursive: true, force: true });
console.log('PSA import parser checks passed.');
