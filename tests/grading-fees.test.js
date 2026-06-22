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

assert(!page.includes('Enter grading fees'), 'Grading orders should not expose a separate Enter grading fees button.');
assert(page.includes('Grades are In!'), 'Grading orders should use the updated return action label.');
assert(page.includes('aria-label="Enter returned grades and grading fees"'), 'Return modal should capture grades and grading fees in one flow.');
assert(page.includes('saveReturnedGradingFeeExpenses'), 'Return flow should save per-card grading fees while marking grades in.');
assert(page.includes('type ReturnedGradingFeeCard'), 'Return flow should attach grading fee expenses to the returned card records.');
assert(page.includes('Field label="Grading fee"'), 'Return grade rows should include a grading fee field.');
assert(page.includes('expenseDraftAmount(row.gradingFee) * row.quantity'), 'Return modal total should count grading fee per card quantity.');
assert(page.includes('gradingFeeDescriptionForCard') && page.includes('Grading fee:'), 'Grading fees should be stored as card-specific grading fee expenses.');
assert(page.includes('isGradingExpenseForCard'), 'Accounting should match grading fee expenses back to the card.');
assert(page.includes('gradingFeeTotalForCard(card)') && page.includes('<span>Grading fees</span>'), 'Sold items should show their grading fees separately.');
assert(page.includes('totalCostBasisForCard') && page.includes('cardPurchaseCost(card) + gradingFeeTotalForCard(card)'), 'Sold ROI should include grading fees in cost basis.');
assert(page.includes('soldViewGradingFees') && page.includes('Grading fees shown'), 'Sold inventory totals should include grading fees.');
assert(css.includes('.returnGradeSplitRow { grid-template-columns: minmax(72px, 92px) minmax(130px, 1fr) minmax(130px, 1fr) minmax(110px, 150px) auto; }'), 'Return grade rows should have room for qty, grade, slab/cert, fee, and remove controls.');

console.log('Grading fee feature checks passed.');
