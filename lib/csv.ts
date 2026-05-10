import type { CardRecord, ExpenseRecord } from "./card";
import { listedPotentialProfit } from "./card";

const cardHeaders: Array<[keyof CardRecord, string]> = [
  ["name", "Name"],
  ["category", "Category"],
  ["year", "Year"],
  ["setName", "Set"],
  ["cardNumber", "Card Number"],
  ["status", "Status"],
  ["listedPlatform", "Listed Platform"],
  ["listingUrl", "Listing URL"],
  ["askingPrice", "Asking Price"],
  ["lowestAcceptablePrice", "Lowest Acceptable Price"],
  ["listedDate", "Listed Date"],
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

const daysSince = (isoDate: string) => {
  if (!isoDate) return "";
  const time = new Date(`${isoDate}T00:00:00`).getTime();
  if (Number.isNaN(time)) return "";
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00").getTime();
  return String(Math.max(0, Math.floor((today - time) / 86_400_000)));
};

const cardExtraHeaders = ["Days Listed", "Potential Profit Before Expenses"];

export const cardsToCsv = (cards: CardRecord[]) => {
  const head = [...cardHeaders.map(([, label]) => label), ...cardExtraHeaders].map(escapeCsv).join(",");
  const rows = cards.map((card) => {
    const base = cardHeaders.map(([key]) => escapeCsv(card[key]));
    const extras = [daysSince(card.listedDate), listedPotentialProfit(card)].map(escapeCsv);
    return [...base, ...extras].join(",");
  });
  return [head, ...rows].join("\n");
};

export const expensesToCsv = (expenses: ExpenseRecord[]) => {
  const head = expenseHeaders.map(([, label]) => escapeCsv(label)).join(",");
  const rows = expenses.map((expense) => expenseHeaders.map(([key]) => escapeCsv(expense[key])).join(","));
  return [head, ...rows].join("\n");
};
