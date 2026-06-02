import type { CardRecord, ExpenseRecord } from "./card";
import { cardNetSoldPrice, cardProfit, cardPurchaseCost, cardQuantity, cardRefundTotal, listedPotentialProfit } from "./card";

export type ProfitSummaryCsvInput = {
  periodLabel: string;
  revenue: number;
  totalInventoryCost: number;
  totalInventoryValue: number;
  expensesTotal: number;
  soldCardProfit: number;
  cash: number;
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
  ["quantity", "Quantity"],
  ["status", "Status"],
  ["listedPlatform", "Listed Platform"],
  ["listingUrl", "Listing URL"],
  ["askingPrice", "Asking Price"],
  ["lowestAcceptablePrice", "Minimum Sale Price"],
  ["listedDate", "Listed Date"],
  ["frontPhotoUrl", "Front Photo URL"],
  ["backPhotoUrl", "Back Photo URL"],
  ["purchaseDate", "Purchase Date"],
  ["purchasePrice", "Purchase Price"],
  ["saleDate", "Sale Date"],
  ["salePlatform", "Sale Platform"],
  ["soldPrice", "Sold Price"],
  ["notes", "Notes"],
];

const salesHeaders: Array<[keyof CardRecord | "refundTotal" | "netSoldPrice" | "profitBeforeExpenses", string]> = [
  ["name", "Name"],
  ["category", "Category"],
  ["year", "Year"],
  ["setName", "Set"],
  ["cardNumber", "Card Number"],
  ["quantity", "Quantity Sold"],
  ["purchaseDate", "Purchase Date"],
  ["purchasePrice", "Purchase Price"],
  ["saleDate", "Sale Date"],
  ["salePlatform", "Sale Platform"],
  ["soldPrice", "Original Sold Price"],
  ["refundTotal", "Refund Total"],
  ["netSoldPrice", "Net Sold Price"],
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

const cardExtraHeaders = ["Purchase Cost", "Days Listed", "Potential Profit Before Expenses"];

export const cardsToCsv = (cards: CardRecord[]) => {
  const head = [...cardHeaders.map(([, label]) => label), ...cardExtraHeaders];
  const rows = cards.map((card) => {
    const base = cardHeaders.map(([key]) => card[key]);
    const extras = [cardPurchaseCost(card), daysSince(card.listedDate), listedPotentialProfit(card)];
    return [...base, ...extras];
  });
  return csvRows([head, ...rows]);
};

export const salesToCsv = (cards: CardRecord[]) => {
  const head = salesHeaders.map(([, label]) => label);
  const rows = cards.map((card) => salesHeaders.map(([key]) => {
    if (key === "profitBeforeExpenses") return cardProfit(card);
    if (key === "refundTotal") return cardRefundTotal(card);
    if (key === "netSoldPrice") return cardNetSoldPrice(card);
    return card[key as keyof CardRecord];
  }));
  return csvRows([head, ...rows]);
};

export const expensesToCsv = (expenses: ExpenseRecord[]) => {
  const head = expenseHeaders.map(([, label]) => label);
  const rows = expenses.map((expense) => expenseHeaders.map(([key]) => expense[key]));
  return csvRows([head, ...rows]);
};

const normalizeForEbayTitle = (value: string) => value.replace(/\s+/g, " ").trim();

const ebayTitle = (card: CardRecord) => {
  const title = normalizeForEbayTitle([card.year, card.name, card.setName, card.cardNumber ? `#${card.cardNumber}` : "", card.category].filter(Boolean).join(" "));
  return title.slice(0, 80);
};

const ebaySpecificValue = (notes: string, labels: string[]) => {
  const lines = notes.split("\n");
  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    if (!rest.length) continue;
    const key = rawKey.trim().toLowerCase();
    if (labels.some((label) => key === label.toLowerCase())) return rest.join(":").trim();
  }
  return "";
};

