import type { CardRecord, CashAdjustmentRecord, ExpenseRecord, GradingSubmission } from "./card";

type CardRow = {
  id: string;
  user_id: string;
  workspace_id?: string | null;
  name: string;
  category: string | null;
  year: string | null;
  set_name: string | null;
  card_number: string | null;
  quantity?: number | string | null;
  status: CardRecord["status"] | string | null;
  listed_platform: string | null;
  listing_url: string | null;
  asking_price?: number | string | null;
  lowest_acceptable_price?: number | string | null;
  outbound_shipping?: number | string | null;
  grading_company?: string | null;
  grade?: string | null;
  listed_date?: string | null;
  listed_at?: string | null;
  listed_by?: string | null;
  front_photo_url: string | null;
  back_photo_url?: string | null;
  purchase_date: string | null;
  purchase_price: number | string | null;
  sale_date: string | null;
  sale_platform: string | null;
  sold_price: number | string | null;
  sold_at?: string | null;
  sold_by?: string | null;
  notes: string | null;
  created_at: string | null;
  created_by?: string | null;
  updated_at: string | null;
  updated_by?: string | null;
  source_platform?: string | null;
  source_id?: string | null;
  source_url?: string | null;
  source_listing_type?: string | null;
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
  created_by?: string | null;
  updated_at: string | null;
  updated_by?: string | null;
};

type CashAdjustmentRow = {
  id: string;
  user_id: string;
  workspace_id?: string | null;
  adjustment_type: CashAdjustmentRecord["adjustmentType"] | string | null;
  amount: number | string | null;
  adjustment_date: string | null;
  description: string | null;
  created_at: string | null;
  created_by?: string | null;
  updated_at: string | null;
  updated_by?: string | null;
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
  created_by?: string | null;
  updated_at: string | null;
  updated_by?: string | null;
  returned_by?: string | null;
};

type GradingSubmissionCardRow = {
  submission_id: string;
  card_id: string;
  quantity_sent?: number | string | null;
};

