const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, '..', 'app', 'page.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  page.includes('const [primeLotReviewOpen, setPrimeLotReviewOpen] = useState(false);'),
  'Post on PrimeLot should open a review modal before any marketplace publish request.'
);

assert(
  page.includes('This will go live in the PrimeLot marketplace'),
  'Review modal must clearly warn that confirmed cards go live on PrimeLot.'
);

assert(
  page.includes('Cancel — go back'),
  'Review modal must include a cancel/go back button.'
);

assert(
  page.includes('openPrimeLotReview'),
  'Bulk PrimeLot button should call an openPrimeLotReview handler, not post immediately.'
);

assert(
  !page.includes('onClick={postSelectedCardsToPrimeLot} disabled={!selectedCards.length || postingToPrimeLot}'),
  'Bulk PrimeLot button must not call postSelectedCardsToPrimeLot directly.'
);

assert(
  page.includes('Listings selected'),
  'Review modal summary should say Listings selected, not Cards selected.'
);

assert(
  page.includes('selectedCards.length}</strong>'),
  'PrimeLot modal selected count should count selected listing rows, not card quantity.'
);

assert(
  page.includes('selectedCards.map((card) => {') && page.includes('const canPostToPrimeLot = card.status === "Not Listed";'),
  'Review modal should show every selected inventory row and mark whether it can post.'
);

assert(
  !page.includes('<span>Grading company</span>') && !page.includes('Grading company is set on the card listing'),
  'Review modal should not show a grading company box at all.'
);

assert(
  !page.includes('updatePrimeLotReviewDraft(card.id, "gradingCompany"'),
  'Review modal must not allow changing grading company inline.'
);

assert(
  !page.includes('quantity: selectedQuantityForCard(card)'),
  'PrimeLot payload should not convert same-card quantity into separate selected listings.'
);

console.log('PrimeLot confirmation modal source checks passed.');