const cardGrade = (card: Pick<CardRecord, "notes">) => ebaySpecificValue(card.notes, ["Grade"]).replace(/^(PSA|BGS|SGC|CGC|TAG)\s+/i, "");
const professionalGrader = (card: Pick<CardRecord, "notes">) => {
  const noteGrader = ebaySpecificValue(card.notes, ["Professional Grader", "Grader"]);
  if (noteGrader) return noteGrader;
  const gradeLine = ebaySpecificValue(card.notes, ["Grade"]);
  const match = gradeLine.match(/^(PSA|BGS|SGC|CGC|TAG)\b/i);
  return match ? match[1].toUpperCase() : "";
};

const ebayCategoryId = (category: string) => {
  const normalized = category.toLowerCase();
  if (/pokemon|pokémon|mtg|magic|yugioh|tcg|ccg/.test(normalized)) return "183454";
  return "261328";
};

const ebayConditionId = (card: CardRecord) => cardGrade(card) || professionalGrader(card) ? "2750" : "4000";
const ebaySport = (category: string) => (/pokemon|pokémon|mtg|magic|yugioh|tcg|ccg/i.test(category) ? "" : category);
const ebayPrice = (card: CardRecord) => (card.askingPrice || card.lowestAcceptablePrice || card.purchasePrice || 0).toFixed(2);
const ebayDescription = (card: CardRecord) => [
  ebayTitle(card),
  cardGrade(card) ? `Grade: ${professionalGrader(card)} ${cardGrade(card)}`.trim() : "",
  card.notes.split("\n").filter((line) => !/^grade:/i.test(line.trim())).join("\n"),
].filter(Boolean).join("\n\n");

const ebayHeaders = [
  "Action(SiteID=US|Country=US|Currency=USD|Version=1193)",
  "CustomLabel",
  "Category",
  "Title",
  "ConditionID",
  "PicURL",
  "Description",
  "Format",
  "Duration",
  "StartPrice",
  "Quantity",
  "Location",
  "PaymentProfileName",
  "ReturnProfileName",
  "ShippingProfileName",
  "C:Sport",
  "C:Card Name",
  "C:Player/Athlete",
  "C:Set",
  "C:Season",
  "C:Card Number",
  "C:Professional Grader",
  "C:Grade",
  "C:Certification Number",
  "C:League",
  "WCTReviewNotes",
];

export const ebayListingsToCsv = (cards: CardRecord[]) => {
  const rows = cards.filter((card) => card.status !== "Sold").map((card) => {
    const grade = cardGrade(card);
    const grader = professionalGrader(card);
    const reviewNotes = [
      !card.frontPhotoUrl ? "Missing front PicURL" : "",
      !card.backPhotoUrl ? "Missing back photo for eBay" : "",
      !ebayPrice(card) || ebayPrice(card) === "0.00" ? "Missing price" : "",
      !card.name ? "Missing card/player name" : "",
      !card.year ? "Missing season/year" : "",
      !card.setName ? "Missing set" : "",
      grade && !grader ? "Missing professional grader" : "",
      "Confirm category, item specifics, business policies, and shipping before upload",
    ].filter(Boolean).join("; ");
    return [
      "Add",
      `WCT-${card.id.slice(0, 8)}`,
      ebayCategoryId(card.category),
      ebayTitle(card),
      ebayConditionId(card),
      [card.frontPhotoUrl, card.backPhotoUrl].filter(Boolean).join("|"),
      ebayDescription(card),
      "FixedPrice",
      "GTC",
      ebayPrice(card),
      cardQuantity(card),
      "",
      "",
      "",
      "",
      ebaySport(card.category),
      card.name,
      card.name,
      card.setName,
      card.year,
      card.cardNumber,
      grader,
      grade,
      ebaySpecificValue(card.notes, ["Certification Number", "Cert Number", "Cert"]),
      ebaySpecificValue(card.notes, ["League"]),
      reviewNotes,
    ];
  });
  return csvRows([ebayHeaders, ...rows]);
};

export const profitSummaryToCsv = (summary: ProfitSummaryCsvInput) => csvRows([
  ["Metric", "Value"],
  ["Reporting Period", summary.periodLabel],
  ["Sold Revenue", summary.revenue],
  ["Total Inventory Purchase Cost", summary.totalInventoryCost],
  ["Total Expenses", summary.expensesTotal],
  ["Profit From Sold Cards", summary.soldCardProfit],
  ["Cash On Hand", summary.cash],
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
