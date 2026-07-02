"use client";

import NextImage from "next/image";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CardRecord, CardStatus, CashAdjustmentRecord, ExpenseCategory, ExpenseRecord, GradingSubmission, appendCardRefundNote, cardNetSoldPrice, cardProfit, cardPurchaseCost, cardQuantity, cardRefundTotal, cardRoi, emptyCard, emptyCashAdjustment, emptyExpense, emptyGradingSubmission, listedPotentialProfit, money, parseCardRefunds, percent } from "@/lib/card";
import { cardsToCsv, expensesToCsv, profitSummaryToCsv, salesToCsv } from "@/lib/csv";
import { cardToInsert, cardToUpdate, cashAdjustmentToInsert, cashAdjustmentToUpdate, expenseToInsert, expenseToUpdate, gradingSubmissionCardRows, gradingSubmissionToInsert, gradingSubmissionToUpdate, rowToCard, rowToCashAdjustment, rowToExpense, rowToGradingSubmission } from "@/lib/dbCard";
import { parsePsaOrderCsv, psaCsvLooksLikeOrderExport } from "@/lib/psaImport";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Tab = "add" | "attention" | "listingReview" | "grading" | "inventory" | "expenses" | "profit" | "glance" | "roi" | "primeLotMarketplace";
type DashboardAction = { id: string; tab: Tab; label: string; subtitle?: string; badge?: number; apply?: () => void; className?: string };
type DateFilterMode = "all" | "month" | "year" | "custom";
type PhotoFilter = "All" | "Has photo" | "Missing photo";
type ListingUrlFilter = "All" | "Has listing URL" | "Missing listing URL";
type InventoryMainView = "Not Listed" | "Listed";
type InventoryDateField = "purchaseDate" | "listedDate" | "saleDate";
type InventorySort =
  | "newest-purchase"
  | "oldest-purchase"
  | "highest-purchase"
  | "lowest-purchase"
  | "highest-sold"
  | "highest-profit"
  | "name-az";
type AttentionItem = {
  id: string;
  recordId: string;
  kind: "card" | "expense";
  title: string;
  detail: string;
  action?: string;
  card?: CardRecord;
};
type AttentionGroup = {
  key: string;
  title: string;
  count: number;
  description: string;
  items: AttentionItem[];
};
type MultiPlatformListing = {
  id: string;
  platform: string;
  url: string;
  askingPrice: number;
  lowestAcceptablePrice: number;
  shippingCharge: number;
  listedDate: string;
};
type ListedReviewItem = {
  card: CardRecord;
  listings: MultiPlatformListing[];
  age: number;
  referenceDate: string;
  tone: "current" | "warning" | "urgent";
};
type ListingReviewLink = { id: string; label: string; url: string };
type ListingReviewBucket = "current" | "warning" | "urgent" | "all";
type ImportCardPreview = {
  id: string;
  sourceRow: number;
  card: CardRecord;
  selected: boolean;
  warnings: string[];
};
type CsvRow = Record<string, string>;
type ReturnGradeRow = { id: string; cardId: string; quantity: number; grade: string; slabNumber: string; gradingFee: string; frontPhotoUrl: string; backPhotoUrl: string };
type InventoryExpenseDraft = { shipping: string; hst: string; duties: string };
type SaleExpenseDraft = { hst: string; fees: string; shippingLabel: string };
type RefundDraft = { amount: string; refundDate: string; note: string };
type CashSuccessSummary = { adjustmentType: CashAdjustmentRecord["adjustmentType"]; amount: number; adjustmentDate: string; description: string; endingCash: number };
type SaleCelebration = { cardName: string; quantity: number; saleTotal: number; saleUnitPrice: number; shippingCharge: number; shippingUnitPrice: number; collectedTotal: number; purchaseCost: number; saleExpenseTotal: number; netProfit: number; remainingQuantity?: number; platform: string; listingRemovalReminder: MultiPlatformListing[] };
type GradingLinkQueryResult = {
  data: Array<{ submission_id: string; card_id: string; quantity_sent?: number | string | null }> | null;
  error: { message: string } | null;
};
type ReturnedGradingFeeCard = { card: CardRecord; gradingFee: number };
type PrimeLotListingType = "single_card" | "sealed_product" | "lot";
type PrimeLotPostResult = {
  postedCount: number;
  totalAmount: number;
  publicListingCount: number;
  draftListingCount: number;
  listings: Array<{ cardTrackerId: string; primeLotListingId: string; url: string; status: string; cardName: string; amount: number; shippingCharge: number }>;
};
type PrimeLotConnectionState = {
  connected: boolean;
  status: "none" | "pending" | "active" | "disconnected" | string;
  sellerEmail: string;
  storeSlug: string;
  storeUrl: string;
  requestedIntent: string;
  migrationRequired?: boolean;
};

const CARD_STORAGE_KEY = "card-inventory-tracker.cards.v2";
const EXPENSE_STORAGE_KEY = "card-inventory-tracker.expenses.v1";
const CASH_STORAGE_KEY = "card-inventory-tracker.cash-adjustments.v1";
const CASH_ONBOARDING_DISMISSED_KEY = "card-inventory-tracker.cash-onboarding-dismissed.v1";
const GRADING_STORAGE_KEY = "card-inventory-tracker.grading-submissions.v1";
const GUEST_CARD_STORAGE_KEY = "card-inventory-tracker.guest-cards.v1";
const GUEST_EXPENSE_STORAGE_KEY = "card-inventory-tracker.guest-expenses.v1";
const GUEST_CASH_STORAGE_KEY = "card-inventory-tracker.guest-cash-adjustments.v1";
const GUEST_GRADING_STORAGE_KEY = "card-inventory-tracker.guest-grading-submissions.v1";
const PRICING_PATH = "/pricing";
const BILLING_PATH = "/billing";
const PRIMELOT_SELLER_MEMBERSHIP_URL = "https://primelot.cards/pricing";
const PRIMELOT_MARKETPLACE_URL = "https://primelot.cards/marketplace";
const PRIMELOT_SIGNUP_URL = "https://primelot.cards/pricing";
const PRIMELOT_DASHBOARD_URL = "https://primelot.cards/dashboard/seller?tab=listings";
const PRIMELOT_DRAFTS_URL = "https://primelot.cards/dashboard/seller?tab=listings&status=draft";
const PRIMELOT_CONNECT_INTENT_PATTERN = /(primelot|prime-lot|wct-connect|connect-wicked)/i;
const statuses: CardStatus[] = ["Not Listed", "Listed", "Sold"];
const primeLotListingTypeOptions: Array<{ value: PrimeLotListingType; label: string }> = [
  { value: "single_card", label: "Single Card" },
  { value: "sealed_product", label: "Sealed Product" },
  { value: "lot", label: "Lot" },
];
const primeLotListingTypeLabels = Object.fromEntries(primeLotListingTypeOptions.map((option) => [option.value, option.label])) as Record<PrimeLotListingType, string>;
const expenseCategories: ExpenseCategory[] = ["HST", "Marketplace Fees", "Duties", "Grading Fees", "Shipping", "Card Show Table", "Supplies", "Gas", "Airfare", "Other"];
const todayIso = () => new Date().toISOString().slice(0, 10);
const primeLotDraftStatuses = new Set(["draft", "pending", "inactive", "archived", "deleted", "removed"]);
const isPrimeLotPublicListing = (status = "") => !primeLotDraftStatuses.has(status.toLowerCase());
const primeLotListingStatusLabel = (status = "") => isPrimeLotPublicListing(status) ? "PrimeLot" : "PrimeLot Draft";
const currentMonthStart = () => `${todayIso().slice(0, 7)}-01`;
const currentYearStart = () => `${todayIso().slice(0, 4)}-01-01`;
const dateInRange = (date: string, start: string, end: string) => {
  if (!date) return false;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
};
const formatDateLabel = (date: string) => {
  if (!date) return "";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};
const formatDateTimeLabel = (value: string) => {
  if (!value) return "date not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};
const actorLabel = (value: string, fallback = "Unknown user") => value || fallback;
const hasPrimeLotConnectIntent = () => {
  if (typeof window === "undefined") return false;
  return PRIMELOT_CONNECT_INTENT_PATTERN.test(`${window.location.pathname} ${window.location.search} ${window.location.hash}`);
};
const PHOTO_MAX_SIDE = 1800;

const canvasToBlob = (canvas: HTMLCanvasElement, type = "image/jpeg", quality = 0.9) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not prepare photo for upload."))), type, quality);
  });

const loadImageBitmap = async (file: File) => {
  if (typeof window !== "undefined" && "createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      return null;
    }
  }
  return null;
};

const loadHtmlImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the selected photo."));
    };
    image.src = url;
  });

const normalizePhotoFile = async (file: File) => {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await loadImageBitmap(file);
  const source = bitmap ?? (await loadHtmlImage(file));
  const sourceWidth = source.width;
  const sourceHeight = source.height;
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare photo for upload.");
  context.drawImage(source, 0, 0, width, height);
  bitmap?.close();

  const blob = await canvasToBlob(canvas);
  const normalizedName = file.name.replace(/\.[^.]+$/, "") || "card-photo";
  return new File([blob], `${normalizedName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
};
const cleanGradeLabel = (grade: string) => grade.trim().replace(/^grade:\s*/i, "");
const gradeParts = (value: string) => {
  const clean = cleanGradeLabel(value);
  const match = clean.match(/^(PSA|BGS|SGC|CGC|TAG)\s+(.+)$/i);
  return match ? { company: match[1].toUpperCase(), grade: match[2].trim() } : { company: "", grade: clean };
};
const cardGradeValue = (card: Pick<CardRecord, "grade" | "notes">) => card.grade || card.notes.split("\n").find((line) => line.toLowerCase().startsWith("grade:"))?.replace(/^grade:\s*/i, "").trim() || "";
const cardGradingCompanyValue = (card: Pick<CardRecord, "gradingCompany" | "notes">) => card.gradingCompany || card.notes.split("\n").find((line) => line.toLowerCase().startsWith("grader:"))?.replace(/^grader:\s*/i, "").trim() || "";
const emptyInventoryExpenseDraft = (): InventoryExpenseDraft => ({ shipping: "", hst: "", duties: "" });
const emptySaleExpenseDraft = (): SaleExpenseDraft => ({ hst: "", fees: "", shippingLabel: "" });
const emptyRefundDraft = (): RefundDraft => ({ amount: "", refundDate: todayIso(), note: "" });
const saleExpenseCategories: ExpenseCategory[] = ["Shipping", "Marketplace Fees", "HST", "Other"];
const saleExpenseLabelForCategory = (category: ExpenseCategory) => {
  if (category === "HST") return "Sale HST";
  if (category === "Marketplace Fees") return "Sale fees";
  if (category === "Shipping") return "Shipping label";
  return "Sale expense";
};
const saleExpenseDescriptionForCard = (category: ExpenseCategory, card: Pick<CardRecord, "name">) => `${saleExpenseLabelForCategory(category)}: ${card.name}`;
const gradingFeeDescriptionForCard = (card: Pick<CardRecord, "id" | "name">) => `Grading fee: ${card.id}: ${card.name}`;
const expenseDraftAmount = (value: string) => Math.max(0, Number(value || 0) || 0);
const inventoryExpenseAmount = expenseDraftAmount;
const inventoryExpenseDraftTotal = (draft: InventoryExpenseDraft) => inventoryExpenseAmount(draft.shipping) + inventoryExpenseAmount(draft.hst) + inventoryExpenseAmount(draft.duties);
const saleExpenseDraftTotal = (draft: SaleExpenseDraft) => expenseDraftAmount(draft.hst) + expenseDraftAmount(draft.fees) + expenseDraftAmount(draft.shippingLabel);
const isSaleExpenseForCard = (expense: ExpenseRecord, card: CardRecord) => {
  const isSaleExpense = expense.category === "HST" || expense.category === "Marketplace Fees" || expense.category === "Shipping" || expense.category === "Other";
  if (!isSaleExpense) return false;
  const matchesDescription = expense.description === `Sale HST: ${card.name}` || expense.description === `Sale fees: ${card.name}` || expense.description === `Shipping label: ${card.name}` || expense.description === `Sale expense: ${card.name}`;
  const matchesDate = !card.saleDate || expense.expenseDate === card.saleDate;
  const matchesVendor = !card.salePlatform || expense.vendor === card.salePlatform;
  return matchesDescription && matchesDate && matchesVendor;
};
const saleExpensesTotalForCards = (sourceExpenses: ExpenseRecord[], sourceCards: CardRecord[]) => sourceExpenses
  .filter((expense) => sourceCards.some((card) => isSaleExpenseForCard(expense, card)))
  .reduce((sum, expense) => sum + expense.amount, 0);
const isGradingExpenseForCard = (expense: ExpenseRecord, card: Pick<CardRecord, "id" | "name">) => expense.category === "Grading Fees" && expense.description === gradingFeeDescriptionForCard(card);
const gradingFeesTotalForCards = (sourceExpenses: ExpenseRecord[], sourceCards: CardRecord[]) => sourceExpenses
  .filter((expense) => sourceCards.some((card) => isGradingExpenseForCard(expense, card)))
  .reduce((sum, expense) => sum + expense.amount, 0);
const roiBucketKey = (date: string, mode: DateFilterMode, start: string, end: string) => {
  if (!date) return "No date";
  if (mode === "month") return date;
  if (mode === "custom") {
    const startTime = start ? new Date(`${start}T00:00:00`).getTime() : 0;
    const endTime = end ? new Date(`${end}T00:00:00`).getTime() : 0;
    const daySpan = startTime && endTime ? Math.round((endTime - startTime) / 86400000) : 0;
    return daySpan > 62 ? date.slice(0, 7) : date;
  }
  return date.slice(0, 7);
};
const roiBucketLabel = (key: string) => key.length === 7 ? formatDateLabel(`${key}-01`).replace(/ 1,/, "") : formatDateLabel(key);
const cardGradeLabel = (card: Pick<CardRecord, "grade" | "gradingCompany" | "notes">) => [cardGradingCompanyValue(card), cardGradeValue(card)].filter(Boolean).join(" ").trim();
const notesWithGrade = (notes: string, grade: string, gradingCompany = "") => {
  const withoutGrade = notes.split("\n").filter((line) => !/^grade:|^grader:/i.test(line.trim())).join("\n").trim();
  const cleanGrade = cleanGradeLabel(grade);
  const cleanCompany = gradingCompany.trim();
  return [cleanCompany ? `Grader: ${cleanCompany}` : "", cleanGrade ? `Grade: ${cleanGrade}` : "", withoutGrade].filter(Boolean).join("\n");
};
const notesWithReturnedGrade = (notes: string, grade: string, gradingCompany = "", slabNumber = "") => {
  const withoutReturnDetails = notes
    .split("\n")
    .filter((line) => !/^grade:|^grader:|^slab\s*(#|number|cert)|^cert\s*(#|number)?/i.test(line.trim()))
    .join("\n")
    .trim();
  const cleanSlabNumber = slabNumber.trim();
  return [
    notesWithGrade(withoutReturnDetails, grade, gradingCompany),
    cleanSlabNumber ? `Slab #: ${cleanSlabNumber}` : "",
  ].filter(Boolean).join("\n");
};
const mergeById = <T extends { id: string }>(primary: T[], fallback: T[]) => {
  const rows = new Map<string, T>();
  fallback.forEach((item) => rows.set(item.id, item));
  primary.forEach((item) => rows.set(item.id, item));
  return Array.from(rows.values());
};
const localCards = (storageKey = CARD_STORAGE_KEY) => {
  try {
    const rawCards = window.localStorage.getItem(storageKey);
    return rawCards ? JSON.parse(rawCards).map(normalizeStoredCard) as CardRecord[] : [];
  } catch {
    return [];
  }
};
const localExpenses = (storageKey = EXPENSE_STORAGE_KEY) => {
  try {
    const rawExpenses = window.localStorage.getItem(storageKey);
    return rawExpenses ? JSON.parse(rawExpenses).map(normalizeStoredExpense) as ExpenseRecord[] : [];
  } catch {
    return [];
  }
};
const localCashAdjustments = (storageKey = CASH_STORAGE_KEY) => {
  try {
    const rawCash = window.localStorage.getItem(storageKey);
    return rawCash ? JSON.parse(rawCash).map(normalizeStoredCashAdjustment) as CashAdjustmentRecord[] : [];
  } catch {
    return [];
  }
};
const localGradingSubmissions = (storageKey = GRADING_STORAGE_KEY) => {
  try {
    const rawGrading = window.localStorage.getItem(storageKey);
    return rawGrading ? JSON.parse(rawGrading).map(normalizeStoredGradingSubmission) as GradingSubmission[] : [];
  } catch {
    return [];
  }
};
const localGuestCards = () => localCards(GUEST_CARD_STORAGE_KEY);
const localGuestExpenses = () => localExpenses(GUEST_EXPENSE_STORAGE_KEY);
const localGuestCashAdjustments = () => localCashAdjustments(GUEST_CASH_STORAGE_KEY);
const localGuestGradingSubmissions = () => localGradingSubmissions(GUEST_GRADING_STORAGE_KEY);
const clearLegacyLocalAccountCache = () => {
  try {
    window.localStorage.removeItem(CARD_STORAGE_KEY);
    window.localStorage.removeItem(EXPENSE_STORAGE_KEY);
    window.localStorage.removeItem(CASH_STORAGE_KEY);
    window.localStorage.removeItem(GRADING_STORAGE_KEY);
  } catch {
    // If localStorage is unavailable, keep the in-memory signed-out state empty.
  }
};
const filterLabel = (mode: DateFilterMode, start: string, end: string) => {
  if (mode === "all") return "All time";
  if (mode === "month") return "This month";
  if (mode === "year") return "This year";
  if (start && end) return `${formatDateLabel(start)} – ${formatDateLabel(end)}`;
  if (start) return `From ${formatDateLabel(start)}`;
  if (end) return `Through ${formatDateLabel(end)}`;
  return "Custom range";
};
const daysSince = (isoDate: string) => {
  if (!isoDate) return null;
  const time = new Date(`${isoDate}T00:00:00`).getTime();
  if (Number.isNaN(time)) return null;
  const today = new Date(`${todayIso()}T00:00:00`).getTime();
  return Math.max(0, Math.floor((today - time) / 86_400_000));
};
const inventoryDateFieldLabels: Record<InventoryDateField, string> = {
  purchaseDate: "purchase date",
  listedDate: "listed date",
  saleDate: "sold date",
};
const sanitizeQuantityInput = (value: string | number) => Math.max(1, Math.floor(Number(value) || 1));
const cardDateForInventoryFilter = (card: CardRecord, field: InventoryDateField) => {
  if (field === "listedDate") return card.listedDate || card.listedAt?.slice(0, 10) || "";
  if (field === "saleDate") return card.saleDate || card.soldAt?.slice(0, 10) || "";
  return card.purchaseDate;
};
const listedAgeDate = (card: CardRecord) => card.listedDate || card.updatedAt?.slice(0, 10) || card.purchaseDate;
const listedDays = (card: CardRecord) => daysSince(listedAgeDate(card));
const listingReviewTone = (age: number): ListedReviewItem["tone"] => {
  if (age >= 60) return "urgent";
  if (age >= 30) return "warning";
  return "current";
};
const dateValue = (date: string) => (date ? new Date(`${date}T00:00:00`).getTime() || 0 : 0);
const uniqueSorted = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));

const listingNotesPrefix = "WCT_LISTINGS_JSON:";
const listingKey = (listing: Pick<MultiPlatformListing, "platform" | "url">) => `${listing.platform.trim().toLowerCase()}|${listing.url.trim().toLowerCase()}`;
const cleanListingNotes = (notes = "") => notes.split("\n").filter((line) => !line.startsWith(listingNotesPrefix)).join("\n").trim();
const parseStoredListings = (notes = ""): MultiPlatformListing[] => {
  const line = notes.split("\n").find((entry) => entry.startsWith(listingNotesPrefix));
  if (!line) return [];
  try {
    const parsed = JSON.parse(line.slice(listingNotesPrefix.length));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item): MultiPlatformListing => ({
      id: typeof item.id === "string" && item.id ? item.id : crypto.randomUUID(),
      platform: String(item.platform || "").trim(),
      url: String(item.url || "").trim(),
      askingPrice: Number(item.askingPrice || 0) || 0,
      lowestAcceptablePrice: Number(item.lowestAcceptablePrice || 0) || 0,
      shippingCharge: Number(item.shippingCharge || 0) || 0,
      listedDate: String(item.listedDate || "").trim(),
    })).filter((listing) => listing.platform || listing.url);
  } catch {
    return [];
  }
};
const notesWithListings = (notes: string, listings: MultiPlatformListing[]) => {
  const cleanNotes = cleanListingNotes(notes);
  const activeListings = listings.filter((listing) => listing.platform || listing.url);
  if (!activeListings.length) return cleanNotes;
  return [cleanNotes, `${listingNotesPrefix}${JSON.stringify(activeListings)}`].filter(Boolean).join("\n");
};
const legacyListingForCard = (card: Pick<CardRecord, "listedPlatform" | "listingUrl" | "askingPrice" | "lowestAcceptablePrice" | "shippingCharge" | "listedDate" | "updatedAt" | "purchaseDate">): MultiPlatformListing | null => {
  if (!card.listedPlatform.trim() && !card.listingUrl.trim()) return null;
  return {
    id: "legacy-primary",
    platform: listingPlatformLabel(card),
    url: card.listingUrl.trim(),
    askingPrice: Number(card.askingPrice || 0) || 0,
    lowestAcceptablePrice: Number(card.lowestAcceptablePrice || 0) || 0,
    shippingCharge: Number(card.shippingCharge || 0) || 0,
    listedDate: card.listedDate || card.updatedAt?.slice(0, 10) || card.purchaseDate || todayIso(),
  };
};
const activeListingsForCard = (card: CardRecord): MultiPlatformListing[] => {
  const stored = parseStoredListings(card.notes);
  const legacy = legacyListingForCard(card);
  const listings = stored.length ? stored : legacy ? [legacy] : [];
  const seen = new Set<string>();
  return listings.filter((listing) => {
    const key = listingKey(listing);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
const cardWithListings = (card: CardRecord, listings: MultiPlatformListing[]): CardRecord => {
  const primary = listings[0];
  return {
    ...card,
    status: primary ? "Listed" : "Not Listed",
    listedPlatform: primary?.platform || "",
    listingUrl: primary?.url || "",
    askingPrice: primary?.askingPrice || 0,
    lowestAcceptablePrice: primary?.lowestAcceptablePrice || 0,
    shippingCharge: primary?.shippingCharge || 0,
    listedDate: primary?.listedDate || "",
    notes: notesWithListings(card.notes, listings),
  };
};
const listingCardProjection = (card: CardRecord, listing: MultiPlatformListing): CardRecord => ({
  ...card,
  listedPlatform: listing.platform,
  listingUrl: listing.url,
  askingPrice: listing.askingPrice,
  lowestAcceptablePrice: listing.lowestAcceptablePrice,
  shippingCharge: listing.shippingCharge,
  listedDate: listing.listedDate,
});
const primeLotListingForCard = (card: CardRecord) => activeListingsForCard(card).find((listing) => {
  const platform = listing.platform.toLowerCase();
  const listingUrl = listing.url.toLowerCase();
  return platform.includes("primelot") || listingUrl.includes("primelot.cards") || listingUrl.includes("primelot");
}) || null;
const isPrimeLotImportedCard = (card: CardRecord) => {
  const sourcePlatform = (card.sourcePlatform || "").trim().toLowerCase();
  const sourceUrl = (card.sourceUrl || "").trim().toLowerCase();
  return sourcePlatform === "primelot"
    || sourceUrl.includes("primelot.cards")
    || /^source:\s*primelot$/im.test(card.notes || "")
    || /primelot listing id:/i.test(card.notes || "");
};
const otherListingsAfterSale = (card: CardRecord) => activeListingsForCard(card).filter((listing) => listing.platform.trim().toLowerCase() !== (card.salePlatform || "").trim().toLowerCase());

const firstUrlInText = (value: string) => value.match(/https?:\/\/\S+/i)?.[0]?.replace(/[),.;]+$/, "") || "";
const urlsInText = (value: string) => Array.from(new Set(Array.from(value.matchAll(/https?:\/\/[^\s,]+/gi), ([url]) => url.replace(/[),.;]+$/, ""))));
const listingHref = (card: Pick<CardRecord, "listingUrl" | "listedPlatform">) => card.listingUrl.trim() || firstUrlInText(card.listedPlatform || "");
const listingPlatformLabel = (card: Pick<CardRecord, "listedPlatform" | "listingUrl">) => {
  const platform = card.listedPlatform.trim();
  const href = listingHref(card);
  if (!platform || platform === href) return href ? "Listed online" : "Listed";
  return platform.replace(href, "").trim().replace(/^[-•|]+|[-•|]+$/g, "").trim() || "Listed online";
};
const splitPlatformLabels = (platform: string) => platform
  .split(/\s*(?:,|\/|\||&|\band\b)\s*/i)
  .map((label) => label.trim())
  .filter(Boolean);
const displayPlatformLabel = (platform: string) => {
  if (/^ebay$/i.test(platform)) return "eBay";
  if (/^primelot(?:\s+draft)?$/i.test(platform)) return platform.toLowerCase().includes("draft") ? "PrimeLot Draft" : "PrimeLot";
  return platform;
};
const platformUrlMatches = (platform: string, url: string) => {
  const normalizedPlatform = platform.toLowerCase();
  const normalizedUrl = url.toLowerCase();
  if (normalizedPlatform.includes("primelot")) return normalizedUrl.includes("primelot");
  if (normalizedPlatform.includes("ebay")) return normalizedUrl.includes("ebay.");
  if (normalizedPlatform.includes("whatnot")) return normalizedUrl.includes("whatnot.");
  if (normalizedPlatform.includes("tcg")) return normalizedUrl.includes("tcgplayer.");
  return normalizedUrl.includes(normalizedPlatform.replace(/[^a-z0-9]/g, ""));
};
const marketplaceSearchUrl = (platform: string, card: CardRecord) => {
  if (!platform.toLowerCase().includes("ebay")) return "";
  const query = [card.name, card.year, card.setName, card.cardNumber].filter(Boolean).join(" ");
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query || card.name || "trading card")}`;
};
const listingReviewPlatformsLabel = (listings: MultiPlatformListing[]) => {
  const labels = listings.flatMap((listing) => splitPlatformLabels(listing.platform || "Listed online")).map(displayPlatformLabel);
  return uniqueSorted(labels).join(", ") || "Not entered";
};
const listingReviewLinksForCard = (card: CardRecord, listings: MultiPlatformListing[]): ListingReviewLink[] => {
  const links: ListingReviewLink[] = [];
  const seen = new Set<string>();
  listings.forEach((listing) => {
    const platforms = splitPlatformLabels(listing.platform || "Listing");
    const labels = platforms.length ? platforms : [listing.platform || "Listing"];
    const urls = urlsInText(`${listing.url} ${listing.platform}`);
    labels.forEach((rawLabel) => {
      const label = displayPlatformLabel(rawLabel);
      const matchedUrl = urls.find((url) => platformUrlMatches(rawLabel, url)) || (urls.length === 1 && labels.length === 1 ? urls[0] : "") || marketplaceSearchUrl(rawLabel, card);
      if (!matchedUrl) return;
      const key = `${label.toLowerCase()}|${matchedUrl.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      links.push({ id: key, label, url: matchedUrl });
    });
  });
  return links;
};
const listingReviewReferenceDate = (card: CardRecord, listings: MultiPlatformListing[]) => {
  const listingDates = listings.map((listing) => listing.listedDate).filter(Boolean).sort((a, b) => dateValue(a) - dateValue(b));
  return listingDates[0] || listedAgeDate(card);
};
const listingReviewAskingValue = (item: ListedReviewItem) => {
  const listingPrices = item.listings.map((listing) => listing.askingPrice).filter((value) => value > 0);
  return (listingPrices[0] || item.card.askingPrice || 0) * cardQuantity(item.card);
};
const listingReviewAskingLabel = (item: ListedReviewItem) => {
  const values = uniqueSorted(item.listings.map((listing) => listing.askingPrice).filter((value) => value > 0).map((value) => String(value))).map(Number);
  if (!values.length) return `${money(item.card.askingPrice)}${cardQuantity(item.card) > 1 ? " each" : ""}`;
  if (values.length === 1) return `${money(values[0])}${cardQuantity(item.card) > 1 ? " each" : ""}`;
  return `${money(Math.min(...values))} - ${money(Math.max(...values))}${cardQuantity(item.card) > 1 ? " each" : ""}`;
};
const titleCaseCategoryLabel = (value: string) => value
  .replace(/[_-]+/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .split(" ")
  .map((word) => word ? `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}` : "")
  .join(" ");

const friendlyCardCategory = (value: string | undefined) => {
  const category = (value || "").trim();
  const normalized = category.toLowerCase().replace(/[\s-]+/g, "_");
  if (!category) return "";
  if (normalized === "one_piece" || normalized === "onepiece") return "One Piece";
  if (normalized === "pokemon" || normalized === "pokémon") return "Pokemon";
  if (normalized === "mtg" || normalized === "magic_the_gathering") return "MTG";
  if (normalized === "tcg") return "TCG";
  if (normalized === "sealed_product") return "Sealed Product";
  return titleCaseCategoryLabel(category);
};
const normalizeStoredCard = (card: Partial<CardRecord>): CardRecord => ({
  ...emptyCard(),
  ...card,
  id: card.id || crypto.randomUUID(),
  name: card.name || "",
  category: friendlyCardCategory(card.category) || "Sports",
  status: card.status || "Not Listed",
  askingPrice: Number(card.askingPrice ?? 0) || 0,
  lowestAcceptablePrice: Number(card.lowestAcceptablePrice ?? 0) || 0,
  shippingCharge: Number(card.shippingCharge ?? 0) || 0,
  gradingCompany: card.gradingCompany || cardGradingCompanyValue({ gradingCompany: "", notes: card.notes || "" }),
  grade: card.grade || cardGradeValue({ grade: "", notes: card.notes || "" }),
  listedDate: card.listedDate || "",
  listedAt: card.listedAt || "",
  listedBy: card.listedBy || "",
  purchasePrice: Number(card.purchasePrice ?? 0) || 0,
  quantity: Math.max(1, Math.floor(Number(card.quantity ?? 1) || 1)),
  soldPrice: Number(card.soldPrice ?? 0) || 0,
  soldAt: card.soldAt || "",
  soldBy: card.soldBy || "",
  createdAt: card.createdAt || new Date().toISOString(),
  createdBy: card.createdBy || "",
  updatedAt: card.updatedAt || new Date().toISOString(),
  updatedBy: card.updatedBy || "",
});
const rowHasQuantity = (row: Parameters<typeof rowToCard>[0]) => Object.prototype.hasOwnProperty.call(row, "quantity") && row.quantity !== null && row.quantity !== undefined;
const rowToCardWithQuantityFallback = (row: Parameters<typeof rowToCard>[0], fallback?: Pick<CardRecord, "quantity" | "shippingCharge" | "gradingCompany" | "grade" | "backPhotoUrl">): CardRecord => {
  const card = rowToCard(row);
  return fallback ? {
    ...card,
    quantity: !rowHasQuantity(row) ? fallback.quantity : card.quantity,
    shippingCharge: card.shippingCharge || fallback.shippingCharge || 0,
    gradingCompany: card.gradingCompany || fallback.gradingCompany || "",
    grade: card.grade || fallback.grade || "",
    backPhotoUrl: card.backPhotoUrl || fallback.backPhotoUrl || "",
  } : card;
};

const normalizeStoredCashAdjustment = (entry: Partial<CashAdjustmentRecord>): CashAdjustmentRecord => ({
  ...emptyCashAdjustment(),
  ...entry,
  id: entry.id || crypto.randomUUID(),
  adjustmentType: entry.adjustmentType === "Cash Removed" || entry.adjustmentType === "Starting Cash" ? entry.adjustmentType : "Cash Added",
  amount: Number(entry.amount ?? 0) || 0,
  adjustmentDate: entry.adjustmentDate || todayIso(),
  description: entry.description || "",
  createdAt: entry.createdAt || new Date().toISOString(),
  createdBy: entry.createdBy || "",
  updatedAt: entry.updatedAt || new Date().toISOString(),
  updatedBy: entry.updatedBy || "",
});

const normalizeStoredExpense = (expense: Partial<ExpenseRecord>): ExpenseRecord => ({
  ...emptyExpense(),
  ...expense,
  amount: Number(expense.amount ?? 0) || 0,
  createdAt: expense.createdAt || new Date().toISOString(),
  createdBy: expense.createdBy || "",
  updatedAt: expense.updatedAt || new Date().toISOString(),
  updatedBy: expense.updatedBy || "",
});
const normalizeStoredGradingSubmission = (submission: Partial<GradingSubmission>): GradingSubmission => ({
  ...emptyGradingSubmission(),
  ...submission,
  id: submission.id || crypto.randomUUID(),
  company: submission.company || "",
  sentDate: submission.sentDate || todayIso(),
  returnedDate: submission.returnedDate || "",
  status: submission.status === "Returned" ? "Returned" : "At Grading",
  reference: submission.reference || "",
  notes: submission.notes || "",
  cardIds: Array.isArray(submission.cardIds) ? submission.cardIds : [],
  cardQuantities: submission.cardQuantities || {},
  createdAt: submission.createdAt || new Date().toISOString(),
  createdBy: submission.createdBy || "",
  updatedAt: submission.updatedAt || new Date().toISOString(),
  updatedBy: submission.updatedBy || "",
  returnedBy: submission.returnedBy || "",
});
const prepareCardForStatus = (card: CardRecord, status: CardStatus): CardRecord => ({
  ...card,
  status,
  listedDate: status === "Listed" ? card.listedDate || todayIso() : card.listedDate,
  saleDate: status === "Sold" ? card.saleDate || todayIso() : "",
  soldPrice: status === "Sold" ? card.soldPrice : 0,
  salePlatform: status === "Sold" ? card.salePlatform : "",
  updatedAt: new Date().toISOString(),
});
const isListingPricingColumnError = (message: string) => /asking_price|lowest_acceptable_price|listed_date/i.test(message);
const isMarketplaceDetailsColumnError = (message: string) => /outbound_shipping|grading_company|grade/i.test(message);
const isAuditColumnError = (message: string) => /created_by|updated_by|listed_at|listed_by|sold_at|sold_by|returned_by/i.test(message);
const isQuantityColumnError = (message: string) => /quantity/i.test(message);
const isBackPhotoColumnError = (message: string) => /back_photo_url/i.test(message);
const isMissingCashAdjustmentsTable = (message: string) => /cash_adjustments|relation .* does not exist|schema cache|Could not find the table/i.test(message);

const csvValue = (row: CsvRow, aliases: string[]) => {
  for (const alias of aliases) {
    const value = row[normalizeCsvHeader(alias)];
    if (value?.trim()) return value.trim();
  }
  return "";
};
const normalizeCsvHeader = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
const parseCsvText = (text: string) => {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeCsvHeader);
  return rows.slice(1).map((cells) => headers.reduce<CsvRow>((record, header, index) => {
    if (header) record[header] = cells[index]?.trim() ?? "";
    return record;
  }, {}));
};
const parseImportedMoney = (value: string) => Number(value.replace(/[$,]/g, "")) || 0;
const normalizeImportedStatus = (value: string): CardStatus => {
  const normalized = value.trim().toLowerCase();
  if (["sold", "shipped", "complete", "completed"].includes(normalized)) return "Sold";
  if (["listed", "active", "for sale", "forsale"].includes(normalized)) return "Listed";
  return "Not Listed";
};
const importCardFromCsvRow = (row: CsvRow, sourceRow: number): ImportCardPreview | null => {
  const name = csvValue(row, ["card/player name", "card name", "player", "name", "title", "item title", "product name", "card"]);
  const setName = csvValue(row, ["set", "set name", "brand", "product", "series"]);
  const year = csvValue(row, ["year", "season"]);
  const cardNumber = csvValue(row, ["card #", "card number", "number", "no", "card no"]);
  const purchasePrice = parseImportedMoney(csvValue(row, ["purchase price", "price paid", "paid", "buy price", "cost", "amount", "total"]));
  const quantity = Math.max(1, Math.floor(Number(csvValue(row, ["quantity", "qty", "item qty", "items", "count"])) || 1));
  const askingPrice = parseImportedMoney(csvValue(row, ["asking price", "list price", "listing price", "listed price", "sale price"]));
  const shippingCharge = parseImportedMoney(csvValue(row, ["shipping charge", "shipping", "buyer shipping", "outbound shipping", "shipping price"]));
  const importedGradingCompany = csvValue(row, ["grading company", "grader", "professional grader"]);
  const importedGradeRaw = csvValue(row, ["grade", "card grade"]);
  const importedGradeParts = gradeParts(importedGradeRaw);
  const gradingCompany = importedGradingCompany || importedGradeParts.company;
  const grade = importedGradeParts.grade;
  const soldPrice = parseImportedMoney(csvValue(row, ["sold price", "sold for", "final sale price"]));
  const status = normalizeImportedStatus(csvValue(row, ["status", "state"]));
  const listedPlatform = csvValue(row, ["listed platform", "platform", "marketplace", "listed where"]);
  const salePlatform = csvValue(row, ["sale platform", "sold platform", "sold where"]);
  const purchaseDate = csvValue(row, ["purchase date", "date bought", "bought date", "date purchased", "order date", "date"]) || todayIso();
  const listedDate = csvValue(row, ["listed date", "date listed"]);
  const saleDate = csvValue(row, ["sale date", "sold date", "date sold"]);
  const notes = csvValue(row, ["notes", "note", "description", "condition"]);
  const category = csvValue(row, ["category", "sport", "type", "game"]) || "Sports";
  const listingUrl = csvValue(row, ["listing url", "url", "link"]);
  const frontPhotoUrl = csvValue(row, ["front photo url", "photo url", "image", "image url", "picture"]);
  const backPhotoUrl = csvValue(row, ["back photo url", "back image url", "reverse photo url", "back picture"]);
  const hasAnyCardDetail = [name, setName, year, cardNumber, notes].some(Boolean);
  if (!hasAnyCardDetail) return null;

  const importedStatus: CardStatus = soldPrice > 0 ? "Sold" : askingPrice > 0 || listedPlatform || listingUrl ? "Listed" : status;
  const now = new Date().toISOString();
  const card: CardRecord = {
    ...emptyCard(),
    id: crypto.randomUUID(),
    name: name || [year, setName, cardNumber].filter(Boolean).join(" ") || `Imported card row ${sourceRow}`,
    category,
    year,
    setName,
    cardNumber,
    status: importedStatus,
    listedPlatform,
    listingUrl,
    askingPrice,
    lowestAcceptablePrice: parseImportedMoney(csvValue(row, ["minimum sale price", "lowest acceptable price", "minimum price", "min price"])),
    shippingCharge,
    gradingCompany,
    grade,
    listedDate: importedStatus === "Listed" ? listedDate || todayIso() : listedDate,
    frontPhotoUrl,
    backPhotoUrl,
    purchaseDate,
    purchasePrice,
    quantity,
    saleDate: importedStatus === "Sold" ? saleDate || todayIso() : saleDate,
    salePlatform,
    soldPrice,
    notes,
    createdAt: now,
    updatedAt: now,
  };
  const warnings = [
    !name ? "Missing card/player name" : "",
    !purchasePrice ? "No purchase price" : "",
    importedStatus === "Sold" && !soldPrice ? "Sold status needs sold price" : "",
    importedStatus === "Sold" && !salePlatform ? "Sold status needs sale platform" : "",
    importedStatus === "Listed" && !askingPrice ? "Listed status needs asking price" : "",
    grade && !gradingCompany ? "Grade needs grading company" : "",
  ].filter(Boolean);

  return { id: card.id, sourceRow, card, selected: warnings.length === 0, warnings };
};

