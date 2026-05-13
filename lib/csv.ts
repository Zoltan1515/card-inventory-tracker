import type { CardRecord, ExpenseRecord } from "./card";
import { cardProfit, listedPotentialProfit } from "./card";

export type ProfitSummaryCsvInput = {
  periodLabel: string;
  revenue: number;
  totalInventoryCost: number;
  totalInventoryValue: number;
  expensesTotal: number;
  profit: number;
  unlistedInventoryCost: number;
  listedInventoryCost: number;
  soldInventoryCost: number;
  soldCardsRevenue: number;
  soldCardsCount: number;
  listedCardsCount: number;
  unlistedCardsCount: number;
};

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
  ["lowestAcceptablePrice", "Minimum Sale Price"],
  ["listedDate", "Listed Date"],
  ["frontPhotoUrl", "Front Photo URL"],
  ["purchaseDate", "Purchase Date"],
  ["purchasePrice", "Purchase Price"],
  ["saleDate", "Sale Date"],
  ["salePlatform", "Sale Platform"],
  ["soldPrice", "Sold Price"],
  ["notes", "Notes"],
];

const salesHeaders: Array<[keyof CardRecord | "profitBeforeExpenses", string]> = [
  ["name", "Name"],
  ["category", "Category"],
  ["year", "Year"],
  ["setName", "Set"],
  ["cardNumber", "Card Number"],
  ["purchaseDate", "Purchase Date"],
  ["purchasePrice", "Purchase Price"],
  ["saleDate", "Sale Date"],
  ["salePlatform", "Sale Platform"],
  ["soldPrice", "Sold Price"],
  ["profitBeforeExpenses", "Profit Before Expenses"],
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

const csvRows = (rows: unknown[][]) => rows.map((row) => row.map(escapeCsv).join(",")).join("\n");

const cardExtraHeaders = ["Days Listed", "Potential Profit Before Expenses"];

export const cardsToCsv = (cards: CardRecord[]) => {
  const head = [...cardHeaders.map(([, label]) => label), ...cardExtraHeaders];
  const rows = cards.map((card) => {
    const base = cardHeaders.map(([key]) => card[key]);
    const extras = [daysSince(card.listedDate), listedPotentialProfit(card)];
    return [...base, ...extras];
  });
  return csvRows([head, ...rows]);
};

export const salesToCsv = (cards: CardRecord[]) => {
  const head = salesHeaders.map(([, label]) => label);
  const rows = cards.map((card) => salesHeaders.map(([key]) => (key === "profitBeforeExpenses" ? cardProfit(card) : card[key])));
  return csvRows([head, ...rows]);
};

export const expensesToCsv = (expenses: ExpenseRecord[]) => {
  const head = expenseHeaders.map(([, label]) => label);
  const rows = expenses.map((expense) => expenseHeaders.map(([key]) => expense[key]));
  return csvRows([head, ...rows]);
};

export const profitSummaryToCsv = (summary: ProfitSummaryCsvInput) => csvRows([
  ["Metric", "Value"],
  ["Reporting Period", summary.periodLabel],
  ["Sold Revenue", summary.revenue],
  ["Inventory Cost Used In Profit", summary.totalInventoryCost],
  ["Total Expenses", summary.expensesTotal],
  ["Total Profit", summary.profit],
  ["Total Inventory Value", summary.totalInventoryValue],
  ["Unlisted Inventory Cost", summary.unlistedInventoryCost],
  ["Listed Inventory Cost", summary.listedInventoryCost],
  ["Sold Inventory Cost", summary.soldInventoryCost],
  ["Sold Cards Revenue", summary.soldCardsRevenue],
  ["Sold Cards Count", summary.soldCardsCount],
  ["Listed Cards Count", summary.listedCardsCount],
  ["Unlisted Cards Count", summary.unlistedCardsCount],
]);
