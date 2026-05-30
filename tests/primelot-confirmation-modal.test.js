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
  page.includes('const alreadyOnPrimeLot = (card: CardRecord) =>') && page.includes('const canPostCardToPrimeLot = (card: CardRecord) =>'),
  'PrimeLot posting eligibility should be explicit and reusable.'
);

assert(
  page.includes('const selectedPrimeLotCards = selectedCards.filter(canPostCardToPrimeLot);'),
  'PrimeLot postable rows should be derived from the selected inventory rows with one reusable eligibility check.'
);

assert(
  !page.includes('selectedCards.filter((card) => card.status === "Not Listed")'),
  'PrimeLot posting must not silently drop selected rows just because their generic inventory status is Listed.'
);

assert(
  page.includes('const canPostCardToPrimeLot = (card: CardRecord) => card.status !== "Sold" && !alreadyOnPrimeLot(card);'),
  'Generic Listed rows should still be eligible for PrimeLot unless they are already linked to PrimeLot.'
);

assert(
  page.includes('selectedPrimeLotCards.map((card) => [card.id, {'),
  'Review drafts should be initialized from the same rows that will be posted.'
);

assert(
  page.includes('const reviewedPrimeLotCards = () => selectedPrimeLotCards.map((card) => {'),
  'Confirm action should post the same PrimeLot rows counted as postable.'
);

assert(
  page.includes('selectedCards.map((card) => {') && page.includes('const canPostToPrimeLot = canPostCardToPrimeLot(card);'),
  'Review modal should render every selected row while marking which rows will post.'
);

assert(
  page.includes('selectedPrimeLotCards.length}</strong>'),
  'PrimeLot modal selected count should count rows that will actually be posted, not quantity.'
);

assert(
  page.includes('Already posted on PrimeLot') && page.includes('Clear PrimeLot listing'),
  'Rows already linked to PrimeLot should have a clear action directly in the review modal.'
);

assert(
  page.includes('clearPrimeLotListingForCard'),
  'Review modal clear action should call a real handler, not just show copy.'
);

assert(
  !page.includes('This selected row is already listed, so it will not be posted again'),
  'Old misleading generic Listed warning should be removed.'
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
