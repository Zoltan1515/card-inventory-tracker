const fs = require("fs");
const path = require("path");
const assert = require("assert");

const page = fs.readFileSync(path.join(__dirname, "..", "app", "page.tsx"), "utf8");

assert(
  page.includes("const [editingInventoryExpenseDraft, setEditingInventoryExpenseDraft] = useState<InventoryExpenseDraft>(emptyInventoryExpenseDraft());"),
  "Edit card modal should keep its own inventory expense draft."
);

assert(
  page.includes("const inventoryExpenseRowsForCard = (card: CardRecord, draft: InventoryExpenseDraft = inventoryExpenseDraft): ExpenseRecord[] =>") &&
  page.includes('amount: inventoryExpenseAmount(draft.shipping)') &&
  page.includes('amount: inventoryExpenseAmount(draft.hst)') &&
  page.includes('amount: inventoryExpenseAmount(draft.duties)'),
  "Inventory expense row creation should accept a draft so edit-card expenses do not reuse Add Inventory inputs."
);

assert(
  page.includes('nextCard.status === "Not Listed" ? inventoryExpenseRowsForCard(nextCard, editingInventoryExpenseDraft) : []'),
  "Saving an edited Not Listed card should create expense rows from the edit modal draft."
);

assert(
  page.includes('Updated ${nextCard.name}${savedExpenseRows.length ? ` and added ${money(savedExpenseRows.reduce((sum, expense) => sum + expense.amount, 0))} in expenses` : ""}.'),
  "Edit save notice should confirm when expenses were added."
);

assert(
  page.includes('{editingCard.status === "Not Listed" && (') &&
  page.includes("Add expenses for this card (optional)") &&
  page.includes("Use this for extra costs you paid after the card was already added") &&
  page.includes("New expense total:"),
  "Edit modal should show an expense section only for Not Listed cards."
);

assert(
  page.includes("const openEditCardModal = (card: CardRecord) => {") &&
  page.includes("setEditingInventoryExpenseDraft(emptyInventoryExpenseDraft());") &&
  page.includes("const closeEditCardModal = () => {"),
  "Opening and closing the edit modal should reset the edit expense draft."
);

console.log("Not-listed edit expense checks passed.");
