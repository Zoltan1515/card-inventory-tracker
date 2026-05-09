import type { CardRecord, ExpenseRecord } from "./card";

type CardRow = {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  year: string | null;
  set_name: string | null;
  card_number: string | null;
  status: CardRecord["status"] | string | null;
  listed_platform: string | null;
  listing_url: string | null;
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
  category: ExpenseRecord["category"] | string | null;
  amount: number | string | null;
  expense_date: string | null;
  description: string | null;
  vendor: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const num = (value: number | string | null | undefined) => Number(value ?? 0) || 0;
const text = (value: string | null | undefined) => value ?? "";
const dateOrNull = (value: string) => value || null;

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
  purchaseDate: text(row.purchase_date),
  purchasePrice: num(row.purchase_price),
  saleDate: text(row.sale_date),
  salePlatform: text(row.sale_platform),
  soldPrice: num(row.sold_price),
  notes: text(row.notes),
  createdAt: row.created_at ?? new Date().toISOString(),
  updatedAt: row.updated_at ?? new Date().toISOString(),
});

export const cardToInsert = (card: CardRecord, userId: string) => ({
  user_id: userId,
  name: card.name,
  category: card.category,
  year: card.year,
  set_name: card.setName,
  card_number: card.cardNumber,
  status: card.status,
  listed_platform: card.listedPlatform,
  listing_url: card.listingUrl,
  purchase_date: dateOrNull(card.purchaseDate),
  purchase_price: card.purchasePrice,
  sale_date: dateOrNull(card.saleDate),
  sale_platform: card.salePlatform,
  sold_price: card.soldPrice,
  notes: card.notes,
});

export const cardToUpdate = (card: CardRecord) => ({
  name: card.name,
  category: card.category,
  year: card.year,
  set_name: card.setName,
  card_number: card.cardNumber,
  status: card.status,
  listed_platform: card.listedPlatform,
  listing_url: card.listingUrl,
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

export const expenseToInsert = (expense: ExpenseRecord, userId: string) => ({
  user_id: userId,
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
