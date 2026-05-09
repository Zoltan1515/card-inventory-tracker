import type { CardRecord } from "./card";

type CardRow = {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  year: string | null;
  set_name: string | null;
  card_number: string | null;
  variant: string | null;
  condition: string | null;
  raw_or_graded: "Raw" | "Graded" | null;
  grading_company: string | null;
  grade: string | null;
  cert_number: string | null;
  status: CardRecord["status"] | null;
  storage_location: string | null;
  purchase_date: string | null;
  purchase_source: string | null;
  purchase_price: number | string | null;
  purchase_tax: number | string | null;
  inbound_shipping: number | string | null;
  listed_platform: string | null;
  listing_url: string | null;
  asking_price: number | string | null;
  sale_date: string | null;
  sale_platform: string | null;
  sold_price: number | string | null;
  platform_fees: number | string | null;
  payment_fees: number | string | null;
  promoted_fees: number | string | null;
  outbound_shipping: number | string | null;
  packaging_cost: number | string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const num = (value: number | string | null | undefined) => Number(value ?? 0) || 0;
const text = (value: string | null | undefined) => value ?? "";
const dateOrNull = (value: string) => value || null;

export const rowToCard = (row: CardRow): CardRecord => ({
  id: row.id,
  name: row.name,
  category: text(row.category),
  year: text(row.year),
  setName: text(row.set_name),
  cardNumber: text(row.card_number),
  variant: text(row.variant),
  condition: text(row.condition),
  rawOrGraded: row.raw_or_graded ?? "Raw",
  gradingCompany: text(row.grading_company),
  grade: text(row.grade),
  certNumber: text(row.cert_number),
  status: row.status ?? "Purchased",
  storageLocation: text(row.storage_location),
  purchaseDate: text(row.purchase_date),
  purchaseSource: text(row.purchase_source),
  purchasePrice: num(row.purchase_price),
  purchaseTax: num(row.purchase_tax),
  inboundShipping: num(row.inbound_shipping),
  listedPlatform: text(row.listed_platform),
  listingUrl: text(row.listing_url),
  askingPrice: num(row.asking_price),
  saleDate: text(row.sale_date),
  salePlatform: text(row.sale_platform),
  soldPrice: num(row.sold_price),
  platformFees: num(row.platform_fees),
  paymentFees: num(row.payment_fees),
  promotedFees: num(row.promoted_fees),
  outboundShipping: num(row.outbound_shipping),
  packagingCost: num(row.packaging_cost),
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
  variant: card.variant,
  condition: card.condition,
  raw_or_graded: card.rawOrGraded,
  grading_company: card.gradingCompany,
  grade: card.grade,
  cert_number: card.certNumber,
  status: card.status,
  storage_location: card.storageLocation,
  purchase_date: dateOrNull(card.purchaseDate),
  purchase_source: card.purchaseSource,
  purchase_price: card.purchasePrice,
  purchase_tax: card.purchaseTax,
  inbound_shipping: card.inboundShipping,
  listed_platform: card.listedPlatform,
  listing_url: card.listingUrl,
  asking_price: card.askingPrice,
  sale_date: dateOrNull(card.saleDate),
  sale_platform: card.salePlatform,
  sold_price: card.soldPrice,
  platform_fees: card.platformFees,
  payment_fees: card.paymentFees,
  promoted_fees: card.promotedFees,
  outbound_shipping: card.outboundShipping,
  packaging_cost: card.packagingCost,
  notes: card.notes,
});

export const cardToUpdate = (card: CardRecord) => ({
  name: card.name,
  category: card.category,
  year: card.year,
  set_name: card.setName,
  card_number: card.cardNumber,
  variant: card.variant,
  condition: card.condition,
  raw_or_graded: card.rawOrGraded,
  grading_company: card.gradingCompany,
  grade: card.grade,
  cert_number: card.certNumber,
  status: card.status,
  storage_location: card.storageLocation,
  purchase_date: dateOrNull(card.purchaseDate),
  purchase_source: card.purchaseSource,
  purchase_price: card.purchasePrice,
  purchase_tax: card.purchaseTax,
  inbound_shipping: card.inboundShipping,
  listed_platform: card.listedPlatform,
  listing_url: card.listingUrl,
  asking_price: card.askingPrice,
  sale_date: dateOrNull(card.saleDate),
  sale_platform: card.salePlatform,
  sold_price: card.soldPrice,
  platform_fees: card.platformFees,
  payment_fees: card.paymentFees,
  promoted_fees: card.promotedFees,
  outbound_shipping: card.outboundShipping,
  packaging_cost: card.packagingCost,
  notes: card.notes,
});
