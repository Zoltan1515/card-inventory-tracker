import type { CardRecord } from "./card";

const headers: Array<[keyof CardRecord, string]> = [
  ["name", "Name"],
  ["category", "Category"],
  ["year", "Year"],
  ["setName", "Set"],
  ["cardNumber", "Card Number"],
  ["variant", "Variant"],
  ["condition", "Condition"],
  ["rawOrGraded", "Raw/Graded"],
  ["gradingCompany", "Grading Company"],
  ["grade", "Grade"],
  ["certNumber", "Cert Number"],
  ["status", "Status"],
  ["storageLocation", "Storage Location"],
  ["purchaseDate", "Purchase Date"],
  ["purchaseSource", "Purchase Source"],
  ["purchasePrice", "Purchase Price"],
  ["purchaseTax", "Purchase Tax"],
  ["inboundShipping", "Inbound Shipping"],
  ["listedPlatform", "Listed Platform"],
  ["listingUrl", "Listing URL"],
  ["askingPrice", "Asking Price"],
  ["saleDate", "Sale Date"],
  ["salePlatform", "Sale Platform"],
  ["soldPrice", "Sold Price"],
  ["platformFees", "Platform Fees"],
  ["paymentFees", "Payment Fees"],
  ["promotedFees", "Promoted Fees"],
  ["outboundShipping", "Outbound Shipping"],
  ["packagingCost", "Packaging Cost"],
  ["notes", "Notes"],
];

const escapeCsv = (value: unknown) => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
};

export const cardsToCsv = (cards: CardRecord[]) => {
  const head = headers.map(([, label]) => escapeCsv(label)).join(",");
  const rows = cards.map((card) => headers.map(([key]) => escapeCsv(card[key])).join(","));
  return [head, ...rows].join("\n");
};
