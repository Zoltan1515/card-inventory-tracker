import type { CardRecord, ExpenseRecord } from "./card";

const cardHeaders: Array<[keyof CardRecord, string]> = [
  ["name", "Name"],
  ["category", "Category"],
  ["year", "Year"],
  ["setName", "Set"],
  ["cardNumber", "Card Number"],
  ["status", "Status"],
  ["listedPlatform", "Listed Platform"],
  ["listingUrl", "Listing URL"],
  ["frontPhotoUrl", "Front Photo URL"],
  ["purchaseDate", "Purchase Date"],
  ["purchasePrice", "Purchase Price"],
  ["saleDate", "Sale Date"],
  ["salePlatform", "Sale Platform"],
  ["soldPrice", "Sold Price"],
  ["notes", "Notes"],
];

const expenseHeaders: Array<[keyof ExpenseRecord, string]> = [
  ["expenseDate", "Date"],
  ["category", "Category"],
  ["amount", "Amount"],
  ["vendor", "Vendor"],
  ["description", "Description"],
];

const escapeCsv = (value: unknown) => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
};

export const cardsToCsv = (cards: CardRecord[]) => {
  const head = cardHeaders.map(([, label]) => escapeCsv(label)).join(",");
  const rows = cards.map((card) => cardHeaders.map(([key]) => escapeCsv(card[key])).join(","));
  return [head, ...rows].join("\n");
};

export const expensesToCsv = (expenses: ExpenseRecord[]) => {
  const head = expenseHeaders.map(([, label]) => escapeCsv(label)).join(",");
  const rows = expenses.map((expense) => expenseHeaders.map(([key]) => escapeCsv(expense[key])).join(","));
  return [head, ...rows].join("\n");
};
