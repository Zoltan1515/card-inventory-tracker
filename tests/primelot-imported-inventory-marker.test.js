const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');
const card = fs.readFileSync(path.join(root, 'lib', 'card.ts'), 'utf8');
const dbCard = fs.readFileSync(path.join(root, 'lib', 'dbCard.ts'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(card.includes('sourcePlatform?: string;') && card.includes('sourceId?: string;') && card.includes('sourceUrl?: string;'), 'Card records should carry PrimeLot source metadata for display-only markers.');
assert(dbCard.includes('source_platform?: string | null;') && dbCard.includes('sourcePlatform: text(row.source_platform)'), 'Database card rows should map source tracking columns into CardRecord.');
assert(page.includes('const isPrimeLotImportedCard = (card: CardRecord) => {'), 'Inventory UI should have an explicit PrimeLot-import detector.');
assert(page.includes('sourcePlatform === "primelot"'), 'PrimeLot marker should use source_platform when available.');
assert(page.includes('/^source:\\s*primelot$/im.test(card.notes || "")') && page.includes('/primelot listing id:/i.test(card.notes || "")'), 'PrimeLot marker should fall back to import metadata in notes for older rows.');
assert(page.includes('isPrimeLotImportedCard(card) ? "primeLotImportedRow" : ""'), 'PrimeLot-imported inventory rows should get a distinct row class.');
assert(page.includes('Imported from PrimeLot') && page.includes('primeLotImportedBadge'), 'PrimeLot-imported rows should show an Imported from PrimeLot badge.');
assert(css.includes('.primeLotImportedRow') && css.includes('rgba(8,36,34,.92)'), 'PrimeLot-imported rows should have a visibly different data-box shade.');
assert(css.includes('.primeLotImportedBadge') && css.includes('var(--neon-green)'), 'PrimeLot-imported badge should use branded styling.');
assert(page.includes('className="cardSourceLine"') && css.includes('.cardSourceLine'), 'PrimeLot badge should live on its own source line to reduce title clutter.');
assert(css.includes('.primeLotImportedRow:not(.listedCardRow):not(.soldCardRow)') && css.includes('minmax(240px, 1fr)') && css.includes('minmax(140px, 178px)'), 'PrimeLot imported not-listed rows should use a tighter, centered grid.');
assert(css.includes('text-align: center') && css.includes('.inlineCostField input { width: 112px') && css.includes('text-align: center; font-size: 1rem'), 'Inline cost controls should be centered and compact.');

console.log('PrimeLot imported inventory marker checks passed.');