const sampleCards = (): CardRecord[] => [
  {
    ...emptyCard(),
    id: "sample-1",
    name: "Example Rookie Card",
    category: "Basketball",
    year: "2023",
    setName: "Prizm",
    cardNumber: "101",
    status: "Listed",
    listedPlatform: "eBay",
    listingUrl: "https://example.com/listing",
    askingPrice: 75,
    lowestAcceptablePrice: 60,
    listedDate: new Date().toISOString().slice(0, 10),
    purchasePrice: 40,
    notes: "Sample listed card.",
  },
  {
    ...emptyCard(),
    id: "sample-2",
    name: "Example Sold Holo",
    category: "Pokemon",
    year: "2021",
    setName: "Evolving Skies",
    cardNumber: "215",
    status: "Sold",
    saleDate: new Date().toISOString().slice(0, 10),
    salePlatform: "eBay",
    purchasePrice: 18,
    soldPrice: 52,
    notes: "Sample sold card.",
  },
];

export default function Home() {
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [cashAdjustments, setCashAdjustments] = useState<CashAdjustmentRecord[]>([]);
  const [gradingSubmissions, setGradingSubmissions] = useState<GradingSubmission[]>([]);
  const [activeCard, setActiveCard] = useState<CardRecord>(emptyCard());
  const [activeCardGrade, setActiveCardGrade] = useState("");
  const [activeCardGradingCompany, setActiveCardGradingCompany] = useState("");
  const [inventoryExpenseDraft, setInventoryExpenseDraft] = useState<InventoryExpenseDraft>(emptyInventoryExpenseDraft());
  const [saleExpenseDraft, setSaleExpenseDraft] = useState<SaleExpenseDraft>(emptySaleExpenseDraft());
  const [activeExpense, setActiveExpense] = useState<ExpenseRecord>(emptyExpense());
  const [expenseForSoldCard, setExpenseForSoldCard] = useState<CardRecord | null>(null);
  const [activeCashAdjustment, setActiveCashAdjustment] = useState<CashAdjustmentRecord>(emptyCashAdjustment());
  const [editingCashAdjustmentId, setEditingCashAdjustmentId] = useState<string | null>(null);
  const [cashSuccessSummary, setCashSuccessSummary] = useState<CashSuccessSummary | null>(null);
  const [cashOnboardingDismissed, setCashOnboardingDismissed] = useState(false);
  const [dashboardCashEntryOpen, setDashboardCashEntryOpen] = useState(false);
  const [dashboardCashEntryAutoOpened, setDashboardCashEntryAutoOpened] = useState(false);
  const [mobileQuickActionsOpen, setMobileQuickActionsOpen] = useState(false);
  const [sellingCard, setSellingCard] = useState<CardRecord | null>(null);
  const [saleCelebration, setSaleCelebration] = useState<SaleCelebration | null>(null);
  const [refundingCard, setRefundingCard] = useState<CardRecord | null>(null);
  const [refundDraft, setRefundDraft] = useState<RefundDraft>(emptyRefundDraft());
  const [confirmingMoveBackToListed, setConfirmingMoveBackToListed] = useState<CardRecord | null>(null);
  const [listingCard, setListingCard] = useState<CardRecord | null>(null);
  const [editingCard, setEditingCard] = useState<CardRecord | null>(null);
  const [deletingCard, setDeletingCard] = useState<CardRecord | null>(null);
  const [inlineCostDrafts, setInlineCostDrafts] = useState<Record<string, string>>({});
  const [confirmingClearListing, setConfirmingClearListing] = useState<CardRecord | null>(null);
  const [enlargedPhotoCard, setEnlargedPhotoCard] = useState<CardRecord | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<ExpenseRecord | null>(null);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [selectedGradingQuantities, setSelectedGradingQuantities] = useState<Record<string, number>>({});
  const [gradingDraft, setGradingDraft] = useState<GradingSubmission>(emptyGradingSubmission());
  const [showGradingForm, setShowGradingForm] = useState(false);
  const [openGradingSubmissionId, setOpenGradingSubmissionId] = useState<string | null>(null);
  const [returningSubmission, setReturningSubmission] = useState<GradingSubmission | null>(null);
  const [returnDate, setReturnDate] = useState(todayIso());
  const [returnGradeRows, setReturnGradeRows] = useState<ReturnGradeRow[]>([]);
  const [deletingGradingSubmission, setDeletingGradingSubmission] = useState<GradingSubmission | null>(null);
  const [importPreviews, setImportPreviews] = useState<ImportCardPreview[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [importingCards, setImportingCards] = useState(false);
  const [postingToPrimeLot, setPostingToPrimeLot] = useState(false);
  const [primeLotConnection, setPrimeLotConnection] = useState<PrimeLotConnectionState>({ connected: false, status: "none", sellerEmail: "", storeSlug: "", storeUrl: "", requestedIntent: "" });
  const [primeLotDetailsOpen, setPrimeLotDetailsOpen] = useState(false);
  const [primeLotModalOpen, setPrimeLotModalOpen] = useState(false);
  const [primeLotReviewOpen, setPrimeLotReviewOpen] = useState(false);
  const [primeLotReviewDrafts, setPrimeLotReviewDrafts] = useState<Record<string, { askingPrice: string; shippingCharge: string; gradingCompany: string; listingType: PrimeLotListingType | "" }>>({});
  const [primeLotReviewErrors, setPrimeLotReviewErrors] = useState<Record<string, Partial<Record<"askingPrice" | "listingType" | "gradingCompany", string>>>>({});
  const [primeLotReviewError, setPrimeLotReviewError] = useState("");
  const [primeLotPostResult, setPrimeLotPostResult] = useState<PrimeLotPostResult | null>(null);
  const [primeLotMembershipRequiredOpen, setPrimeLotMembershipRequiredOpen] = useState(false);
  const [primeLotIntent, setPrimeLotIntent] = useState<"create" | "connect">("create");
  const [primeLotEmail, setPrimeLotEmail] = useState("");
  const [primeLotStoreSlug, setPrimeLotStoreSlug] = useState("");
  const [savingPrimeLotConnection, setSavingPrimeLotConnection] = useState(false);
  const [handledPrimeLotConnectIntent, setHandledPrimeLotConnectIntent] = useState(false);
  const [tab, setTab] = useState<Tab>("add");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CardStatus | "All">("Not Listed");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [platformFilter, setPlatformFilter] = useState("All");
  const [photoFilter, setPhotoFilter] = useState<PhotoFilter>("All");
  const [listingUrlFilter, setListingUrlFilter] = useState<ListingUrlFilter>("All");
  const [inventoryDateField, setInventoryDateField] = useState<InventoryDateField>("purchaseDate");
  const [inventoryStartDate, setInventoryStartDate] = useState("");
  const [inventoryEndDate, setInventoryEndDate] = useState("");
  const [inventorySort, setInventorySort] = useState<InventorySort>("newest-purchase");
  const [inventoryFiltersOpen, setInventoryFiltersOpen] = useState(false);
  const [activeListingReviewBucket, setActiveListingReviewBucket] = useState<ListingReviewBucket | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [appUpdateAvailable, setAppUpdateAvailable] = useState(false);
  const [appUpdateVersion, setAppUpdateVersion] = useState("");
  const [showAddInventoryCheck, setShowAddInventoryCheck] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [topSoldMode, setTopSoldMode] = useState<"all" | "month">("all");
  const [topSoldMonth, setTopSoldMonth] = useState(todayIso().slice(0, 7));

  const usingSupabase = Boolean(isSupabaseConfigured && supabase);
  const appVersionRef = useRef("");
  const appVersionStorageKey = "wicked-card-tracker-app-version";
  const isSignedIn = Boolean(session?.user.id);
  // Stripe subscription status is not connected yet. Keep this false until the Stripe customer/subscription record is wired to the logged-in account.
  const hasActiveSubscription = false;
  const subscriptionStatusLabel = hasActiveSubscription ? "Subscribed" : isSignedIn ? "Account active" : "Create an account to start";
  const accountActionPath = hasActiveSubscription ? BILLING_PATH : PRICING_PATH;
  const accountActionLabel = hasActiveSubscription ? "Billing" : "Pricing";
  const currentUsername = session?.user.email || "Guest trial";
  const primeLotButtonLabel = primeLotConnection.connected ? "Post on PrimeLot" : primeLotConnection.status === "pending" ? "PrimeLot pending" : "Sell on PrimeLot";

  const loadPrimeLotConnection = async (accessToken = session?.access_token) => {
    if (!accessToken) return;
    try {
      const response = await fetch("/api/primelot/connection", { headers: { Authorization: `Bearer ${accessToken}` } });
      const result: PrimeLotConnectionState & { error?: string } = await response.json();
      if (response.ok) {
        setPrimeLotConnection(result);
        if (result.sellerEmail) setPrimeLotEmail(result.sellerEmail);
        if (result.storeSlug) setPrimeLotStoreSlug(result.storeSlug);
      }
    } catch {
      // Keep inventory usable if the PrimeLot connection check is unavailable.
    }
  };

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    let stopped = false;
    const checkAppVersion = async () => {
      try {
        const response = await fetch("/api/version", { cache: "no-store" });
        if (!response.ok) return;
        const result: { version?: string } = await response.json();
        const nextVersion = String(result.version || "").trim();
        if (!nextVersion || stopped) return;
        const acknowledgedVersion = window.localStorage.getItem(appVersionStorageKey) || "";
        const currentVersion = appVersionRef.current || acknowledgedVersion;
        if (!currentVersion) {
          appVersionRef.current = nextVersion;
          window.localStorage.setItem(appVersionStorageKey, nextVersion);
          return;
        }
        appVersionRef.current = currentVersion;
        if (currentVersion !== nextVersion) {
          setAppUpdateVersion(nextVersion);
          setAppUpdateAvailable(true);
        }
      } catch {
        // Keep the app usable if the version check cannot be reached.
      }
    };
    checkAppVersion();
    const interval = window.setInterval(checkAppVersion, 15_000);
    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") checkAppVersion();
    };
    window.addEventListener("focus", checkAppVersion);
    document.addEventListener("visibilitychange", checkWhenVisible);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", checkAppVersion);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, []);

  const refreshToLatestApp = () => {
    if (appUpdateVersion) window.localStorage.setItem(appVersionStorageKey, appUpdateVersion);
    window.location.reload();
  };

  useEffect(() => {
    if (!showAddInventoryCheck) return;
    const timer = window.setTimeout(() => setShowAddInventoryCheck(false), 1000);
    return () => window.clearTimeout(timer);
  }, [showAddInventoryCheck]);

  useEffect(() => {
    if (!enlargedPhotoCard) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEnlargedPhotoCard(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [enlargedPhotoCard]);

  const loadSupabaseData = async (userId: string) => {
    if (!supabase) return;
    setError("");
    setDataLoaded(false);

    try {
      // Privacy-first loading: only load records owned by the logged-in user.
      // A previous shared-workspace setup intentionally allowed two emails to see one
      // workspace, but that made test/other-account data appear in the wrong account.
      // Keep workspaceId null until an explicit, visible team-sharing flow is added.
      setWorkspaceId(null);

      const [userCardsResult, userExpensesResult, userCashResult, userGradingResult] = await Promise.all([
        supabase.from("cards").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("expenses").select("*").eq("user_id", userId).order("expense_date", { ascending: false }),
        supabase.from("cash_adjustments").select("*").eq("user_id", userId).order("adjustment_date", { ascending: false }),
        supabase.from("grading_submissions").select("*").eq("user_id", userId).order("sent_date", { ascending: false }),
      ]);

      const cachedCards = localCards();
      const cachedCardsById = new Map(cachedCards.map((card) => [card.id, card]));
      if (userCardsResult.error) setError(userCardsResult.error.message);
      else setCards((userCardsResult.data ?? []).map((row) => rowToCardWithQuantityFallback(row, cachedCardsById.get(row.id))));

      if (userExpensesResult.error) setError(`Expenses table needs setup: ${userExpensesResult.error.message}`);
      else setExpenses((userExpensesResult.data ?? []).map(rowToExpense));

      const cashErrorMessage = userCashResult.error?.message || "";
      if (userCashResult.error && !isMissingCashAdjustmentsTable(cashErrorMessage)) setError(`Cash adjustments need setup: ${cashErrorMessage}`);
      setCashAdjustments(userCashResult.data?.length ? (userCashResult.data ?? []).map(rowToCashAdjustment) : []);

      const gradingResult = {
        data: userGradingResult.data ?? [],
        error: userGradingResult.error ?? null,
      };

      if (gradingResult.error) {
        setGradingSubmissions([]);
      } else {
        const submissionIds = (gradingResult.data ?? []).map((submission) => submission.id);
        let linkResult: GradingLinkQueryResult = submissionIds.length
          ? await supabase.from("grading_submission_cards").select("submission_id, card_id, quantity_sent").in("submission_id", submissionIds)
          : { data: [], error: null };
        if (linkResult.error && isQuantityColumnError(linkResult.error.message)) {
          linkResult = submissionIds.length
            ? await supabase.from("grading_submission_cards").select("submission_id, card_id").in("submission_id", submissionIds)
            : { data: [], error: null };
        }
        if (linkResult.error) setGradingSubmissions((gradingResult.data ?? []).map((row) => rowToGradingSubmission(row)));
        else setGradingSubmissions((gradingResult.data ?? []).map((row) => rowToGradingSubmission(row, linkResult.data ?? [])));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load your account data. Please refresh and try again.");
    } finally {
      setDataLoaded(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!usingSupabase || !supabase) {
      setWorkspaceId(null);
      const storedCards = localCards();
      setCards(storedCards.length ? storedCards : sampleCards());
      setExpenses(localExpenses());
      setCashAdjustments(localCashAdjustments());
      setGradingSubmissions(localGradingSubmissions());
      setDataLoaded(true);
      setLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        if (data.session?.user.id) {
          void loadSupabaseData(data.session.user.id);
          void loadPrimeLotConnection(data.session.access_token);
        } else {
          clearLegacyLocalAccountCache();
          setCards(localGuestCards());
          setExpenses(localGuestExpenses());
          setCashAdjustments(localGuestCashAdjustments());
          setGradingSubmissions(localGuestGradingSubmissions());
          setDataLoaded(true);
          setLoading(false);
        }
      })
      .catch((sessionError) => {
        setError(sessionError instanceof Error ? sessionError.message : "Could not restore your login. Please sign in again.");
        setDataLoaded(true);
        setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecoveryMode(true);
      setSession(nextSession);
      if (nextSession?.user.id) {
        setDataLoaded(false);
        void loadSupabaseData(nextSession.user.id);
        void loadPrimeLotConnection(nextSession.access_token);
      } else {
        setWorkspaceId(null);
        setPrimeLotConnection({ connected: false, status: "none", sellerEmail: "", storeSlug: "", storeUrl: "", requestedIntent: "" });
        clearLegacyLocalAccountCache();
        setCards(localGuestCards());
        setExpenses(localGuestExpenses());
        setCashAdjustments(localGuestCashAdjustments());
        setGradingSubmissions(localGuestGradingSubmissions());
        setDataLoaded(true);
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [usingSupabase]);

  useEffect(() => {
    if (!session || !dataLoaded || handledPrimeLotConnectIntent || !hasPrimeLotConnectIntent()) return;
    setHandledPrimeLotConnectIntent(true);
    setTab("add");
    setPrimeLotIntent("connect");
    setPrimeLotEmail((current) => current || session.user.email || "");
    setPrimeLotModalOpen(true);
    window.setTimeout(() => document.querySelector(".primeLotStatusCard")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }, [dataLoaded, handledPrimeLotConnectIntent, session]);

  useEffect(() => {
    if (loading || !dataLoaded) return;
    if (!usingSupabase) {
      window.localStorage.setItem(CARD_STORAGE_KEY, JSON.stringify(cards));
      window.localStorage.setItem(GRADING_STORAGE_KEY, JSON.stringify(gradingSubmissions));
      window.localStorage.setItem(CASH_STORAGE_KEY, JSON.stringify(cashAdjustments));
      window.localStorage.setItem(EXPENSE_STORAGE_KEY, JSON.stringify(expenses));
      return;
    }
    if (!isSignedIn) {
      window.localStorage.setItem(GUEST_CARD_STORAGE_KEY, JSON.stringify(cards));
      window.localStorage.setItem(GUEST_GRADING_STORAGE_KEY, JSON.stringify(gradingSubmissions));
      window.localStorage.setItem(GUEST_CASH_STORAGE_KEY, JSON.stringify(cashAdjustments));
      window.localStorage.setItem(GUEST_EXPENSE_STORAGE_KEY, JSON.stringify(expenses));
    }
  }, [cards, cashAdjustments, dataLoaded, expenses, gradingSubmissions, isSignedIn, loading, usingSupabase]);


  useEffect(() => {
    setCashOnboardingDismissed(window.localStorage.getItem(CASH_ONBOARDING_DISMISSED_KEY) === "true");
  }, []);

  useEffect(() => {
    if (session && dataLoaded && !cashAdjustments.length && !dashboardCashEntryAutoOpened) {
      setDashboardCashEntryOpen(true);
      setDashboardCashEntryAutoOpened(true);
    }
  }, [cashAdjustments.length, dashboardCashEntryAutoOpened, dataLoaded, session]);

  const openGradingSubmissions = useMemo(() => gradingSubmissions.filter((submission) => submission.status === "At Grading"), [gradingSubmissions]);
  const activeGradingCardIds = useMemo(() => new Set(openGradingSubmissions.flatMap((submission) => submission.cardIds)), [openGradingSubmissions]);
  const activeInventoryCards = useMemo(() => cards.filter((card) => card.status !== "Sold" && !activeGradingCardIds.has(card.id)), [activeGradingCardIds, cards]);
  const soldInventoryCards = useMemo(() => cards.filter((card) => card.status === "Sold"), [cards]);
  const inventoryCategories = useMemo(() => uniqueSorted(activeInventoryCards.map((card) => card.category)), [activeInventoryCards]);
  const inventoryPlatforms = useMemo(() => uniqueSorted(activeInventoryCards.flatMap((card) => activeListingsForCard(card).map((listing) => listing.platform))), [activeInventoryCards]);
  const filtersAreActive = Boolean(
    query.trim() ||
    categoryFilter !== "All" ||
    platformFilter !== "All" ||
    photoFilter !== "All" ||
    listingUrlFilter !== "All" ||
    inventoryDateField !== "purchaseDate" ||
    inventoryStartDate ||
    inventoryEndDate ||
    inventorySort !== "newest-purchase"
  );

  const clearInventoryFilters = (nextStatus: CardStatus | "All" = "Not Listed") => {
    setQuery("");
    setStatusFilter(nextStatus);
    setCategoryFilter("All");
    setPlatformFilter("All");
    setPhotoFilter("All");
    setListingUrlFilter("All");
    setInventoryDateField("purchaseDate");
    setInventoryStartDate("");
    setInventoryEndDate("");
    setInventorySort("newest-purchase");
  };

  const scrollToSection = (sectionId: string) => {
    window.setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const showDashboardTab = (nextTab: Tab, sectionId: string) => {
    setTab(nextTab);
    scrollToSection(sectionId);
  };

  const applyNeedsAttentionFilter = (groupKey: string) => {
    setQuery("");
    setCategoryFilter("All");
    setPlatformFilter("All");
    setListingUrlFilter("All");
    setInventorySort("newest-purchase");

    if (groupKey === "missing-photos") {
      setStatusFilter("All");
      setPhotoFilter("Missing photo");
      setNotice("Inventory filtered to cards missing photos.");
    } else if (groupKey === "unlisted") {
      setStatusFilter("Not Listed");
      setPhotoFilter("All");
      setNotice("Inventory filtered to bought but not listed cards.");
    }

    setTab("inventory");
    window.setTimeout(() => document.querySelector(".inventoryFilterPanel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const showActiveInventory = () => {
    clearInventoryFilters("Not Listed");
    showDashboardTab("inventory", "inventory-panel");
  };

  const showInventoryMainView = (view: InventoryMainView) => {
    clearSelectedCards();
    clearInventoryFilters(view);
  };

  const showAddInventoryForm = () => {
    showDashboardTab("add", "add-inventory-panel");
  };

  const scrollToDashboardCashEntry = () => {
    setDashboardCashEntryOpen(true);
    scrollToSection("dashboard-cash-entry");
  };

  const dismissCashOnboarding = () => {
    setCashOnboardingDismissed(true);
    window.localStorage.setItem(CASH_ONBOARDING_DISMISSED_KEY, "true");
  };

  const showSoldInventory = () => {
    clearInventoryFilters("Sold");
    showDashboardTab("inventory", "inventory-panel");
  };

  const filteredCards = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inventorySource = statusFilter === "Sold" ? soldInventoryCards : activeInventoryCards;
    const filtered = inventorySource.filter((card) => {
      const matchesStatus = statusFilter === "All" || card.status === statusFilter;
      const matchesCategory = categoryFilter === "All" || card.category === categoryFilter;
      const cardListings = activeListingsForCard(card);
      const matchesPlatform = platformFilter === "All" || cardListings.some((listing) => listing.platform === platformFilter);
      const hasPhoto = Boolean(card.frontPhotoUrl.trim());
      const matchesPhoto = photoFilter === "All" || (photoFilter === "Has photo" ? hasPhoto : !hasPhoto);
      const hasListingUrl = Boolean(card.listingUrl.trim()) || cardListings.some((listing) => listing.url);
      const matchesListingUrl = listingUrlFilter === "All" || (listingUrlFilter === "Has listing URL" ? hasListingUrl : !hasListingUrl);
      const searchableText = [card.name, card.category, card.year, card.setName, card.cardNumber, cleanListingNotes(card.notes), card.listedPlatform, card.listingUrl, card.salePlatform, ...cardListings.map((listing) => `${listing.platform} ${listing.url}`)]
        .join(" ")
        .toLowerCase();
      const matchesQuery = !q || searchableText.includes(q);
      const matchesInventoryDate = !inventoryStartDate && !inventoryEndDate
        ? true
        : dateInRange(cardDateForInventoryFilter(card, inventoryDateField), inventoryStartDate, inventoryEndDate);
      return matchesStatus && matchesCategory && matchesPlatform && matchesPhoto && matchesListingUrl && matchesInventoryDate && matchesQuery;
    });

    return [...filtered].sort((a, b) => {
      switch (inventorySort) {
        case "oldest-purchase":
          return dateValue(a.purchaseDate) - dateValue(b.purchaseDate);
        case "highest-purchase":
          return b.purchasePrice - a.purchasePrice;
        case "lowest-purchase":
          return a.purchasePrice - b.purchasePrice;
        case "highest-sold":
          return cardNetSoldPrice(b) - cardNetSoldPrice(a);
        case "highest-profit":
          return cardProfit(b) - cardProfit(a);
        case "name-az":
          return a.name.localeCompare(b.name);
        case "newest-purchase":
        default:
          return dateValue(b.purchaseDate) - dateValue(a.purchaseDate);
      }
    });
  }, [activeInventoryCards, categoryFilter, inventoryDateField, inventoryEndDate, inventorySort, inventoryStartDate, listingUrlFilter, photoFilter, platformFilter, query, soldInventoryCards, statusFilter]);

  const activeInventoryQuantity = activeInventoryCards.reduce((sum, card) => sum + cardQuantity(card), 0);
  const notListedInventoryCards = useMemo(() => activeInventoryCards.filter((card) => card.status === "Not Listed"), [activeInventoryCards]);
  const listedInventoryCards = useMemo(() => activeInventoryCards.filter((card) => card.status === "Listed"), [activeInventoryCards]);
  const notListedInventoryQuantity = notListedInventoryCards.reduce((sum, card) => sum + cardQuantity(card), 0);
  const listedInventoryQuantity = listedInventoryCards.reduce((sum, card) => sum + cardQuantity(card), 0);
  const soldInventoryQuantity = soldInventoryCards.reduce((sum, card) => sum + cardQuantity(card), 0);
  const filteredInventoryQuantity = filteredCards.reduce((sum, card) => sum + cardQuantity(card), 0);

  const dateRange = useMemo(() => {
    if (dateFilterMode === "month") return { start: currentMonthStart(), end: todayIso() };
    if (dateFilterMode === "year") return { start: currentYearStart(), end: todayIso() };
    if (dateFilterMode === "custom") return { start: customStartDate, end: customEndDate };
    return { start: "", end: "" };
  }, [customEndDate, customStartDate, dateFilterMode]);
  const selectedDateLabel = filterLabel(dateFilterMode, dateRange.start, dateRange.end);
  const isAllTime = dateFilterMode === "all";

  const totals = useMemo(() => {
    const purchasedInRange = (card: CardRecord) => isAllTime || dateInRange(card.purchaseDate, dateRange.start, dateRange.end);
    const soldInRange = (card: CardRecord) => card.status === "Sold" && (isAllTime || dateInRange(card.saleDate, dateRange.start, dateRange.end));
    const expenseInRange = (expense: ExpenseRecord) => isAllTime || dateInRange(expense.expenseDate, dateRange.start, dateRange.end);
    const cashInRange = (entry: CashAdjustmentRecord) => isAllTime || dateInRange(entry.adjustmentDate, dateRange.start, dateRange.end);

    const notListedCards = cards.filter((card) => card.status === "Not Listed" && !activeGradingCardIds.has(card.id) && purchasedInRange(card));
    const listedCards = cards.filter((card) => card.status === "Listed" && !activeGradingCardIds.has(card.id) && purchasedInRange(card));
    const soldCards = cards.filter(soldInRange);
    const inventoryCostCards = cards.filter((card) => !activeGradingCardIds.has(card.id) && purchasedInRange(card));
    const filteredExpenses = expenses.filter(expenseInRange);
    const allSoldCards = cards.filter((card) => card.status === "Sold");
    const allRevenue = allSoldCards.reduce((sum, card) => sum + cardNetSoldPrice(card), 0);
    const allTotalInventoryCost = cards.reduce((sum, card) => sum + cardPurchaseCost(card), 0);
    const allExpensesTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const allCashAdjustmentsTotal = cashAdjustments.reduce((sum, entry) => sum + (entry.adjustmentType === "Cash Removed" ? -entry.amount : entry.amount), 0);
    const revenue = soldCards.reduce((sum, card) => sum + cardNetSoldPrice(card), 0);
    const soldInventoryCost = soldCards.reduce((sum, card) => sum + cardPurchaseCost(card), 0);
    const unlistedInventoryCost = notListedCards.reduce((sum, card) => sum + cardPurchaseCost(card), 0);
    const listedInventoryCost = listedCards.reduce((sum, card) => sum + cardPurchaseCost(card), 0);
    const currentInventoryCost = unlistedInventoryCost + listedInventoryCost;
    const unlistedInventoryValue = unlistedInventoryCost;
    const listedInventoryValue = listedCards.reduce((sum, card) => sum + ((card.askingPrice || card.purchasePrice) * cardQuantity(card)), 0);
    const currentInventoryValue = unlistedInventoryValue + listedInventoryValue;
    const totalInventoryBought = inventoryCostCards.reduce((sum, card) => sum + cardPurchaseCost(card), 0);
    const totalInventoryValue = unlistedInventoryValue + listedInventoryCost;
    const totalInventoryCost = totalInventoryValue;
    const expenseBreakdown = expenseCategories.map((category) => {
      const categoryExpenses = filteredExpenses.filter((expense) => expense.category === category);
      return {
        category,
        total: categoryExpenses.reduce((sum, expense) => sum + expense.amount, 0),
        count: categoryExpenses.length,
      };
    });
    const filteredCashAdjustments = cashAdjustments.filter(cashInRange);
    const cashAdjustmentsTotal = filteredCashAdjustments.reduce((sum, entry) => sum + (entry.adjustmentType === "Cash Removed" ? -entry.amount : entry.amount), 0);
    const expensesTotal = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const saleExpensesForSoldCardsTotal = saleExpensesTotalForCards(expenses, soldCards);
    const periodNetProfit = revenue - soldInventoryCost - expensesTotal;
    const roiCostBasis = soldInventoryCost + expensesTotal;
    const roi = roiCostBasis > 0 ? (periodNetProfit / roiCostBasis) * 100 : 0;
    const soldCardProfit = revenue - soldInventoryCost - saleExpensesForSoldCardsTotal;
    const soldRoiCostBasis = soldInventoryCost + saleExpensesForSoldCardsTotal;
    const soldRoi = soldRoiCostBasis > 0 ? (soldCardProfit / soldRoiCostBasis) * 100 : 0;
    const cash = allCashAdjustmentsTotal + allRevenue - allTotalInventoryCost - allExpensesTotal;
    const profit = periodNetProfit;
    return {
      revenue,
      soldInventoryCost,
      soldCardProfit,
      cash,
      unlistedInventoryCost,
      listedInventoryCost,
      currentInventoryCost,
      unlistedInventoryValue,
      listedInventoryValue,
      currentInventoryValue,
      totalInventoryBought,
      totalInventoryValue,
      totalInventoryCost,
      inventoryCostCards,
      expensesTotal,
      expenseBreakdown,
      saleExpensesForSoldCardsTotal,
      periodNetProfit,
      roi,
      roiCostBasis,
      soldRoi,
      soldRoiCostBasis,
      profit,
      notListedCards,
      listedCards,
      soldCards,
      filteredExpenses,
      filteredCashAdjustments,
      cashAdjustmentsTotal,
      soldCount: soldCards.reduce((sum, card) => sum + cardQuantity(card), 0),
      listedCount: listedCards.reduce((sum, card) => sum + cardQuantity(card), 0),
      notListedCount: notListedCards.reduce((sum, card) => sum + cardQuantity(card), 0),
    };
  }, [activeGradingCardIds, cards, cashAdjustments, dateRange.end, dateRange.start, expenses, isAllTime]);

  const attentionGroups = useMemo<AttentionGroup[]>(() => {
    const cardsMissingPhotos = cards
      .filter((card) => card.status !== "Sold" && !activeGradingCardIds.has(card.id) && !card.frontPhotoUrl.trim())
      .map((card) => ({
        id: `photo-${card.id}`,
        recordId: card.id,
        kind: "card" as const,
        title: card.name || "Unnamed card",
        detail: `${card.status} • ${money(cardPurchaseCost(card))} purchase cost${cardQuantity(card) > 1 ? ` • Qty ${cardQuantity(card)}` : ""}`,
        action: "Edit card and add a front photo",
        card,
      }));

    const unlistedCards = cards
      .filter((card) => card.status === "Not Listed" && !activeGradingCardIds.has(card.id))
      .map((card) => ({
        id: `unlisted-${card.id}`,
        recordId: card.id,
        kind: "card" as const,
        title: card.name || "Unnamed card",
        detail: [card.category, card.purchaseDate ? `Bought ${card.purchaseDate}` : "No purchase date", money(cardPurchaseCost(card)), cardQuantity(card) > 1 ? `Qty ${cardQuantity(card)}` : ""].filter(Boolean).join(" • "),
        action: "List Card",
        card,
      }));

    return [
      {
        key: "missing-photos",
        title: "Cards without photos",
        count: cardsMissingPhotos.length,
        description: "Add front photos so cards are easier to recognize and list.",
        items: cardsMissingPhotos,
      },
      {
        key: "unlisted",
        title: "Bought but not listed",
        count: unlistedCards.length,
        description: "Inventory that still needs to be listed or moved forward.",
        items: unlistedCards,
      },
    ];
  }, [activeGradingCardIds, cards, expenses]);

  const listingReviewItems = useMemo<ListedReviewItem[]>(() => cards
    .filter((card) => card.status === "Listed" && !activeGradingCardIds.has(card.id))
    .map((card) => ({ card, listings: activeListingsForCard(card) }))
    .filter(({ listings }) => listings.length > 0)
    .map(({ card, listings }) => ({ card, listings, referenceDate: listingReviewReferenceDate(card, listings) }))
    .map(({ card, listings, referenceDate }) => ({ card, listings, referenceDate, age: daysSince(referenceDate) }))
    .filter((item): item is { card: CardRecord; listings: MultiPlatformListing[]; referenceDate: string; age: number } => item.age !== null)
    .map(({ card, listings, referenceDate, age }) => ({ card, listings, referenceDate, age, tone: listingReviewTone(age) }))
    .sort((a, b) => b.age - a.age), [activeGradingCardIds, cards]);
  const listingReviewGroups = {
    current: listingReviewItems.filter((item) => item.tone === "current"),
    warning: listingReviewItems.filter((item) => item.tone === "warning"),
    urgent: listingReviewItems.filter((item) => item.tone === "urgent"),
  };
  const listingReviewCounts = {
    current: listingReviewGroups.current.length,
    warning: listingReviewGroups.warning.length,
    urgent: listingReviewGroups.urgent.length,
  };
  const listingReviewAskingTotals = {
    current: listingReviewGroups.current.reduce((sum, item) => sum + listingReviewAskingValue(item), 0),
    warning: listingReviewGroups.warning.reduce((sum, item) => sum + listingReviewAskingValue(item), 0),
    urgent: listingReviewGroups.urgent.reduce((sum, item) => sum + listingReviewAskingValue(item), 0),
  };
  const activeListingReviewItems = activeListingReviewBucket === "current" ? listingReviewGroups.current
    : activeListingReviewBucket === "warning" ? listingReviewGroups.warning
    : activeListingReviewBucket === "urgent" ? listingReviewGroups.urgent
    : activeListingReviewBucket === "all" ? listingReviewItems
    : [];
  const activeListingReviewLabel = activeListingReviewBucket === "current" ? "Current listings (0–30 days)"
    : activeListingReviewBucket === "warning" ? "Review soon (30–60 days)"
    : activeListingReviewBucket === "urgent" ? "Urgent review (60+ days)"
    : activeListingReviewBucket === "all" ? "Total listed asking"
    : "";

  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const gradingSubmissionQuantity = (submission: GradingSubmission, card: CardRecord) => {
    const linkedQuantity = Math.max(1, Math.floor(Number(submission.cardQuantities[card.id]) || 1));
    const inventoryQuantity = cardQuantity(card);
    return submission.status === "At Grading" && inventoryQuantity > 1 ? Math.max(linkedQuantity, inventoryQuantity) : Math.max(1, Math.min(inventoryQuantity, linkedQuantity));
  };
  const gradingSubmissionCards = (submission: GradingSubmission) => submission.cardIds.map((cardId) => cardById.get(cardId)).filter((card): card is CardRecord => Boolean(card));
  const gradingSubmissionCardCopies = (submission: GradingSubmission) => gradingSubmissionCards(submission).flatMap((card) => {
    const quantity = gradingSubmissionQuantity(submission, card);
    return Array.from({ length: quantity }, (_, index) => ({ card, copyNumber: index + 1, totalCopies: quantity, key: `${card.id}-${index}` }));
  });
  const gradingSubmissionCardQuantity = (submission: GradingSubmission) => gradingSubmissionCardCopies(submission).length;
  const gradingPurchaseValue = (submission: GradingSubmission) => gradingSubmissionCardCopies(submission).reduce((sum, { card }) => sum + card.purchasePrice, 0);
  const activeGradingSubmissionForCard = (cardId: string) => openGradingSubmissions.find((submission) => submission.cardIds.includes(cardId)) || null;
  const openGradingCardCount = openGradingSubmissions.reduce((sum, submission) => sum + gradingSubmissionCardQuantity(submission), 0);
  const openGradingPurchaseValue = openGradingSubmissions.reduce((sum, submission) => sum + gradingPurchaseValue(submission), 0);
  const selectedCards = selectedCardIds
    .map((cardId) => cardById.get(cardId))
    .filter((card): card is CardRecord => Boolean(card))
    .filter((card) => card.status !== "Sold");
  const alreadyOnPrimeLot = (card: CardRecord) => Boolean(primeLotListingForCard(card));
  const canPostCardToPrimeLot = (card: CardRecord) => card.status !== "Sold" && !alreadyOnPrimeLot(card);
  const selectedPrimeLotCards = selectedCards.filter(canPostCardToPrimeLot);
  const selectedQuantityForCard = (card: CardRecord) => Math.max(1, Math.min(cardQuantity(card), Math.floor(Number(selectedGradingQuantities[card.id]) || cardQuantity(card))));
  const selectedCardQuantity = selectedCards.reduce((sum, card) => sum + selectedQuantityForCard(card), 0);
  const selectedPurchaseValue = selectedCards.reduce((sum, card) => sum + (card.purchasePrice * selectedQuantityForCard(card)), 0);
  const selectedImportPreviews = importPreviews.filter((preview) => preview.selected);
  const importReadyCount = selectedImportPreviews.length;
  const importWarningCount = importPreviews.filter((preview) => preview.warnings.length).length;
  const inventoryExpenseTotal = inventoryExpenseDraftTotal(inventoryExpenseDraft);
  const saleExpenseTotal = saleExpenseDraftTotal(saleExpenseDraft);
  const sellingQuantity = sellingCard ? cardQuantity(sellingCard) : 1;
  const sellingUnitPrice = sellingCard ? sellingCard.soldPrice / sellingQuantity : 0;
  const sellingShippingUnitPrice = sellingCard ? (sellingCard.shippingCharge || 0) / sellingQuantity : 0;
  const sellingSaleLabel = sellingQuantity > 1 ? `Card sale (${money(sellingUnitPrice)} per card)` : "Card sale";
  const sellingShippingLabel = sellingQuantity > 1 ? `Buyer shipping collected (${money(sellingShippingUnitPrice)} per card)` : "Buyer shipping collected";
  const sellingCollectedTotal = sellingCard ? cardNetSoldPrice(sellingCard) : 0;
  const sellingPurchaseCost = sellingCard ? cardPurchaseCost(sellingCard) : 0;
  const sellingTotalCost = sellingPurchaseCost + saleExpenseTotal;
  const sellingNetAfterExpenses = sellingCollectedTotal - sellingTotalCost;
  const activeInventoryDisplayPrice = (card: CardRecord) => card.status === "Listed" ? card.askingPrice : (Number(card.askingPrice || 0) > 0 ? card.askingPrice : card.purchasePrice);
  const activeInventoryPriceLabel = (card: CardRecord) => {
    if (card.status === "Listed" || Number(card.askingPrice || 0) > 0) return `asking${cardQuantity(card) > 1 ? ` each • Qty ${cardQuantity(card)}` : ""} • cost ${money(card.purchasePrice)}`;
    return cardQuantity(card) > 1 ? `cost each • Qty ${cardQuantity(card)}` : "cost each";
  };
  const inlineCostValue = (card: CardRecord) => inlineCostDrafts[card.id] ?? String(Number(card.purchasePrice || 0));
  const inventoryExpenseRowsForCard = (card: CardRecord): ExpenseRecord[] => {
    const now = new Date().toISOString();
    const expenseDate = card.purchaseDate || todayIso();
    const rows: Array<{ category: ExpenseCategory; amount: number }> = [
      { category: "Shipping", amount: inventoryExpenseAmount(inventoryExpenseDraft.shipping) },
      { category: "HST", amount: inventoryExpenseAmount(inventoryExpenseDraft.hst) },
      { category: "Duties", amount: inventoryExpenseAmount(inventoryExpenseDraft.duties) },
    ];
    return rows.filter((row) => row.amount > 0).map((row) => ({
      ...emptyExpense(),
      id: crypto.randomUUID(),
      workspaceId: workspaceId || undefined,
      category: row.category,
      amount: row.amount,
      expenseDate,
      vendor: "",
      description: `Inventory add: ${card.name}`,
      createdAt: now,
      createdBy: currentUsername,
      updatedAt: now,
      updatedBy: currentUsername,
    }));
  };
  const saleExpenseRowsForCard = (card: CardRecord): ExpenseRecord[] => {
    const now = new Date().toISOString();
    const expenseDate = card.saleDate || todayIso();
    const rows: Array<{ category: ExpenseCategory; amount: number }> = [
      { category: "HST", amount: expenseDraftAmount(saleExpenseDraft.hst) },
      { category: "Marketplace Fees", amount: expenseDraftAmount(saleExpenseDraft.fees) },
      { category: "Shipping", amount: expenseDraftAmount(saleExpenseDraft.shippingLabel) },
    ];
    return rows.filter((row) => row.amount > 0).map((row) => ({
      ...emptyExpense(),
      id: crypto.randomUUID(),
      workspaceId: workspaceId || undefined,
      category: row.category,
      amount: row.amount,
      expenseDate,
      vendor: card.salePlatform || "Sale",
      description: saleExpenseDescriptionForCard(row.category, card),
      createdAt: now,
      createdBy: currentUsername,
      updatedAt: now,
      updatedBy: currentUsername,
    }));
  };
  const saleExpenseDraftFromCard = (card: CardRecord): SaleExpenseDraft => {
    const matchedExpenses = expenses.filter((expense) => isSaleExpenseForCard(expense, card));
    return {
      hst: String(matchedExpenses.filter((expense) => expense.category === "HST").reduce((sum, expense) => sum + expense.amount, 0) || ""),
      fees: String(matchedExpenses.filter((expense) => expense.category === "Marketplace Fees").reduce((sum, expense) => sum + expense.amount, 0) || ""),
      shippingLabel: String(matchedExpenses.filter((expense) => expense.category === "Shipping").reduce((sum, expense) => sum + expense.amount, 0) || ""),
    };
  };
  const normalizeSaleExpenseForCard = (expense: ExpenseRecord, card: CardRecord): ExpenseRecord => ({
    ...expense,
    category: saleExpenseCategories.includes(expense.category) ? expense.category : "Other",
    expenseDate: card.saleDate || expense.expenseDate || todayIso(),
    vendor: card.salePlatform || "Sale",
    description: saleExpenseDescriptionForCard(saleExpenseCategories.includes(expense.category) ? expense.category : "Other", card),
  });
  const isSoldInventoryView = statusFilter === "Sold";
  const activeInventoryMainView: InventoryMainView = statusFilter === "Listed" ? "Listed" : "Not Listed";
  const saleExpenseTotalForCard = (card: CardRecord) => expenses.filter((expense) => isSaleExpenseForCard(expense, card)).reduce((sum, expense) => sum + expense.amount, 0);
  const gradingFeeTotalForCard = (card: CardRecord) => expenses.filter((expense) => isGradingExpenseForCard(expense, card)).reduce((sum, expense) => sum + expense.amount, 0);
  const totalCostBasisForCard = (card: CardRecord) => cardPurchaseCost(card) + gradingFeeTotalForCard(card);
  const totalProfitForCard = (card: CardRecord) => cardNetSoldPrice(card) - totalCostBasisForCard(card) - saleExpenseTotalForCard(card);
  const cardRoiAfterSaleExpenses = (card: CardRecord) => {
    const purchaseCost = cardPurchaseCost(card) + gradingFeeTotalForCard(card);
    if (!purchaseCost) return 0;
    return (totalProfitForCard(card) / purchaseCost) * 100;
  };
  const soldViewRevenue = isSoldInventoryView ? filteredCards.reduce((sum, card) => sum + cardNetSoldPrice(card), 0) : 0;
  const soldViewCost = isSoldInventoryView ? filteredCards.reduce((sum, card) => sum + cardPurchaseCost(card), 0) : 0;
  const soldViewGradingFees = isSoldInventoryView ? gradingFeesTotalForCards(expenses, filteredCards) : 0;
  const soldViewSaleExpenses = isSoldInventoryView ? saleExpensesTotalForCards(expenses, filteredCards) : 0;
  const soldViewProfit = soldViewRevenue - soldViewCost - soldViewGradingFees - soldViewSaleExpenses;
  const soldViewRoiCostBasis = soldViewCost + soldViewGradingFees;
  const soldViewRoiPercent = soldViewRoiCostBasis > 0 ? (soldViewProfit / soldViewRoiCostBasis) * 100 : 0;

  useEffect(() => {
    if (!isSoldInventoryView) return;
    setSelectedCardIds([]);
  }, [isSoldInventoryView]);

  const totalAttentionItems = attentionGroups.reduce((sum, group) => sum + group.count, 0);
  const listedReviewTotal = listingReviewCounts.warning + listingReviewCounts.urgent;
  const listedValue = totals.listedInventoryValue;
  const topSoldCandidates = useMemo(() => {
    const soldCards = cards.filter((card) => card.status === "Sold" && card.soldPrice > 0);
    if (topSoldMode === "month") return soldCards.filter((card) => card.saleDate.startsWith(topSoldMonth));
    return soldCards;
  }, [cards, topSoldMode, topSoldMonth]);
  const mostExpensiveSoldCard = topSoldCandidates.reduce<CardRecord | null>((best, card) => {
    if (!best) return card;
    return card.soldPrice > best.soldPrice ? card : best;
  }, null);
  const topSoldPeriodLabel = topSoldMode === "month" && topSoldMonth ? formatDateLabel(`${topSoldMonth}-01`).replace(/ 1,/, "") : "All time";
  const roiTrendPoints = useMemo(() => {
    const buckets = new Map<string, { cost: number; expenses: number; profit: number; soldCount: number }>();
    cards
      .filter((card) => card.status === "Sold" && card.saleDate && (isAllTime || dateInRange(card.saleDate, dateRange.start, dateRange.end)))
      .forEach((card) => {
        const key = roiBucketKey(card.saleDate, dateFilterMode, dateRange.start, dateRange.end);
        const current = buckets.get(key) || { cost: 0, expenses: 0, profit: 0, soldCount: 0 };
        current.cost += cardPurchaseCost(card);
        current.profit += cardNetSoldPrice(card) - cardPurchaseCost(card);
        current.soldCount += cardQuantity(card);
        buckets.set(key, current);
      });
    expenses
      .filter((expense) => expense.expenseDate && (isAllTime || dateInRange(expense.expenseDate, dateRange.start, dateRange.end)))
      .forEach((expense) => {
        const key = roiBucketKey(expense.expenseDate, dateFilterMode, dateRange.start, dateRange.end);
        const current = buckets.get(key) || { cost: 0, expenses: 0, profit: 0, soldCount: 0 };
        current.expenses += expense.amount;
        current.profit -= expense.amount;
        buckets.set(key, current);
      });
    return Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, bucket]) => {
      const costBasis = bucket.cost + bucket.expenses;
      return {
        key,
        label: roiBucketLabel(key),
        roi: costBasis > 0 ? (bucket.profit / costBasis) * 100 : 0,
        profit: bucket.profit,
        cost: costBasis,
        soldCount: bucket.soldCount,
      };
    }).filter((point) => point.soldCount > 0);
  }, [cards, dateFilterMode, dateRange.end, dateRange.start, expenses, isAllTime]);
  const roiTrendValues = roiTrendPoints.map((point) => point.roi);
  const roiTrendMin = roiTrendValues.length ? Math.min(...roiTrendValues) : 0;
  const roiTrendMax = roiTrendValues.length ? Math.max(...roiTrendValues) : 0;
  const roiTrendRange = roiTrendMax === roiTrendMin ? 1 : roiTrendMax - roiTrendMin;
  const roiTrendPath = roiTrendPoints.map((point, index) => {
    const x = roiTrendPoints.length === 1 ? 50 : (index / (roiTrendPoints.length - 1)) * 100;
    const y = 90 - ((point.roi - roiTrendMin) / roiTrendRange) * 70;
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
  const dashboardActions: DashboardAction[] = [
    {
      id: "add",
      tab: "add",
      label: !session ? "Create account" : "Add Inventory",
      subtitle: !session ? "Sign in to add inventory" : "Add cards to your tracker",
      apply: !session ? () => scrollToSection("account-login") : showAddInventoryForm,
    },
    { id: "inventory", tab: "inventory", label: "Inventory", subtitle: `${activeInventoryQuantity} cards`, apply: showActiveInventory },
    { id: "glance", tab: "glance", label: "Business Numbers", subtitle: money(totals.cash), apply: () => showDashboardTab("glance", "at-a-glance-panel") },
    { id: "roi", tab: "roi", label: "ROI%", subtitle: percent(totals.roi), apply: () => showDashboardTab("roi", "roi-panel") },
    { id: "attention", tab: "attention", label: "Needs Attention", subtitle: "Fix next actions", badge: totalAttentionItems, apply: () => showDashboardTab("attention", "attention-panel") },
    { id: "listingReview", tab: "listingReview", label: "Listing Review", subtitle: "Listed-card age", badge: listedReviewTotal, apply: () => showDashboardTab("listingReview", "listing-review-panel") },
    { id: "grading", tab: "grading", label: "Grading", subtitle: "Open submissions", badge: openGradingCardCount, apply: () => showDashboardTab("grading", "grading-panel") },
    { id: "expenses", tab: "expenses", label: "Expenses", subtitle: money(totals.expensesTotal), apply: () => showDashboardTab("expenses", "expenses-panel") },
    { id: "soldInventory", tab: "inventory", label: "Sold Inventory", subtitle: `${soldInventoryQuantity} cards sold`, apply: showSoldInventory },
    { id: "primeLotMarketplace", tab: "primeLotMarketplace", label: "PrimeLot Marketplace", subtitle: "No seller fees", className: "primeLotNavButton", apply: () => showDashboardTab("primeLotMarketplace", "primelot-marketplace-panel") },
    { id: "pricing", tab: "add", label: "Pricing", subtitle: "Plans & free month", apply: () => { window.location.href = PRICING_PATH; } },
  ];
  const showInventoryUtilityPanels = tab === "add" || (tab === "inventory" && statusFilter !== "Sold");
  const runDashboardAction = (action: DashboardAction) => {
    if (action.apply) {
      action.apply();
    } else {
      setTab(action.tab);
    }
    setMobileQuickActionsOpen(false);
  };

  const openAttentionItem = (item: AttentionItem) => {
    if (item.kind === "card") {
      const card = cards.find((entry) => entry.id === item.recordId);
      if (card) setEditingCard(card);
      return;
    }

    const expense = expenses.find((entry) => entry.id === item.recordId);
    if (expense) {
      setActiveExpense(expense);
      setEditingExpenseId(expense.id);
      setTab("expenses");
      window.setTimeout(() => document.getElementById("expense-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    }
  };

  const openGradingSubmissionFromInventory = (submissionId: string) => {
    setTab("grading");
    setOpenGradingSubmissionId(submissionId);
    scrollToSection("grading-panel");
  };

  const uploadCardPhoto = async (file: File, target: "active" | "editing" = "active", side: "front" | "back" = "front") => {
    setError("");
    setNotice("");
    setPhotoUploading(true);
    const photoField = side === "front" ? "frontPhotoUrl" : "backPhotoUrl";
    const sideLabel = side === "front" ? "Front" : "Back";

    const applyPhoto = (url: string) => {
      if (target === "editing") setEditingCard((card) => (card ? { ...card, [photoField]: url } : card));
      else setActiveCard((card) => ({ ...card, [photoField]: url }));
    };

    try {
      const uploadFile = await normalizePhotoFile(file);

      if (usingSupabase && supabase && session?.user.id) {
        const path = `${session.user.id}/${side}-${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage.from("card-photos").upload(path, uploadFile, {
          cacheControl: "3600",
          contentType: uploadFile.type,
          upsert: false,
        });

        if (uploadError) {
          setError(`Photo upload failed. Make sure the card-photos storage SQL has been run. ${uploadError.message}`);
          return;
        }

        const { data } = supabase.storage.from("card-photos").getPublicUrl(path);
        applyPhoto(data.publicUrl);
        setNotice(`${sideLabel} photo uploaded.`);
      } else {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(uploadFile);
        });
        applyPhoto(dataUrl);
        setNotice(`${sideLabel} photo added locally.`);
      }
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : "Photo upload failed. Try taking the photo again.");
    } finally {
      setPhotoUploading(false);
    }
  };

  const validateCardBusinessRules = (card: CardRecord) => {
    if (card.grade.trim() && !card.gradingCompany.trim()) return "Choose the grading company when entering a grade.";
    if (card.status === "Listed" && !(Number(card.askingPrice) > 0)) return "Add an asking price before marking this card as Listed.";
    if (card.status === "Listed" && !card.listedDate) return "Add a listed date before marking this card as Listed.";
    if (card.status === "Sold") {
      if (!(Number(card.soldPrice) > 0)) return "Add the sold price before marking this card as Sold.";
      if (!card.saleDate) return "Add the sale date before marking this card as Sold.";
      if (!card.salePlatform.trim()) return "Add where the card sold before marking it as Sold.";
    }
    return "";
  };

  const validateExpenseBusinessRules = (expense: ExpenseRecord) => {
    if (!expense.category) return "Choose an expense type before saving.";
    if (!(Number(expense.amount) > 0)) return "Add an expense amount before saving.";
    if (!expense.expenseDate) return "Add an expense date before saving.";
    if (!expense.vendor.trim() && !expense.description.trim()) return "Add a vendor/source or description before saving the expense.";
    return "";
  };

  const validateCashAdjustmentBusinessRules = (entry: CashAdjustmentRecord) => {
    if (!(Number(entry.amount) > 0)) return "Add a cash amount before saving.";
    if (!entry.adjustmentDate) return "Add the cash date before saving.";
    if (!entry.description.trim()) return "Add a short note so you know why cash changed.";
    return "";
  };
  const cashAdjustmentSignedAmount = (entry: Pick<CashAdjustmentRecord, "adjustmentType" | "amount">) => entry.adjustmentType === "Cash Removed" ? -entry.amount : entry.amount;
  const cashSuccessActionLabel = (type: CashAdjustmentRecord["adjustmentType"]) => type === "Cash Removed" ? "removed cash" : type === "Starting Cash" ? "set starting cash" : "added cash";
  const cashSuccessTitle = (type: CashAdjustmentRecord["adjustmentType"]) => `You've successfully ${cashSuccessActionLabel(type)}.`;


  const handleCardImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setNotice("");
    setImportFileName(file.name);

    try {
      const text = await file.text();
      const parsedRows = psaCsvLooksLikeOrderExport(text)
        ? parsePsaOrderCsv(text)
        : parseCsvText(text)
          .map((row, index) => importCardFromCsvRow(row, index + 2))
          .filter((preview): preview is ImportCardPreview => Boolean(preview));
      setImportPreviews(parsedRows);
      if (!parsedRows.length) setError("No card rows found in that CSV. Make sure the first row has column headers.");
      else setNotice(`Previewed ${parsedRows.length} cards from ${file.name}. Review them, then import selected.`);
    } catch (importError) {
      setImportPreviews([]);
      setError(importError instanceof Error ? importError.message : "Could not read that CSV file.");
    } finally {
      event.target.value = "";
    }
  };

  const toggleImportPreview = (id: string) => {
    setImportPreviews((current) => current.map((preview) => preview.id === id ? { ...preview, selected: !preview.selected } : preview));
  };
  const selectAllImportPreviews = () => setImportPreviews((current) => current.map((preview) => ({ ...preview, selected: true })));
  const selectCleanImportPreviews = () => setImportPreviews((current) => current.map((preview) => ({ ...preview, selected: preview.warnings.length === 0 })));
  const clearImportPreviews = () => {
    setImportPreviews([]);
    setImportFileName("");
  };

  const importSelectedCards = async () => {
    if (!selectedImportPreviews.length) {
      setError("Select at least one card from the import preview before importing.");
      return;
    }
    setError("");
    setNotice("");
    setImportingCards(true);
    const now = new Date().toISOString();
    const cardsToImport = selectedImportPreviews.map(({ card }) => ({
      ...card,
      id: crypto.randomUUID(),
      createdAt: now,
      createdBy: currentUsername,
      updatedAt: now,
      updatedBy: currentUsername,
      listedAt: card.status === "Listed" ? card.listedAt || now : card.listedAt,
      listedBy: card.status === "Listed" ? card.listedBy || currentUsername : card.listedBy,
      soldAt: card.status === "Sold" ? card.soldAt || now : card.soldAt,
      soldBy: card.status === "Sold" ? card.soldBy || currentUsername : card.soldBy,
    }));

    try {
      if (usingSupabase && supabase && session?.user.id) {
        let insertResult = await supabase
          .from("cards")
          .insert(cardsToImport.map((card) => cardToInsert(card, session.user.id, workspaceId)))
          .select("*");
        if (insertResult.error && isBackPhotoColumnError(insertResult.error.message)) {
          insertResult = await supabase
            .from("cards")
            .insert(cardsToImport.map((card) => cardToInsert(card, session.user.id, workspaceId, true, true, true, true, false)))
            .select("*");
          if (!insertResult.error) setNotice("Inventory imported. Run the back-photo SQL migration so back photos save to account storage.");
        }
        if (insertResult.error && isMarketplaceDetailsColumnError(insertResult.error.message)) {
          insertResult = await supabase
            .from("cards")
            .insert(cardsToImport.map((card) => cardToInsert(card, session.user.id, workspaceId, true, true, true, false)))
            .select("*");
        }
        if (insertResult.error && isQuantityColumnError(insertResult.error.message)) {
          insertResult = await supabase
            .from("cards")
            .insert(cardsToImport.map((card) => cardToInsert(card, session.user.id, workspaceId, true, true, false)))
            .select("*");
          if (!insertResult.error) setNotice("Inventory imported. Run the quantity SQL migration so item quantities save to account storage.");
        }
        if (insertResult.error && isAuditColumnError(insertResult.error.message)) {
          const includeQuantity = !isQuantityColumnError(insertResult.error.message);
          insertResult = await supabase
            .from("cards")
            .insert(cardsToImport.map((card) => cardToInsert(card, session.user.id, workspaceId, true, false, includeQuantity)))
            .select("*");
        }
        if (insertResult.error && isListingPricingColumnError(insertResult.error.message)) {
          const includeQuantity = !isQuantityColumnError(insertResult.error.message);
          insertResult = await supabase
            .from("cards")
            .insert(cardsToImport.map((card) => cardToInsert(card, session.user.id, workspaceId, false, false, includeQuantity)))
            .select("*");
        }
        if (insertResult.error) {
          setError(insertResult.error.message);
          return;
        }
        setCards((current) => [...(insertResult.data ?? []).map((row, index) => rowToCardWithQuantityFallback(row, cardsToImport[index])), ...current]);
      } else {
        setCards((current) => [...cardsToImport, ...current]);
      }
      setNotice(`Imported ${cardsToImport.length} cards${importFileName ? ` from ${importFileName}` : ""}.`);
      clearImportPreviews();
      setTab("inventory");
    } finally {
      setImportingCards(false);
    }
  };

  const insertExpenseRecords = async (records: ExpenseRecord[]) => {
    if (!records.length) return [];
    if (usingSupabase && supabase && session?.user.id) {
      let insertResult = await supabase
        .from("expenses")
        .insert(records.map((expense) => expenseToInsert(expense, session.user.id, workspaceId)))
        .select("*");
      if (insertResult.error && isAuditColumnError(insertResult.error.message)) {
        insertResult = await supabase
          .from("expenses")
          .insert(records.map((expense) => expenseToInsert(expense, session.user.id, workspaceId, false)))
          .select("*");
        if (!insertResult.error) setNotice("Record saved. Run the audit SQL migration so expense usernames save to account storage.");
      }
      if (insertResult.error) {
        setError(`The main record saved, but the expense rows did not save: ${insertResult.error.message}`);
        return null;
      }
      const savedRows = (insertResult.data ?? []).map(rowToExpense);
      setExpenses((current) => [...savedRows, ...current]);
      return savedRows;
    }
    setExpenses((current) => [...records, ...current]);
    return records;
  };

  const saveCard = async (event: FormEvent) => {
    event.preventDefault();
    if (!session?.user.id) {
      setError("Create an account first to add inventory.");
      window.setTimeout(() => document.getElementById("account-login")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
      return;
    }
    if (!activeCard.name.trim()) return;
    setError("");
    setNotice("");

    const now = new Date().toISOString();
    const preparedCard = activeCard.status === "Listed" || activeCard.status === "Sold" ? prepareCardForStatus(activeCard, activeCard.status) : activeCard;
    const cardToSave: CardRecord = {
      ...preparedCard,
      gradingCompany: activeCardGradingCompany.trim(),
      grade: cleanGradeLabel(activeCardGrade),
      notes: notesWithGrade(preparedCard.notes, activeCardGrade, activeCardGradingCompany),
      createdBy: preparedCard.createdBy || currentUsername,
      updatedBy: currentUsername,
      listedAt: preparedCard.status === "Listed" ? preparedCard.listedAt || now : preparedCard.listedAt,
      listedBy: preparedCard.status === "Listed" ? preparedCard.listedBy || currentUsername : preparedCard.listedBy,
      soldAt: preparedCard.status === "Sold" ? preparedCard.soldAt || now : preparedCard.soldAt,
      soldBy: preparedCard.status === "Sold" ? preparedCard.soldBy || currentUsername : preparedCard.soldBy,
    };
    const validationError = validateCardBusinessRules(cardToSave);
    if (validationError) {
      setError(validationError);
      return;
    }

    let savedInventoryCard: CardRecord | null = null;

    if (usingSupabase && supabase && session?.user.id) {
      let insertResult = await supabase
        .from("cards")
        .insert(cardToInsert(cardToSave, session.user.id, workspaceId))
        .select("*")
        .single();
      if (insertResult.error && isBackPhotoColumnError(insertResult.error.message)) {
        insertResult = await supabase
          .from("cards")
          .insert(cardToInsert(cardToSave, session.user.id, workspaceId, true, true, true, true, false))
          .select("*")
          .single();
        if (!insertResult.error) setNotice("Inventory added. Run the back-photo SQL migration so back photos save to account storage.");
      }
      if (insertResult.error && isMarketplaceDetailsColumnError(insertResult.error.message)) {
        insertResult = await supabase
          .from("cards")
          .insert(cardToInsert(cardToSave, session.user.id, workspaceId, true, true, true, false))
          .select("*")
          .single();
      }
      if (insertResult.error && isQuantityColumnError(insertResult.error.message)) {
        insertResult = await supabase
          .from("cards")
          .insert(cardToInsert(cardToSave, session.user.id, workspaceId, true, true, false))
          .select("*")
          .single();
        if (!insertResult.error) setNotice("Inventory added. Run the quantity SQL migration so item quantities save to account storage.");
      }
      if (insertResult.error && isAuditColumnError(insertResult.error.message)) {
        const includeQuantity = !isQuantityColumnError(insertResult.error.message);
        insertResult = await supabase
          .from("cards")
          .insert(cardToInsert(cardToSave, session.user.id, workspaceId, true, false, includeQuantity))
          .select("*")
          .single();
        if (!insertResult.error) setNotice("Inventory added. Run the audit SQL migration so usernames save to account storage.");
      }
      if (insertResult.error && isListingPricingColumnError(insertResult.error.message)) {
        insertResult = await supabase
          .from("cards")
          .insert(cardToInsert(cardToSave, session.user.id, workspaceId, false, false, !isQuantityColumnError(insertResult.error.message)))
          .select("*")
          .single();
        if (!insertResult.error) setNotice("Inventory added. Finish account storage setup so listing price/date fields save for both users.");
      }
      const { data, error: insertError } = insertResult;
      if (insertError) {
        setError(insertError.message);
        return;
      }
      savedInventoryCard = rowToCardWithQuantityFallback(data, cardToSave);
      setCards((current) => [savedInventoryCard!, ...current]);
    } else {
      savedInventoryCard = { ...cardToSave, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      setCards((current) => [savedInventoryCard!, ...current]);
    }

    const inventoryExpenseRows = savedInventoryCard ? inventoryExpenseRowsForCard(savedInventoryCard) : [];
    const savedExpenseRows = await insertExpenseRecords(inventoryExpenseRows);
    if (savedExpenseRows === null) return;

    setNotice((current) => current || `Inventory added${savedExpenseRows.length ? ` with ${money(savedExpenseRows.reduce((sum, expense) => sum + expense.amount, 0))} in expenses` : ""}.`);
    setShowAddInventoryCheck(false);
    window.setTimeout(() => setShowAddInventoryCheck(true), 0);
    setActiveCard(emptyCard());
    setActiveCardGrade("");
    setActiveCardGradingCompany("");
    setInventoryExpenseDraft(emptyInventoryExpenseDraft());
    setTab("inventory");
  };

  const updateCard = async (card: CardRecord) => {
    setError("");
    if (usingSupabase && supabase && session?.user.id) {
      let updateQuery = supabase
        .from("cards")
        .update(cardToUpdate(card))
        .eq("id", card.id);
      updateQuery = updateQuery.eq("user_id", session.user.id);
      let updateResult = await updateQuery.select("*").single();
      if (updateResult.error && isBackPhotoColumnError(updateResult.error.message)) {
        let legacyBackPhotoQuery = supabase
          .from("cards")
          .update(cardToUpdate(card, true, true, true, true, false))
          .eq("id", card.id);
        legacyBackPhotoQuery = legacyBackPhotoQuery.eq("user_id", session.user.id);
        updateResult = await legacyBackPhotoQuery.select("*").single();
        if (!updateResult.error) setNotice("Card updated. Run the back-photo SQL migration so back photos save to account storage.");
      }
      if (updateResult.error && isMarketplaceDetailsColumnError(updateResult.error.message)) {
        let legacyMarketplaceQuery = supabase
          .from("cards")
          .update(cardToUpdate(card, true, true, true, false))
          .eq("id", card.id);
        legacyMarketplaceQuery = legacyMarketplaceQuery.eq("user_id", session.user.id);
        updateResult = await legacyMarketplaceQuery.select("*").single();
      }
      if (updateResult.error && isQuantityColumnError(updateResult.error.message)) {
        let legacyQuantityQuery = supabase
          .from("cards")
          .update(cardToUpdate(card, true, true, false))
          .eq("id", card.id);
        legacyQuantityQuery = legacyQuantityQuery.eq("user_id", session.user.id);
        updateResult = await legacyQuantityQuery.select("*").single();
        if (!updateResult.error) setNotice("Card updated. Run the quantity SQL migration so item quantities save to account storage.");
      }
      if (updateResult.error && isAuditColumnError(updateResult.error.message)) {
        let legacyAuditQuery = supabase
          .from("cards")
          .update(cardToUpdate(card, true, false, !isQuantityColumnError(updateResult.error.message)))
          .eq("id", card.id);
        legacyAuditQuery = legacyAuditQuery.eq("user_id", session.user.id);
        updateResult = await legacyAuditQuery.select("*").single();
        if (!updateResult.error) setNotice("Card updated. Run the audit SQL migration so usernames save to account storage.");
      }
      if (updateResult.error && isListingPricingColumnError(updateResult.error.message)) {
        let legacyUpdateQuery = supabase
          .from("cards")
          .update(cardToUpdate(card, false, false, !isQuantityColumnError(updateResult.error.message)))
          .eq("id", card.id);
        legacyUpdateQuery = legacyUpdateQuery.eq("user_id", session.user.id);
        updateResult = await legacyUpdateQuery.select("*").single();
        if (!updateResult.error) setNotice("Card updated. Finish account storage setup so listing price/date fields save for both users.");
      }
      const { data, error: updateError } = updateResult;
      if (updateError) {
        setError(updateError.message);
        return false;
      }
      setCards((current) => current.map((item) => (item.id === card.id ? rowToCardWithQuantityFallback(data, card) : item)));
      return true;
    }
    setCards((current) => current.map((item) => (item.id === card.id ? card : item)));
    return true;
  };

  const saveInlineCost = async (card: CardRecord, rawValue: string) => {
    const nextCost = Math.max(0, Number(rawValue || 0) || 0);
    setInlineCostDrafts((drafts) => {
      const { [card.id]: _removed, ...rest } = drafts;
      return rest;
    });
    if (nextCost === Number(card.purchasePrice || 0)) return;
    const ok = await updateCard({ ...card, purchasePrice: nextCost, updatedAt: new Date().toISOString(), updatedBy: currentUsername });
    if (ok) setNotice(`Updated your cost for ${card.name}. Profit, inventory value, cash snapshot, and expense math now use ${money(nextCost)}.`);
  };

  const insertCardRecord = async (card: CardRecord) => {
    if (usingSupabase && supabase && session?.user.id) {
      let insertResult = await supabase
        .from("cards")
        .insert(cardToInsert(card, session.user.id, workspaceId))
        .select("*")
        .single();
      if (insertResult.error && isBackPhotoColumnError(insertResult.error.message)) {
        insertResult = await supabase
          .from("cards")
          .insert(cardToInsert(card, session.user.id, workspaceId, true, true, true, true, false))
          .select("*")
          .single();
        if (!insertResult.error) setNotice("Card saved. Run the back-photo SQL migration so back photos save to account storage.");
      }
      if (insertResult.error && isQuantityColumnError(insertResult.error.message)) {
        insertResult = await supabase
          .from("cards")
          .insert(cardToInsert(card, session.user.id, workspaceId, true, true, false))
          .select("*")
          .single();
        if (!insertResult.error) setNotice("Card saved. Run the quantity SQL migration so item quantities save to account storage.");
      }
      if (insertResult.error && isAuditColumnError(insertResult.error.message)) {
        insertResult = await supabase
          .from("cards")
          .insert(cardToInsert(card, session.user.id, workspaceId, true, false, !isQuantityColumnError(insertResult.error.message)))
          .select("*")
          .single();
      }
      if (insertResult.error && isListingPricingColumnError(insertResult.error.message)) {
        insertResult = await supabase
          .from("cards")
          .insert(cardToInsert(card, session.user.id, workspaceId, false, false, !isQuantityColumnError(insertResult.error.message)))
          .select("*")
          .single();
      }
      if (insertResult.error) {
        setError(insertResult.error.message);
        return null;
      }
      return rowToCardWithQuantityFallback(insertResult.data, card);
    }
    return { ...card, id: card.id || crypto.randomUUID(), createdAt: card.createdAt || new Date().toISOString(), updatedAt: card.updatedAt || new Date().toISOString() };
  };

  const deleteCard = async (card: CardRecord) => {
    setError("");
    if (card.status === "Sold") {
      setError("Sold cards cannot be deleted. They are kept as sales history for profit and audit records.");
      return false;
    }
    if (usingSupabase && supabase && session?.user.id) {
      let deleteQuery = supabase.from("cards").delete().eq("id", card.id);
      deleteQuery = deleteQuery.eq("user_id", session.user.id);
      const { error: deleteError } = await deleteQuery;
      if (deleteError) {
        setError(deleteError.message);
        return false;
      }
    }
    setCards((current) => current.filter((item) => item.id !== card.id));
    return true;
  };

  const requestDeleteCard = (card: CardRecord) => {
    setError("");
    if (card.status === "Sold") {
      setError("Sold cards cannot be deleted. They are kept as sales history for profit and audit records.");
      return;
    }
    setDeletingCard(card);
  };

  const confirmDeleteCard = async () => {
    if (!deletingCard) return;
    const cardToDelete = deletingCard;
    const deletedName = cardToDelete.name;
    const deletedStatus = cardToDelete.status;
    const deletedQuantity = cardQuantity(cardToDelete);
    const deleted = await deleteCard(cardToDelete);
    if (!deleted) return;
    setDeletingCard(null);
    setNotice(`Deleted ${deletedQuantity > 1 ? `${deletedQuantity} ` : ""}${deletedStatus.toLowerCase()} ${deletedName}.`);
  };

  const beginListingEdit = (card: CardRecord) => {
    setError("");
    setListingCard(prepareCardForStatus(card, "Listed"));
  };

  const changeCardStatus = async (card: CardRecord, status: CardStatus) => {
    const now = new Date().toISOString();
    const preparedCard = prepareCardForStatus(card, status);
    const nextCard: CardRecord = {
      ...preparedCard,
      updatedBy: currentUsername,
      listedAt: status === "Listed" && card.status !== "Listed" ? now : preparedCard.listedAt,
      listedBy: status === "Listed" && card.status !== "Listed" ? currentUsername : preparedCard.listedBy,
      soldAt: status === "Sold" && card.status !== "Sold" ? now : preparedCard.soldAt,
      soldBy: status === "Sold" && card.status !== "Sold" ? currentUsername : preparedCard.soldBy,
    };

    if (status === "Listed") {
      const validationError = validateCardBusinessRules(nextCard);
      if (validationError) {
        setError(validationError);
        setEditingCard(nextCard);
        return;
      }
    }

    if (status === "Sold") {
      setError("");
      openSaleModal(nextCard);
      return;
    }

    const ok = await updateCard(nextCard);
    if (ok) setNotice(`${card.name} changed to ${status}.`);
  };

  const updateListingInfo = async (card: CardRecord, updates: Partial<Pick<CardRecord, "listedPlatform" | "listingUrl" | "askingPrice" | "lowestAcceptablePrice" | "listedDate">>) => {
    const now = new Date().toISOString();
    const nextCard = {
      ...card,
      ...updates,
      status: "Listed" as const,
      listedDate: updates.listedDate ?? (card.listedDate || todayIso()),
      listedAt: card.status !== "Listed" ? now : card.listedAt,
      listedBy: card.status !== "Listed" ? currentUsername : card.listedBy,
      updatedAt: now,
      updatedBy: currentUsername,
    };
    const validationError = validateCardBusinessRules(nextCard);
    if (validationError) {
      setError(validationError);
      return;
    }
    const ok = await updateCard(nextCard);
    if (ok) setNotice(`Updated listing info for ${card.name}.`);
  };

  const removePrimeLotListingIfNeeded = async (card: CardRecord) => {
    const primeLotListing = primeLotListingForCard(card);
    if (!primeLotListing) return true;
    if (!session?.access_token) {
      setError("Sign in before clearing a PrimeLot listing.");
      return false;
    }

    const response = await fetch("/api/primelot/clear-listing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        cardTrackerId: card.id,
        listingUrl: primeLotListing.url,
      }),
    });
    const result: { error?: string } = await response.json();
    if (!response.ok) {
      setError(result.error || "Could not remove the PrimeLot listing.");
      return false;
    }
    return true;
  };

  const requestClearListing = (card: CardRecord) => {
    setError("");
    setNotice("");
    setConfirmingClearListing(card);
  };

  const confirmClearListing = async () => {
    if (!confirmingClearListing) return;
    const card = confirmingClearListing;
    setConfirmingClearListing(null);
    await clearListingInfo(card);
  };

  const clearListingInfo = async (card: CardRecord) => {
    setError("");
    setNotice("");
    const primeLotRemoved = await removePrimeLotListingIfNeeded(card);
    if (!primeLotRemoved) return;
    const ok = await updateCard({
      ...card,
      status: "Not Listed",
      listedPlatform: "",
      listingUrl: "",
      listedDate: "",
      listedAt: "",
      listedBy: "",
      notes: cleanListingNotes(card.notes),
      updatedAt: new Date().toISOString(),
      updatedBy: currentUsername,
    });
    if (ok) {
      setNotice(alreadyOnPrimeLot(card) ? `Removed ${card.name} from PrimeLot and moved it back to Not Listed.` : `Cleared the old listing link for ${card.name}. You can select it and post it to PrimeLot again.`);
      setListingCard(null);
      setStatusFilter("Not Listed");
    }
  };

  const saveListing = async (event: FormEvent) => {
    event.preventDefault();
    if (!listingCard) return;
    const platformUrl = firstUrlInText(listingCard.listedPlatform || "");
    const normalizedListingCard = platformUrl && !listingCard.listingUrl.trim()
      ? { ...listingCard, listingUrl: platformUrl, listedPlatform: listingPlatformLabel({ ...listingCard, listingUrl: platformUrl }) }
      : listingCard;
    const sourceCard = cards.find((card) => card.id === normalizedListingCard.id) || normalizedListingCard;
    const availableQty = cardQuantity(sourceCard);
    const listingQty = Math.max(1, Math.min(availableQty, cardQuantity(normalizedListingCard)));
    const now = new Date().toISOString();
    const newListing: MultiPlatformListing = {
      id: crypto.randomUUID(),
      platform: normalizedListingCard.listedPlatform.trim(),
      url: normalizedListingCard.listingUrl.trim(),
      askingPrice: Number(normalizedListingCard.askingPrice || 0) || 0,
      lowestAcceptablePrice: Number(normalizedListingCard.lowestAcceptablePrice || 0) || 0,
      shippingCharge: Number(normalizedListingCard.shippingCharge || 0) || 0,
      listedDate: normalizedListingCard.listedDate || todayIso(),
    };

    if (!newListing.platform) {
      setError("Add where the card is listed before saving the listing.");
      return;
    }

    const existingListings = activeListingsForCard(sourceCard);
    const nextListings = [...existingListings.filter((listing) => listing.platform.toLowerCase() !== newListing.platform.toLowerCase()), newListing];
    const nextListedCard: CardRecord = {
      ...cardWithListings(normalizedListingCard, nextListings),
      id: listingQty < availableQty ? crypto.randomUUID() : sourceCard.id,
      workspaceId: sourceCard.workspaceId,
      quantity: listingQty,
      listedAt: sourceCard.status !== "Listed" ? now : (normalizedListingCard.listedAt || now),
      listedBy: sourceCard.status !== "Listed" ? currentUsername : (normalizedListingCard.listedBy || currentUsername),
      saleDate: "",
      salePlatform: "",
      soldPrice: 0,
      soldAt: "",
      soldBy: "",
      createdAt: listingQty < availableQty ? now : sourceCard.createdAt,
      createdBy: listingQty < availableQty ? currentUsername : sourceCard.createdBy,
      updatedAt: now,
      updatedBy: currentUsername,
    };

    const validationError = validateCardBusinessRules(nextListedCard);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (listingQty < availableQty) {
      const remainingCard: CardRecord = {
        ...sourceCard,
        quantity: availableQty - listingQty,
        status: "Not Listed",
        listedPlatform: "",
        listingUrl: "",
        askingPrice: 0,
        lowestAcceptablePrice: 0,
        listedDate: "",
        listedAt: "",
        listedBy: "",
        notes: cleanListingNotes(sourceCard.notes),
        updatedAt: now,
        updatedBy: currentUsername,
      };
      const updatedRemaining = await updateCard(remainingCard);
      if (!updatedRemaining) return;
      const insertedListed = await insertCardRecord(nextListedCard);
      if (!insertedListed) return;
      setCards((current) => [insertedListed, ...current.map((item) => (item.id === remainingCard.id ? remainingCard : item))]);
      setNotice(`Listed ${listingQty} of ${availableQty} ${nextListedCard.name}. ${availableQty - listingQty} left unlisted.`);
      setListingCard(null);
      setTab("inventory");
      return;
    }

    const ok = await updateCard(nextListedCard);
    if (ok) {
      setNotice(`${nextListedCard.name} is listed on ${nextListings.map((listing) => listing.platform).join(", ")}. Inventory count was not duplicated.`);
      setListingCard(null);
      setTab("inventory");
    }
  };

  const saveEditedCard = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingCard?.name.trim()) return;
    const nextCard = { ...editingCard, updatedAt: new Date().toISOString(), updatedBy: currentUsername };
    const validationError = validateCardBusinessRules(nextCard);
    if (validationError) {
      setError(validationError);
      return;
    }
    const ok = await updateCard(nextCard);
    if (ok) {
      setNotice(`Updated ${nextCard.name}.`);
      setEditingCard(null);
    }
  };

  const openSaleModal = (card: CardRecord) => {
    setSaleCelebration(null);
    setSaleExpenseDraft(card.status === "Sold" ? saleExpenseDraftFromCard(card) : emptySaleExpenseDraft());
    setSellingCard({
      ...card,
      quantity: cardQuantity(card),
      shippingCharge: Number(card.shippingCharge || 0),
      saleDate: card.saleDate || todayIso(),
    });
  };

  const showSaleCelebration = (card: CardRecord, savedSaleExpenses: ExpenseRecord[], remainingQuantity?: number) => {
    const savedSaleExpenseTotal = savedSaleExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    setSaleCelebration({
      cardName: card.name,
      quantity: cardQuantity(card),
      saleTotal: card.soldPrice,
      saleUnitPrice: card.soldPrice / cardQuantity(card),
      shippingCharge: card.shippingCharge || 0,
      shippingUnitPrice: (card.shippingCharge || 0) / cardQuantity(card),
      collectedTotal: cardNetSoldPrice(card),
      purchaseCost: cardPurchaseCost(card),
      saleExpenseTotal: savedSaleExpenseTotal,
      netProfit: cardProfit(card) - savedSaleExpenseTotal,
      remainingQuantity,
      platform: card.salePlatform || "Sale",
      listingRemovalReminder: otherListingsAfterSale(card),
    });
  };

  const saveSale = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!sellingCard) return;
    const sourceCard = cards.find((card) => card.id === sellingCard.id) || sellingCard;
    const updatingExistingSoldSale = sourceCard.status === "Sold";
    const availableQty = cardQuantity(sourceCard);
    const saleQty = updatingExistingSoldSale ? cardQuantity(sellingCard) : Math.min(availableQty, cardQuantity(sellingCard));
    const partialActiveSale = !updatingExistingSoldSale && saleQty < availableQty;
    const now = new Date().toISOString();
    const soldCard = {
      ...sellingCard,
      id: partialActiveSale ? crypto.randomUUID() : sellingCard.id,
      workspaceId: sourceCard.workspaceId,
      quantity: saleQty,
      status: "Sold" as const,
      soldAt: sellingCard.soldAt || now,
      soldBy: sellingCard.soldBy || currentUsername,
      createdAt: partialActiveSale ? now : sellingCard.createdAt,
      createdBy: partialActiveSale ? currentUsername : sellingCard.createdBy,
      updatedAt: now,
      updatedBy: currentUsername,
    };
    const validationError = validateCardBusinessRules(soldCard);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (partialActiveSale) {
      const remainingCard: CardRecord = {
        ...sourceCard,
        quantity: availableQty - saleQty,
        saleDate: "",
        salePlatform: "",
        soldPrice: 0,
        soldAt: "",
        soldBy: "",
        status: sourceCard.status === "Sold" ? "Not Listed" : sourceCard.status,
        updatedAt: now,
        updatedBy: currentUsername,
      };
      const updatedRemaining = await updateCard(remainingCard);
      if (!updatedRemaining) return;
      const insertedSold = await insertCardRecord(soldCard);
      if (!insertedSold) return;
      setCards((current) => [insertedSold, ...current.map((item) => (item.id === remainingCard.id ? remainingCard : item))]);
      const savedSaleExpenses = await insertExpenseRecords(saleExpenseRowsForCard(insertedSold));
      if (savedSaleExpenses === null) return;
      showSaleCelebration(insertedSold, savedSaleExpenses, availableQty - saleQty);
      setNotice(`Sold ${saleQty} of ${availableQty} ${soldCard.name} for ${money(cardNetSoldPrice(soldCard))} collected${savedSaleExpenses.length ? ` and logged ${money(savedSaleExpenses.reduce((sum, expense) => sum + expense.amount, 0))} in sale expenses` : ""}. ${availableQty - saleQty} left in inventory. Check WCT and the real marketplaces to remove/update any remaining listings.`);
      setSellingCard(null);
      setSaleExpenseDraft(emptySaleExpenseDraft());
      setTab("inventory");
      return;
    }

    const ok = await updateCard(soldCard);
    if (ok) {
      const savedSaleExpenses = sourceCard.status === "Sold" ? await replaceSaleExpensesForCard(soldCard, saleExpenseRowsForCard(soldCard)) : await insertExpenseRecords(saleExpenseRowsForCard(soldCard));
      if (savedSaleExpenses === null) return;
      showSaleCelebration(soldCard, savedSaleExpenses);
      setNotice(`Sold ${soldCard.name} for ${money(cardNetSoldPrice(soldCard))} collected${savedSaleExpenses.length ? ` and logged ${money(savedSaleExpenses.reduce((sum, expense) => sum + expense.amount, 0))} in sale expenses` : ""}. Remove/update this listing in WCT and on the real marketplace so it cannot sell twice.`);
      setSellingCard(null);
      setSaleExpenseDraft(emptySaleExpenseDraft());
      setTab("profit");
    }
  };

  const openRefundModal = (card: CardRecord) => {
    const remainingRefundable = cardNetSoldPrice(card);
    setRefundingCard(card);
    setRefundDraft({ amount: remainingRefundable > 0 ? String(remainingRefundable) : "", refundDate: todayIso(), note: "" });
  };

  const closeRefundModal = () => {
    setRefundingCard(null);
    setRefundDraft(emptyRefundDraft());
  };

  const saleExpenseMatchesCard = (expense: ExpenseRecord, card: CardRecord) => isSaleExpenseForCard(expense, card);

  const requestMoveBackToListed = (card: CardRecord) => {
    setError("");
    setNotice("");
    setConfirmingMoveBackToListed(card);
  };

  const confirmMoveBackToListed = async () => {
    if (!confirmingMoveBackToListed) return;
    await reverseSoldToListed(confirmingMoveBackToListed);
  };

  const reverseSoldToListed = async (card: CardRecord) => {
    setError("");
    setNotice("");
    const now = new Date().toISOString();
    const relistedCard: CardRecord = {
      ...card,
      status: "Listed",
      saleDate: "",
      salePlatform: "",
      soldPrice: 0,
      soldAt: "",
      soldBy: "",
      listedDate: card.listedDate || todayIso(),
      listedAt: card.listedAt || now,
      listedBy: card.listedBy || currentUsername,
      updatedAt: now,
      updatedBy: currentUsername,
    };
    const ok = await updateCard(relistedCard);
    if (!ok) return;
    const saleExpensesToRemove = expenses.filter((expense) => saleExpenseMatchesCard(expense, card));
    for (const expense of saleExpensesToRemove) await deleteExpense(expense);
    setConfirmingMoveBackToListed(null);
    setStatusFilter("Listed");
    setTab("inventory");
    setNotice(`${card.name} moved back to Listed${saleExpensesToRemove.length ? ` and ${saleExpensesToRemove.length} sale expense${saleExpensesToRemove.length === 1 ? "" : "s"} removed` : ""}.`);
  };

  const saveRefund = async (event: FormEvent) => {
    event.preventDefault();
    if (!refundingCard) return;
    setError("");
    setNotice("");
    const currentCard = cards.find((card) => card.id === refundingCard.id) || refundingCard;
    const remainingRefundable = cardNetSoldPrice(currentCard);
    const refundAmount = Math.max(0, Number(refundDraft.amount || 0) || 0);
    if (refundAmount <= 0) {
      setError("Enter a refund amount greater than $0.");
      return;
    }
    if (refundAmount > remainingRefundable) {
      setError(`Refund amount cannot be more than the remaining sold amount (${money(remainingRefundable)}).`);
      return;
    }
    const now = new Date().toISOString();
    const refundedCard: CardRecord = {
      ...currentCard,
      notes: appendCardRefundNote(currentCard.notes, refundAmount, refundDraft.refundDate || todayIso(), refundDraft.note),
      updatedAt: now,
      updatedBy: currentUsername,
    };
    const ok = await updateCard(refundedCard);
    if (ok) {
      setNotice(`${money(refundAmount)} refund recorded for ${refundedCard.name}. Net sold amount is now ${money(cardNetSoldPrice(refundedCard))}.`);
      closeRefundModal();
      setTab("inventory");
      if (cardNetSoldPrice(refundedCard) <= 0) setStatusFilter("Sold");
    }
  };

  const openAddExpenseModal = () => {
    setActiveExpense(emptyExpense());
    setEditingExpenseId(null);
    setExpenseForSoldCard(null);
    setExpenseModalOpen(true);
    setError("");
    setNotice("");
  };

  const openSoldCardExpenseModal = (card: CardRecord) => {
    const draft = emptyExpense();
    const category: ExpenseCategory = "Shipping";
    setActiveExpense({
      ...draft,
      workspaceId: workspaceId || undefined,
      category,
      expenseDate: card.saleDate || todayIso(),
      vendor: card.salePlatform || "Sale",
      description: saleExpenseDescriptionForCard(category, card),
    });
    setEditingExpenseId(null);
    setExpenseForSoldCard(card);
    setExpenseModalOpen(true);
    setError("");
    setNotice("");
  };

  const openEditExpenseModal = (expense: ExpenseRecord) => {
    setActiveExpense({ ...expense });
    setEditingExpenseId(expense.id);
    setExpenseForSoldCard(null);
    setExpenseModalOpen(true);
    setError("");
    setNotice("");
  };

  const closeExpenseModal = () => {
    setActiveExpense(emptyExpense());
    setEditingExpenseId(null);
    setExpenseForSoldCard(null);
    setExpenseModalOpen(false);
  };

  const requestDeleteExpense = (expense: ExpenseRecord) => {
    setError("");
    setNotice("");
    setDeletingExpense(expense);
  };

  const confirmDeleteExpense = async () => {
    if (!deletingExpense) return;
    const expenseToDelete = deletingExpense;
    const deleted = await deleteExpense(expenseToDelete);
    if (!deleted) return;
    setDeletingExpense(null);
    setNotice(`Deleted ${expenseToDelete.category} expense for ${money(expenseToDelete.amount)}.`);
  };

  const saveExpense = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const now = new Date().toISOString();
    const expenseToSave: ExpenseRecord = {
      ...activeExpense,
      createdAt: activeExpense.createdAt || now,
      createdBy: activeExpense.createdBy || currentUsername,
      updatedAt: now,
      updatedBy: currentUsername,
    };
    const normalizedSaleExpenseForCard = expenseForSoldCard ? normalizeSaleExpenseForCard(expenseToSave, expenseForSoldCard) : expenseToSave;
    const validationError = validateExpenseBusinessRules(normalizedSaleExpenseForCard);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (usingSupabase && supabase && session?.user.id) {
      if (editingExpenseId) {
        let updateQuery = supabase
          .from("expenses")
          .update(expenseToUpdate(normalizedSaleExpenseForCard))
          .eq("id", normalizedSaleExpenseForCard.id);
        updateQuery = updateQuery.eq("user_id", session.user.id);
        let updateResult = await updateQuery.select("*").single();
        if (updateResult.error && isAuditColumnError(updateResult.error.message)) {
          let legacyExpenseQuery = supabase
            .from("expenses")
            .update(expenseToUpdate(normalizedSaleExpenseForCard, false))
            .eq("id", normalizedSaleExpenseForCard.id);
          legacyExpenseQuery = legacyExpenseQuery.eq("user_id", session.user.id);
          updateResult = await legacyExpenseQuery.select("*").single();
          if (!updateResult.error) setNotice("Expense updated. Run the audit SQL migration so usernames save to account storage.");
        }
        const { data, error: updateError } = updateResult;
        if (updateError) {
          setError(updateError.message);
          return;
        }
        setExpenses((current) => current.map((expense) => (expense.id === activeExpense.id ? rowToExpense(data) : expense)));
      } else {
        let insertResult = await supabase
          .from("expenses")
          .insert(expenseToInsert(normalizedSaleExpenseForCard, session.user.id, workspaceId))
          .select("*")
          .single();
        if (insertResult.error && isAuditColumnError(insertResult.error.message)) {
          insertResult = await supabase
            .from("expenses")
            .insert(expenseToInsert(normalizedSaleExpenseForCard, session.user.id, workspaceId, false))
            .select("*")
            .single();
          if (!insertResult.error) setNotice("Expense saved. Run the audit SQL migration so usernames save to account storage.");
        }
        const { data, error: insertError } = insertResult;
        if (insertError) {
          setError(insertError.message);
          return;
        }
        setExpenses((current) => [rowToExpense(data), ...current]);
      }
    } else {
      setExpenses((current) => {
        const exists = current.some((expense) => expense.id === normalizedSaleExpenseForCard.id);
        return exists ? current.map((expense) => (expense.id === normalizedSaleExpenseForCard.id ? normalizedSaleExpenseForCard : expense)) : [{ ...normalizedSaleExpenseForCard, id: crypto.randomUUID() }, ...current];
      });
    }

    setNotice(expenseForSoldCard ? `Expense saved for ${expenseForSoldCard.name}. Sold-card profit updated.` : "Expense saved.");
    setActiveExpense(emptyExpense());
    setEditingExpenseId(null);
    setExpenseForSoldCard(null);
    setExpenseModalOpen(false);
  };

  const deleteExpense = async (expense: ExpenseRecord) => {
    setError("");
    if (usingSupabase && supabase && session?.user.id) {
      let deleteQuery = supabase.from("expenses").delete().eq("id", expense.id);
      deleteQuery = deleteQuery.eq("user_id", session.user.id);
      const { error: deleteError } = await deleteQuery;
      if (deleteError) {
        setError(deleteError.message);
        return false;
      }
    }
    setExpenses((current) => current.filter((expenseRecord) => expenseRecord.id !== expense.id));
    return true;
  };

  const replaceSaleExpensesForCard = async (card: CardRecord, nextExpenses: ExpenseRecord[]) => {
    const existingSaleExpenses = expenses.filter((expense) => isSaleExpenseForCard(expense, card));
    for (const expense of existingSaleExpenses) {
      const deleted = await deleteExpense(expense);
      if (!deleted) return null;
    }
    return insertExpenseRecords(nextExpenses);
  };

  const saveCashAdjustment = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const now = new Date().toISOString();
    const entryToSave: CashAdjustmentRecord = {
      ...activeCashAdjustment,
      createdAt: activeCashAdjustment.createdAt || now,
      createdBy: activeCashAdjustment.createdBy || currentUsername,
      updatedAt: now,
      updatedBy: currentUsername,
    };
    const validationError = validateCashAdjustmentBusinessRules(entryToSave);
    if (validationError) {
      setError(validationError);
      return;
    }
    const previousCashEntry = editingCashAdjustmentId ? cashAdjustments.find((entry) => entry.id === editingCashAdjustmentId) : null;
    const projectedEndingCash = totals.cash - (previousCashEntry ? cashAdjustmentSignedAmount(previousCashEntry) : 0) + cashAdjustmentSignedAmount(entryToSave);

    if (usingSupabase && supabase && session?.user.id) {
      if (editingCashAdjustmentId) {
        let updateQuery = supabase.from("cash_adjustments").update(cashAdjustmentToUpdate(entryToSave)).eq("id", entryToSave.id);
        updateQuery = updateQuery.eq("user_id", session.user.id);
        const updateResult = await updateQuery.select("*").single();
        if (updateResult.error) {
          if (isMissingCashAdjustmentsTable(updateResult.error.message)) setError("Run the cash-on-hand SQL migration before saving cash entries to account storage.");
          else setError(updateResult.error.message);
          return;
        }
        setCashAdjustments((current) => current.map((entry) => (entry.id === entryToSave.id ? rowToCashAdjustment(updateResult.data) : entry)));
      } else {
        const insertResult = await supabase.from("cash_adjustments").insert(cashAdjustmentToInsert(entryToSave, session.user.id, workspaceId)).select("*").single();
        if (insertResult.error) {
          if (isMissingCashAdjustmentsTable(insertResult.error.message)) setError("Run the cash-on-hand SQL migration before saving cash entries to account storage.");
          else setError(insertResult.error.message);
          return;
        }
        setCashAdjustments((current) => [rowToCashAdjustment(insertResult.data), ...current]);
      }
    } else {
      setCashAdjustments((current) => {
        const exists = current.some((entry) => entry.id === entryToSave.id);
        return exists ? current.map((entry) => (entry.id === entryToSave.id ? entryToSave : entry)) : [{ ...entryToSave, id: crypto.randomUUID() }, ...current];
      });
    }

    setCashSuccessSummary({
      adjustmentType: entryToSave.adjustmentType,
      amount: entryToSave.amount,
      adjustmentDate: entryToSave.adjustmentDate,
      description: entryToSave.description,
      endingCash: projectedEndingCash,
    });
    setActiveCashAdjustment(emptyCashAdjustment());
    setEditingCashAdjustmentId(null);
    setDashboardCashEntryOpen(false);
  };

  const deleteCashAdjustment = async (entry: CashAdjustmentRecord) => {
    setError("");
    if (usingSupabase && supabase && session?.user.id) {
      let deleteQuery = supabase.from("cash_adjustments").delete().eq("id", entry.id);
      deleteQuery = deleteQuery.eq("user_id", session.user.id);
      const { error: deleteError } = await deleteQuery;
      if (deleteError) {
        setError(deleteError.message);
        return;
      }
    }
    setCashAdjustments((current) => current.filter((cashEntry) => cashEntry.id !== entry.id));
  };

  const toggleSelectedCard = (cardId: string) => {
    const card = cardById.get(cardId);
    if (!card || card.status === "Sold" || activeGradingCardIds.has(cardId)) return;
    setSelectedCardIds((current) => {
      if (current.includes(cardId)) {
        setSelectedGradingQuantities((quantities) => {
          const next = { ...quantities };
          delete next[cardId];
          return next;
        });
        return current.filter((id) => id !== cardId);
      }
      setSelectedGradingQuantities((quantities) => ({ ...quantities, [cardId]: cardQuantity(card) }));
      return [...current, cardId];
    });
  };

  const selectAllFilteredCards = () => {
    const selectableCards = filteredCards.filter((card) => card.status !== "Sold" && !activeGradingCardIds.has(card.id));
    setSelectedCardIds(selectableCards.map((card) => card.id));
    setSelectedGradingQuantities(Object.fromEntries(selectableCards.map((card) => [card.id, cardQuantity(card)])));
  };
  const clearSelectedCards = () => {
    setSelectedCardIds([]);
    setSelectedGradingQuantities({});
  };

  const beginGradingSubmission = () => {
    setError("");
    if (!selectedCards.length) {
      setError("Select at least one unsold card before creating a grading submission.");
      return;
    }
    const submissionCardIds = selectedCards.map((card) => card.id);
    setGradingDraft({
      ...emptyGradingSubmission(),
      cardIds: submissionCardIds,
      cardQuantities: Object.fromEntries(selectedCards.map((card) => [card.id, selectedQuantityForCard(card)])),
    });
    setShowGradingForm(true);
  };

  const saveGradingSubmission = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const now = new Date().toISOString();
    const draftCompany = gradingDraft.company.trim();
    const draftReference = gradingDraft.reference.trim();
    const draftNotes = gradingDraft.notes.trim();
    if (!draftCompany) {
      setError("Choose the grading company before saving the submission.");
      return;
    }
    if (!gradingDraft.sentDate) {
      setError("Add the date the cards were sent to grading.");
      return;
    }
    if (!selectedCards.length) {
      setError("Select at least one card before saving the grading submission.");
      return;
    }

    const gradingCards: CardRecord[] = [];
    const insertedGradingCards: CardRecord[] = [];
    const cardQuantities: Record<string, number> = {};

    for (const card of selectedCards) {
      const availableQuantity = cardQuantity(card);
      const quantityToSend = selectedQuantityForCard(card);
      const unitGradingCard = (source: CardRecord, id = crypto.randomUUID()): CardRecord => ({
        ...source,
        id,
        quantity: 1,
        createdAt: id === source.id ? source.createdAt : now,
        createdBy: id === source.id ? source.createdBy : currentUsername,
        updatedAt: now,
        updatedBy: currentUsername,
      });

      if (quantityToSend < availableQuantity) {
        const remainingCard: CardRecord = {
          ...card,
          quantity: availableQuantity - quantityToSend,
          updatedAt: now,
          updatedBy: currentUsername,
        };
        const updatedRemaining = await updateCard(remainingCard);
        if (!updatedRemaining) return;

        for (let index = 0; index < quantityToSend; index += 1) {
          const insertedGradingCard = await insertCardRecord(unitGradingCard(card));
          if (!insertedGradingCard) return;
          gradingCards.push(insertedGradingCard);
          insertedGradingCards.push(insertedGradingCard);
          cardQuantities[insertedGradingCard.id] = 1;
        }
      } else {
        const firstGradingCard = unitGradingCard(card, card.id);
        const updatedFirst = await updateCard(firstGradingCard);
        if (!updatedFirst) return;
        gradingCards.push(firstGradingCard);
        cardQuantities[firstGradingCard.id] = 1;

        for (let index = 1; index < quantityToSend; index += 1) {
          const insertedGradingCard = await insertCardRecord(unitGradingCard(card));
          if (!insertedGradingCard) return;
          gradingCards.push(insertedGradingCard);
          insertedGradingCards.push(insertedGradingCard);
          cardQuantities[insertedGradingCard.id] = 1;
        }
      }
    }

    if (insertedGradingCards.length) setCards((current) => [...insertedGradingCards, ...current]);

    const submission: GradingSubmission = {
      ...gradingDraft,
      company: draftCompany,
      reference: draftReference,
      notes: draftNotes,
      cardIds: gradingCards.map((card) => card.id),
      cardQuantities,
      status: "At Grading",
      returnedDate: "",
      createdAt: gradingDraft.createdAt || now,
      createdBy: gradingDraft.createdBy || currentUsername,
      updatedAt: now,
      updatedBy: currentUsername,
    };

    if (usingSupabase && supabase && session?.user.id) {
      let insertResult = await supabase
        .from("grading_submissions")
        .insert(gradingSubmissionToInsert(submission, session.user.id, workspaceId))
        .select("*")
        .single();
      if (insertResult.error && isAuditColumnError(insertResult.error.message)) {
        insertResult = await supabase
          .from("grading_submissions")
          .insert(gradingSubmissionToInsert(submission, session.user.id, workspaceId, false))
          .select("*")
          .single();
        if (!insertResult.error) setNotice("Grading submission saved. Run the audit SQL migration so usernames save to account storage.");
      }
      const { data, error: insertError } = insertResult;
      if (insertError) {
        setNotice("Grading submission saved locally for now. Run the pending grading SQL migration so it saves to account storage.");
        setGradingSubmissions((current) => [submission, ...current]);
        setSelectedCardIds([]);
        setSelectedGradingQuantities({});
        setShowGradingForm(false);
        setOpenGradingSubmissionId(submission.id);
        setTab("grading");
        return;
      }

      const linkRows = gradingSubmissionCardRows(submission);
      let linkResult = linkRows.length ? await supabase.from("grading_submission_cards").insert(linkRows) : { error: null };
      if (linkResult.error && isQuantityColumnError(linkResult.error.message)) {
        linkResult = linkRows.length ? await supabase.from("grading_submission_cards").insert(gradingSubmissionCardRows(submission, false)) : { error: null };
        if (!linkResult.error) setNotice("Grading submission saved. Run the grading quantity SQL migration so partial quantities persist after reload.");
      }
      if (linkResult.error) {
        await supabase.from("grading_submissions").delete().eq("id", submission.id);
        setError(linkResult.error.message);
        return;
      }
      setGradingSubmissions((current) => [rowToGradingSubmission(data, linkRows), ...current]);
    } else {
      setGradingSubmissions((current) => [submission, ...current]);
    }

    setNotice((current) => current || `Sent ${selectedCardQuantity} cards to ${submission.company} for grading.`);
    setSelectedCardIds([]);
    setSelectedGradingQuantities({});
    setShowGradingForm(false);
    setOpenGradingSubmissionId(submission.id);
    setTab("grading");
  };

  const openReturnGradingModal = (submission: GradingSubmission) => {
    setReturningSubmission(submission);
    setReturnDate(todayIso());
    setReturnGradeRows(gradingSubmissionCards(submission).flatMap((card) => {
      const quantity = gradingSubmissionQuantity(submission, card);
      const existingFee = expenses.filter((expense) => isGradingExpenseForCard(expense, card)).reduce((sum, expense) => sum + expense.amount, 0);
      const existingFeePerCard = existingFee ? String(Number((existingFee / Math.max(1, quantity)).toFixed(2))) : "";
      return Array.from({ length: quantity }, () => ({
        id: crypto.randomUUID(),
        cardId: card.id,
        quantity: 1,
        grade: cardGradeLabel(card),
        slabNumber: "",
        gradingFee: existingFeePerCard,
        frontPhotoUrl: "",
        backPhotoUrl: "",
      }));
    }));
  };

  const saveReturnedGradingFeeExpenses = async (submission: GradingSubmission, returnedCards: ReturnedGradingFeeCard[]) => {
    const submissionCards = gradingSubmissionCards(submission);
    for (const card of submissionCards) {
      for (const expense of expenses.filter((entry) => isGradingExpenseForCard(entry, card))) {
        const deleted = await deleteExpense(expense);
        if (!deleted) return;
      }
    }
    const now = new Date().toISOString();
    const feeRows: ExpenseRecord[] = returnedCards
      .filter((row) => row.gradingFee > 0)
      .map(({ card, gradingFee }) => ({
        ...emptyExpense(),
        id: crypto.randomUUID(),
        category: "Grading Fees",
        amount: gradingFee,
        expenseDate: returnDate || submission.returnedDate || submission.sentDate || todayIso(),
        vendor: submission.company || "Grading",
        description: gradingFeeDescriptionForCard(card),
        createdAt: now,
        createdBy: currentUsername,
        updatedAt: now,
        updatedBy: currentUsername,
      }));
    return insertExpenseRecords(feeRows);
  };

  const updateReturnGradeRow = (rowId: string, changes: Partial<ReturnGradeRow>) => {
    setReturnGradeRows((rows) => rows.map((row) => row.id === rowId ? { ...row, ...changes } : row));
  };

  const uploadReturnSlabPhoto = async (rowId: string, file: File, side: "front" | "back") => {
    setError("");
    setNotice("");
    setPhotoUploading(true);
    const photoField = side === "front" ? "frontPhotoUrl" : "backPhotoUrl";
    const sideLabel = side === "front" ? "Front slab" : "Back slab";

    try {
      const uploadFile = await normalizePhotoFile(file);

      if (usingSupabase && supabase && session?.user.id) {
        const path = `${session.user.id}/returned-${side}-${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage.from("card-photos").upload(path, uploadFile, {
          cacheControl: "3600",
          contentType: uploadFile.type,
          upsert: false,
        });

        if (uploadError) {
          setError(`Photo upload failed. Make sure the card-photos storage SQL has been run. ${uploadError.message}`);
          return;
        }

        const { data } = supabase.storage.from("card-photos").getPublicUrl(path);
        updateReturnGradeRow(rowId, { [photoField]: data.publicUrl });
        setNotice(`${sideLabel} photo uploaded.`);
      } else {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(uploadFile);
        });
        updateReturnGradeRow(rowId, { [photoField]: dataUrl });
        setNotice(`${sideLabel} photo added locally.`);
      }
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : "Photo upload failed. Try taking the photo again.");
    } finally {
      setPhotoUploading(false);
    }
  };

  const applyReturnedGradeSplits = async (submission: GradingSubmission) => {
    const insertedCards: CardRecord[] = [];
    const returnedFeeCards: ReturnedGradingFeeCard[] = [];
    const now = new Date().toISOString();

    for (const card of gradingSubmissionCards(submission)) {
      const expectedQuantity = gradingSubmissionQuantity(submission, card);
      const rowsForCard = returnGradeRows.filter((row) => row.cardId === card.id && row.quantity > 0);
      const totalQuantity = rowsForCard.reduce((sum, row) => sum + row.quantity, 0);
      if (totalQuantity !== expectedQuantity) {
        setError(`${card.name} needs grade quantities totaling ${expectedQuantity}.`);
        return null;
      }

      const returnedUnits = rowsForCard.flatMap((row) => Array.from({ length: row.quantity }, (_, index) => ({
        grade: row.grade,
        slabNumber: row.quantity === 1 ? row.slabNumber : index === 0 ? row.slabNumber : "",
        gradingFee: expenseDraftAmount(row.gradingFee),
        frontPhotoUrl: row.quantity === 1 ? row.frontPhotoUrl : index === 0 ? row.frontPhotoUrl : "",
        backPhotoUrl: row.quantity === 1 ? row.backPhotoUrl : index === 0 ? row.backPhotoUrl : "",
      })));

      for (const [index, returnedUnit] of returnedUnits.entries()) {
        const parsedGrade = gradeParts(returnedUnit.grade);
        const gradingCompany = parsedGrade.company || submission.company || card.gradingCompany;
        const returnedCard: CardRecord = {
          ...card,
          id: index === 0 ? card.id : crypto.randomUUID(),
          quantity: 1,
          status: "Not Listed",
          listedPlatform: "",
          listingUrl: "",
          askingPrice: 0,
          lowestAcceptablePrice: 0,
          shippingCharge: 0,
          gradingCompany,
          grade: parsedGrade.grade,
          listedDate: "",
          listedAt: "",
          listedBy: "",
          frontPhotoUrl: returnedUnit.frontPhotoUrl,
          backPhotoUrl: returnedUnit.backPhotoUrl,
          notes: notesWithReturnedGrade(card.notes, parsedGrade.grade, gradingCompany, returnedUnit.slabNumber),
          createdAt: index === 0 ? card.createdAt : now,
          createdBy: index === 0 ? card.createdBy : currentUsername,
          updatedAt: now,
          updatedBy: currentUsername,
        };
        if (index === 0) {
          const updated = await updateCard(returnedCard);
          if (!updated) return null;
          returnedFeeCards.push({ card: returnedCard, gradingFee: returnedUnit.gradingFee });
        } else {
          const inserted = await insertCardRecord(returnedCard);
          if (!inserted) return null;
          insertedCards.push(inserted);
          returnedFeeCards.push({ card: inserted, gradingFee: returnedUnit.gradingFee });
        }
      }
    }

    if (insertedCards.length) setCards((current) => [...insertedCards, ...current]);
    return returnedFeeCards;
  };

  const markGradingReturned = async (event: FormEvent) => {
    event.preventDefault();
    if (!returningSubmission) return;
    if (!returnDate) {
      setError("Add the return date before marking the submission returned.");
      return;
    }
    const returnedFeeCards = await applyReturnedGradeSplits(returningSubmission);
    if (!returnedFeeCards) return;
    const savedGradingFees = await saveReturnedGradingFeeExpenses(returningSubmission, returnedFeeCards);
    if (!savedGradingFees) return;

    const now = new Date().toISOString();
    const returnedSubmission: GradingSubmission = {
      ...returningSubmission,
      status: "Returned",
      returnedDate: returnDate,
      updatedAt: now,
      updatedBy: currentUsername,
      returnedBy: currentUsername,
    };

    if (usingSupabase && supabase && session?.user.id) {
      let updateResult = await supabase
        .from("grading_submissions")
        .update(gradingSubmissionToUpdate(returnedSubmission))
        .eq("id", returnedSubmission.id)
        .select("*")
        .single();
      if (updateResult.error && isAuditColumnError(updateResult.error.message)) {
        updateResult = await supabase
          .from("grading_submissions")
          .update(gradingSubmissionToUpdate(returnedSubmission, false))
          .eq("id", returnedSubmission.id)
          .select("*")
          .single();
        if (!updateResult.error) setNotice("Marked returned. Run the audit SQL migration so usernames save to account storage.");
      }
      const { data, error: updateError } = updateResult;
      if (updateError) {
        setNotice("Marked returned locally for now. Run the pending grading SQL migration so returns save to account storage.");
        setGradingSubmissions((current) => current.map((submission) => submission.id === returnedSubmission.id ? returnedSubmission : submission));
        setReturningSubmission(null);
        setReturnGradeRows([]);
        return;
      }
      setGradingSubmissions((current) => current.map((submission) => submission.id === returnedSubmission.id ? rowToGradingSubmission(data, gradingSubmissionCardRows(returnedSubmission)) : submission));
    } else {
      setGradingSubmissions((current) => current.map((submission) => submission.id === returnedSubmission.id ? returnedSubmission : submission));
    }

    setNotice(`${returnedSubmission.company} grading submission marked returned${savedGradingFees.length ? ` with ${savedGradingFees.length} grading fee${savedGradingFees.length === 1 ? "" : "s"}` : ""}.`);
    setReturningSubmission(null);
    setReturnGradeRows([]);
  };

  const confirmDeleteGradingSubmission = async () => {
    if (!deletingGradingSubmission) return;
    setError("");
    setNotice("");
    const submissionToDelete = deletingGradingSubmission;

    if (usingSupabase && supabase && session?.user.id) {
      const linkDelete = await supabase.from("grading_submission_cards").delete().eq("submission_id", submissionToDelete.id);
      if (linkDelete.error) {
        setError(`Could not delete grading submission cards: ${linkDelete.error.message}`);
        return;
      }
      const submissionDelete = await supabase.from("grading_submissions").delete().eq("id", submissionToDelete.id);
      if (submissionDelete.error) {
        setError(`Could not delete grading submission: ${submissionDelete.error.message}`);
        return;
      }
    }

    setGradingSubmissions((current) => current.filter((submission) => submission.id !== submissionToDelete.id));
    setOpenGradingSubmissionId((current) => current === submissionToDelete.id ? null : current);
    setReturningSubmission((current) => current?.id === submissionToDelete.id ? null : current);
    setDeletingGradingSubmission(null);
    setNotice(`${submissionToDelete.reference || `${submissionToDelete.company} submission`} deleted.`);
  };

  const inventoryDateSuffix = inventoryStartDate || inventoryEndDate
    ? `${inventoryDateFieldLabels[inventoryDateField].replace(/\s+/g, "-")}-${inventoryStartDate || "start"}-to-${inventoryEndDate || "today"}`
    : "all-dates";
  const exportCards = () => downloadCsv(cardsToCsv(filteredCards), `card-inventory-filtered-${inventoryDateSuffix}-${new Date().toISOString().slice(0, 10)}.csv`);
  const openPrimeLotModal = (intent: "create" | "connect" = primeLotConnection.status === "pending" ? (primeLotConnection.requestedIntent === "connect" ? "connect" : "create") : "create") => {
    setError("");
    setNotice("");
    setPrimeLotIntent(intent);
    setPrimeLotEmail(primeLotConnection.sellerEmail || session?.user.email || "");
    setPrimeLotStoreSlug(primeLotConnection.storeSlug || (session?.user.email || "").split("@")[0]?.toLowerCase().replace(/[^a-z0-9-]+/g, "-") || "");
    setPrimeLotModalOpen(true);
  };

  const savePrimeLotConnection = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!session?.access_token) {
      setError("Sign in before connecting PrimeLot.");
      return;
    }
    setSavingPrimeLotConnection(true);
    try {
      const response = await fetch("/api/primelot/connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ intent: primeLotIntent, sellerEmail: primeLotEmail, storeSlug: primeLotStoreSlug }),
      });
      const result: PrimeLotConnectionState & { error?: string; code?: string } = await response.json();
      if (!response.ok) {
        setError(result.error || "Could not save the PrimeLot connection request.");
        return;
      }
      setPrimeLotConnection(result);
      setPrimeLotModalOpen(false);
      setNotice(result.connected ? "PrimeLot connected. You can post selected inventory now." : "PrimeLot request saved. We will finish activating this storefront before listings can post.");
    } catch (connectionError) {
      setError(connectionError instanceof Error ? connectionError.message : "Could not save the PrimeLot connection request.");
    } finally {
      setSavingPrimeLotConnection(false);
    }
  };

  const openPrimeLotReview = () => {
    setError("");
    setNotice("");
    setPrimeLotReviewError("");
    setPrimeLotReviewErrors({});
    if (!selectedPrimeLotCards.length) {
      setError("Select at least one card that is not already posted on PrimeLot.");
      return;
    }
    if (!primeLotConnection.connected) {
      openPrimeLotModal(primeLotConnection.requestedIntent === "connect" ? "connect" : "create");
      return;
    }
    if (!session?.access_token) {
      setError("Sign in before posting to PrimeLot.");
      return;
    }

    setPrimeLotReviewDrafts(Object.fromEntries(selectedPrimeLotCards.map((card) => [card.id, {
      askingPrice: String(card.askingPrice || ""),
      shippingCharge: String(card.shippingCharge || 0),
      gradingCompany: card.gradingCompany || "",
      listingType: "" as PrimeLotListingType | "",
    }])));
    setPrimeLotReviewOpen(true);
  };

  const updatePrimeLotReviewDraft = (cardId: string, field: "askingPrice" | "shippingCharge" | "listingType", value: string) => {
    setPrimeLotReviewError("");
    setPrimeLotReviewErrors((errors) => {
      if (field === "shippingCharge") return errors;
      const cardErrors = errors[cardId];
      if (!cardErrors || !(field in cardErrors)) return errors;
      const remainingCardErrors = { ...cardErrors };
      delete remainingCardErrors[field];
      if (!Object.keys(remainingCardErrors).length) {
        const remainingErrors = { ...errors };
        delete remainingErrors[cardId];
        return remainingErrors;
      }
      return { ...errors, [cardId]: remainingCardErrors };
    });
    setPrimeLotReviewDrafts((drafts) => {
      const current = drafts[cardId];
      const nextDraft = {
        askingPrice: current?.askingPrice || "",
        shippingCharge: current?.shippingCharge || "0",
        gradingCompany: current?.gradingCompany || "",
        listingType: current?.listingType || "" as PrimeLotListingType | "",
      };
      if (field === "listingType") nextDraft.listingType = value as PrimeLotListingType | "";
      else nextDraft[field] = value;
      return { ...drafts, [cardId]: nextDraft };
    });
  };

  const clearPrimeLotListingForCard = async (card: CardRecord) => {
    setError("");
    setNotice("");
    const primeLotRemoved = await removePrimeLotListingIfNeeded(card);
    if (!primeLotRemoved) return;
    const remainingListings = activeListingsForCard(card).filter((listing) => listing.id !== primeLotListingForCard(card)?.id);
    const updatedCard: CardRecord = {
      ...cardWithListings(card, remainingListings),
      listedAt: remainingListings.length ? card.listedAt : "",
      listedBy: remainingListings.length ? card.listedBy : "",
      updatedAt: new Date().toISOString(),
      updatedBy: currentUsername,
    };
    const saved = await updateCard(updatedCard);
    if (saved) {
      setNotice(remainingListings.length ? `Removed ${card.name} from PrimeLot in WCT. It is still listed on ${remainingListings.map((listing) => listing.platform).join(", ")}.` : `Removed ${card.name} from PrimeLot and moved it back to Not Listed.`);
      if (!remainingListings.length) setStatusFilter("Not Listed");
      setPrimeLotReviewDrafts((drafts) => ({
        ...drafts,
        [card.id]: {
          askingPrice: drafts[card.id]?.askingPrice || String(card.askingPrice || ""),
          shippingCharge: drafts[card.id]?.shippingCharge || String(card.shippingCharge || 0),
          gradingCompany: drafts[card.id]?.gradingCompany || card.gradingCompany || "",
          listingType: drafts[card.id]?.listingType || "",
        },
      }));
    }
  };

  const reviewedPrimeLotCards = () => selectedPrimeLotCards.map((card) => {
    const draft = primeLotReviewDrafts[card.id];
    return {
      ...card,
      askingPrice: Number(draft?.askingPrice || 0),
      shippingCharge: Number(draft?.shippingCharge || 0),
      listingType: draft?.listingType || "",
    };
  });

  const confirmPrimeLotPost = async () => {
    const cardsToPost = reviewedPrimeLotCards();
    const reviewErrors = cardsToPost.reduce<Record<string, Partial<Record<"askingPrice" | "listingType" | "gradingCompany", string>>>>((errors, card) => {
      const cardErrors: Partial<Record<"askingPrice" | "listingType" | "gradingCompany", string>> = {};
      if (Number(card.askingPrice || 0) <= 0) cardErrors.askingPrice = "Add a listing price.";
      if (!card.listingType) cardErrors.listingType = "Choose Single Card, Sealed Product, or Lot.";
      if (card.grade.trim() && !card.gradingCompany.trim()) cardErrors.gradingCompany = "Add the grading company on this card before importing.";
      if (Object.keys(cardErrors).length) errors[card.id] = cardErrors;
      return errors;
    }, {});
    if (Object.keys(reviewErrors).length) {
      setPrimeLotReviewErrors(reviewErrors);
      setPrimeLotReviewError("Fix the highlighted fields before importing drafts to PrimeLot.");
      return;
    }
    setPrimeLotReviewError("");
    setPrimeLotReviewErrors({});
    setPrimeLotReviewOpen(false);
    await postSelectedCardsToPrimeLot(cardsToPost);
  };

  const postSelectedCardsToPrimeLot = async (cardsToPost: CardRecord[]) => {
    setError("");
    setNotice("");
    setPrimeLotMembershipRequiredOpen(false);
    if (!session?.access_token) {
      setError("Sign in before posting to PrimeLot.");
      return;
    }

    setPostingToPrimeLot(true);
    try {
      const response = await fetch("/api/primelot/post-listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ cards: cardsToPost }),
      });
      const result: { createdListings?: Array<{ cardTrackerId: string; primeLotListingId: string; url: string; status: string }>; error?: string; code?: string; canSell?: boolean } = await response.json();
      const isPrimeLotMembershipRequiredFailure = result.code === "NO_SELLER_MEMBERSHIP"
        || result.code === "PRIMELOT_SELLER_MEMBERSHIP_REQUIRED"
        || result.canSell === false
        || (response.status === 403 && /seller|membership/i.test(`${result.code || ""} ${result.error || ""}`));
      if (!response.ok) {
        if (result.code === "PRIMELOT_NOT_CONNECTED") openPrimeLotModal();
        if (isPrimeLotMembershipRequiredFailure) {
          setPrimeLotMembershipRequiredOpen(true);
          setError("");
          return;
        }
        setError(result.error || "PrimeLot posting failed.");
        return;
      }

      const listingsByCardId = new Map((result.createdListings || []).map((listing) => [listing.cardTrackerId, listing]));
      let updatedCount = 0;
      let publicListingCount = 0;
      let draftListingCount = 0;
      for (const card of cardsToPost) {
        const listing = listingsByCardId.get(card.id);
        if (!listing) continue;
        const isPublicListing = isPrimeLotPublicListing(listing.status);
        if (isPublicListing) publicListingCount += 1;
        else draftListingCount += 1;
        const primeLotListing: MultiPlatformListing = {
          id: listing.primeLotListingId || crypto.randomUUID(),
          platform: primeLotListingStatusLabel(listing.status),
          url: listing.url,
          askingPrice: Number(card.askingPrice || 0) || 0,
          lowestAcceptablePrice: Number(card.lowestAcceptablePrice || 0) || 0,
          shippingCharge: Number(card.shippingCharge || 0) || 0,
          listedDate: todayIso(),
        };
        const nextListings = [...activeListingsForCard(card).filter((item) => !item.platform.toLowerCase().includes("primelot")), primeLotListing];
        const updatedCard: CardRecord = {
          ...cardWithListings(card, nextListings),
          status: "Listed",
          listedAt: new Date().toISOString(),
          listedBy: currentUsername,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUsername,
        };
        const saved = await updateCard(updatedCard);
        if (saved) updatedCount += 1;
      }

      const listingDetails = cardsToPost.map((card) => {
        const listing = listingsByCardId.get(card.id);
        return listing ? {
          ...listing,
          cardName: card.name,
          amount: Number(card.askingPrice || 0) * cardQuantity(card),
          shippingCharge: Number(card.shippingCharge || 0),
        } : null;
      }).filter((listing): listing is PrimeLotPostResult["listings"][number] => Boolean(listing));
      setPrimeLotPostResult({
        postedCount: updatedCount,
        totalAmount: listingDetails.reduce((sum, listing) => sum + listing.amount, 0),
        publicListingCount,
        draftListingCount,
        listings: listingDetails,
      });
      clearSelectedCards();
      if (draftListingCount && !publicListingCount) {
        setNotice(`Created ${updatedCount} PrimeLot draft${updatedCount === 1 ? "" : "s"} and moved ${updatedCount === 1 ? "it" : "them"} to Listed in WCT with a PrimeLot Draft link.`);
      } else if (draftListingCount) {
        setNotice(`Posted ${publicListingCount} card${publicListingCount === 1 ? "" : "s"} on PrimeLot, created ${draftListingCount} draft${draftListingCount === 1 ? "" : "s"}, and moved the exported cards to Listed in WCT.`);
      } else {
        setNotice(`Posted ${updatedCount} card${updatedCount === 1 ? "" : "s"} on PrimeLot.`);
      }
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : "PrimeLot posting failed.");
    } finally {
      setPostingToPrimeLot(false);
    }
  };
  const exportDateSuffix = selectedDateLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "all-time";
  const exportExpenses = () => downloadCsv(expensesToCsv(totals.filteredExpenses), `card-expenses-${exportDateSuffix}-${new Date().toISOString().slice(0, 10)}.csv`);
  const exportAllInventory = () => downloadCsv(cardsToCsv(activeInventoryCards), `card-inventory-all-${new Date().toISOString().slice(0, 10)}.csv`);
  const exportPeriodInventory = () => downloadCsv(cardsToCsv([...totals.notListedCards, ...totals.listedCards]), `card-inventory-${exportDateSuffix}-${new Date().toISOString().slice(0, 10)}.csv`);
  const exportPeriodSales = () => downloadCsv(salesToCsv(totals.soldCards), `card-sales-${exportDateSuffix}-${new Date().toISOString().slice(0, 10)}.csv`);
  const exportProfitSummary = () => downloadCsv(profitSummaryToCsv({
    periodLabel: selectedDateLabel,
    revenue: totals.revenue,
    totalInventoryCost: totals.soldInventoryCost,
    totalInventoryValue: totals.totalInventoryBought,
    currentInventoryCost: totals.currentInventoryCost,
    currentInventoryValue: totals.currentInventoryValue,
    expensesTotal: totals.expensesTotal,
    saleExpensesForSoldCardsTotal: totals.saleExpensesForSoldCardsTotal,
    roi: totals.roi,
    soldRoi: totals.soldRoi,
    soldCardProfit: totals.soldCardProfit,
    cash: totals.cash,
    profit: totals.profit,
    unlistedInventoryCost: totals.unlistedInventoryCost,
    listedInventoryCost: totals.listedInventoryCost,
    soldInventoryCost: totals.soldInventoryCost,
    soldCardsRevenue: totals.revenue,
    soldCardsCount: totals.soldCount,
    listedCardsCount: totals.listedCount,
    unlistedCardsCount: totals.notListedCount,
  }), `card-profit-summary-${exportDateSuffix}-${new Date().toISOString().slice(0, 10)}.csv`);

  const updateRecoveredPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    if (newPassword.length < 6) {
      setError("Choose a password with at least 6 characters.");
      return;
    }
    setUpdatingPassword(true);
    setError("");
    setNotice("");
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setUpdatingPassword(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNewPassword("");
    setPasswordRecoveryMode(false);
    setNotice("Password updated. You can keep using Wicked Card Tracker.");
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
  };

  const primeLotSuccessHasDrafts = Boolean(primeLotPostResult?.draftListingCount);
  const primeLotSuccessViewListingsUrl = primeLotConnection.storeUrl || primeLotPostResult?.listings[0]?.url || PRIMELOT_DASHBOARD_URL;

  return (
    <main className="shell mobileDashboardShell">
      <header className="mobileTopHeader" aria-label="Wicked Card Tracker dashboard header">
        <button className="iconCircle menuToggleButton" type="button" aria-label={mobileQuickActionsOpen ? "Close quick actions menu" : "Open quick actions menu"} aria-expanded={mobileQuickActionsOpen} aria-controls="quick-actions" onClick={() => setMobileQuickActionsOpen((open) => !open)}>☰</button>
        <Logo />
        <div className="topHeaderActions">
          <a className="secondary signOutButton" href={accountActionPath}>{accountActionLabel}</a>
          {session ? <button className="secondary signOutButton" onClick={signOut} type="button">Sign out</button> : <a className="primary signOutButton" href="#account-login">Sign up</a>}
        </div>
      </header>

      {passwordRecoveryMode && (
        <section className="panel passwordResetPanel" aria-label="Set new password">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Password reset</p>
              <h2>Choose your new password</h2>
              <p className="muted">Enter a new Wicked Card Tracker password to finish the reset.</p>
            </div>
          </div>
          <form className="authForm" onSubmit={updateRecoveredPassword}>
            <Field label="New password" type="password" value={newPassword} onChange={setNewPassword} required />
            <button className="primary" disabled={updatingPassword} type="submit">{updatingPassword ? "Updating…" : "Update password"}</button>
          </form>
        </section>
      )}

      {session && (
        <section className="collectorHeroCard" aria-label="Logged in account and portfolio summary">
          <div className="collectorHeroContent">
            <span className="loginBadge"><span /> Logged In</span>
            <strong className="collectorEmail">{session.user.email || "Account"}</strong>
            <p className="collectorSince">▣ Collector workspace</p>
            <span className={`subscriptionStatusPill ${hasActiveSubscription ? "isSubscribed" : "isNotSubscribed"}`}>{subscriptionStatusLabel}</span>
            <div className="heroStatsGrid compactHeroStats">
              <Stat label="Total Unsold Cards" value={String(activeInventoryQuantity)} />
              <Stat label="Total Inventory Value" value={money(totals.totalInventoryValue)} />
              <Stat label="Inventory at Grading" value={money(openGradingPurchaseValue)} tone={openGradingPurchaseValue > 0 ? "warning" : undefined} />
            </div>
          </div>
          <div className="slabShowpiece" aria-label={mostExpensiveSoldCard ? `Top sold card ${mostExpensiveSoldCard.name} card sale ${money(mostExpensiveSoldCard.soldPrice)}` : "Top sold card placeholder"}>
            <div className="slabControls" aria-label="Top sold card period">
              <button className={topSoldMode === "all" ? "active" : ""} type="button" onClick={() => setTopSoldMode("all")}>All time</button>
              <button className={topSoldMode === "month" ? "active" : ""} type="button" onClick={() => setTopSoldMode("month")}>Month</button>
              {topSoldMode === "month" && <input aria-label="Top sold month" type="month" value={topSoldMonth} onChange={(e) => setTopSoldMonth(e.target.value)} />}
            </div>
            <div className="slabLabel">TOP SOLD • {topSoldPeriodLabel}</div>
            <div className={`slabArt ${mostExpensiveSoldCard?.frontPhotoUrl ? "hasPhoto" : ""}`}>
              {mostExpensiveSoldCard?.frontPhotoUrl ? (
                <img src={mostExpensiveSoldCard.frontPhotoUrl} alt={`Front of ${mostExpensiveSoldCard.name}`} />
              ) : (
                <span>{mostExpensiveSoldCard ? mostExpensiveSoldCard.name.slice(0, 1).toUpperCase() : "W"}</span>
              )}
            </div>
            <div className="slabBase">
              {mostExpensiveSoldCard ? (
                <>
                  <strong>{money(mostExpensiveSoldCard.soldPrice)}</strong>
                  <small>{mostExpensiveSoldCard.name}</small>
                  <small>Sold {formatDateLabel(mostExpensiveSoldCard.saleDate) || "date not set"}</small>
                </>
              ) : (
                <>
                  <strong>WCT</strong>
                  <small>No sold cards for {topSoldPeriodLabel.toLowerCase()}.</small>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {session && (
        <section className="secondaryStatStrip" aria-label="Business stat strip">
          <button type="button" onClick={showSoldInventory}><small>Sold Cards</small><strong>{totals.soldCount}</strong></button>
          <button type="button" onClick={() => setTab("profit")}><small>Sold Revenue</small><strong className={totals.revenue > 0 ? "positive" : ""}>{money(totals.revenue)}</strong></button>
          <button type="button" onClick={() => setTab("profit")}><small>Net Profit After Costs/Fees</small><strong className={totals.periodNetProfit >= 0 ? "positive" : "negative"}>{money(totals.periodNetProfit)}</strong></button>
          <button type="button" onClick={() => setTab("roi")}><small>ROI after expenses</small><strong className={totals.roi >= 0 ? "positive" : "negative"}>{percent(totals.roi)}</strong></button>
          <button type="button" onClick={() => setTab("glance")}><small>Cash on hand</small><strong className={totals.cash >= 0 ? "positive" : "negative"}>{money(totals.cash)}</strong></button>
        </section>
      )}

      {session && showInventoryUtilityPanels && !cashAdjustments.length && !cashOnboardingDismissed && (
        <section className="cashOnboardingCard" aria-label="Cash on hand onboarding">
          <div>
            <p className="eyebrow">Getting started</p>
            <h2>Add your starting cash first</h2>
            <p className="muted">Cash on hand is most useful when you tell Wicked Card Tracker how much business cash you started with before buying inventory. Add it now so purchases, sales, and expenses show the real cash picture.</p>
          </div>
          <div className="rowActions">
            <button className="primary" type="button" onClick={scrollToDashboardCashEntry}>Add starting cash</button>
            <button className="secondary" type="button" onClick={dismissCashOnboarding}>I'll do this later</button>
          </div>
        </section>
      )}

      {session && showInventoryUtilityPanels && (
        <section className={`dashboardCashEntryPanel ${dashboardCashEntryOpen ? "isOpen" : "isCollapsed"}`} id="dashboard-cash-entry" aria-label="Enter cash on hand from dashboard">
          <button className="cashEntryToggle" type="button" onClick={() => setDashboardCashEntryOpen((open) => !open)} aria-expanded={dashboardCashEntryOpen} aria-controls="dashboard-cash-entry-form">
            <span>
              <span className="eyebrow">Cash on hand</span>
              <strong>{cashAdjustments.length ? "Add or adjust cash" : "Enter starting cash"}</strong>
              <small>{dashboardCashEntryOpen ? "Only use this for actual cash added to or removed from the business." : `Current cash: ${money(totals.cash)}. Purchases subtract automatically and sales add automatically.`}</small>
            </span>
            <span className="cashEntryToggleIcon" aria-hidden="true">{dashboardCashEntryOpen ? "−" : "+"}</span>
          </button>
          {dashboardCashEntryOpen && (
            <div className="dashboardCashEntryBody" id="dashboard-cash-entry-form">
              <div>
                <h2>Enter actual business cash</h2>
                <p className="muted">Only use this feature to add actual cash to your business or record cash removed. When you add inventory with a purchase price, cash on hand is automatically deducted. When you sell a card, cash on hand is automatically added. Current cash on hand: <strong>{money(totals.cash)}</strong>.</p>
              </div>
              <form className="formGrid dashboardCashForm" onSubmit={saveCashAdjustment}>
                <Select label="Cash type" value={activeCashAdjustment.adjustmentType} options={["Starting Cash", "Cash Added", "Cash Removed"]} onChange={(v) => setActiveCashAdjustment({ ...activeCashAdjustment, adjustmentType: v as CashAdjustmentRecord["adjustmentType"] })} required />
                <Field label="Amount" type="number" value={String(activeCashAdjustment.amount)} onChange={(v) => setActiveCashAdjustment({ ...activeCashAdjustment, amount: Number(v || 0) })} required />
                <Field label="Date" type="date" value={activeCashAdjustment.adjustmentDate} onChange={(v) => setActiveCashAdjustment({ ...activeCashAdjustment, adjustmentDate: v })} required />
                <Field label="Note" value={activeCashAdjustment.description} onChange={(v) => setActiveCashAdjustment({ ...activeCashAdjustment, description: v })} placeholder="Starting money for first card buys" required />
                <button className="primary" type="submit">{editingCashAdjustmentId ? "Save cash entry" : "Add cash entry"}</button>
                {editingCashAdjustmentId && <button className="secondary" type="button" onClick={() => { setActiveCashAdjustment(emptyCashAdjustment()); setEditingCashAdjustmentId(null); setDashboardCashEntryOpen(false); }}>Cancel edit</button>}
              </form>
            </div>
          )}
        </section>
      )}

      {mobileQuickActionsOpen && <button className="quickActionsScrim" type="button" aria-label="Close quick actions menu" onClick={() => setMobileQuickActionsOpen(false)} />}
      <section className={`quickActionsPanel ${mobileQuickActionsOpen ? "isOpen" : "isCollapsed"}`} id="quick-actions" aria-label="Quick actions">
        <div className="quickActionsHeader">
          <p className="eyebrow">Quick Actions</p>
        </div>
        <nav className="navBar quickActionGrid" aria-label="Main navigation">
          {dashboardActions.map((action) => (
            <NavButton active={action.id === "soldInventory" ? tab === "inventory" && statusFilter === "Sold" : tab === action.tab && !(action.id === "inventory" && statusFilter === "Sold")} badge={action.badge} className={action.className} featured={action.id === "add"} key={action.id} onClick={() => runDashboardAction(action)} subtitle={action.subtitle}>
              {action.label}
            </NavButton>
          ))}
        </nav>
      </section>

      {appUpdateAvailable && (
        <section className="appUpdateBanner" role="alert" aria-live="assertive" aria-label="New Wicked Card Tracker update available">
          <div>
            <strong>New update available</strong>
            <span>Press Refresh to load the latest Wicked Card Tracker changes.</span>
          </div>
          <button className="primary" type="button" onClick={refreshToLatestApp}>Refresh</button>
        </section>
      )}
      {notice && <p className="notice">{notice}</p>}
      {showAddInventoryCheck && <div className="addInventoryCheck" aria-live="polite" aria-label="Inventory added">✓</div>}
      {error && <p className="errorBox">{error}</p>}
      {loading && <p className="notice">Loading…</p>}
      {!session && <AuthPanel defaultMode="signin" />}

      {session && showInventoryUtilityPanels && (
        <section className="primeLotStatusCard" aria-label="PrimeLot connection status">
          <div className="primeLotStatusTopRow">
            <div className="primeLotStatusBrand">
              <a className="primeLotLogoLink" href="https://primelot.cards" target="_blank" rel="noreferrer" aria-label="Open PrimeLot storefront website">
                <img src="/primelot-logo.png" alt="PrimeLot logo" />
              </a>
              <strong>PrimeLot Storefront</strong>
            </div>
            <div className="primeLotStatusActions">
              <button className="secondary" type="button" onClick={() => openPrimeLotModal(primeLotConnection.requestedIntent === "connect" ? "connect" : "create")}>Manage</button>
              <button className="secondary compactButton primeLotDetailsToggle" type="button" onClick={() => setPrimeLotDetailsOpen((open) => !open)} aria-expanded={primeLotDetailsOpen} aria-controls="primelot-status-details" aria-label={primeLotDetailsOpen ? "Hide PrimeLot storefront details" : "Show PrimeLot storefront details"}>{primeLotDetailsOpen ? "⌃" : "⌄"}</button>
            </div>
          </div>
          {primeLotDetailsOpen && (
            <div className="primeLotStatusDetails" id="primelot-status-details">
              <strong>{primeLotConnection.connected ? "Connected" : primeLotConnection.status === "pending" ? "Activation pending" : "Not connected"}</strong>
              <p className="muted">
                {primeLotConnection.connected
                  ? `Publishing to ${primeLotConnection.sellerEmail || "your PrimeLot seller account"}${primeLotConnection.storeUrl ? ` • ${primeLotConnection.storeUrl}` : ""}`
                  : primeLotConnection.status === "pending"
                    ? `Request saved for ${primeLotConnection.sellerEmail || "PrimeLot"}. Listings will post after activation.`
                    : "Turn selected inventory into public PrimeLot listings without retyping card details."}
              </p>
            </div>
          )}
        </section>
      )}

      {cashSuccessSummary && (
        <div className="modalBackdrop cashSuccessBackdrop" role="dialog" aria-modal="true" aria-label="Cash entry saved successfully">
          <section className="modalCard cashSuccessModal">
            <div className="successIcon" aria-hidden="true">✓</div>
            <div>
              <p className="eyebrow">Cash on hand updated</p>
              <h2>{cashSuccessTitle(cashSuccessSummary.adjustmentType)}</h2>
              <p className="muted">Your business cash has been updated and your dashboard totals now include this entry.</p>
            </div>
            <div className="successSummaryGrid cashSuccessSummaryGrid">
              <span><small>Cash type</small><strong>{cashSuccessSummary.adjustmentType}</strong></span>
              <span><small>Amount</small><strong>{cashSuccessSummary.adjustmentType === "Cash Removed" ? "-" : "+"}{money(cashSuccessSummary.amount)}</strong></span>
              <span><small>Date</small><strong>{formatDateLabel(cashSuccessSummary.adjustmentDate)}</strong></span>
              <span><small>Cash on hand</small><strong>{money(cashSuccessSummary.endingCash)}</strong></span>
            </div>
            <div className="cashSuccessNote">
              <small>Note</small>
              <strong>{cashSuccessSummary.description}</strong>
            </div>
            <button className="primary full" type="button" onClick={() => setCashSuccessSummary(null)}>Nice — continue</button>
          </section>
        </div>
      )}

      {primeLotModalOpen && (
        <div className="modalBackdrop" role="presentation">
          <section className="modalCard primeLotModal" role="dialog" aria-modal="true" aria-labelledby="primelot-connect-title">
            <div className="modalHeader">
              <div>
                <p className="eyebrow">PrimeLot sales channel</p>
                <h2 id="primelot-connect-title">{primeLotConnection.connected ? "PrimeLot connected" : "Sell cards on PrimeLot"}</h2>
              </div>
              <button className="secondary compactButton" type="button" onClick={() => setPrimeLotModalOpen(false)}>Close</button>
            </div>
            <p className="muted">Connect a PrimeLot storefront once. After that, selected Card Tracker inventory can be sent to PrimeLot. Public listings move to Listed here; drafts stay Not Listed until they are published on PrimeLot.</p>
            <div className="primeLotBenefitGrid">
              <span>Public listing pages</span>
              <span>Shareable card URLs</span>
              <span>No duplicate data entry</span>
              <span>Listing links saved here</span>
            </div>
            <form className="stackedForm" onSubmit={savePrimeLotConnection}>
              <div className="segmentedButtons" role="group" aria-label="PrimeLot setup type">
                <button className={primeLotIntent === "create" ? "primary active" : "primary"} type="button" onClick={() => setPrimeLotIntent("create")}>Create PrimeLot account</button>
                <button className={primeLotIntent === "connect" ? "primary active" : "primary"} type="button" onClick={() => setPrimeLotIntent("connect")}>I already have PrimeLot</button>
              </div>
              <div className="primeLotIntentNote">
                <strong>{primeLotIntent === "connect" ? "Connect your existing PrimeLot shop" : "Request a new PrimeLot shop"}</strong>
                <p>{primeLotIntent === "connect" ? "Use the email and shop name already on PrimeLot. If this shop matches the configured PrimeLot seller account, it activates right away." : "We will save this request so the PrimeLot storefront can be created, then activated for posting."}</p>
              </div>
              <Field label="PrimeLot account email" type="email" value={primeLotEmail} onChange={setPrimeLotEmail} required />
              <Field label="PrimeLot shop name (optional)" value={primeLotStoreSlug} onChange={setPrimeLotStoreSlug} placeholder="zoltans-cards" />
              <p className="muted formHelpText">This is the storefront name/URL you want on PrimeLot. If you already have PrimeLot, use your existing shop name.</p>
              {primeLotConnection.status === "pending" && <p className="notice">Your PrimeLot request is saved. Activation is pending before cards can post.</p>}
              {primeLotConnection.connected && <p className="notice">Connected to {primeLotConnection.sellerEmail || "PrimeLot"}. You can post selected cards now.</p>}
              {primeLotConnection.migrationRequired && <p className="errorBox">Connection storage still needs the PrimeLot SQL migration before requests can save.</p>}
              <div className="rowActions">
                <button className="primary" type="submit" disabled={savingPrimeLotConnection}>{savingPrimeLotConnection ? "Saving…" : primeLotConnection.connected ? "Update connection" : "Save PrimeLot Request"}</button>
                <button className="secondary" type="button" onClick={() => setPrimeLotModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </section>
        </div>
)}


      {primeLotReviewOpen && (
        <div className="modalBackdrop" role="presentation">
          <section className="modalCard primeLotReviewModal" role="dialog" aria-modal="true" aria-labelledby="primelot-review-title">
            <div className="modalHeader">
              <div>
                <p className="eyebrow">Review PrimeLot listings</p>
                <h2 id="primelot-review-title">Confirm before posting</h2>
                <p className="muted">Review each selected card, fill in any missing details, then confirm only when you are ready.</p>
              </div>
              <button className="secondary compactButton" type="button" onClick={() => { setPrimeLotReviewOpen(false); setPrimeLotReviewError(""); setPrimeLotReviewErrors({}); }}>Cancel</button>
            </div>
            {primeLotReviewError && <div className="primeLotReviewError" role="alert">{primeLotReviewError}</div>}
            <div className="primeLotIntentNote liveWarning">
              <strong>All imports are saved as PrimeLot drafts</strong>
              <p>Choose the correct PrimeLot listing type for each row. Sealed boxes, booster packs, tins, cases, and other sealed products must use Sealed Product. PrimeLot will save imported listings as drafts for review before publishing.</p>
            </div>
            <div className="primeLotReviewList">
              {selectedCards.map((card) => {
                const canPostToPrimeLot = canPostCardToPrimeLot(card);
                const isAlreadyOnPrimeLot = alreadyOnPrimeLot(card);
                const draft = primeLotReviewDrafts[card.id] || { askingPrice: String(card.askingPrice || ""), shippingCharge: String(card.shippingCharge || 0), gradingCompany: card.gradingCompany || "", listingType: "" as PrimeLotListingType | "" };
                const fieldErrors = primeLotReviewErrors[card.id] || {};
                const total = Number(draft.askingPrice || 0) * cardQuantity(card);
                return (
                  <article className={`${canPostToPrimeLot ? "primeLotReviewRow" : "primeLotReviewRow blocked"} ${Object.keys(fieldErrors).length ? "needsReview" : ""}`} key={card.id}>
                    <div className="primeLotReviewCardHeader">
                      <div>
                        <strong>{card.name}</strong>
                        <p className="muted">{[card.year, card.setName, card.cardNumber].filter(Boolean).join(" • ") || "No card details"} • 1 listing{cardQuantity(card) > 1 ? ` • Qty ${cardQuantity(card)}` : ""}</p>
                      </div>
                      <span className={`statusBadge ${card.status.replace(" ", "").toLowerCase()}`}>{canPostToPrimeLot ? "Ready" : "Already posted on PrimeLot"}</span>
                    </div>
                    <div className="primeLotReviewFields compact">
                      <div className={fieldErrors.listingType ? "primeLotReviewField invalid" : "primeLotReviewField"}>
                        <label>PrimeLot listing type<select required aria-invalid={Boolean(fieldErrors.listingType)} value={draft.listingType} onChange={(event) => updatePrimeLotReviewDraft(card.id, "listingType", event.target.value)}>
                          <option value="">Choose listing type</option>
                          {primeLotListingTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select></label>
                        {fieldErrors.listingType && <p className="fieldErrorText">{fieldErrors.listingType}</p>}
                      </div>
                      <div className={fieldErrors.askingPrice ? "primeLotReviewField invalid" : "primeLotReviewField"}>
                        <Field label="Listing price" type="number" value={draft.askingPrice} onChange={(value) => updatePrimeLotReviewDraft(card.id, "askingPrice", value)} required />
                        {fieldErrors.askingPrice && <p className="fieldErrorText">{fieldErrors.askingPrice}</p>}
                      </div>
                      <Field label="Buyer shipping charge" type="number" value={draft.shippingCharge} onChange={(value) => updatePrimeLotReviewDraft(card.id, "shippingCharge", value)} />
                    </div>
                    {fieldErrors.gradingCompany && <p className="fieldErrorText">{fieldErrors.gradingCompany}</p>}
                    {draft.listingType === "sealed_product" && <p className="muted">Use Sealed Product for sealed boxes, booster packs, tins, cases, and other unopened products so PrimeLot does not import them as single cards.</p>}
                    {canPostToPrimeLot ? (
                      <p className="muted">PrimeLot listing total: {money(total)}</p>
                    ) : (
                      <div className="primeLotBlockedActions">
                        <p className="warning">This selected row already has a PrimeLot listing link, so it will not be posted again unless you clear that PrimeLot link first.</p>
                        {isAlreadyOnPrimeLot && <button className="secondary compactButton" type="button" onClick={() => clearPrimeLotListingForCard(card)}>Clear PrimeLot listing</button>}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            <div className="primeLotReviewSummary">
              <span><small>Listings selected</small><strong>{selectedPrimeLotCards.length}</strong></span>
              <span><small>Estimated total</small><strong>{money(selectedPrimeLotCards.reduce((sum, card) => sum + (Number(primeLotReviewDrafts[card.id]?.askingPrice || card.askingPrice || 0) * cardQuantity(card)), 0))}</strong></span>
            </div>
            <div className="rowActions">
              <button className="primary" type="button" onClick={confirmPrimeLotPost} disabled={postingToPrimeLot}>{postingToPrimeLot ? "Importing…" : "Confirm — import drafts to PrimeLot"}</button>
              <button className="secondary" type="button" onClick={() => { setPrimeLotReviewOpen(false); setPrimeLotReviewError(""); setPrimeLotReviewErrors({}); }}>Cancel — go back</button>
            </div>
          </section>
        </div>
      )}

      {primeLotPostResult && (
        <div className="modalBackdrop" role="presentation">
          <section className="modalCard primeLotSuccessModal" role="dialog" aria-modal="true" aria-labelledby="primelot-post-success-title">
            <div className="successIcon" aria-hidden="true">✓</div>
            <div>
              <p className="eyebrow">PrimeLot import complete</p>
              <h2 id="primelot-post-success-title">Your cards imported successfully.</h2>
              {primeLotSuccessHasDrafts ? (
                <p className="muted">Your listings imported successfully. They were saved as drafts in PrimeLot so you can review them before publishing.</p>
              ) : (
                <p className="muted">Your listings are now live on the PrimeLot marketplace.</p>
              )}
            </div>
            <div className="successSummaryGrid">
              <span><small>Imported cards</small><strong>{primeLotPostResult.postedCount}</strong></span>
              <span><small>Live listings</small><strong>{primeLotPostResult.publicListingCount}</strong></span>
              <span><small>Drafts</small><strong>{primeLotPostResult.draftListingCount}</strong></span>
              <span><small>Total amount</small><strong>{money(primeLotPostResult.totalAmount)}</strong></span>
            </div>
            <div className="postedListingList">
              {primeLotPostResult.listings.map((listing) => (
                <article key={listing.primeLotListingId}>
                  <div>
                    <strong>{listing.cardName}</strong>
                    <p className="muted">{money(listing.amount)}{listing.shippingCharge ? ` • Shipping ${money(listing.shippingCharge)}` : " • Free shipping"} • {isPrimeLotPublicListing(listing.status) ? "Live on PrimeLot" : "Draft in PrimeLot"}</p>
                  </div>
                  {isPrimeLotPublicListing(listing.status) ? <a href={listing.url} target="_blank" rel="noreferrer">Open</a> : <a href={PRIMELOT_DRAFTS_URL} target="_blank" rel="noreferrer">Drafts</a>}
                </article>
              ))}
            </div>
            <div className="rowActions">
              {primeLotSuccessHasDrafts ? (
                <a className="primary buttonLink" href={PRIMELOT_DRAFTS_URL} target="_blank" rel="noreferrer">View Drafts</a>
              ) : (
                <a className="primary buttonLink" href={primeLotSuccessViewListingsUrl} target="_blank" rel="noreferrer">View Listings</a>
              )}
              <button className="secondary" type="button" onClick={() => setPrimeLotPostResult(null)}>Done</button>
            </div>
          </section>
        </div>
      )}

      {primeLotMembershipRequiredOpen && (
        <div className="modalBackdrop" role="presentation">
          <section className="modalCard primeLotSuccessModal" role="dialog" aria-modal="true" aria-labelledby="primelot-membership-required-title">
            <div className="successIcon" aria-hidden="true">!</div>
            <div>
              <p className="eyebrow">PrimeLot Seller membership needed</p>
              <h2 id="primelot-membership-required-title">Start a PrimeLot Seller membership to import and publish your listings.</h2>
              <p className="muted">PrimeLot is not accepting non-seller draft imports yet. Once PrimeLot adds that API support, WCT can show draft-import messaging.</p>
            </div>
            <div className="rowActions">
              <a className="primary buttonLink" href={PRIMELOT_SELLER_MEMBERSHIP_URL} target="_blank" rel="noreferrer">Start Seller Membership</a>
              <a className="secondary buttonLink" href={PRIMELOT_DASHBOARD_URL} target="_blank" rel="noreferrer">Go to PrimeLot Dashboard</a>
              <button className="secondary" type="button" onClick={() => setPrimeLotMembershipRequiredOpen(false)}>Close</button>
            </div>
          </section>
        </div>
      )}

      {tab === "primeLotMarketplace" && (
        <section className="primeLotLandingPanel primeLotHeroOnlyPanel" id="primelot-marketplace-panel" aria-label="PrimeLot Marketplace landing page">
          <div className="primeLotCenteredLogo">
            <Link href="https://primelot.cards" target="_blank" rel="noreferrer" aria-label="Open PrimeLot Cards">
              <NextImage src="/primelot-logo.png" alt="PrimeLot Cards" width={360} height={156} priority />
            </Link>
          </div>

          <div className="primeLotLandingHero primeLotSoloHero">
            <div className="primeLotHeroCopy">
              <p className="primeLotPill">The transparent card marketplace</p>
              <h1>Buy &amp; Sell Cards Without Marketplace Fees</h1>
              <p className="subhead">PrimeLot helps collectors browse, buy, sell, make offers, and message directly — with transparent pricing on every card, lot, sealed product, and wishlist match.</p>
              <div className="primeLotHeroActions">
                <Link className="primeLotRedButton" href={PRIMELOT_SIGNUP_URL} target="_blank" rel="noreferrer">Start 3 Months Free</Link>
                <Link className="primeLotGhostButton" href={PRIMELOT_MARKETPLACE_URL} target="_blank" rel="noreferrer">Browse Marketplace</Link>
              </div>
              <div className="primeLotTrustRow" aria-label="PrimeLot benefits">
                {[
                  "0% PrimeLot transaction fees",
                  "Pay sellers directly",
                  "Singles, lots & sealed",
                  "Wishlist matching",
                ].map((item) => <span key={item}>{item}</span>)}
              </div>
              <div className="primeLotHeroOffer">First 3 months free. Then $6.99/month plus applicable tax.</div>
            </div>
          </div>
        </section>
      )}

      {tab === "glance" && (
        <section className="panel atAGlancePanel printableReport" id="at-a-glance-panel">
          <div className="panelHeader inventoryHeader businessReportHeader">
            <div>
              <p className="eyebrow">Business Numbers</p>
              <h2>Clean business snapshot</h2>
              <p className="muted">Showing {selectedDateLabel.toLowerCase()}. Report includes inventory bought in the period (even if already sold), current inventory, sold totals, expenses/fees, net profit, and ROI after costs and fees.</p>
            </div>
            <button className="secondary noPrint printReportButton" type="button" onClick={() => window.print()}>Print report</button>
          </div>
          <DateFilterControls
            mode={dateFilterMode}
            startDate={customStartDate}
            endDate={customEndDate}
            selectedLabel={selectedDateLabel}
            onModeChange={setDateFilterMode}
            onStartDateChange={setCustomStartDate}
            onEndDateChange={setCustomEndDate}
          />
          <section className="glanceHeroGrid detailedReportGrid" aria-label="Detailed business report totals">
            <Stat label="Cash on hand" value={money(totals.cash)} tone={totals.cash >= 0 ? "positive" : "negative"} />
            <Stat label="Net profit after costs/fees" value={money(totals.periodNetProfit)} tone={totals.periodNetProfit >= 0 ? "positive" : "negative"} />
            <Stat label="ROI after costs/fees" value={percent(totals.roi)} tone={totals.roi >= 0 ? "positive" : "negative"} />
            <Stat label="Total inventory bought" value={money(totals.totalInventoryBought)} />
            <Stat label="Current inventory cost" value={money(totals.currentInventoryCost)} />
            <Stat label="Current inventory value" value={money(totals.currentInventoryValue)} />
            <Stat label="Total sold collected" value={money(totals.revenue)} />
            <Stat label="Sold inventory cost" value={money(totals.soldInventoryCost)} />
            <Stat label="Expenses & fees" value={money(totals.expensesTotal)} />
          </section>
          <section className="glanceBreakdown detailedReportBreakdown" aria-label="Detailed report breakdown">
            <div>
              <p className="eyebrow">Inventory</p>
              <h3>{money(totals.totalInventoryBought)}</h3>
              <ul className="reportBreakdownList">
                <li><span>All inventory bought in period</span><strong>{money(totals.totalInventoryBought)}</strong></li>
                <li><span>Current inventory cost</span><strong>{money(totals.currentInventoryCost)}</strong></li>
                <li><span>Not listed</span><strong>{totals.notListedCount} cards • {money(totals.unlistedInventoryCost)}</strong></li>
                <li><span>Listed</span><strong>{totals.listedCount} cards • {money(totals.listedInventoryCost)}</strong></li>
                <li><span>Current listed asking value</span><strong>{money(totals.listedInventoryValue)}</strong></li>
              </ul>
            </div>
            <div>
              <p className="eyebrow">Sold</p>
              <h3>{money(totals.revenue)}</h3>
              <ul className="reportBreakdownList">
                <li><span>Sold cards</span><strong>{totals.soldCount}</strong></li>
                <li><span>Total collected</span><strong>{money(totals.revenue)}</strong></li>
                <li><span>Sold inventory cost</span><strong>{money(totals.soldInventoryCost)}</strong></li>
                <li><span>Sale fees tied to sold cards</span><strong>{money(totals.saleExpensesForSoldCardsTotal)}</strong></li>
              </ul>
            </div>
            <div>
              <p className="eyebrow">Expenses & fees</p>
              <h3>{money(totals.expensesTotal)}</h3>
              <ul className="reportBreakdownList">
                {totals.expenseBreakdown.map((row) => (
                  <li key={row.category}><span>{row.category}</span><strong>{money(row.total)}</strong></li>
                ))}
              </ul>
            </div>
          </section>
          <section className="cashEntryPanel noPrint" aria-label="Add cash on hand">
            <div>
              <p className="eyebrow">Cash on hand</p>
              <h3>Add starting cash or owner cash</h3>
              <p className="muted">Use this only for money put into or taken out of the business. Do not use it for card purchases — purchase price on Add Inventory already subtracts from cash.</p>
            </div>
            <form className="formGrid simpleForm" onSubmit={saveCashAdjustment}>
              <Select label="Cash type" value={activeCashAdjustment.adjustmentType} options={["Starting Cash", "Cash Added", "Cash Removed"]} onChange={(v) => setActiveCashAdjustment({ ...activeCashAdjustment, adjustmentType: v as CashAdjustmentRecord["adjustmentType"] })} required />
              <Field label="Amount" type="number" value={String(activeCashAdjustment.amount)} onChange={(v) => setActiveCashAdjustment({ ...activeCashAdjustment, amount: Number(v || 0) })} required />
              <Field label="Date" type="date" value={activeCashAdjustment.adjustmentDate} onChange={(v) => setActiveCashAdjustment({ ...activeCashAdjustment, adjustmentDate: v })} required />
              <Field label="Note" value={activeCashAdjustment.description} onChange={(v) => setActiveCashAdjustment({ ...activeCashAdjustment, description: v })} placeholder="Starting money for first card buys" required />
              <button className="primary" type="submit">{editingCashAdjustmentId ? "Save cash entry" : "Add cash entry"}</button>
              {editingCashAdjustmentId && <button className="secondary" type="button" onClick={() => { setActiveCashAdjustment(emptyCashAdjustment()); setEditingCashAdjustmentId(null); }}>Cancel edit</button>}
            </form>
          </section>
          <section className="cashEntryList noPrint" aria-label="Cash entries">
            <div className="rowTitle"><strong>Cash entries for {selectedDateLabel.toLowerCase()}</strong></div>
            {totals.filteredCashAdjustments.map((entry) => (
              <article className="expenseRow" key={entry.id}>
                <div className="expenseDetails">
                  <div className="rowTitle"><strong>{entry.adjustmentType}</strong></div>
                  <p>{entry.description}</p>
                  <p className="muted auditTrail">Added {formatDateTimeLabel(entry.createdAt)} by {actorLabel(entry.createdBy, currentUsername)}{entry.updatedAt !== entry.createdAt ? ` • Updated ${formatDateTimeLabel(entry.updatedAt)} by ${actorLabel(entry.updatedBy, currentUsername)}` : ""}</p>
                </div>
                <span>{entry.adjustmentDate}</span>
                <strong>{entry.adjustmentType === "Cash Removed" ? "-" : "+"}{money(entry.amount)}</strong>
                <div className="rowActions">
                  <button className="secondary" type="button" onClick={() => { setActiveCashAdjustment(entry); setEditingCashAdjustmentId(entry.id); setDashboardCashEntryOpen(true); scrollToSection("dashboard-cash-entry"); }}>Edit</button>
                  <button className="danger" type="button" onClick={() => deleteCashAdjustment(entry)}>Delete</button>
                </div>
              </article>
            ))}
            {!totals.filteredCashAdjustments.length && <p className="empty">No cash entries for {selectedDateLabel.toLowerCase()}.</p>}
          </section>
        </section>
      )}

      {tab === "roi" && session && (
        <section className="panel roiPanel" id="roi-panel">
          <div className="panelHeader inventoryHeader">
            <div>
              <p className="eyebrow">ROI%</p>
              <h2>Return on sold inventory</h2>
              <p className="muted">Showing {selectedDateLabel.toLowerCase()}. ROI% is net profit after all expenses divided by sold inventory cost plus expenses.</p>
            </div>
          </div>
          <DateFilterControls
            mode={dateFilterMode}
            startDate={customStartDate}
            endDate={customEndDate}
            selectedLabel={selectedDateLabel}
            onModeChange={setDateFilterMode}
            onStartDateChange={setCustomStartDate}
            onEndDateChange={setCustomEndDate}
          />
          <section className="statsGrid roiSummaryGrid" aria-label="ROI% summary">
            <Stat label="ROI after expenses" value={percent(totals.roi)} tone={totals.roi >= 0 ? "positive" : "negative"} />
            <Stat label="ROI cost basis" value={money(totals.roiCostBasis)} />
            <Stat label="Net profit after costs/fees" value={money(totals.periodNetProfit)} tone={totals.periodNetProfit >= 0 ? "positive" : "negative"} />
            <Stat label="Expenses & fees" value={money(totals.expensesTotal)} />
          </section>
          <section className="roiChartCard" aria-label="ROI% trend chart">
            <div className="roiChartHeader">
              <div>
                <p className="eyebrow">ROI% trend</p>
                <h3>{roiTrendPoints.length ? `${roiTrendPoints.length} period${roiTrendPoints.length === 1 ? "" : "s"}` : "No sold cards in this range"}</h3>
                <p className="muted">Shows only periods with sold cards. No-sale expense periods stay in the ROI total above, but do not become chart dots.</p>
              </div>
              <strong className={totals.roi >= 0 ? "positive" : "negative"}>{percent(totals.roi)}</strong>
            </div>
            {roiTrendPoints.length ? (
              <>
                {roiTrendPoints.length > 1 && (
                  <>
                    <div className="roiChartLegend" aria-label="ROI chart legend">
                      <span><i className="roiLineKey" />ROI after expenses</span>
                      <span><i className="roiDotKey" />Sold-card periods</span>
                    </div>
                    <svg className="roiChartSvg" viewBox="0 0 100 100" role="img" aria-label={`ROI% line chart for ${selectedDateLabel}`} preserveAspectRatio="none">
                      <line x1="0" x2="100" y1="90" y2="90" />
                      <line x1="0" x2="100" y1="55" y2="55" />
                      <line x1="0" x2="100" y1="20" y2="20" />
                      <path d={roiTrendPath} />
                      {roiTrendPoints.map((point, index) => {
                        const cx = (index / (roiTrendPoints.length - 1)) * 100;
                        const cy = 90 - ((point.roi - roiTrendMin) / roiTrendRange) * 70;
                        return <circle key={point.key} cx={cx} cy={cy} r="2.2" />;
                      })}
                    </svg>
                  </>
                )}
                {roiTrendPoints.length === 1 && (
                  <p className="singleRoiNote">Only one sold-card period in this range, so the chart is shown as a clean summary instead of a one-dot graph.</p>
                )}
                <div className={`roiTrendList ${roiTrendPoints.length === 1 ? "singlePeriod" : ""}`} aria-label="ROI% chart data">
                  {roiTrendPoints.map((point) => (
                    <div key={point.key}>
                      <span>{point.label}</span>
                      <strong className={point.roi >= 0 ? "positive" : "negative"}>{percent(point.roi)}</strong>
                      <small>{point.soldCount} sold • {money(point.profit)} profit</small>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="empty">No sold cards for {selectedDateLabel.toLowerCase()} yet.</p>
            )}
          </section>
        </section>
      )}

      {tab === "add" && session && (
        <section className="panel" id="add-inventory-panel">
          <div className="panelHeader addInventoryHeader">
            <div>
              <p className="eyebrow">Add Inventory</p>
              <h2>Add a card</h2>
            </div>
            <p className="muted addInventoryIntro">This section uploads your card to your <strong>Not Listed</strong> Inventory. All information here should be your cost for this card and the information you want to store.</p>
          </div>
          <section className="importPanel" aria-label="Import cards from PSA CSV">
            <div className="importHeader">
              <div>
                <p className="eyebrow">PSA CSV import</p>
                <h3>Import cards from PSA CSV</h3>
                <p className="muted">Upload a PSA CSV, preview the rows, select the cards you want, then import them into your Not Listed inventory.</p>
              </div>
              <label className="secondary importFileButton">Choose PSA CSV
                <input accept=".csv,text/csv" type="file" onChange={handleCardImportFile} />
              </label>
            </div>
            {importPreviews.length > 0 && (
              <div className="importPreview">
                <div className="importSummary">
                  <strong>{importReadyCount} selected of {importPreviews.length}</strong>
                  <span className="muted">{importWarningCount ? `${importWarningCount} rows need review` : "All rows look ready"}{importFileName ? ` • ${importFileName}` : ""}</span>
                </div>
                <div className="rowActions importActions">
                  <button className="secondary" type="button" onClick={selectAllImportPreviews}>Select all</button>
                  <button className="secondary" type="button" onClick={selectCleanImportPreviews}>Select clean rows</button>
                  <button className="secondary" type="button" onClick={clearImportPreviews}>Clear import</button>
                  <button className="primary" type="button" onClick={importSelectedCards} disabled={!importReadyCount || importingCards}>{importingCards ? "Importing…" : `Import ${importReadyCount} cards`}</button>
                </div>
                <div className="importPreviewList">
                  {importPreviews.map((preview) => (
                    <article className={preview.warnings.length ? "importPreviewRow needsReview" : "importPreviewRow"} key={preview.id}>
                      <label className="selectCardBox" aria-label={`Select row ${preview.sourceRow} for import`}>
                        <input type="checkbox" checked={preview.selected} onChange={() => toggleImportPreview(preview.id)} />
                      </label>
                      <div>
                        <div className="rowTitle"><strong>{preview.card.name}</strong><span className={`statusBadge ${preview.card.status.replace(" ", "").toLowerCase()}`}>{preview.card.status}</span></div>
                        <p>{[preview.card.year, preview.card.setName, preview.card.cardNumber].filter(Boolean).join(" • ") || "No card details"}</p>
                        <p className="muted">Cost {money(cardPurchaseCost(preview.card))}{cardQuantity(preview.card) > 1 ? ` (${cardQuantity(preview.card)} × ${money(preview.card.purchasePrice)})` : ""} • Bought {formatDateLabel(preview.card.purchaseDate)}</p>
                        {preview.warnings.length > 0 && <p className="warning">Review: {preview.warnings.join(" • ")}</p>}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
          <form className="formGrid simpleForm" id="add-inventory-form" onSubmit={saveCard}>
            <Field label="Card/player name" value={activeCard.name} onChange={(v) => setActiveCard({ ...activeCard, name: v })} required />
            <Field label="Category" value={activeCard.category} onChange={(v) => setActiveCard({ ...activeCard, category: v })} placeholder="Sports, Pokemon, MTG..." />
            <Field label="Year" value={activeCard.year} onChange={(v) => setActiveCard({ ...activeCard, year: v })} />
            <Field label="Set" value={activeCard.setName} onChange={(v) => setActiveCard({ ...activeCard, setName: v })} />
            <Field label="Card #" value={activeCard.cardNumber} onChange={(v) => setActiveCard({ ...activeCard, cardNumber: v })} />
            <Field label="Item quantity" type="number" value={String(activeCard.quantity)} onChange={(v) => setActiveCard({ ...activeCard, quantity: sanitizeQuantityInput(v) })} />
            <p className="muted full quantityPhotoNote">One front/back photo set applies to every copy in this row. If copies have different condition/photos, add or split them as separate rows.</p>
            <Field label="Your cost per item" type="number" value={String(activeCard.purchasePrice)} onChange={(v) => setActiveCard({ ...activeCard, purchasePrice: Number(v || 0) })} />
            <Field label="Date you purchased" type="date" value={activeCard.purchaseDate} onChange={(v) => setActiveCard({ ...activeCard, purchaseDate: v })} />
            <Field label="Grading company if already graded" value={activeCardGradingCompany} onChange={setActiveCardGradingCompany} placeholder="PSA, BGS, SGC, CGC..." />
            <Field label="Grade if already graded" value={activeCardGrade} onChange={(v) => { const parsed = gradeParts(v); setActiveCardGrade(parsed.grade); if (parsed.company && !activeCardGradingCompany) setActiveCardGradingCompany(parsed.company); }} placeholder="10, 9.5, 8..." />
            <Select label="Status" value={activeCard.status} options={statuses} onChange={(v) => setActiveCard(prepareCardForStatus(activeCard, v as CardStatus))} />
            <Field label="Listed where?" value={activeCard.listedPlatform} onChange={(v) => setActiveCard({ ...activeCard, listedPlatform: v, status: v ? "Listed" : activeCard.status, listedDate: v ? activeCard.listedDate || todayIso() : activeCard.listedDate })} placeholder="eBay, Whatnot, TCGplayer..." />
            <Field label="Listing URL" value={activeCard.listingUrl} onChange={(v) => setActiveCard({ ...activeCard, listingUrl: v })} />
            {activeCard.status === "Listed" && (
              <>
                <Field label="Asking price" type="number" value={String(activeCard.askingPrice)} onChange={(v) => setActiveCard({ ...activeCard, askingPrice: Number(v || 0) })} required />
                <Field label="Minimum sale price" type="number" value={String(activeCard.lowestAcceptablePrice)} onChange={(v) => setActiveCard({ ...activeCard, lowestAcceptablePrice: Number(v || 0) })} />
                <Field label="Buyer shipping charge" type="number" value={String(activeCard.shippingCharge)} onChange={(v) => setActiveCard({ ...activeCard, shippingCharge: Number(v || 0) })} />
                <Field label="Listed date" type="date" value={activeCard.listedDate} onChange={(v) => setActiveCard({ ...activeCard, listedDate: v })} required />
                <div className="calc">
                  <span>Potential profit: <strong className={listedPotentialProfit(activeCard) >= 0 ? "positive" : "negative"}>{money(listedPotentialProfit(activeCard))}</strong></span>
                </div>
              </>
            )}
            {activeCard.status === "Sold" && (
              <>
                <Field label="Card sale total" type="number" value={String(activeCard.soldPrice)} onChange={(v) => setActiveCard({ ...activeCard, soldPrice: Number(v || 0) })} required />
                <Field label="Buyer shipping collected" type="number" value={String(activeCard.shippingCharge || 0)} onChange={(v) => setActiveCard({ ...activeCard, shippingCharge: Number(v || 0) })} />
                <Field label="Sale date" type="date" value={activeCard.saleDate} onChange={(v) => setActiveCard({ ...activeCard, saleDate: v })} required />
                <Field label="Sold where?" value={activeCard.salePlatform} onChange={(v) => setActiveCard({ ...activeCard, salePlatform: v })} placeholder="eBay, Whatnot, private sale..." required />
              </>
            )}
            <div className="photoUploadGrid full">
              <PhotoUploadControl
                label="Front"
                onPick={(file) => uploadCardPhoto(file, "active", "front")}
              />
              <PhotoUploadControl
                label="Back"
                onPick={(file) => uploadCardPhoto(file, "active", "back")}
              />
            </div>
            {(activeCard.frontPhotoUrl || activeCard.backPhotoUrl) && (
              <div className="photoPreview full">
                {activeCard.frontPhotoUrl && (
                  <div className="photoPreviewItem">
                    <span>Front</span>
                    <img src={activeCard.frontPhotoUrl} alt="Front of card preview" />
                    <button className="secondary" type="button" onClick={() => setActiveCard({ ...activeCard, frontPhotoUrl: "" })}>Remove front</button>
                  </div>
                )}
                {activeCard.backPhotoUrl && (
                  <div className="photoPreviewItem">
                    <span>Back</span>
                    <img src={activeCard.backPhotoUrl} alt="Back of card preview" />
                    <button className="secondary" type="button" onClick={() => setActiveCard({ ...activeCard, backPhotoUrl: "" })}>Remove back</button>
                  </div>
                )}
              </div>
            )}
            <label className="full textareaLabel">Notes<textarea value={activeCard.notes} onChange={(e) => setActiveCard({ ...activeCard, notes: e.target.value })} /></label>
            <div className="full splitList">
              <strong>Extra costs for this card (optional)</strong>
              <p className="muted">Only fill these in if you paid extra for this card, like shipping, tax, or duty. They will be saved in Expenses automatically.</p>
              <div className="splitRow">
                <Field label="Shipping" type="number" value={inventoryExpenseDraft.shipping} onChange={(v) => setInventoryExpenseDraft((draft) => ({ ...draft, shipping: v }))} />
                <Field label="HST" type="number" value={inventoryExpenseDraft.hst} onChange={(v) => setInventoryExpenseDraft((draft) => ({ ...draft, hst: v }))} />
                <Field label="Duties" type="number" value={inventoryExpenseDraft.duties} onChange={(v) => setInventoryExpenseDraft((draft) => ({ ...draft, duties: v }))} />
              </div>
              <p className="muted">Extra costs total: <strong>{money(inventoryExpenseTotal)}</strong></p>
              <p className="muted cashImpactNote">When you save, Cash on Hand will go down by <strong>{money(cardPurchaseCost(activeCard) + inventoryExpenseTotal)}</strong>. This includes the card price plus any extra costs above. You do not need to add this purchase anywhere else.</p>
            </div>
            <button className="primary full" type="submit" disabled={photoUploading}>{photoUploading ? "Uploading photo…" : "Add to inventory"}</button>
          </form>
        </section>
      )}

      {tab === "attention" && (
        <section className="panel" id="attention-panel">
          <div className="panelHeader inventoryHeader">
            <div>
              <p className="eyebrow">Needs Attention</p>
              <h2>{totalAttentionItems ? `${totalAttentionItems} things to review` : "Everything looks caught up"}</h2>
              <p className="muted">Quick list of cards and expenses that need the next business action.</p>
            </div>
            <button className="secondary" type="button" onClick={showActiveInventory}>Open inventory</button>
          </div>

          <section className="attentionStats" aria-label="Needs attention summary">
            {attentionGroups.map((group) => (
              <button
                className={`attentionStat ${group.count ? "hasItems" : ""}`}
                disabled={!group.count}
                key={group.key}
                onClick={() => applyNeedsAttentionFilter(group.key)}
                type="button"
              >
                <span>{group.title}</span>
                <strong>{group.count}</strong>
              </button>
            ))}
          </section>

          {totalAttentionItems === 0 ? (
            <p className="empty">No action items right now. Missing photos or unlisted cards will show here.</p>
          ) : (
            <div className="attentionGroups">
              {attentionGroups.map((group) => (
                <AttentionGroupSection group={group} key={group.key} onOpenItem={openAttentionItem} onListCard={beginListingEdit} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "listingReview" && (
        <section className="panel" id="listing-review-panel">
          <div className="panelHeader inventoryHeader">
            <div>
              <p className="eyebrow">Listing Review</p>
              <h2>{listingReviewItems.length ? `${listingReviewItems.length} listed cards` : "No listed cards yet"}</h2>
              <p className="muted">Use the date buckets as the focus. Listings stay hidden until you click a dollar amount below.</p>
            </div>
            <button className="secondary" type="button" onClick={showActiveInventory}>Open inventory</button>
          </div>
          <section className="statsGrid listingReviewStats" aria-label="Listing review summary">
            <Stat label={`0–30 days listed • ${listingReviewCounts.current} cards`} value={money(listingReviewAskingTotals.current)} active={activeListingReviewBucket === "current"} onClick={() => setActiveListingReviewBucket(activeListingReviewBucket === "current" ? null : "current")} />
            <Stat label={`30–60 days listed • ${listingReviewCounts.warning} cards`} value={money(listingReviewAskingTotals.warning)} tone={listingReviewCounts.warning ? "warning" : undefined} active={activeListingReviewBucket === "warning"} onClick={() => setActiveListingReviewBucket(activeListingReviewBucket === "warning" ? null : "warning")} />
            <Stat label={`60+ days listed • ${listingReviewCounts.urgent} cards`} value={money(listingReviewAskingTotals.urgent)} tone={listingReviewCounts.urgent ? "negative" : undefined} active={activeListingReviewBucket === "urgent"} onClick={() => setActiveListingReviewBucket(activeListingReviewBucket === "urgent" ? null : "urgent")} />
            <Stat label={`Total listed asking • ${listingReviewItems.length} cards`} value={money(listedValue)} active={activeListingReviewBucket === "all"} onClick={() => setActiveListingReviewBucket(activeListingReviewBucket === "all" ? null : "all")} />
          </section>
          {activeListingReviewBucket ? (
            <div className="listingReviewDetail">
              <div className="listingReviewDetailHeader">
                <div>
                  <h3>{activeListingReviewLabel}</h3>
                  <p className="muted">Showing {activeListingReviewItems.length} cards for this date bucket.</p>
                </div>
                <button className="secondary" type="button" onClick={() => setActiveListingReviewBucket(null)}>Hide listings</button>
              </div>
              <div className="cardsList listingReviewList">
                {activeListingReviewItems.map((item) => {
                  const { card, listings, age, referenceDate, tone } = item;
                  const links = listingReviewLinksForCard(card, listings);
                  const minimumPrices = listings.map((listing) => listing.lowestAcceptablePrice).filter((value) => value > 0);
                  const photoUrl = card.frontPhotoUrl.trim() || card.backPhotoUrl.trim();
                  return (
                    <article className={`cardRow compactRow listingReviewRow ${tone}`} key={card.id}>
                      <div className={`listingReviewThumb ${photoUrl ? "hasPhoto" : ""}`} aria-label={photoUrl ? `Photo of ${card.name || "card"}` : `No photo saved for ${card.name || "card"}`}>
                        {photoUrl ? <img src={photoUrl} alt={`Photo of ${card.name || "card"}`} /> : <span>No photo</span>}
                      </div>
                      <div>
                        <div className="rowTitle">
                          <strong>{card.name || "Unnamed card"}</strong>
                          <span className={`listingAgeBadge ${tone}`}>{age} days listed</span>
                        </div>
                        <div className="listingReviewMeta" aria-label={`Listing details for ${card.name || "card"}`}>
                          <span><small>Listed</small><strong>{referenceDate ? formatDateLabel(referenceDate) : "Date unknown"}</strong></span>
                          <span><small>Platform</small><strong>{listingReviewPlatformsLabel(listings)}</strong></span>
                          <span><small>Asking</small><strong>{listingReviewAskingLabel(item)}</strong></span>
                          <span><small>Cost</small><strong>{money(cardPurchaseCost(card))}{cardQuantity(card) > 1 ? ` (${cardQuantity(card)} items)` : ""}</strong></span>
                          <span><small>Potential profit</small><strong className={listedPotentialProfit(card) >= 0 ? "positive" : "negative"}>{money(listedPotentialProfit(card))}</strong></span>
                          {minimumPrices.length ? <span><small>Minimum</small><strong>{money(Math.min(...minimumPrices))}{minimumPrices.length > 1 ? " lowest" : ""}{cardQuantity(card) > 1 ? " each" : ""}</strong></span> : null}
                        </div>
                        {activeGradingCardIds.has(card.id) && (
                          <p className="gradingInline">At grading: {openGradingSubmissions.find((submission) => submission.cardIds.includes(card.id))?.company || "grading company"}</p>
                        )}
                        {card.status === "Listed" && (
                          <div className="listingLinkRow">
                            {links.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer">Open {link.label}</a>)}
                            <button className="inlineLinkButton" type="button" onClick={() => requestClearListing(card)}>Clear listing</button>
                          </div>
                        )}
                      </div>
                      <div className="rowActions">
                        <button className="secondary" onClick={() => setEditingCard(card)} type="button">Edit card</button>
                      </div>
                    </article>
                  );
                })}
                {!activeListingReviewItems.length && <p className="empty">No cards in this date bucket.</p>}
              </div>
            </div>
          ) : (
            <p className="empty listingReviewPrompt">Pick a dollar amount above to open that date bucket. All individual listings are hidden until then.</p>
          )}
        </section>
      )}

      {tab === "grading" && (
        <section className="panel" id="grading-panel">
          <div className="panelHeader inventoryHeader">
            <div>
              <p className="eyebrow">Grading</p>
              <h2>Cards currently away at grading</h2>
              <p className="muted">Track bulk submissions by company, date sent, cards inside, and return status.</p>
            </div>
            <button className="secondary" type="button" onClick={() => { setTab("inventory"); window.setTimeout(() => document.querySelector(".bulkGradingBar")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }}>Select cards to send</button>
          </div>

          <section className="statsGrid gradingStats" aria-label="Grading totals">
            <Stat label="Open grading orders" value={String(openGradingSubmissions.length)} />
            <Stat label="Cards currently at grading" value={String(openGradingCardCount)} tone={openGradingCardCount ? "warning" : undefined} />
            <Stat label="Purchase value at grading" value={money(openGradingPurchaseValue)} />
            <Stat label="Total grading orders" value={String(gradingSubmissions.length)} />
          </section>

          <div className="gradingGrid">
            <section className="gradingOrders">
              <h3>Grading orders</h3>
              <div className="cardsList">
                {gradingSubmissions.map((submission) => {
                  const submissionCards = gradingSubmissionCards(submission);
                  const submissionCardCopies = gradingSubmissionCardCopies(submission);
                  const isOpen = openGradingSubmissionId === submission.id;
                  return (
                    <article className={submission.status === "Returned" ? "gradingOrder returned" : "gradingOrder"} key={submission.id}>
                      <button className="gradingOrderSummary" type="button" onClick={() => setOpenGradingSubmissionId(isOpen ? null : submission.id)}>
                        <div>
                          <div className="rowTitle">
                            <strong>{submission.reference || `${submission.company} submission`}</strong>
                            <span className={`statusBadge ${submission.status === "Returned" ? "sold" : "notlisted"}`}>{submission.status}</span>
                          </div>
                          <p className="muted">{submission.company} • Sent {formatDateLabel(submission.sentDate)}{submission.returnedDate ? ` • Returned ${formatDateLabel(submission.returnedDate)}` : ""}</p>
                          <p className="muted auditTrail">Submitted {formatDateTimeLabel(submission.createdAt)} by {actorLabel(submission.createdBy, currentUsername)}{submission.status === "Returned" ? ` • Marked returned ${formatDateTimeLabel(submission.updatedAt)} by ${actorLabel(submission.returnedBy || submission.updatedBy, currentUsername)}` : ""}</p>
                        </div>
                        <div className="rowMoney">
                          <span>{money(gradingPurchaseValue(submission))}</span>
                          <small>{gradingSubmissionCardQuantity(submission)} cards</small>
                        </div>
                      </button>
                      {isOpen && (
                        <div className="gradingOrderDetail">
                          {submission.notes && <p className="muted">{submission.notes}</p>}
                          <div className="cardsList gradingCardsList">
                            {submissionCardCopies.map(({ card, copyNumber, totalCopies, key }) => (
                              <article className="gradingCardRow" key={key}>
                                {card.frontPhotoUrl || card.backPhotoUrl ? (
                                  <button className="photoThumbButton photoThumbStack" type="button" onClick={() => setEnlargedPhotoCard(card)} aria-label={`Enlarge photos of ${card.name || "card"}`}>
                                    {card.frontPhotoUrl ? <img className="cardThumb" src={card.frontPhotoUrl} alt={`Front of ${card.name}`} /> : <div className="cardThumb placeholderThumb">No front</div>}
                                  </button>
                                ) : (
                                  <div className="cardThumb placeholderThumb">No photo</div>
                                )}
                                <div>
                                  <div className="rowTitle">
                                    <strong>{card.name}</strong>
                                    {totalCopies > 1 && <span className="statusBadge notlisted">Copy {copyNumber} of {totalCopies}</span>}
                                  </div>
                                  <p className="muted">{[card.year, card.setName, card.cardNumber].filter(Boolean).join(" • ") || "No card details"}</p>
                                </div>
                                <div className="rowMoney">
                                  <span>{money(card.purchasePrice)}</span>
                                  <small>purchase cost</small>
                                </div>
                              </article>
                            ))}
                            {!submissionCards.length && <p className="empty">No cards found for this submission.</p>}
                          </div>
                          <div className="rowActions gradingOrderActions">
                            {submission.status !== "Returned" && <button className="primary gradingActionButton" type="button" onClick={() => openReturnGradingModal(submission)}>Grades are In!</button>}
                            <button className="danger" type="button" onClick={() => setDeletingGradingSubmission(submission)}>Delete submission</button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
                {!gradingSubmissions.length && <p className="empty">No grading submissions yet. Select cards in Inventory and send them to grading.</p>}
              </div>
            </section>
          </div>
        </section>
      )}

      {tab === "inventory" && (
        <section className={`panel ${!isSoldInventoryView && activeInventoryMainView === "Not Listed" ? "notListedInventoryPanel" : ""}`} id="inventory-panel">
          <div className="panelHeader inventoryHeader">
            <div>
              <p className="eyebrow">{isSoldInventoryView ? "Sold Inventory" : activeInventoryMainView}</p>
              <h2>{isSoldInventoryView ? `Sold Inventory: showing ${filteredInventoryQuantity} of ${soldInventoryQuantity} sold cards` : activeInventoryMainView === "Listed" ? `Listed: showing ${filteredInventoryQuantity} of ${listedInventoryQuantity} listed cards` : `Not Listed: showing ${filteredInventoryQuantity} of ${notListedInventoryQuantity} cards to list`}</h2>
              <p className="muted">{isSoldInventoryView ? "Sold cards are kept out of active inventory and listed here with sale amount, sold date, and platform." : activeInventoryMainView === "Listed" ? "Cards you already listed. Use Clear listing to remove them from PrimeLot and move them back to Not Listed." : "Cards not listed yet. Select cards here to list them or post them to PrimeLot."}</p>
            </div>
          </div>

          {!isSoldInventoryView && (
            <section className="inventoryMainSwitch" aria-label="Inventory listing status">
              <button className={`inventoryMainSwitchButton ${activeInventoryMainView === "Not Listed" ? "primary inventoryMainSwitchButtonActive" : "inventoryMainSwitchButtonInactive"}`} type="button" onClick={() => showInventoryMainView("Not Listed")}>Not listed <span>{notListedInventoryQuantity}</span></button>
              <button className={`inventoryMainSwitchButton ${activeInventoryMainView === "Listed" ? "primary inventoryMainSwitchButtonActive" : "inventoryMainSwitchButtonInactive"}`} type="button" onClick={() => showInventoryMainView("Listed")}>Listed <span>{listedInventoryQuantity}</span></button>
            </section>
          )}

          <div className="inventoryFilterToggleRow">
            <button className="filterToggleButton" onClick={() => setInventoryFiltersOpen((open) => !open)} type="button" aria-expanded={inventoryFiltersOpen} aria-controls="inventory-filter-panel">
              <span>{inventoryFiltersOpen ? "Hide filters" : "Show filters"}</span>
              <strong>{filtersAreActive ? "Active" : ""}</strong>
            </button>
            <div className="inventoryToolbarActions">
              <button className="secondary exportInventoryButton" onClick={exportCards} type="button">Export filtered inventory</button>
              <span className={filtersAreActive ? "filterStatus active" : "filterStatus"}>{filtersAreActive ? "Filters active" : "No filters active"}</span>
            </div>
          </div>

          {inventoryFiltersOpen && (
          <section className="inventoryFilterPanel" id="inventory-filter-panel" aria-label="Inventory search and filters">
            <label className="filterSearch">Search inventory
              <input aria-label="Search inventory" placeholder="Search name, set, card #, notes..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label>Status
              <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as CardStatus | "All")}>
                <option value="All">All statuses</option>
                {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label>Category
              <select aria-label="Filter by category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="All">All categories</option>
                {inventoryCategories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label>Platform
              <select aria-label="Filter by platform" value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
                <option value="All">All platforms</option>
                {inventoryPlatforms.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
              </select>
            </label>
            <label>Photo
              <select aria-label="Filter by photo" value={photoFilter} onChange={(e) => setPhotoFilter(e.target.value as PhotoFilter)}>
                <option value="All">All photo statuses</option>
                <option value="Has photo">Has photo</option>
                <option value="Missing photo">Missing photo</option>
              </select>
            </label>
            <label>Listing URL
              <select aria-label="Filter by listing URL" value={listingUrlFilter} onChange={(e) => setListingUrlFilter(e.target.value as ListingUrlFilter)}>
                <option value="All">All listing URL statuses</option>
                <option value="Has listing URL">Has listing URL</option>
                <option value="Missing listing URL">Missing listing URL</option>
              </select>
            </label>
            <label>Date type
              <select aria-label="Choose date field for inventory export" value={inventoryDateField} onChange={(e) => setInventoryDateField(e.target.value as InventoryDateField)}>
                <option value="purchaseDate">Purchase date</option>
                <option value="listedDate">Listed date</option>
                <option value="saleDate">Sold date</option>
              </select>
            </label>
            <label>From date
              <input aria-label="Filter inventory export from date" type="date" value={inventoryStartDate} onChange={(e) => setInventoryStartDate(e.target.value)} />
            </label>
            <label>To date
              <input aria-label="Filter inventory export to date" type="date" value={inventoryEndDate} onChange={(e) => setInventoryEndDate(e.target.value)} />
            </label>
            <label>Sort
              <select aria-label="Sort inventory" value={inventorySort} onChange={(e) => setInventorySort(e.target.value as InventorySort)}>
                <option value="newest-purchase">Newest purchase date</option>
                <option value="oldest-purchase">Oldest purchase date</option>
                <option value="highest-purchase">Highest purchase price</option>
                <option value="lowest-purchase">Lowest purchase price</option>
                <option value="highest-sold">Highest sold price</option>
                <option value="highest-profit">Highest profit before expenses</option>
                <option value="name-az">Name A-Z</option>
              </select>
            </label>
            <div className="filterActions">
              <span className="muted">{filtersAreActive ? "Filters active" : "No filters active"}</span>
              <button className="secondary" disabled={!filtersAreActive} onClick={() => clearInventoryFilters(isSoldInventoryView ? "Sold" : activeInventoryMainView)} type="button">Clear filters</button>
            </div>
          </section>
          )}

          {isSoldInventoryView && (
            <section className="statsGrid soldInventoryStats" aria-label="Sold inventory totals">
              <Stat label="Sold cards shown" value={String(filteredInventoryQuantity)} />
              <Stat label="Net sold amount shown" value={money(soldViewRevenue)} tone="positive" />
              <Stat label="Original cost shown" value={money(soldViewCost)} />
              <Stat label="Grading fees shown" value={money(soldViewGradingFees)} tone={soldViewGradingFees > 0 ? "negative" : undefined} />
              <Stat label="Fees/Shipping label shown" value={money(soldViewSaleExpenses)} tone={soldViewSaleExpenses > 0 ? "negative" : undefined} />
              <Stat label="Profit from shown sold cards" value={money(soldViewProfit)} tone={soldViewProfit >= 0 ? "positive" : "negative"} />
              <Stat label="ROI% shown" value={percent(soldViewRoiPercent)} tone={soldViewRoiPercent >= 0 ? "positive" : "negative"} />
            </section>
          )}

          {!isSoldInventoryView && (
          <section className="bulkGradingBar" aria-label="Bulk inventory actions">
            <div>
              <p className="eyebrow">Bulk actions</p>
              <strong>{selectedCardQuantity} selected cards</strong>
              {selectedCards.length > 0 && <p className="muted">Selected purchase value: {money(selectedPurchaseValue)}</p>}
            </div>
            <div className="rowActions">
              <button className="secondary" type="button" onClick={selectAllFilteredCards} disabled={!filteredCards.some((card) => card.status !== "Sold")}>Select all shown</button>
              <button className="secondary" type="button" onClick={clearSelectedCards} disabled={!selectedCards.length}>Clear selected</button>
              <button className="primary" type="button" onClick={openPrimeLotReview} disabled={!selectedCards.length || postingToPrimeLot}>{postingToPrimeLot ? "Posting…" : primeLotButtonLabel}</button>
              <button className="primary" type="button" onClick={beginGradingSubmission} disabled={!selectedCards.length}>Send selected to grading</button>
            </div>
          </section>
          )}

          <div className="cardsList">
            {filteredCards.map((card) => (
              <article className={`cardRow ${isPrimeLotImportedCard(card) ? "primeLotImportedRow" : ""} ${isSoldInventoryView ? "noSelectCardRow" : ""} ${card.status === "Sold" ? "soldCardRow" : ""} ${card.status === "Listed" ? "listedCardRow" : ""}`} key={card.id}>
                {!isSoldInventoryView && (
                <label className="selectCardBox" aria-label={`Select ${card.name} for grading`}>
                  <input type="checkbox" checked={selectedCardIds.includes(card.id)} disabled={card.status === "Sold" || activeGradingCardIds.has(card.id)} onChange={() => toggleSelectedCard(card.id)} />
                </label>
                )}
                {card.frontPhotoUrl || card.backPhotoUrl ? (
                  <button className="photoThumbButton photoThumbStack" type="button" onClick={() => setEnlargedPhotoCard(card)} aria-label={`Enlarge photos of ${card.name || "card"}`}>
                    {card.frontPhotoUrl ? <img className="cardThumb" src={card.frontPhotoUrl} alt={`Front of ${card.name}`} /> : <div className="cardThumb placeholderThumb">No front</div>}
                  </button>
                ) : (
                  <div className="cardThumb placeholderThumb">No photo</div>
                )}
                <div className="cardInfo">
                  <div className="rowTitle">
                    <strong>{card.name}</strong>
                    {cardGradeLabel(card) && <span className="statusBadge listed">{cardGradeLabel(card)}</span>}
                    {activeGradingSubmissionForCard(card.id) && (
                      <button
                        className="statusBadge gradingLinkBadge"
                        type="button"
                        onClick={() => openGradingSubmissionFromInventory(activeGradingSubmissionForCard(card.id)!.id)}
                        title="Open this grading submission"
                      >
                        In grading
                      </button>
                    )}
                  </div>
                  {isPrimeLotImportedCard(card) && <div className="cardSourceLine"><span className="statusBadge primeLotImportedBadge">Imported from PrimeLot</span></div>}
                  {(card.year || card.setName || card.cardNumber || cardQuantity(card) > 1) && <p className="cardDetailsLine">{[card.year, card.setName, card.cardNumber, cardQuantity(card) > 1 ? `Qty ${cardQuantity(card)}` : ""].filter(Boolean).join(" • ")}</p>}
                  {card.status === "Sold" ? (
                    <>
                      <div className="soldSummary" aria-label={`Card sold for ${money(card.soldPrice)} with ${money(card.shippingCharge || 0)} shipping collected, ${money(cardPurchaseCost(card))} original cost, ${money(gradingFeeTotalForCard(card))} grading fees, and ${money(saleExpenseTotalForCard(card))} fees/shipping label`}>
                        <div>
                          <span>Card sold</span>
                          <strong>{money(card.soldPrice)}</strong>
                        </div>
                        <div>
                          <span>Shipping collected</span>
                          <strong>{money(card.shippingCharge || 0)}</strong>
                        </div>
                        <div>
                          <span>Original cost</span>
                          <strong>{money(cardPurchaseCost(card))}</strong>
                        </div>
                        <div className="soldDeduction">
                          <span>Grading fees</span>
                          <strong>{money(gradingFeeTotalForCard(card))}</strong>
                        </div>
                        <div className="soldDeduction">
                          <span>Fees/Shipping label</span>
                          <strong>{money(saleExpenseTotalForCard(card))}</strong>
                        </div>
                        {cardRefundTotal(card) > 0 && (
                          <div>
                            <span>Refunded</span>
                            <strong>{money(cardRefundTotal(card))}</strong>
                          </div>
                        )}
                        <div>
                          <span>Net collected</span>
                          <strong>{money(cardNetSoldPrice(card))}</strong>
                        </div>
                        <div className={totalProfitForCard(card) >= 0 ? "soldProfit positive" : "soldProfit negative"}>
                          <span>Total profit</span>
                          <strong>{money(totalProfitForCard(card))}</strong>
                        </div>
                        <div className={`soldRoiBadge ${cardRoiAfterSaleExpenses(card) >= 0 ? "positive" : "negative"}`}>
                          <small>ROI%</small>
                          <strong className={cardRoiAfterSaleExpenses(card) >= 0 ? "positive" : "negative"}>{percent(cardRoiAfterSaleExpenses(card))}</strong>
                        </div>
                      </div>
                      <div className="cardDetailChips soldDetailChips" aria-label="Saved sale details">
                        <span>Cost {money(cardPurchaseCost(card))}{cardQuantity(card) > 1 ? ` (${cardQuantity(card)} × ${money(card.purchasePrice)})` : ""}</span>
                        <span>Sold {formatDateLabel(card.saleDate) || formatDateTimeLabel(card.soldAt || card.updatedAt)}</span>
                        <span>{card.salePlatform || "Unknown platform"}</span>
                        {parseCardRefunds(card.notes).map((refund, index) => <span key={`${card.id}-refund-${index}`}>Refunded {money(refund.amount)}{refund.refundDate ? ` on ${formatDateLabel(refund.refundDate)}` : ""}{refund.note ? ` • ${refund.note}` : ""}</span>)}
                      </div>
                    </>
                  ) : card.status === "Listed" ? (
                    <div className="listedMetaChips" aria-label="Listed card details">
                      {activeListingsForCard(card).map((listing) => {
                        const age = daysSince(listing.listedDate || listedAgeDate(card));
                        return <span key={`${card.id}-${listing.id}`}>{listing.platform || "Listed"}{listing.askingPrice ? ` ${money(listing.askingPrice)}` : ""}{listing.lowestAcceptablePrice ? ` • Min ${money(listing.lowestAcceptablePrice)}` : ""}{age !== null ? ` • ${age}d` : ""}</span>;
                      })}
                      <span>Added {formatDateLabel(card.createdAt.slice(0, 10))}</span>
                      <span>Profit <strong className={listedPotentialProfit(card) >= 0 ? "positive" : "negative"}>{money(listedPotentialProfit(card))}</strong></span>
                    </div>
                  ) : (
                    <p className="muted auditTrail">Added {formatDateLabel(card.createdAt.slice(0, 10))}</p>
                  )}
                  {card.status === "Listed" && activeListingsForCard(card).some((listing) => listing.url) && (
                    <div className="listingLinkRow">
                      {activeListingsForCard(card).map((listing) => listing.url ? <a key={`${card.id}-${listing.id}-open`} href={listing.url} target="_blank" rel="noreferrer">Open {listing.platform}</a> : null)}
                    </div>
                  )}
                </div>
                {card.status !== "Sold" && (
                  <div className={card.status === "Listed" ? "rowMoney askingRowMoney" : "rowMoney unlistedCostMoney"}>
                    {card.status === "Not Listed" ? (
                      <>
                        {Number(card.askingPrice || 0) > 0 && (
                          <div className="inlineAskingPrice">
                            <span>{money(activeInventoryDisplayPrice(card))}</span>
                            <small>asking{cardQuantity(card) > 1 ? ` each • Qty ${cardQuantity(card)}` : ""}</small>
                          </div>
                        )}
                        <label className="inlineCostField">
                          <small>Your cost</small>
                          <input
                            aria-label={`Your cost for ${card.name}`}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={inlineCostValue(card)}
                            onChange={(event) => setInlineCostDrafts((drafts) => ({ ...drafts, [card.id]: event.target.value }))}
                            onFocus={(event) => event.currentTarget.select()}
                            onBlur={(event) => void saveInlineCost(card, event.currentTarget.value)}
                            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                          />
                        </label>
                      </>
                    ) : (
                      <>
                        <span>{money(activeInventoryDisplayPrice(card))}</span>
                        <small>{activeInventoryPriceLabel(card)}</small>
                      </>
                    )}
                  </div>
                )}
                {!isSoldInventoryView && (
                  <div className="inventoryControls">
                    <button className="secondary listingEditButton" type="button" onClick={() => beginListingEdit(card)}>
                      {card.status === "Listed" ? "Manage listings" : "Add listing"}
                    </button>
                  </div>
                )}
                <div className="rowActions">
                  <button className="secondary" onClick={() => setEditingCard(card)} type="button">Edit</button>
                  <button className="secondary" onClick={() => openSaleModal(card)} type="button">{card.status === "Sold" ? "Update sale" : "Sale"}</button>
                  {card.status === "Sold" && <button className="secondary" onClick={() => openSoldCardExpenseModal(card)} type="button">Add expense</button>}
                  {card.status === "Sold" && <button className="secondary" onClick={() => openRefundModal(card)} type="button" disabled={cardNetSoldPrice(card) <= 0}>{cardNetSoldPrice(card) <= 0 ? "Fully refunded" : "Refund"}</button>}
                  {card.status === "Sold" && <button className="secondary" onClick={() => requestMoveBackToListed(card)} type="button">Move back to Listed</button>}
                  {card.status !== "Sold" && <button className="danger" onClick={() => requestDeleteCard(card)} type="button">Delete</button>}
                </div>
              </article>
            ))}
            {!filteredCards.length && <p className="empty">No cards match your filters.</p>}
          </div>
        </section>
      )}

      {tab === "expenses" && (
        <section className="panel" id="expenses-panel">
          <div className="panelHeader inventoryHeader">
            <div>
              <p className="eyebrow">Expenses</p>
              <h2>Record HST, duties, grading, shipping, and other expenses</h2>
            </div>
            <div className="rowActions">
              <button className="primary" onClick={openAddExpenseModal} type="button">Add expense</button>
              <button className="secondary" onClick={exportExpenses} type="button">Export filtered expenses ({totals.filteredExpenses.length})</button>
            </div>
          </div>
          <DateFilterControls
            mode={dateFilterMode}
            startDate={customStartDate}
            endDate={customEndDate}
            selectedLabel={selectedDateLabel}
            onModeChange={setDateFilterMode}
            onStartDateChange={setCustomStartDate}
            onEndDateChange={setCustomEndDate}
          />
          <section className="statsGrid expenseBreakdown" aria-label="Expense category totals">
            <Stat label="Total expenses" value={money(totals.expensesTotal)} />
            {totals.expenseBreakdown.map((item) => (
              <Stat key={item.category} label={`${item.category} (${item.count})`} value={money(item.total)} />
            ))}
          </section>
          <div className="expenseList">
            {totals.filteredExpenses.map((expense) => (
              <article className="expenseRow" key={expense.id}>
                <div className="expenseDetails">
                  <div className="rowTitle"><strong>{expense.category}</strong></div>
                  <p>{expense.description || "No description"}</p>
                  <p className="muted">Vendor/source: {expense.vendor || "Not entered"}</p>
                  <p className="muted auditTrail">Added {formatDateTimeLabel(expense.createdAt)} by {actorLabel(expense.createdBy, currentUsername)}{expense.updatedAt !== expense.createdAt ? ` • Updated ${formatDateTimeLabel(expense.updatedAt)} by ${actorLabel(expense.updatedBy, currentUsername)}` : ""}</p>
                </div>
                <span>{expense.expenseDate}</span>
                <strong>{money(expense.amount)}</strong>
                <div className="rowActions">
                  <button className="secondary" type="button" onClick={() => openEditExpenseModal(expense)}>Edit</button>
                  <button className="danger" type="button" onClick={() => requestDeleteExpense(expense)}>Delete</button>
                </div>
              </article>
            ))}
            {!totals.filteredExpenses.length && <p className="empty">No expenses for {selectedDateLabel.toLowerCase()}.</p>}
          </div>
        </section>
      )}

      {tab === "profit" && (
        <section className="panel" id="profit-panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Profit</p>
              <h2>Sold revenue minus sold inventory cost and expenses</h2>
              <p className="muted">Showing {selectedDateLabel.toLowerCase()}. Profit only counts cards that are already sold; Total Inventory Value matches your current listed asking value.</p>
            </div>
          </div>
          <DateFilterControls
            mode={dateFilterMode}
            startDate={customStartDate}
            endDate={customEndDate}
            selectedLabel={selectedDateLabel}
            onModeChange={setDateFilterMode}
            onStartDateChange={setCustomStartDate}
            onEndDateChange={setCustomEndDate}
          />
          <section className="statsGrid profitGrid" aria-label="Profit totals">
            <Stat label="Revenue from sold cards" value={money(totals.revenue)} />
            <Stat label="Sold inventory cost" value={money(totals.soldInventoryCost)} />
            <Stat label="Profit from sold cards" value={money(totals.soldCardProfit)} tone={totals.soldCardProfit >= 0 ? "positive" : "negative"} />
            <Stat label="Total expenses" value={money(totals.expensesTotal)} />
            <Stat label="Cash on hand" value={money(totals.cash)} tone={totals.cash >= 0 ? "positive" : "negative"} />
            <Stat label="Total Inventory Value" value={money(totals.totalInventoryValue)} />
            <Stat label="Unlisted inventory" value={money(totals.unlistedInventoryCost)} />
            <Stat label="Listed asking value" value={money(totals.listedInventoryValue)} />
          </section>

          <section className="businessExports" aria-label="Business exports">
            <div>
              <p className="eyebrow">Business Exports</p>
              <h3>Accountant-ready CSVs</h3>
              <p className="muted">Period exports use the current Profit date filter: {selectedDateLabel}.</p>
            </div>
            <div className="exportActions">
              <button className="secondary" onClick={exportProfitSummary} type="button">Export profit summary</button>
              <button className="secondary" onClick={exportPeriodSales} type="button">Export sales for period ({totals.soldCards.length})</button>
              <button className="secondary" onClick={exportPeriodInventory} type="button">Export inventory for period ({totals.notListedCards.length + totals.listedCards.length})</button>
              <button className="secondary" onClick={exportAllInventory} type="button">Export all inventory ({activeInventoryCards.length})</button>
            </div>
          </section>

          <div className="profitSections">
            <ProfitStatusSection title="Unlisted cards" cards={totals.notListedCards} totalLabel="Money in unlisted cards" total={totals.unlistedInventoryCost} emptyText="No unlisted cards." />
            <ProfitStatusSection title="Listed cards" cards={totals.listedCards} totalLabel="Listed asking value" total={totals.listedInventoryValue} emptyText="No listed cards." />
            <ProfitStatusSection title="Sold cards" cards={totals.soldCards} totalLabel="Sold inventory cost" total={totals.soldInventoryCost} emptyText="No sold cards yet. Use Inventory → Enter sale." showSale />
          </div>
        </section>
      )}


      {confirmingMoveBackToListed && (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Confirm move back to Listed">
          <div className="modal panel moveBackListedModal">
            <div className="panelHeader">
              <div>
                <p className="eyebrow moveBackEyebrow">Move back to Listed</p>
                <h2>Move {confirmingMoveBackToListed.name || "this card"} back to Listed?</h2>
                <p className="muted">This will undo the sold status, clear the sale date/platform/price, and put the card back in your Listed inventory. Any sale HST or marketplace fee rows tied to this sale will be removed from expenses.</p>
              </div>
              <button className="secondary" type="button" onClick={() => setConfirmingMoveBackToListed(null)}>Cancel</button>
            </div>
            <div className="moveBackSummary">
              <span>Current status: <strong>{confirmingMoveBackToListed.status}</strong></span>
              <span>Net sold: <strong>{money(cardNetSoldPrice(confirmingMoveBackToListed))}</strong></span>
              <span>Sold on: <strong>{confirmingMoveBackToListed.saleDate ? formatDateLabel(confirmingMoveBackToListed.saleDate) : "Not entered"}</strong></span>
              <span>Platform: <strong>{confirmingMoveBackToListed.salePlatform || "Not entered"}</strong></span>
              <span>Will become: <strong>Listed</strong></span>
              <span>Sale expenses to remove: <strong>{expenses.filter((expense) => saleExpenseMatchesCard(expense, confirmingMoveBackToListed)).length}</strong></span>
            </div>
            <div className="confirmActions">
              <button className="secondary" type="button" onClick={() => setConfirmingMoveBackToListed(null)}>Keep as Sold</button>
              <button className="primary" type="button" onClick={confirmMoveBackToListed}>Yes, move back to Listed</button>
            </div>
          </div>
        </div>
      )}

      {confirmingClearListing && (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Confirm clear listing">
          <div className="modal panel confirmDeleteModal">
            <div className="panelHeader">
              <div>
                <p className="eyebrow dangerEyebrow">Clear listing</p>
                <h2>Clear listing for {confirmingClearListing.name || "this card"}?</h2>
                <p className="muted">This removes all saved platform listings from WCT and moves the card back to Not Listed. Also remove/end the real listings on eBay, PrimeLot, or any other marketplace so the item cannot sell twice. If it is linked to PrimeLot, Card Tracker will try to remove the PrimeLot listing first.</p>
              </div>
              <button className="secondary" type="button" onClick={() => setConfirmingClearListing(null)}>Cancel</button>
            </div>
            <div className="confirmSummary">
              <span>Status: <strong>{confirmingClearListing.status}</strong></span>
              <span>Listed on: <strong>{listingPlatformLabel(confirmingClearListing)}</strong></span>
              {listingHref(confirmingClearListing) && <span>Listing URL: <strong>{listingHref(confirmingClearListing)}</strong></span>}
            </div>
            <div className="confirmActions">
              <button className="secondary" type="button" onClick={() => setConfirmingClearListing(null)}>Keep listing</button>
              <button className="danger" type="button" onClick={confirmClearListing}>Yes, clear listing</button>
            </div>
          </div>
        </div>
      )}

      {deletingCard && (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Confirm delete card">
          <div className="modal panel confirmDeleteModal">
            <div className="panelHeader">
              <div>
                <p className="eyebrow dangerEyebrow">Delete {deletingCard.status === "Listed" ? "listing" : "card"}</p>
                <h2>Delete {deletingCard.name}?</h2>
                <p className="muted">This removes the {deletingCard.status.toLowerCase()} card from inventory and updates your totals. This cannot be undone.</p>
              </div>
              <button className="secondary" type="button" onClick={() => setDeletingCard(null)}>Cancel</button>
            </div>
            <div className="deleteSummary">
              <span>Status: <strong>{deletingCard.status}</strong></span>
              <span>Quantity: <strong>{cardQuantity(deletingCard)}</strong></span>
              <span>Cost: <strong>{money(cardPurchaseCost(deletingCard))}</strong></span>
              {deletingCard.status === "Listed" && <span>Listed on: <strong>{deletingCard.listedPlatform || "Not entered"}</strong></span>}
            </div>
            <div className="confirmActions">
              <button className="secondary" type="button" onClick={() => setDeletingCard(null)}>Keep card</button>
              <button className="danger" type="button" onClick={confirmDeleteCard}>Yes, delete it</button>
            </div>
          </div>
        </div>
      )}

      {deletingExpense && (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Confirm delete expense">
          <div className="modal panel confirmDeleteModal">
            <div className="panelHeader">
              <div>
                <p className="eyebrow dangerEyebrow">Delete expense</p>
                <h2>Delete this {deletingExpense.category} expense?</h2>
                <p className="muted">This removes the expense from your records and updates Expenses and Cash on Hand. This cannot be undone.</p>
              </div>
              <button className="secondary" type="button" onClick={() => setDeletingExpense(null)}>Cancel</button>
            </div>
            <div className="deleteSummary">
              <span>Type: <strong>{deletingExpense.category}</strong></span>
              <span>Amount: <strong>{money(deletingExpense.amount)}</strong></span>
              <span>Date: <strong>{deletingExpense.expenseDate}</strong></span>
              <span>Vendor/source: <strong>{deletingExpense.vendor || "Not entered"}</strong></span>
              <span>Description: <strong>{deletingExpense.description || "No description"}</strong></span>
            </div>
            <div className="confirmActions">
              <button className="secondary" type="button" onClick={() => setDeletingExpense(null)}>Keep expense</button>
              <button className="danger" type="button" onClick={confirmDeleteExpense}>Yes, delete it</button>
            </div>
          </div>
        </div>
      )}

      {listingCard && (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Add listing details">
          <form className="modal panel addListingModal" onSubmit={saveListing}>
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Listing details</p>
                <h2>{listingCard.name || "Card listing"}</h2>
                <p className="muted">Add one marketplace at a time. Existing platform listings stay attached to this same inventory item, so your card count and profit math are not duplicated.</p>
              </div>
              <button className="secondary" type="button" onClick={() => setListingCard(null)}>Cancel</button>
            </div>
            <div className="formGrid simpleForm">
              {activeListingsForCard(cards.find((card) => card.id === listingCard.id) || listingCard).length > 0 && (
                <div className="existingListings full" aria-label="Existing platform listings">
                  <strong>Current listings for this inventory item</strong>
                  {activeListingsForCard(cards.find((card) => card.id === listingCard.id) || listingCard).map((listing) => (
                    <span key={`${listingCard.id}-${listing.id}`}>{listing.platform || "Listed"}{listing.askingPrice ? ` • ${money(listing.askingPrice)}` : ""}{listing.listedDate ? ` • ${formatDateLabel(listing.listedDate)}` : ""}</span>
                  ))}
                  <p className="muted">Saving another platform here does not create another card. It only adds another place where this same inventory is advertised.</p>
                </div>
              )}
              <Field label="Listed where?" value={listingCard.listedPlatform} onChange={(v) => setListingCard({ ...listingCard, listedPlatform: v })} placeholder="eBay, Whatnot, TCGplayer..." required />
              <Field label="Asking price per item" type="number" value={String(listingCard.askingPrice)} onChange={(v) => setListingCard({ ...listingCard, askingPrice: Number(v || 0) })} required />
              <Field label="Listed date" type="date" value={listingCard.listedDate || todayIso()} onChange={(v) => setListingCard({ ...listingCard, listedDate: v })} required />
              <Field label={`Quantity to list (available ${cardQuantity(cards.find((card) => card.id === listingCard.id) || listingCard)})`} type="number" value={String(listingCard.quantity)} onChange={(v) => setListingCard({ ...listingCard, quantity: Math.max(1, Math.min(cardQuantity(cards.find((card) => card.id === listingCard.id) || listingCard), sanitizeQuantityInput(v))) })} required />
              <Field label="Minimum sale price per item" type="number" value={String(listingCard.lowestAcceptablePrice)} onChange={(v) => setListingCard({ ...listingCard, lowestAcceptablePrice: Number(v || 0) })} />
              <Field label="Buyer shipping charge" type="number" value={String(listingCard.shippingCharge)} onChange={(v) => setListingCard({ ...listingCard, shippingCharge: Number(v || 0) })} />
              <Field label="Listing URL" value={listingCard.listingUrl} onChange={(v) => setListingCard({ ...listingCard, listingUrl: v })} placeholder="Optional link to the live listing" />
              <div className="calc full">
                <span>Purchase cost: <strong>{money(cardPurchaseCost(listingCard))}</strong></span>
                <span>Potential profit: <strong className={listedPotentialProfit(listingCard) >= 0 ? "positive" : "negative"}>{money(listedPotentialProfit(listingCard))}</strong></span>
              </div>
              <button className="primary full" type="submit">Save listing</button>
              {(listingCard.listingUrl || listingCard.listedPlatform || listingCard.status === "Listed") && (
                <button className="secondary full" type="button" onClick={() => requestClearListing(listingCard)}>Clear old listing / make Not Listed</button>
              )}
            </div>
          </form>
        </div>
      )}

      {editingCard && (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Edit card details">
          <form className="modal panel" onSubmit={saveEditedCard}>
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Edit card</p>
                <h2>{editingCard.name || "Card details"}</h2>
              </div>
              <button className="secondary" type="button" onClick={() => setEditingCard(null)}>Cancel</button>
            </div>
            <div className="formGrid simpleForm">
              <Field label="Card/player name" value={editingCard.name} onChange={(v) => setEditingCard({ ...editingCard, name: v })} required />
              <Field label="Category" value={editingCard.category} onChange={(v) => setEditingCard({ ...editingCard, category: v })} placeholder="Sports, Pokemon, MTG..." />
              <Field label="Year" value={editingCard.year} onChange={(v) => setEditingCard({ ...editingCard, year: v })} />
              <Field label="Set" value={editingCard.setName} onChange={(v) => setEditingCard({ ...editingCard, setName: v })} />
              <Field label="Card #" value={editingCard.cardNumber} onChange={(v) => setEditingCard({ ...editingCard, cardNumber: v })} />
              <Field label="Item quantity" type="number" value={String(editingCard.quantity)} onChange={(v) => setEditingCard({ ...editingCard, quantity: sanitizeQuantityInput(v) })} />
              <p className="muted full quantityPhotoNote">One front/back photo set applies to every copy in this row. Split the row if each copy needs its own photos.</p>
              <Field label="Your cost per item" type="number" value={String(editingCard.purchasePrice)} onChange={(v) => setEditingCard({ ...editingCard, purchasePrice: Number(v || 0) })} />
              <Field label="Date you purchased" type="date" value={editingCard.purchaseDate} onChange={(v) => setEditingCard({ ...editingCard, purchaseDate: v })} />
              <Field label="Grading company if already graded" value={editingCard.gradingCompany} onChange={(v) => setEditingCard({ ...editingCard, gradingCompany: v, notes: notesWithGrade(editingCard.notes, editingCard.grade, v) })} placeholder="PSA, BGS, SGC, CGC..." />
              <Field label="Grade if already graded" value={editingCard.grade} onChange={(v) => { const parsed = gradeParts(v); setEditingCard({ ...editingCard, grade: parsed.grade, gradingCompany: parsed.company || editingCard.gradingCompany, notes: notesWithGrade(editingCard.notes, parsed.grade, parsed.company || editingCard.gradingCompany) }); }} placeholder="10, 9.5, 8..." />
              <Select label="Status" value={editingCard.status} options={statuses} onChange={(v) => setEditingCard(prepareCardForStatus(editingCard, v as CardStatus))} />
              <Field label="Listed where?" value={editingCard.listedPlatform} onChange={(v) => setEditingCard({ ...editingCard, listedPlatform: v, status: v ? "Listed" : editingCard.status, listedDate: v ? editingCard.listedDate || todayIso() : editingCard.listedDate })} placeholder="eBay, Whatnot, TCGplayer..." />
              <Field label="Listing URL" value={editingCard.listingUrl} onChange={(v) => setEditingCard({ ...editingCard, listingUrl: v })} />
              {editingCard.status === "Listed" && (
                <>
                  <Field label="Asking price" type="number" value={String(editingCard.askingPrice)} onChange={(v) => setEditingCard({ ...editingCard, askingPrice: Number(v || 0) })} required />
                  <Field label="Minimum sale price" type="number" value={String(editingCard.lowestAcceptablePrice)} onChange={(v) => setEditingCard({ ...editingCard, lowestAcceptablePrice: Number(v || 0) })} />
                  <Field label="Buyer shipping charge" type="number" value={String(editingCard.shippingCharge)} onChange={(v) => setEditingCard({ ...editingCard, shippingCharge: Number(v || 0) })} />
                  <Field label="Listed date" type="date" value={editingCard.listedDate} onChange={(v) => setEditingCard({ ...editingCard, listedDate: v })} required />
                  <div className="calc">
                    <span>Days listed: <strong>{listedDays(editingCard) ?? 0}</strong></span>
                    <span>Potential profit: <strong className={listedPotentialProfit(editingCard) >= 0 ? "positive" : "negative"}>{money(listedPotentialProfit(editingCard))}</strong></span>
                  </div>
                </>
              )}
              {editingCard.status === "Sold" && (
                <>
                  <Field label="Card sale total" type="number" value={String(editingCard.soldPrice)} onChange={(v) => setEditingCard({ ...editingCard, soldPrice: Number(v || 0) })} required />
                  <Field label="Buyer shipping collected" type="number" value={String(editingCard.shippingCharge || 0)} onChange={(v) => setEditingCard({ ...editingCard, shippingCharge: Number(v || 0) })} />
                  <Field label="Sale date" type="date" value={editingCard.saleDate} onChange={(v) => setEditingCard({ ...editingCard, saleDate: v })} required />
                  <Field label="Sold where?" value={editingCard.salePlatform} onChange={(v) => setEditingCard({ ...editingCard, salePlatform: v })} placeholder="eBay, Whatnot, private sale..." required />
                </>
              )}
              <div className="photoUploadGrid full">
                <PhotoUploadControl
                  label="Front"
                  onPick={(file) => uploadCardPhoto(file, "editing", "front")}
                />
                <PhotoUploadControl
                  label="Back"
                  onPick={(file) => uploadCardPhoto(file, "editing", "back")}
                />
              </div>
              {(editingCard.frontPhotoUrl || editingCard.backPhotoUrl) && (
                <div className="photoPreview full">
                  {editingCard.frontPhotoUrl && (
                    <div className="photoPreviewItem">
                      <span>Front</span>
                      <img src={editingCard.frontPhotoUrl} alt={`Front of ${editingCard.name}`} />
                      <button className="secondary" type="button" onClick={() => setEditingCard({ ...editingCard, frontPhotoUrl: "" })}>Remove front</button>
                    </div>
                  )}
                  {editingCard.backPhotoUrl && (
                    <div className="photoPreviewItem">
                      <span>Back</span>
                      <img src={editingCard.backPhotoUrl} alt={`Back of ${editingCard.name}`} />
                      <button className="secondary" type="button" onClick={() => setEditingCard({ ...editingCard, backPhotoUrl: "" })}>Remove back</button>
                    </div>
                  )}
                </div>
              )}
              <label className="full textareaLabel">Notes<textarea value={cleanListingNotes(editingCard.notes)} onChange={(e) => setEditingCard({ ...editingCard, notes: notesWithListings(e.target.value, activeListingsForCard(editingCard)) })} /></label>
              <button className="primary full" type="submit" disabled={photoUploading}>{photoUploading ? "Uploading photo…" : "Save changes"}</button>
            </div>
          </form>
        </div>
      )}

      {showGradingForm && (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Create grading submission">
          <form className="modal panel" onSubmit={saveGradingSubmission}>
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Send to grading</p>
                <h2>{selectedCardQuantity} selected cards</h2>
                <p className="muted">Purchase value selected: {money(selectedPurchaseValue)}</p>
              </div>
              <button className="secondary" type="button" onClick={() => setShowGradingForm(false)}>Cancel</button>
            </div>
            <div className="formGrid simpleForm">
              <Field label="Grading company" value={gradingDraft.company} onChange={(v) => setGradingDraft({ ...gradingDraft, company: v })} placeholder="PSA, SGC, BGS, CGC..." required />
              <Field label="Date sent" type="date" value={gradingDraft.sentDate} onChange={(v) => setGradingDraft({ ...gradingDraft, sentDate: v })} required />
              <Field label="Order / reference" value={gradingDraft.reference} onChange={(v) => setGradingDraft({ ...gradingDraft, reference: v })} placeholder="Optional submission name or order #" />
              <label className="full textareaLabel">Notes<textarea value={gradingDraft.notes} onChange={(e) => setGradingDraft({ ...gradingDraft, notes: e.target.value })} placeholder="Optional notes about this grading order" /></label>
              <div className="full splitList">
                <strong>Quantity to send</strong>
                <p className="muted">For quantity rows, choose how many copies are going to grading. The rest stay in inventory.</p>
                {selectedCards.map((card) => {
                  const availableQuantity = cardQuantity(card);
                  return (
                    <div className="splitCard" key={card.id}>
                      <div className="rowTitle">
                        <strong>{card.name}</strong>
                        <span className="muted">Available: {availableQuantity}</span>
                      </div>
                      <Field
                        label="Send qty"
                        type="number"
                        value={String(selectedQuantityForCard(card))}
                        onChange={(v) => setSelectedGradingQuantities((quantities) => ({
                          ...quantities,
                          [card.id]: Math.max(1, Math.min(availableQuantity, sanitizeQuantityInput(v))),
                        }))}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="calc full">
                <span>Cards in submission: <strong>{selectedCardQuantity}</strong></span>
                <span>Total purchase value: <strong>{money(selectedPurchaseValue)}</strong></span>
              </div>
              <button className="primary full" type="submit">Create grading submission</button>
            </div>
          </form>
        </div>
      )}

      {deletingGradingSubmission && (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Delete grading submission confirmation">
          <div className="modal panel themedConfirmModal">
            <div>
              <p className="eyebrow dangerEyebrow">Are you sure?</p>
              <h2>Delete grading submission?</h2>
              <p className="muted">This removes the grading order and its submitted-card links. The inventory cards stay in your account.</p>
            </div>
            <div className="confirmSummaryBox">
              <strong>{deletingGradingSubmission.reference || `${deletingGradingSubmission.company} submission`}</strong>
              <span>{deletingGradingSubmission.company} • Sent {formatDateLabel(deletingGradingSubmission.sentDate)} • {gradingSubmissionCardQuantity(deletingGradingSubmission)} cards</span>
            </div>
            <div className="modalActionRow">
              <button className="secondary" type="button" onClick={() => setDeletingGradingSubmission(null)}>Cancel</button>
              <button className="danger" type="button" onClick={confirmDeleteGradingSubmission}>Yes, delete submission</button>
            </div>
          </div>
        </div>
      )}

      {returningSubmission && (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Enter returned grades and grading fees">
          <form className="modal panel" onSubmit={markGradingReturned}>
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Grades are in</p>
                <h2>{returningSubmission.reference || `${returningSubmission.company} submission`}</h2>
              </div>
              <button className="secondary" type="button" onClick={() => { setReturningSubmission(null); setReturnGradeRows([]); }}>Cancel</button>
            </div>
            <div className="formGrid simpleForm">
              <Field label="Return date" type="date" value={returnDate} onChange={setReturnDate} required />
              <div className="calc full">
                <span>Company: <strong>{returningSubmission.company}</strong></span>
                <span>Cards returning: <strong>{gradingSubmissionCardQuantity(returningSubmission)}</strong></span>
                <span>Sent date: <strong>{formatDateLabel(returningSubmission.sentDate)}</strong></span>
              </div>
              <div className="full splitList">
                <strong>Grades received</strong>
                <p className="muted">Enter the returned grade, slab/cert number, grading fee, and new slab photos for each card.</p>
                {gradingSubmissionCards(returningSubmission).map((card) => {
                  const expectedQuantity = gradingSubmissionQuantity(returningSubmission, card);
                  const rows = returnGradeRows.filter((row) => row.cardId === card.id);
                  const enteredQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
                  return (
                    <div className="splitCard" key={card.id}>
                      <div className="rowTitle">
                        <strong>{card.name}</strong>
                        <span className="muted">Qty returning: {expectedQuantity}</span>
                      </div>
                      {rows.map((row, rowIndex) => (
                        <div className="returnGradeCard" key={row.id}>
                          <div className="returnGradeCardHeader">
                            <span>{rows.length > 1 ? `Returned card ${rowIndex + 1} of ${expectedQuantity}` : "Returned card details"}</span>
                          </div>
                          <div className="splitRow returnGradeSplitRow">
                            <Field label="Grade" value={row.grade} onChange={(v) => updateReturnGradeRow(row.id, { grade: v })} placeholder="PSA 10, PSA 9..." />
                            <Field label="Slab / cert #" value={row.slabNumber} onChange={(v) => updateReturnGradeRow(row.id, { slabNumber: v })} placeholder="Optional" />
                            <Field label="Grading fee" type="number" value={row.gradingFee} onChange={(v) => updateReturnGradeRow(row.id, { gradingFee: v })} placeholder="0.00" />
                          </div>
                          <div className="returnSlabPhotoGrid">
                            <div className="slabPhotoPanel">
                              <SlabPhotoUploadControl label="Front slab photo" helpText="Take or upload the front of the graded slab." onPick={(file) => uploadReturnSlabPhoto(row.id, file, "front")} />
                              {row.frontPhotoUrl && (
                                <div className="photoPreviewCard">
                                  <NextImage src={row.frontPhotoUrl} alt={`Front slab of ${card.name}`} width={220} height={300} unoptimized />
                                  <button className="secondary" type="button" onClick={() => updateReturnGradeRow(row.id, { frontPhotoUrl: "" })}>Remove front</button>
                                </div>
                              )}
                            </div>
                            <div className="slabPhotoPanel">
                              <SlabPhotoUploadControl label="Back slab photo" helpText="Take or upload the back of the graded slab." onPick={(file) => uploadReturnSlabPhoto(row.id, file, "back")} />
                              {row.backPhotoUrl && (
                                <div className="photoPreviewCard">
                                  <NextImage src={row.backPhotoUrl} alt={`Back slab of ${card.name}`} width={220} height={300} unoptimized />
                                  <button className="secondary" type="button" onClick={() => updateReturnGradeRow(row.id, { backPhotoUrl: "" })}>Remove back</button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="returnGradeQuantityStatus">
                        <span className={enteredQuantity === expectedQuantity ? "muted" : "warning"}>Entered qty: {enteredQuantity} / {expectedQuantity}</span>
                      </div>
                    </div>
                  );
                })}
                <div className="calc">
                  <span>Total grading fees: <strong>{money(returnGradeRows.reduce((sum, row) => sum + (expenseDraftAmount(row.gradingFee) * row.quantity), 0))}</strong></span>
                  <span>Expense type: <strong>Grading Fees</strong></span>
                </div>
              </div>
              <button className="primary full" type="submit">Save grades and fees</button>
            </div>
          </form>
        </div>
      )}

      {expenseModalOpen && (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label={expenseForSoldCard ? `Add expense for ${expenseForSoldCard.name}` : editingExpenseId ? "Edit expense" : "Add expense"}>
          <form className="modal panel expenseModal" onSubmit={saveExpense}>
            <div className="panelHeader">
              <div>
                <p className="eyebrow">{expenseForSoldCard ? "Sold-card expense" : editingExpenseId ? "Edit expense" : "Add expense"}</p>
                <h2>{expenseForSoldCard ? `Add expense for ${expenseForSoldCard.name}` : editingExpenseId ? "Edit this cost" : "Log a new cost"}</h2>
                <p className="muted">{expenseForSoldCard ? "This cost will lower this card’s Total profit and Profit from sold cards." : editingExpenseId ? "Update only this expense record." : "Start a blank expense entry when you need to add a new cost."}</p>
              </div>
              <button className="secondary" type="button" onClick={closeExpenseModal}>Cancel</button>
            </div>
            <div className="formGrid simpleForm">
              <Select label="Expense type" value={activeExpense.category} options={expenseForSoldCard ? saleExpenseCategories : expenseCategories} onChange={(v) => setActiveExpense({ ...activeExpense, category: v as ExpenseCategory })} placeholder="Select expense type" required />
              <Field label="Amount" type="number" value={activeExpense.amount ? String(activeExpense.amount) : ""} onChange={(v) => setActiveExpense({ ...activeExpense, amount: Number(v || 0) })} placeholder="0.00" required />
              {expenseForSoldCard ? (
                <div className="calc full">
                  <span>Sold card: <strong>{expenseForSoldCard.name}</strong></span>
                  <span>Sale date: <strong>{expenseForSoldCard.saleDate ? formatDateLabel(expenseForSoldCard.saleDate) : "Today"}</strong></span>
                  <span>Platform: <strong>{expenseForSoldCard.salePlatform || "Sale"}</strong></span>
                </div>
              ) : (
                <>
                  <Field label="Date" type="date" value={activeExpense.expenseDate} onChange={(v) => setActiveExpense({ ...activeExpense, expenseDate: v })} required />
                  <Field label="Vendor / source" value={activeExpense.vendor} onChange={(v) => setActiveExpense({ ...activeExpense, vendor: v })} placeholder="PSA, Canada Post, customs..." />
                  <Field label="Description" value={activeExpense.description} onChange={(v) => setActiveExpense({ ...activeExpense, description: v })} placeholder="What was this for?" />
                </>
              )}
              <button className="primary full" type="submit">{editingExpenseId ? "Save expense" : "Add expense"}</button>
            </div>
          </form>
        </div>
      )}

      {refundingCard && (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Record refund">
          <form className="modal panel refundModal" onSubmit={saveRefund}>
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Refund sale</p>
                <h2>{refundingCard.name}</h2>
                <p className="muted">Record a full or partial refund. Dashboard sold revenue, cash, and sold-card profit will use the net sold amount.</p>
              </div>
              <button className="secondary" type="button" onClick={closeRefundModal}>Cancel</button>
            </div>
            <div className="refundSummaryGrid full">
              <span>Original sale <strong>{money(refundingCard.soldPrice)}</strong></span>
              <span>Already refunded <strong>{money(cardRefundTotal(refundingCard))}</strong></span>
              <span>Remaining refundable <strong>{money(cardNetSoldPrice(refundingCard))}</strong></span>
            </div>
            <div className="formGrid simpleForm">
              <Field label="Refund amount" type="number" value={refundDraft.amount} onChange={(v) => setRefundDraft((draft) => ({ ...draft, amount: v }))} required />
              <Field label="Refund date" type="date" value={refundDraft.refundDate} onChange={(v) => setRefundDraft((draft) => ({ ...draft, refundDate: v }))} required />
              <Field label="Reason / note" value={refundDraft.note} onChange={(v) => setRefundDraft((draft) => ({ ...draft, note: v }))} placeholder="Return, damage, partial goodwill..." />
              <div className="rowActions full refundQuickActions">
                <button className="secondary" type="button" onClick={() => setRefundDraft((draft) => ({ ...draft, amount: String(cardNetSoldPrice(refundingCard)) }))}>Refund full remaining amount</button>
                <button className="secondary" type="button" onClick={() => setRefundDraft((draft) => ({ ...draft, amount: "" }))}>Enter partial amount</button>
              </div>
              <div className="calc full">
                <span>Net sold after this refund: <strong className={Math.max(0, cardNetSoldPrice(refundingCard) - (Number(refundDraft.amount || 0) || 0)) >= 0 ? "positive" : "negative"}>{money(Math.max(0, cardNetSoldPrice(refundingCard) - (Number(refundDraft.amount || 0) || 0)))}</strong></span>
              </div>
              <button className="primary full" type="submit">Save refund</button>
            </div>
          </form>
        </div>
      )}

      {saleCelebration && (
        <div className="modalBackdrop saleCelebrationBackdrop" role="dialog" aria-modal="true" aria-label="Sale congratulations">
          <div className="modal panel saleCelebrationModal">
            <div className="celebrationGlow" aria-hidden="true">✦</div>
            <div className="successIcon saleCelebrationIcon" aria-hidden="true">✓</div>
            <p className="eyebrow">Sale saved</p>
            <h2>Congrats — you made a sale!</h2>
            <p className="muted">{saleCelebration.cardName} is now marked Sold. Here’s the sale breakdown.</p>
            <p className="saleCrossListingNotice">If you have this listed on other platforms, don’t forget to remove them!</p>
            <div className="saleCelebrationCard saleCelebrationList" aria-label="Sale price expenses and total profit">
              <span><small>{`Card sale (${money(saleCelebration.saleUnitPrice)} per card)`}</small><strong>{money(saleCelebration.saleTotal)}</strong></span>
              <span><small>{`Buyer shipping (${money(saleCelebration.shippingUnitPrice)} per card)`}</small><strong>{money(saleCelebration.shippingCharge)}</strong></span>
              <span><small>Total collected</small><strong>{money(saleCelebration.collectedTotal)}</strong></span>
              <span><small>Card cost</small><strong>{money(saleCelebration.purchaseCost)}</strong></span>
              <span><small>Expenses</small><strong>{money(saleCelebration.saleExpenseTotal)}</strong></span>
              <span className="saleCelebrationProfit"><small>Total profit</small><strong className={saleCelebration.netProfit >= 0 ? "positive" : "negative"}>{money(saleCelebration.netProfit)}</strong></span>
              <span><small>Quantity</small><strong>{saleCelebration.quantity}</strong></span>
              <span><small>Platform</small><strong>{saleCelebration.platform}</strong></span>
              {saleCelebration.remainingQuantity !== undefined && <span><small>Still in inventory</small><strong>{saleCelebration.remainingQuantity}</strong></span>}
            </div>
            {saleCelebration.listingRemovalReminder.length > 0 && (
              <div className="saleListingReminder" role="alert">
                <strong>Remove remaining listings</strong>
                <p>This sale is saved in WCT, but you still need to remove/update any other live marketplace listings so the card cannot sell twice.</p>
                <div className="listingLinkRow">
                  {saleCelebration.listingRemovalReminder.map((listing) => listing.url ? <a key={listing.id} href={listing.url} target="_blank" rel="noreferrer">Open {listing.platform}</a> : <span key={listing.id}>{listing.platform}</span>)}
                </div>
              </div>
            )}
            <div className="saleCelebrationActions">
              <button className="primary full" type="button" onClick={() => setSaleCelebration(null)}>Nice — continue</button>
              <button className="secondary" type="button" onClick={() => { setSaleCelebration(null); setTab("expenses"); window.setTimeout(() => document.getElementById("expenses-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }}>View expenses</button>
            </div>
          </div>
        </div>
      )}

      {sellingCard && (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Enter sale details">
          <form className="modal panel" onSubmit={saveSale}>
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Enter sale</p>
                <h2>{sellingCard.name}</h2>
              </div>
              <button className="secondary" type="button" onClick={() => { setSellingCard(null); setSaleExpenseDraft(emptySaleExpenseDraft()); }}>Cancel</button>
            </div>
            <div className="formGrid simpleForm">
              <Field label={sellingCard.status === "Sold" ? "Quantity sold" : `Quantity sold (available ${cardQuantity(cards.find((card) => card.id === sellingCard.id) || sellingCard)})`} type="number" value={String(sellingCard.quantity)} onChange={(v) => {
                const availableQuantity = cardQuantity(cards.find((card) => card.id === sellingCard.id) || sellingCard);
                const requestedQuantity = sanitizeQuantityInput(v);
                const nextQuantity = sellingCard.status === "Sold" ? requestedQuantity : Math.max(1, Math.min(availableQuantity, requestedQuantity));
                if (sellingCard.status !== "Sold" && requestedQuantity > availableQuantity) setError(`Only ${availableQuantity} ${availableQuantity === 1 ? "copy is" : "copies are"} available in this row. If both copies already sold, delete this leftover Not Listed row instead of selling it again.`);
                else setError("");
                setSellingCard({ ...sellingCard, quantity: nextQuantity, soldPrice: sellingUnitPrice * nextQuantity, shippingCharge: sellingShippingUnitPrice * nextQuantity });
              }} required />
              <Field label="Sold price per item" type="number" value={String(sellingUnitPrice)} onChange={(v) => setSellingCard({ ...sellingCard, soldPrice: Number(v || 0) * sellingQuantity })} required />
              <Field label="Buyer shipping per item" type="number" value={String(sellingShippingUnitPrice)} onChange={(v) => setSellingCard({ ...sellingCard, shippingCharge: Number(v || 0) * sellingQuantity })} />
              <Field label="Sale date" type="date" value={sellingCard.saleDate} onChange={(v) => setSellingCard({ ...sellingCard, saleDate: v })} required />
              <Field label="Sold where?" value={sellingCard.salePlatform} onChange={(v) => setSellingCard({ ...sellingCard, salePlatform: v })} placeholder="eBay, Whatnot, private sale..." required />
              <div className="saleExpenseBox full" aria-label="Sale expenses">
                <div>
                  <p className="eyebrow">Sale expenses</p>
                  <p className="muted">Optional HST, marketplace/payment fees, and shipping label cost. If you bought the shipping label already, input your cost here. Otherwise you can input your shipping label cost later under the Expense tab.</p>
                </div>
                <div className="splitRow">
                  <Field label="HST" type="number" value={saleExpenseDraft.hst} onChange={(v) => setSaleExpenseDraft((draft) => ({ ...draft, hst: v }))} />
                  <Field label="Fees" type="number" value={saleExpenseDraft.fees} onChange={(v) => setSaleExpenseDraft((draft) => ({ ...draft, fees: v }))} />
                  <Field label="Shipping label cost" type="number" value={saleExpenseDraft.shippingLabel} onChange={(v) => setSaleExpenseDraft((draft) => ({ ...draft, shippingLabel: v }))} />
                </div>
              </div>
              <div className="saleMath full">
                <div className="saleMathHeader">
                  <span>Quantity sold: <strong>{sellingQuantity}</strong></span>
                  <span>Available: <strong>{cardQuantity(cards.find((card) => card.id === sellingCard.id) || sellingCard)}</strong></span>
                </div>
                <div className="saleMathGrid" aria-label="Sale profit math">
                  <section className="saleMathCard moneyIn">
                    <p className="eyebrow">Customer paid</p>
                    <div><span>{sellingSaleLabel}</span><strong>{money(sellingCard.soldPrice)}</strong></div>
                    <small>{sellingQuantity} × {money(sellingUnitPrice)} per card</small>
                    <div><span>Shipping collected</span><strong>{money(sellingCard.shippingCharge || 0)}</strong></div>
                    <small>{sellingQuantity} × {money(sellingShippingUnitPrice)} per card</small>
                    <div className="saleMathTotal"><span>Total in</span><strong>{money(sellingCollectedTotal)}</strong></div>
                  </section>
                  <section className="saleMathCard costs">
                    <p className="eyebrow">Your costs</p>
                    <div><span>Card cost</span><strong>{money(sellingPurchaseCost)}</strong></div>
                    <div><span>Sale expenses</span><strong>{money(saleExpenseTotal)}</strong></div>
                    <small>HST, fees, shipping label</small>
                    <div className="saleMathTotal"><span>Total costs</span><strong>{money(sellingTotalCost)}</strong></div>
                  </section>
                  <section className={`saleMathCard result ${sellingNetAfterExpenses >= 0 ? "profit" : "loss"}`}>
                    <p className="eyebrow">Final result</p>
                    <div className="saleMathResultBreakdown"><span>Customer paid</span><strong>{money(sellingCollectedTotal)}</strong></div>
                    <div className="saleMathResultBreakdown"><span>Your cost</span><strong>{money(sellingTotalCost)}</strong></div>
                    <div className="saleMathFinal"><span>{sellingNetAfterExpenses >= 0 ? "Total profit" : "Total loss"}</span><strong>{money(sellingNetAfterExpenses)}</strong></div>
                  </section>
                </div>
              </div>
              <button className="primary full" type="submit">Save sale</button>
            </div>
          </form>
        </div>
      )}

      {enlargedPhotoCard && (enlargedPhotoCard.frontPhotoUrl || enlargedPhotoCard.backPhotoUrl) && (
        <div className="modalBackdrop photoLightboxBackdrop" role="dialog" aria-modal="true" aria-label={`Photo preview for ${enlargedPhotoCard.name || "card"}`} onClick={() => setEnlargedPhotoCard(null)}>
          <div className="photoLightbox" onClick={(event) => event.stopPropagation()}>
            <div className="photoLightboxHeader">
              <div>
                <p className="eyebrow">Card photo</p>
                <h2>{enlargedPhotoCard.name || "Card photo"}</h2>
                <p className="muted">{[enlargedPhotoCard.year, enlargedPhotoCard.setName, enlargedPhotoCard.cardNumber].filter(Boolean).join(" • ")}</p>
              </div>
              <button className="secondary" type="button" onClick={() => setEnlargedPhotoCard(null)}>Close</button>
            </div>
            <div className="photoLightboxGrid">
              {enlargedPhotoCard.frontPhotoUrl && (
                <figure>
                  <figcaption>Front</figcaption>
                  <img src={enlargedPhotoCard.frontPhotoUrl} alt={`Enlarged front of ${enlargedPhotoCard.name || "card"}`} />
                </figure>
              )}
              {enlargedPhotoCard.backPhotoUrl && (
                <figure>
                  <figcaption>Back</figcaption>
                  <img src={enlargedPhotoCard.backPhotoUrl} alt={`Enlarged back of ${enlargedPhotoCard.name || "card"}`} />
                </figure>
              )}
            </div>
          </div>
        </div>
      )}

    </main>
  );
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Logo() {
  return (
    <div className="brandLogo" aria-label="Wicked Card Tracker">
      <img src="/wicked-card-tracker-logo.png" alt="Wicked Card Tracker" />
    </div>
  );
}

function AttentionGroupSection({ group, onOpenItem, onListCard }: { group: AttentionGroup; onOpenItem: (item: AttentionItem) => void; onListCard: (card: CardRecord) => void }) {
  if (!group.count) {
    return (
      <section className="attentionGroup isClear" id={`attention-${group.key}`}>
        <div className="attentionGroupHeader">
          <div>
            <h3>{group.title}</h3>
            <p>{group.description}</p>
          </div>
          <span className="clearBadge">Clear</span>
        </div>
      </section>
    );
  }

  return (
    <section className="attentionGroup" id={`attention-${group.key}`}>
      <div className="attentionGroupHeader">
        <div>
          <h3>{group.title}</h3>
          <p>{group.description}</p>
        </div>
        <span className="attentionCount">{group.count}</span>
      </div>
      <div className="attentionItemList">
        {group.items.map((item) => {
          const card = item.card;
          const photoUrl = card?.frontPhotoUrl || card?.backPhotoUrl || "";
          const isUnlistedCard = group.key === "unlisted" && Boolean(card);
          return (
            <article className={card ? "attentionItem attentionCardItem" : "attentionItem"} key={item.id}>
              {card && (
                photoUrl ? (
                  <img className="attentionCardThumb" src={photoUrl} alt={`${card.name || "Card"} photo`} />
                ) : (
                  <div className="attentionCardThumb placeholderThumb">No photo</div>
                )
              )}
              <div className="attentionItemBody">
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                {card && (
                  <div className="cardDetailChips attentionCardChips" aria-label={`Card details for ${card.name || "card"}`}>
                    {card.year && <span>{card.year}</span>}
                    {card.setName && <span>{card.setName}</span>}
                    {card.cardNumber && <span>#{card.cardNumber}</span>}
                    {cardQuantity(card) > 1 && <span>Qty {cardQuantity(card)}</span>}
                  </div>
                )}
              </div>
              <div className="attentionItemActions">
                {isUnlistedCard ? (
                  <button className="primary" type="button" onClick={() => { if (card) onListCard(card); }}>List Card</button>
                ) : (
                  <button className="secondary" type="button" onClick={() => onOpenItem(item)}>{item.action || "Open"}</button>
                )}
                {isUnlistedCard && <button className="secondary" type="button" onClick={() => onOpenItem(item)}>Edit card</button>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PhotoUploadControl({ label, onPick }: { label: string; onPick: (file: File) => void }) {
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onPick(file);
  };

  return (
    <div className="full photoUploadLabel">
      <span>{label}</span>
      <div className="photoUploadActions">
        <label className="primary photoChoiceButton">
          Take photo
          <input accept="image/*" capture="environment" type="file" onChange={handleFile} />
        </label>
        <label className="secondary photoChoiceButton">
          Choose from gallery
          <input accept="image/*" type="file" onChange={handleFile} />
        </label>
      </div>
    </div>
  );
}

function SlabPhotoUploadControl({ label, helpText, onPick }: { label: string; helpText: string; onPick: (file: File) => void }) {
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onPick(file);
  };

  return (
    <div className="slabPhotoUploadControl">
      <span>{label}</span>
      <div className="photoUploadActions">
        <label className="primary photoChoiceButton">
          Take photo
          <input accept="image/*" capture="environment" type="file" onChange={handleFile} />
        </label>
        <label className="secondary photoChoiceButton">
          Choose from gallery
          <input accept="image/*" type="file" onChange={handleFile} />
        </label>
      </div>
      <span className="muted">{helpText}</span>
    </div>
  );
}

function AuthPanel({ defaultMode = "signin" }: { defaultMode?: "signin" | "signup" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">(defaultMode);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const authFormRef = useRef<HTMLFormElement>(null);

  const formValue = (name: "email" | "password", fallback: string) => {
    const field = authFormRef.current?.elements.namedItem(name);
    const value = field instanceof HTMLInputElement ? field.value : fallback;
    return name === "email" ? value.trim() : value;
  };

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const requestedEmail = params.get("email") || params.get("wctEmail") || params.get("sellerEmail") || "";
    if (requestedEmail) setEmail(requestedEmail.trim());
  }, []);

  const resetPassword = async () => {
    if (!supabase) return;
    const submittedEmail = formValue("email", email);
    setSubmitting(true);
    setError("");
    setMessage("");
    if (!submittedEmail) {
      setSubmitting(false);
      setError("Enter your email first, then click reset password.");
      return;
    }
    setEmail(submittedEmail);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(submittedEmail, { redirectTo: `${window.location.origin}/` });
    setSubmitting(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setMessage("Password reset email sent. Check your inbox for the Wicked Card Tracker reset link.");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    const submittedEmail = formValue("email", email);
    const submittedPassword = formValue("password", password);
    setEmail(submittedEmail);
    setPassword(submittedPassword);
    setSubmitting(true);
    setError("");
    setMessage("");
    if (!submittedEmail || !submittedPassword) {
      setSubmitting(false);
      setError("Enter your email and password, then click sign in.");
      return;
    }
    const result = mode === "signup"
      ? await supabase.auth.signUp({ email: submittedEmail, password: submittedPassword, options: { emailRedirectTo: `${window.location.origin}/` } })
      : await supabase.auth.signInWithPassword({ email: submittedEmail, password: submittedPassword });
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setMessage(mode === "signup" ? "Account created. Check your email to confirm your account before signing in." : "Signed in.");
  };

  return (
    <section className="panel authPanel" id="account-login">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Account login</p>
          <h2>{mode === "signup" ? "Create your account" : "Sign in"}</h2>
        </div>
        <button className="secondary" type="button" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
          {mode === "signup" ? "I already have an account" : "Create new account"}
        </button>
      </div>
      <form ref={authFormRef} className="authForm" onSubmit={submit}>
        <Field label="Email" name="email" autoComplete="email" type="email" value={email} onChange={setEmail} required />
        <Field label="Password" name="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} type="password" value={password} onChange={setPassword} required />
        <button className="primary" disabled={submitting} type="submit">{submitting ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}</button>
        {mode === "signin" && <button className="secondary" disabled={submitting} type="button" onClick={resetPassword}>Reset password</button>}
        <a className="secondary" href={PRICING_PATH}>View pricing</a>
      </form>
      {message && <p className="notice">{message}</p>}
      {error && <p className="errorBox">{error}</p>}
    </section>
  );
}

function NavButton({ active, onClick, children, subtitle, badge, featured = false, className = "" }: { active: boolean; onClick: () => void; children: React.ReactNode; subtitle?: string; badge?: number; featured?: boolean; className?: string }) {
  const buttonClassName = ["navButton", active ? "active" : "", featured ? "featuredNavButton" : "", className].filter(Boolean).join(" ");
  return (
    <button className={buttonClassName} type="button" onClick={onClick}>
      <span className="navText"><strong>{children}</strong>{subtitle && <small>{subtitle}</small>}</span>
      {!!badge && <span className="navBadge">{badge}</span>}
    </button>
  );
}

function DateFilterControls({
  mode,
  startDate,
  endDate,
  selectedLabel,
  onModeChange,
  onStartDateChange,
  onEndDateChange,
}: {
  mode: DateFilterMode;
  startDate: string;
  endDate: string;
  selectedLabel: string;
  onModeChange: (mode: DateFilterMode) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}) {
  const setQuickMode = (nextMode: DateFilterMode) => onModeChange(nextMode);
  return (
    <section className="dateFilterBar" aria-label="Date filter">
      <div>
        <p className="eyebrow">Date filter</p>
        <strong>Viewing: {selectedLabel}</strong>
      </div>
      <div className="dateFilterButtons">
        <button className={mode === "all" ? "secondary activeFilter" : "secondary"} type="button" onClick={() => setQuickMode("all")}>All time</button>
        <button className={mode === "month" ? "secondary activeFilter" : "secondary"} type="button" onClick={() => setQuickMode("month")}>This month</button>
        <button className={mode === "year" ? "secondary activeFilter" : "secondary"} type="button" onClick={() => setQuickMode("year")}>This year</button>
        <button className={mode === "custom" ? "secondary activeFilter" : "secondary"} type="button" onClick={() => setQuickMode("custom")}>Custom</button>
      </div>
      {mode === "custom" && (
        <div className="customDateRange">
          <Field label="Start date" type="date" value={startDate} onChange={onStartDateChange} />
          <Field label="End date" type="date" value={endDate} onChange={onEndDateChange} />
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, tone, onClick, active = false }: { label: string; value: string; tone?: "positive" | "negative" | "warning"; onClick?: () => void; active?: boolean }) {
  const className = active ? "stat clickableStat activeStat" : onClick ? "stat clickableStat" : "stat";
  if (onClick) {
    return (
      <button className={className} type="button" onClick={onClick} aria-pressed={active}>
        <span>{label}</span>
        <strong className={tone}>{value}</strong>
      </button>
    );
  }
  return <div className={className}><span>{label}</span><strong className={tone}>{value}</strong></div>;
}

function ProfitStatusSection({
  title,
  cards,
  total,
  totalLabel,
  emptyText,
  showSale = false,
}: {
  title: string;
  cards: CardRecord[];
  total: number;
  totalLabel: string;
  emptyText: string;
  showSale?: boolean;
}) {
  return (
    <section className="profitStatusSection">
      <div className="profitSectionHeader">
        <div>
          <h3>{title}</h3>
          <p className="muted">{cards.reduce((sum, card) => sum + cardQuantity(card), 0)} cards</p>
        </div>
        <div className="rowMoney">
          <span>{money(total)}</span>
          <small>{totalLabel}</small>
        </div>
      </div>
      <div className="cardsList">
        {cards.map((card) => (
          <article className="cardRow compactRow" key={card.id}>
            <div>
              <strong>{card.name}</strong>
              <p className="muted">
                {card.year || "No year"}{card.setName ? ` · ${card.setName}` : ""}{card.cardNumber ? ` · #${card.cardNumber}` : ""}
              </p>
            </div>
            {showSale ? (
              <div className="rowMoney">
                <span className={cardProfit(card) >= 0 ? "positive" : "negative"}>{money(cardProfit(card))}</span>
                <small>Sold {money(card.soldPrice)} · cost {money(cardPurchaseCost(card))}{cardQuantity(card) > 1 ? ` (${cardQuantity(card)} × ${money(card.purchasePrice)})` : ""}</small>
              </div>
            ) : (
              <div className="rowMoney">
                <span>{money(card.purchasePrice)}</span>
                <small>purchase cost</small>
              </div>
            )}
          </article>
        ))}
        {cards.length === 0 && <p className="empty">{emptyText}</p>}
      </div>
    </section>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, required, name, autoComplete }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean; name?: string; autoComplete?: string }) {
  if (type === "date") return <DateField label={label} value={value} onChange={onChange} required={required} />;
  if (type === "number") return <NumberField label={label} value={value} onChange={onChange} placeholder={placeholder} required={required} />;
  return <label>{label}<input name={name} autoComplete={autoComplete} required={required} type={type} value={value} placeholder={placeholder} onFocus={(e) => e.currentTarget.select()} onChange={(e) => onChange(e.target.value)} /></label>;
}

function NumberField({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return <label>{label}<NumberInput value={value} onChange={onChange} placeholder={placeholder} required={required} step={label.toLowerCase().includes("quantity") ? "1" : "0.01"} /></label>;
}

function NumberInput({ value, onChange, placeholder, required, ariaLabel, step = "0.01" }: { value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean; ariaLabel?: string; step?: string }) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value);
  }, [focused, value]);

  return (
    <input
      aria-label={ariaLabel}
      required={required}
      type="number"
      step={step}
      value={draft}
      placeholder={placeholder}
      onFocus={(e) => {
        setFocused(true);
        e.currentTarget.select();
      }}
      onBlur={() => setFocused(false)}
      onWheel={(event) => event.currentTarget.blur()}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(e.target.value);
      }}
    />
  );
}

function DateField({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") input.showPicker();
    else input.focus();
  };

  return (
    <label>
      {label}
      <span className="dateInputWrap">
        <input ref={inputRef} required={required} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
        <button className="calendarButton" type="button" aria-label={`Open ${label} calendar`} onClick={openPicker}>📅</button>
      </span>
    </label>
  );
}

function Select({ label, value, options, onChange, required, placeholder }: { label: string; value: string; options: string[]; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
  return <label>{label}<select required={required} value={value} onChange={(e) => onChange(e.target.value)}>{placeholder && <option value="">{placeholder}</option>}{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
