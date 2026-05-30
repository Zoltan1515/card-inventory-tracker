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
  page.includes('Grading company is set on the card listing'),
  'Review modal should show grading company as read-only source data.'
);

assert(
  !page.includes('updatePrimeLotReviewDraft(card.id, "gradingCompany"'),
  'Review modal must not allow changing grading company inline.'
);

assert(
  page.includes('quantity: selectedQuantityForCard(card)'),
  'PrimeLot payload should use the selected listing quantity, not silently post the whole inventory row quantity.'
);

console.log('PrimeLot confirmation modal source checks passed.');
