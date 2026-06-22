const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

const assert = (condition, message) => {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
};

assert(
  page.includes('cards.filter((card) => card.status !== "Sold" && !activeGradingCardIds.has(card.id))'),
  'Active grading cards should be removed from active inventory views.'
);
assert(
  page.includes('card.status === "Not Listed" && !activeGradingCardIds.has(card.id)'),
  'Active grading cards should be removed from Unlisted and Needs Attention counts.'
);
assert(
  page.includes('const unitGradingCard = (source: CardRecord, id = crypto.randomUUID()): CardRecord => ({') &&
    page.includes('quantity: 1,') &&
    page.includes('cardQuantities[insertedGradingCard.id] = 1;'),
  'Sending quantity rows to grading should split them into one-card grading records.'
);
assert(
  page.includes('return submission.status === "At Grading" && inventoryQuantity > 1 ? Math.max(linkedQuantity, inventoryQuantity)') &&
    page.includes('const gradingSubmissionCardCopies = (submission: GradingSubmission) => gradingSubmissionCards(submission).flatMap') &&
    page.includes('Copy {copyNumber} of {totalCopies}'),
  'Legacy active grading rows with quantity should expand into individual visible card copies.'
);
assert(
  page.includes('setEnlargedPhotoCard(card)') &&
    page.includes('aria-label={`Enlarge photos of ${card.name || "card"}`}') &&
    page.includes('No photo'),
  'Expanded grading submissions should show card photos and keep the photo lightbox available.'
);
assert(
  page.includes('type ReturnGradeRow = { id: string; cardId: string; quantity: number; grade: string; slabNumber: string }') &&
    page.includes('Field label="Slab / cert #"') &&
    page.includes('Slab #: ${cleanSlabNumber}'),
  'Returned grading flow should capture slab/cert numbers.'
);
assert(
  page.includes('frontPhotoUrl: "",') &&
    page.includes('backPhotoUrl: "",') &&
    page.includes('notesWithReturnedGrade(card.notes, parsedGrade.grade, gradingCompany, returnedUnit.slabNumber)'),
  'Returned graded cards should clear raw-card photos and save returned grade details.'
);
assert(
  css.includes('.returnGradeSplitRow { grid-template-columns: minmax(82px, 110px) minmax(140px, 1fr) minmax(140px, 1fr) auto; }'),
  'Return grade rows should have room for quantity, grade, slab/cert, and remove controls.'
);
assert(
  css.includes('.gradingCardRow { border: 1px solid rgba(148,163,184,.16);') &&
    css.includes('.gradingCardRow .photoThumbButton,') &&
    css.includes('.gradingCardRow .cardThumb { width: 52px; height: 72px;'),
  'Grading submission card rows should use a compact row layout.'
);

console.log('Grading quantity, photo, and return flow checks passed.');