const num = (value: number | string | null | undefined) => Number(value ?? 0) || 0;
const text = (value: string | null | undefined) => value ?? "";
const dateOrNull = (value: string) => value || null;
const titleCaseCategory = (value: string) => value
  .replace(/[_-]+/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .split(" ")
  .map((word) => word ? `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}` : "")
  .join(" ");

const friendlyCardCategory = (value: string | null | undefined) => {
  const category = text(value).trim();
  const normalized = category.toLowerCase().replace(/[\s-]+/g, "_");
  if (!category) return "";
  if (normalized === "one_piece" || normalized === "onepiece") return "One Piece";
  if (normalized === "pokemon" || normalized === "pokémon") return "Pokemon";
  if (normalized === "mtg" || normalized === "magic_the_gathering") return "MTG";
  if (normalized === "tcg") return "TCG";
  if (normalized === "sealed_product") return "Sealed Product";
  return titleCaseCategory(category);
};
const listingPricingFields = (card: CardRecord, includeMarketplaceDetails = true) => ({
  asking_price: card.askingPrice,
  lowest_acceptable_price: card.lowestAcceptablePrice,
  ...(includeMarketplaceDetails ? {
    outbound_shipping: card.shippingCharge,
    grading_company: card.gradingCompany,
    grade: card.grade,
  } : {}),
  listed_date: dateOrNull(card.listedDate),
});

const normalizeStatus = (status: string | null | undefined): CardRecord["status"] => {
  const normalized = status?.trim().toLowerCase();
  if (status === "Sold" || status === "Listed" || status === "Not Listed") return status;
  if (normalized === "sold" || normalized === "shipped") return "Sold";
  if (normalized === "listed") return "Listed";
  if (normalized === "not listed" || normalized === "purchased" || normalized === "ready to list") return "Not Listed";
  if (status === "Purchased" || status === "Ready to List") return "Not Listed";
  if (status === "Shipped") return "Sold";
  return "Not Listed";
};

const normalizeExpenseCategory = (category: string | null | undefined): ExpenseRecord["category"] => {
  if (category === "HST" || category === "Marketplace Fees" || category === "Duties" || category === "Grading Fees" || category === "Shipping" || category === "Card Show Table" || category === "Supplies" || category === "Gas" || category === "Airfare" || category === "Other") return category;
  return "Other";
};

const normalizeCashAdjustmentType = (value: string | null | undefined): CashAdjustmentRecord["adjustmentType"] => {
  if (value === "Cash Added" || value === "Cash Removed" || value === "Starting Cash") return value;
  return "Cash Added";
};

const normalizeGradingStatus = (status: string | null | undefined): GradingSubmission["status"] => {
  if (status === "Returned") return "Returned";
  return "At Grading";
};

const sportFromCardNotes = (notes = "") => notes
  .split("\n")
  .find((line) => line.toLowerCase().startsWith("sport:"))
  ?.replace(/^sport:\s*/i, "")
  .trim() || "";

export const rowToCard = (row: CardRow): CardRecord => ({
  id: row.id,
  workspaceId: row.workspace_id ?? undefined,
  name: row.name,
  category: friendlyCardCategory(row.category),
  sport: sportFromCardNotes(text(row.notes)),
  year: text(row.year),
  setName: text(row.set_name),
  cardNumber: text(row.card_number),
  quantity: Math.max(1, Math.floor(num(row.quantity) || 1)),
  status: normalizeStatus(row.status),
  listedPlatform: text(row.listed_platform),
  listingUrl: text(row.listing_url),
  askingPrice: num(row.asking_price),
  lowestAcceptablePrice: num(row.lowest_acceptable_price),
  shippingCharge: num(row.outbound_shipping),
  gradingCompany: text(row.grading_company),
  grade: text(row.grade),
  listedDate: text(row.listed_date),
  listedAt: text(row.listed_at),
  listedBy: text(row.listed_by),
  frontPhotoUrl: text(row.front_photo_url),
  backPhotoUrl: text(row.back_photo_url),
  purchaseDate: text(row.purchase_date),
  purchasePrice: num(row.purchase_price),
  saleDate: text(row.sale_date),
  salePlatform: text(row.sale_platform),
  soldPrice: num(row.sold_price),
  soldAt: text(row.sold_at),
  soldBy: text(row.sold_by),
  notes: text(row.notes),
  createdAt: row.created_at ?? new Date().toISOString(),
  createdBy: text(row.created_by),
  updatedAt: row.updated_at ?? new Date().toISOString(),
  updatedBy: text(row.updated_by),
  sourcePlatform: text(row.source_platform),
  sourceId: text(row.source_id),
  sourceUrl: text(row.source_url),
  sourceListingType: text(row.source_listing_type),
});

export const cardToInsert = (card: CardRecord, userId: string, workspaceId?: string | null, includeListingPricing = true, includeAudit = true, includeQuantity = true, includeMarketplaceDetails = true, includeBackPhoto = true) => ({
  user_id: userId,
  ...(workspaceId ? { workspace_id: workspaceId } : {}),
  name: card.name,
  category: card.category,
  year: card.year,
  set_name: card.setName,
  card_number: card.cardNumber,
  ...(includeQuantity ? { quantity: card.quantity } : {}),
  status: card.status,
  listed_platform: card.listedPlatform,
  listing_url: card.listingUrl,
  ...(includeListingPricing ? listingPricingFields(card, includeMarketplaceDetails) : {}),
  front_photo_url: card.frontPhotoUrl,
  ...(includeBackPhoto ? { back_photo_url: card.backPhotoUrl } : {}),
  purchase_date: dateOrNull(card.purchaseDate),
  purchase_price: card.purchasePrice,
  sale_date: dateOrNull(card.saleDate),
  sale_platform: card.salePlatform,
  sold_price: card.soldPrice,
  ...(includeAudit ? { listed_at: dateOrNull(card.listedAt), listed_by: card.listedBy, sold_at: dateOrNull(card.soldAt), sold_by: card.soldBy, created_by: card.createdBy, updated_by: card.updatedBy } : {}),
  notes: card.notes,
});

export const cardToUpdate = (card: CardRecord, includeListingPricing = true, includeAudit = true, includeQuantity = true, includeMarketplaceDetails = true, includeBackPhoto = true) => ({
  name: card.name,
  category: card.category,
  year: card.year,
  set_name: card.setName,
  card_number: card.cardNumber,
  ...(includeQuantity ? { quantity: card.quantity } : {}),
  status: card.status,
  listed_platform: card.listedPlatform,
  listing_url: card.listingUrl,
  ...(includeListingPricing ? listingPricingFields(card, includeMarketplaceDetails) : {}),
  front_photo_url: card.frontPhotoUrl,
  ...(includeBackPhoto ? { back_photo_url: card.backPhotoUrl } : {}),
  purchase_date: dateOrNull(card.purchaseDate),
  purchase_price: card.purchasePrice,
  sale_date: dateOrNull(card.saleDate),
  sale_platform: card.salePlatform,
  sold_price: card.soldPrice,
  ...(includeAudit ? { listed_at: dateOrNull(card.listedAt), listed_by: card.listedBy, sold_at: dateOrNull(card.soldAt), sold_by: card.soldBy, updated_by: card.updatedBy } : {}),
  notes: card.notes,
});

export const rowToCashAdjustment = (row: CashAdjustmentRow): CashAdjustmentRecord => ({
  id: row.id,
  workspaceId: row.workspace_id ?? undefined,
  adjustmentType: normalizeCashAdjustmentType(row.adjustment_type),
  amount: num(row.amount),
  adjustmentDate: text(row.adjustment_date),
  description: text(row.description),
  createdAt: row.created_at ?? new Date().toISOString(),
  createdBy: text(row.created_by),
  updatedAt: row.updated_at ?? new Date().toISOString(),
  updatedBy: text(row.updated_by),
});

export const cashAdjustmentToInsert = (entry: CashAdjustmentRecord, userId: string, workspaceId?: string | null, includeAudit = true) => ({
  user_id: userId,
  ...(workspaceId ? { workspace_id: workspaceId } : {}),
  adjustment_type: entry.adjustmentType,
  amount: entry.amount,
  adjustment_date: dateOrNull(entry.adjustmentDate),
  description: entry.description,
  ...(includeAudit ? { created_by: entry.createdBy, updated_by: entry.updatedBy } : {}),
});

export const cashAdjustmentToUpdate = (entry: CashAdjustmentRecord, includeAudit = true) => ({
  adjustment_type: entry.adjustmentType,
  amount: entry.amount,
  adjustment_date: dateOrNull(entry.adjustmentDate),
  description: entry.description,
  ...(includeAudit ? { updated_by: entry.updatedBy } : {}),
});

export const rowToExpense = (row: ExpenseRow): ExpenseRecord => ({
  id: row.id,
  workspaceId: row.workspace_id ?? undefined,
  category: normalizeExpenseCategory(row.category),
  amount: num(row.amount),
  expenseDate: text(row.expense_date),
  description: text(row.description),
  vendor: text(row.vendor),
  createdAt: row.created_at ?? new Date().toISOString(),
  createdBy: text(row.created_by),
  updatedAt: row.updated_at ?? new Date().toISOString(),
  updatedBy: text(row.updated_by),
});

export const expenseToInsert = (expense: ExpenseRecord, userId: string, workspaceId?: string | null, includeAudit = true) => ({
  user_id: userId,
  ...(workspaceId ? { workspace_id: workspaceId } : {}),
  category: expense.category,
  amount: expense.amount,
  expense_date: dateOrNull(expense.expenseDate),
  description: expense.description,
  vendor: expense.vendor,
  ...(includeAudit ? { created_by: expense.createdBy, updated_by: expense.updatedBy } : {}),
});

export const expenseToUpdate = (expense: ExpenseRecord, includeAudit = true) => ({
  category: expense.category,
  amount: expense.amount,
  expense_date: dateOrNull(expense.expenseDate),
  description: expense.description,
  vendor: expense.vendor,
  ...(includeAudit ? { updated_by: expense.updatedBy } : {}),
});
export const rowToGradingSubmission = (row: GradingSubmissionRow, cardRows: GradingSubmissionCardRow[] = []): GradingSubmission => ({
  id: row.id,
  workspaceId: row.workspace_id ?? undefined,
  company: text(row.company),
  sentDate: text(row.sent_date),
  returnedDate: text(row.returned_date),
  status: normalizeGradingStatus(row.status),
  reference: text(row.reference),
  notes: text(row.notes),
  cardIds: cardRows.filter((item) => item.submission_id === row.id).map((item) => item.card_id),
  cardQuantities: cardRows
    .filter((item) => item.submission_id === row.id)
    .reduce<Record<string, number>>((quantities, item) => {
      quantities[item.card_id] = Math.max(1, Math.floor(num(item.quantity_sent) || 1));
      return quantities;
    }, {}),
  createdAt: row.created_at ?? new Date().toISOString(),
  createdBy: text(row.created_by),
  updatedAt: row.updated_at ?? new Date().toISOString(),
  updatedBy: text(row.updated_by),
  returnedBy: text(row.returned_by),
});

export const gradingSubmissionToInsert = (submission: GradingSubmission, userId: string, workspaceId?: string | null, includeAudit = true) => ({
  id: submission.id,
  user_id: userId,
  ...(workspaceId ? { workspace_id: workspaceId } : {}),
  company: submission.company,
  sent_date: dateOrNull(submission.sentDate),
  returned_date: dateOrNull(submission.returnedDate),
  status: submission.status,
  reference: submission.reference,
  notes: submission.notes,
  ...(includeAudit ? { created_by: submission.createdBy, updated_by: submission.updatedBy, returned_by: submission.returnedBy } : {}),
});

export const gradingSubmissionToUpdate = (submission: GradingSubmission, includeAudit = true) => ({
  company: submission.company,
  sent_date: dateOrNull(submission.sentDate),
  returned_date: dateOrNull(submission.returnedDate),
  status: submission.status,
  reference: submission.reference,
  notes: submission.notes,
  ...(includeAudit ? { updated_by: submission.updatedBy, returned_by: submission.returnedBy } : {}),
  updated_at: new Date().toISOString(),
});

export const gradingSubmissionCardRows = (submission: GradingSubmission, includeQuantity = true) => submission.cardIds.map((cardId) => ({
  submission_id: submission.id,
  card_id: cardId,
  ...(includeQuantity ? { quantity_sent: Math.max(1, Math.floor(Number(submission.cardQuantities[cardId]) || 1)) } : {}),
}));
