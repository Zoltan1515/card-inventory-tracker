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

assert(page.includes('className="primary gradingActionButton" type="button" onClick={() => openGradingFeesModal(submission)}>Enter grading fees</button>'), 'Enter grading fees should use the same green grading action button styling.');
assert(page.includes('className="primary gradingActionButton" type="button" onClick={() => openReturnGradingModal(submission)}>Mark returned</button>'), 'Mark returned should use the same green grading action button styling.');
assert(page.includes('Delete submission') && page.includes('setDeletingGradingSubmission(submission)'), 'Grading orders should include a delete submission action.');
assert(page.includes('aria-label="Delete grading submission confirmation"') && page.includes('Are you sure?'), 'Deleting a grading submission should open a themed are-you-sure modal.');
assert(page.includes('confirmDeleteGradingSubmission') && page.includes('grading_submission_cards'), 'Delete flow should have a confirmation handler.');
assert(page.includes('from("grading_submission_cards").delete().eq("submission_id", submissionToDelete.id)'), 'Delete flow should remove grading submission card links.');
assert(page.includes('from("grading_submissions").delete().eq("id", submissionToDelete.id)'), 'Delete flow should remove the grading submission row.');
assert(css.includes('.gradingActionButton') && css.includes('var(--neon-green)'), 'Grading action buttons should share green themed styling.');
assert(css.includes('.themedConfirmModal') && css.includes('.dangerEyebrow') && css.includes('.confirmSummaryBox'), 'Delete confirmation modal should have themed styles.');
assert(css.includes('.gradingFeeModal .panelHeader') && css.includes('flex-direction: column'), 'Grading fee modal header should prevent the Cancel button from bleeding out on mobile.');

console.log('Grading order action UI checks passed.');
