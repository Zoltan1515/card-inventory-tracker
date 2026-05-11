import type { CardRecord, ExpenseRecord, GradingSubmission } from "./card";

type CardRow = {
  id: string;
  user_id: string;
  workspace_id?: string | null;
  name: string;
  category: string | null;
  year: string | null;
  set_name: string | null;
  card_number: string | null;
  status: CardRecord["status"] | string | null;
  listed_platform: string | null;
  listing_url: string | null;
  asking_price?: number | string | null;
  lowest_acceptable_price?: number | string | null;
  listed_date?: string | null;
  front_photo_url: string | null;
  purchase_date: string | null;
  purchase_price: number | string | null;
  sale_date: string | null;
  sale_platform: string | null;
  sold_price: number | string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ExpenseRow = {
  id: string;
  user_id: string;
  workspace_id?: string | null;
  category: ExpenseRecord["category"] | string | null;
  amount: number | string | null;
  expense_date: string | null;
  description: string | null;
  vendor: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type GradingSubmissionRow = {
  id: string;
  user_id: string;
  workspace_id?: string | null;
  company: string | null;
  sent_date: string | null;
  returned_date: string | null;
  status: GradingSubmission["status"] | string | null;
  reference: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type GradingSubmissionCardRow = {
  submission_id: string;
  card_id: string;
};

const num = (value: number | string | null | undefined) => Number(value ?? 0) || 0;
const text = (value: string | null | undefined) => value ?? "";
const dateOrNull = (value: string) => value || null;
const listingPricingFields = (card: CardRecord) => ({
  asking_price: card.askingPrice,
  lowest_acceptable_price: card.lowestAcceptablePrice,
  listed_date: dateOrNull(card.listedDate),
});

const normalizeStatus = (status: string | null | undefined): CardRecord["status"] => {
  if (status === "Sold" || status === "Listed" || status === "Not Listed") return status;
  if (status === "Purchased" || status === "Ready to List") return "Not Listed";
  if (status === "Shipped") return "Sold";
  return "Not Listed";
};

const normalizeExpenseCategory = (category: string | null | undefined): ExpenseRecord["category"] => {
  if (category === "HST" || category === "Duties" || category === "Grading Fees" || category === "Shipping" || category === "Other") return category;
  return "Other";
};

const normalizeGradingStatus = (status: string | null | undefined): GradingSubmission["status"] => {
  if (status === "Returned") return "Returned";
  return "At Grading";
};

export const rowToCard = (row: CardRow): CardRecord => ({
  id: row.id,
  name: row.name,
  category: text(row.category),
  year: text(row.year),
  setName: text(row.set_name),
  cardNumber: text(row.card_number),
  status: normalizeStatus(row.status),
  listedPlatform: text(row.listed_platform),
  listingUrl: text(row.listing_url),
  askingPrice: num(row.asking_price),
  lowestAcceptablePrice: num(row.lowest_acceptable_price),
  listedDate: text(row.listed_date),
  frontPhotoUrl: text(row.front_photo_url),
  purchaseDate: text(row.purchase_date),
  purchasePrice: num(row.purchase_price),
  saleDate: text(row.sale_date),
  salePlatform: text(row.sale_platform),
  soldPrice: num(row.sold_price),
  notes: text(row.notes),
  createdAt: row.created_at ?? new Date().toISOString(),
  updatedAt: row.updated_at ?? new Date().toISOString(),
});

export const cardToInsert = (card: CardRecord, userId: string, workspaceId?: string | null, includeListingPricing = true) => ({
  user_id: userId,
  ...(workspaceId ? { workspace_id: workspaceId } : {}),
  name: card.name,
  category: card.category,
  year: card.year,
  set_name: card.setName,
  card_number: card.cardNumber,
  status: card.status,
  listed_platform: card.listedPlatform,
  listing_url: card.listingUrl,
  ...(includeListingPricing ? listingPricingFields(card) : {}),
  front_photo_url: card.frontPhotoUrl,
  purchase_date: dateOrNull(card.purchaseDate),
  purchase_price: card.purchasePrice,
  sale_date: dateOrNull(card.saleDate),
  sale_platform: card.salePlatform,
  sold_price: card.soldPrice,
  notes: card.notes,
});

export const cardToUpdate = (card: CardRecord, includeListingPricing = true) => ({
  name: card.name,
  category: card.category,
  year: card.year,
  set_name: card.setName,
  card_number: card.cardNumber,
  status: card.status,
  listed_platform: card.listedPlatform,
  listing_url: card.listingUrl,
  ...(includeListingPricing ? listingPricingFields(card) : {}),
  front_photo_url: card.frontPhotoUrl,
  purchase_date: dateOrNull(card.purchaseDate),
  purchase_price: card.purchasePrice,
  sale_date: dateOrNull(card.saleDate),
  sale_platform: card.salePlatform,
  sold_price: card.soldPrice,
  notes: card.notes,
});

export const rowToExpense = (row: ExpenseRow): ExpenseRecord => ({
  id: row.id,
  category: normalizeExpenseCategory(row.category),
  amount: num(row.amount),
  expenseDate: text(row.expense_date),
  description: text(row.description),
  vendor: text(row.vendor),
  createdAt: row.created_at ?? new Date().toISOString(),
  updatedAt: row.updated_at ?? new Date().toISOString(),
});

export const expenseToInsert = (expense: ExpenseRecord, userId: string, workspaceId?: string | null) => ({
  user_id: userId,
  ...(workspaceId ? { workspace_id: workspaceId } : {}),
  category: expense.category,
  amount: expense.amount,
  expense_date: dateOrNull(expense.expenseDate),
  description: expense.description,
  vendor: expense.vendor,
});

export const expenseToUpdate = (expense: ExpenseRecord) => ({
  category: expense.category,
  amount: expense.amount,
  expense_date: dateOrNull(expense.expenseDate),
  description: expense.description,
  vendor: expense.vendor,
});
export const rowToGradingSubmission = (row: GradingSubmissionRow, cardRows: GradingSubmissionCardRow[] = []): GradingSubmission => ({
  id: row.id,
  company: text(row.company),
  sentDate: text(row.sent_date),
  returnedDate: text(row.returned_date),
  status: normalizeGradingStatus(row.status),
  reference: text(row.reference),
  notes: text(row.notes),
  cardIds: cardRows.filter((item) => item.submission_id === row.id).map((item) => item.card_id),
  createdAt: row.created_at ?? new Date().toISOString(),
  updatedAt: row.updated_at ?? new Date().toISOString(),
});

export const gradingSubmissionToInsert = (submission: GradingSubmission, userId: string, workspaceId?: string | null) => ({
  id: submission.id,
  user_id: userId,
  ...(workspaceId ? { workspace_id: workspaceId } : {}),
  company: submission.company,
  sent_date: dateOrNull(submission.sentDate),
  returned_date: dateOrNull(submission.returnedDate),
  status: submission.status,
  reference: submission.reference,
  notes: submission.notes,
});

export const gradingSubmissionToUpdate = (submission: GradingSubmission) => ({
  company: submission.company,
  sent_date: dateOrNull(submission.sentDate),
  returned_date: dateOrNull(submission.returnedDate),
  status: submission.status,
  reference: submission.reference,
  notes: submission.notes,
  updated_at: new Date().toISOString(),
});

export const gradingSubmissionCardRows = (submission: GradingSubmission) => submission.cardIds.map((cardId) => ({
  submission_id: submission.id,
  card_id: cardId,
}));
