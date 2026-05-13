"use client";

import type { Session } from "@supabase/supabase-js";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CardRecord, CardStatus, ExpenseCategory, ExpenseRecord, GradingSubmission, cardProfit, cardRoi, emptyCard, emptyExpense, emptyGradingSubmission, listedPotentialProfit, money, percent } from "@/lib/card";
import { cardsToCsv, expensesToCsv, profitSummaryToCsv, salesToCsv } from "@/lib/csv";
import { cardToInsert, cardToUpdate, expenseToInsert, expenseToUpdate, gradingSubmissionCardRows, gradingSubmissionToInsert, gradingSubmissionToUpdate, rowToCard, rowToExpense, rowToGradingSubmission } from "@/lib/dbCard";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Tab = "add" | "attention" | "listingReview" | "grading" | "inventory" | "expenses" | "profit";
type DashboardAction = { id: string; tab: Tab; icon: string; label: string; subtitle?: string; badge?: number; apply?: () => void };
type DateFilterMode = "all" | "month" | "year" | "custom";
type PhotoFilter = "All" | "Has photo" | "Missing photo";
type ListingUrlFilter = "All" | "Has listing URL" | "Missing listing URL";
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
};
type AttentionGroup = {
  key: string;
  title: string;
  count: number;
  description: string;
  items: AttentionItem[];
};
type ListedReviewItem = {
  card: CardRecord;
  age: number;
  referenceDate: string;
  tone: "current" | "warning" | "urgent";
};


const CARD_STORAGE_KEY = "card-inventory-tracker.cards.v2";
const EXPENSE_STORAGE_KEY = "card-inventory-tracker.expenses.v1";
const GRADING_STORAGE_KEY = "card-inventory-tracker.grading-submissions.v1";
const statuses: CardStatus[] = ["Not Listed", "Listed", "Sold"];
const expenseCategories: ExpenseCategory[] = ["HST", "Duties", "Grading Fees", "Shipping", "Card Show Table", "Supplies", "Gas", "Airfare", "Other"];
const todayIso = () => new Date().toISOString().slice(0, 10);
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
const mergeById = <T extends { id: string }>(primary: T[], fallback: T[]) => {
  const rows = new Map<string, T>();
  fallback.forEach((item) => rows.set(item.id, item));
  primary.forEach((item) => rows.set(item.id, item));
  return Array.from(rows.values());
};
const localCards = () => {
  try {
    const rawCards = window.localStorage.getItem(CARD_STORAGE_KEY);
    return rawCards ? JSON.parse(rawCards).map(normalizeStoredCard) as CardRecord[] : [];
  } catch {
    return [];
  }
};
const localExpenses = () => {
  try {
    const rawExpenses = window.localStorage.getItem(EXPENSE_STORAGE_KEY);
    return rawExpenses ? JSON.parse(rawExpenses).map(normalizeStoredExpense) as ExpenseRecord[] : [];
  } catch {
    return [];
  }
};
const localGradingSubmissions = () => {
  try {
    const rawGrading = window.localStorage.getItem(GRADING_STORAGE_KEY);
    return rawGrading ? JSON.parse(rawGrading).map(normalizeStoredGradingSubmission) as GradingSubmission[] : [];
  } catch {
    return [];
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
const listedAgeDate = (card: CardRecord) => card.listedDate || card.updatedAt?.slice(0, 10) || card.purchaseDate;
const listedDays = (card: CardRecord) => daysSince(listedAgeDate(card));
const listingReviewTone = (age: number): ListedReviewItem["tone"] => {
  if (age >= 60) return "urgent";
  if (age >= 30) return "warning";
  return "current";
};
const dateValue = (date: string) => (date ? new Date(`${date}T00:00:00`).getTime() || 0 : 0);
const uniqueSorted = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
const normalizeStoredCard = (card: Partial<CardRecord>): CardRecord => ({
  ...emptyCard(),
  ...card,
  id: card.id || crypto.randomUUID(),
  name: card.name || "",
  category: card.category || "Sports",
  status: card.status || "Not Listed",
  askingPrice: Number(card.askingPrice ?? 0) || 0,
  lowestAcceptablePrice: Number(card.lowestAcceptablePrice ?? 0) || 0,
  listedDate: card.listedDate || "",
  listedAt: card.listedAt || "",
  listedBy: card.listedBy || "",
  purchasePrice: Number(card.purchasePrice ?? 0) || 0,
  soldPrice: Number(card.soldPrice ?? 0) || 0,
  soldAt: card.soldAt || "",
  soldBy: card.soldBy || "",
  createdAt: card.createdAt || new Date().toISOString(),
  createdBy: card.createdBy || "",
  updatedAt: card.updatedAt || new Date().toISOString(),
  updatedBy: card.updatedBy || "",
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
const isListingPricingColumnError = (message: string) => /asking_price|lowest_acceptable_price|listed_date|listed_at|listed_by|schema cache|column/i.test(message);
const isAuditColumnError = (message: string) => /created_by|updated_by|listed_at|listed_by|sold_at|sold_by|returned_by|schema cache|column/i.test(message);


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
  const [gradingSubmissions, setGradingSubmissions] = useState<GradingSubmission[]>([]);
  const [activeCard, setActiveCard] = useState<CardRecord>(emptyCard());
  const [activeExpense, setActiveExpense] = useState<ExpenseRecord>(emptyExpense());
  const [sellingCard, setSellingCard] = useState<CardRecord | null>(null);
  const [editingCard, setEditingCard] = useState<CardRecord | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [gradingDraft, setGradingDraft] = useState<GradingSubmission>(emptyGradingSubmission());
  const [showGradingForm, setShowGradingForm] = useState(false);
  const [openGradingSubmissionId, setOpenGradingSubmissionId] = useState<string | null>(null);
  const [returningSubmission, setReturningSubmission] = useState<GradingSubmission | null>(null);
  const [returnDate, setReturnDate] = useState(todayIso());
  const [tab, setTab] = useState<Tab>("add");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CardStatus | "All">("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [platformFilter, setPlatformFilter] = useState("All");
  const [photoFilter, setPhotoFilter] = useState<PhotoFilter>("All");
  const [listingUrlFilter, setListingUrlFilter] = useState<ListingUrlFilter>("All");
  const [inventorySort, setInventorySort] = useState<InventorySort>("newest-purchase");
  const [session, setSession] = useState<Session | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [topSoldMode, setTopSoldMode] = useState<"all" | "month">("all");
  const [topSoldMonth, setTopSoldMonth] = useState(todayIso().slice(0, 7));

  const usingSupabase = Boolean(isSupabaseConfigured && supabase);
  const currentUsername = session?.user.email || "Local user";

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const loadSupabaseData = async (userId: string) => {
    if (!supabase) return;
    setError("");

    try {
      const membershipResult = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      const activeWorkspaceId = membershipResult.error ? null : membershipResult.data?.workspace_id ?? null;
      setWorkspaceId(activeWorkspaceId);

      const [workspaceCardsResult, userCardsResult, workspaceExpensesResult, userExpensesResult, workspaceGradingResult, userGradingResult] = await Promise.all([
        activeWorkspaceId
          ? supabase.from("cards").select("*").eq("workspace_id", activeWorkspaceId).order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        supabase.from("cards").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        activeWorkspaceId
          ? supabase.from("expenses").select("*").eq("workspace_id", activeWorkspaceId).order("expense_date", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        supabase.from("expenses").select("*").eq("user_id", userId).order("expense_date", { ascending: false }),
        activeWorkspaceId
          ? supabase.from("grading_submissions").select("*").eq("workspace_id", activeWorkspaceId).order("sent_date", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        supabase.from("grading_submissions").select("*").eq("user_id", userId).order("sent_date", { ascending: false }),
      ]);

      const cardRows = mergeById(workspaceCardsResult.data ?? [], userCardsResult.data ?? []);
      if (workspaceCardsResult.error && userCardsResult.error) setError(workspaceCardsResult.error.message || userCardsResult.error.message);
      else setCards(mergeById(cardRows.map(rowToCard), localCards()));

      const expenseRows = mergeById(workspaceExpensesResult.data ?? [], userExpensesResult.data ?? []);
      if (workspaceExpensesResult.error && userExpensesResult.error) setError(`Expenses table needs setup: ${workspaceExpensesResult.error.message || userExpensesResult.error.message}`);
      else setExpenses(mergeById(expenseRows.map(rowToExpense), localExpenses()));

      const gradingResult = {
        data: mergeById(workspaceGradingResult.data ?? [], userGradingResult.data ?? []),
        error: workspaceGradingResult.error && userGradingResult.error ? workspaceGradingResult.error : null,
      };

      if (gradingResult.error) {
        setGradingSubmissions([]);
      } else {
        const submissionIds = (gradingResult.data ?? []).map((submission) => submission.id);
        const linkResult = submissionIds.length
          ? await supabase.from("grading_submission_cards").select("submission_id, card_id").in("submission_id", submissionIds)
          : { data: [], error: null };
        if (linkResult.error) setGradingSubmissions(mergeById((gradingResult.data ?? []).map((row) => rowToGradingSubmission(row)), localGradingSubmissions()));
        else setGradingSubmissions(mergeById((gradingResult.data ?? []).map((row) => rowToGradingSubmission(row, linkResult.data ?? [])), localGradingSubmissions()));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load your account data. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!usingSupabase || !supabase) {
      setWorkspaceId(null);
      const storedCards = localCards();
      setCards(storedCards.length ? storedCards : sampleCards());
      setExpenses(localExpenses());
      setGradingSubmissions(localGradingSubmissions());
      setLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setLoading(false);
        if (data.session?.user.id) void loadSupabaseData(data.session.user.id);
      })
      .catch((sessionError) => {
        setError(sessionError instanceof Error ? sessionError.message : "Could not restore your login. Please sign in again.");
        setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      if (nextSession?.user.id) {
        void loadSupabaseData(nextSession.user.id);
      } else {
        setWorkspaceId(null);
        setCards(localCards());
        setExpenses(localExpenses());
        setGradingSubmissions(localGradingSubmissions());
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [usingSupabase]);

  useEffect(() => {
    if (!loading) window.localStorage.setItem(GRADING_STORAGE_KEY, JSON.stringify(gradingSubmissions));
    if (!usingSupabase && !loading) {
      window.localStorage.setItem(CARD_STORAGE_KEY, JSON.stringify(cards));
      window.localStorage.setItem(EXPENSE_STORAGE_KEY, JSON.stringify(expenses));
    }
  }, [cards, expenses, gradingSubmissions, loading, usingSupabase]);

  const activeInventoryCards = useMemo(() => cards.filter((card) => card.status !== "Sold"), [cards]);
  const soldInventoryCards = useMemo(() => cards.filter((card) => card.status === "Sold"), [cards]);
  const inventoryCategories = useMemo(() => uniqueSorted(activeInventoryCards.map((card) => card.category)), [activeInventoryCards]);
  const inventoryPlatforms = useMemo(() => uniqueSorted(activeInventoryCards.map((card) => card.listedPlatform)), [activeInventoryCards]);
  const filtersAreActive = Boolean(
    query.trim() ||
    statusFilter !== "All" ||
    categoryFilter !== "All" ||
    platformFilter !== "All" ||
    photoFilter !== "All" ||
    listingUrlFilter !== "All" ||
    inventorySort !== "newest-purchase"
  );

  const clearInventoryFilters = () => {
    setQuery("");
    setStatusFilter("All");
    setCategoryFilter("All");
    setPlatformFilter("All");
    setPhotoFilter("All");
    setListingUrlFilter("All");
    setInventorySort("newest-purchase");
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
    clearInventoryFilters();
    setTab("inventory");
  };

  const showAddInventoryForm = () => {
    setTab("add");
    window.setTimeout(() => document.getElementById("add-inventory-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const showSoldInventory = () => {
    clearInventoryFilters();
    setStatusFilter("Sold");
    setTab("inventory");
  };

  const filteredCards = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inventorySource = statusFilter === "Sold" ? soldInventoryCards : activeInventoryCards;
    const filtered = inventorySource.filter((card) => {
      const matchesStatus = statusFilter === "All" || card.status === statusFilter;
      const matchesCategory = categoryFilter === "All" || card.category === categoryFilter;
      const matchesPlatform = platformFilter === "All" || card.listedPlatform === platformFilter;
      const hasPhoto = Boolean(card.frontPhotoUrl.trim());
      const matchesPhoto = photoFilter === "All" || (photoFilter === "Has photo" ? hasPhoto : !hasPhoto);
      const hasListingUrl = Boolean(card.listingUrl.trim());
      const matchesListingUrl = listingUrlFilter === "All" || (listingUrlFilter === "Has listing URL" ? hasListingUrl : !hasListingUrl);
      const searchableText = [card.name, card.category, card.year, card.setName, card.cardNumber, card.notes, card.listedPlatform, card.listingUrl, card.salePlatform]
        .join(" ")
        .toLowerCase();
      const matchesQuery = !q || searchableText.includes(q);
      return matchesStatus && matchesCategory && matchesPlatform && matchesPhoto && matchesListingUrl && matchesQuery;
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
          return b.soldPrice - a.soldPrice;
        case "highest-profit":
          return cardProfit(b) - cardProfit(a);
        case "name-az":
          return a.name.localeCompare(b.name);
        case "newest-purchase":
        default:
          return dateValue(b.purchaseDate) - dateValue(a.purchaseDate);
      }
    });
  }, [activeInventoryCards, categoryFilter, inventorySort, listingUrlFilter, photoFilter, platformFilter, query, soldInventoryCards, statusFilter]);

  const inventoryTotalForCurrentView = statusFilter === "Sold" ? soldInventoryCards.length : activeInventoryCards.length;

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

    const notListedCards = cards.filter((card) => card.status === "Not Listed" && purchasedInRange(card));
    const listedCards = cards.filter((card) => card.status === "Listed" && purchasedInRange(card));
    const soldCards = cards.filter(soldInRange);
    const inventoryCostCards = cards.filter(purchasedInRange);
    const filteredExpenses = expenses.filter(expenseInRange);
    const revenue = soldCards.reduce((sum, card) => sum + card.soldPrice, 0);
    const soldInventoryCost = soldCards.reduce((sum, card) => sum + card.purchasePrice, 0);
    const unlistedInventoryCost = notListedCards.reduce((sum, card) => sum + card.purchasePrice, 0);
    const listedInventoryCost = listedCards.reduce((sum, card) => sum + card.purchasePrice, 0);
    const totalInventoryValue = unlistedInventoryCost + listedInventoryCost;
    const totalInventoryCost = inventoryCostCards.reduce((sum, card) => sum + card.purchasePrice, 0);
    const expenseBreakdown = expenseCategories.map((category) => {
      const categoryExpenses = filteredExpenses.filter((expense) => expense.category === category);
      return {
        category,
        total: categoryExpenses.reduce((sum, expense) => sum + expense.amount, 0),
        count: categoryExpenses.length,
      };
    });
    const expensesTotal = expenseBreakdown.reduce((sum, item) => sum + item.total, 0);
    const profit = revenue - soldInventoryCost - expensesTotal;
    return {
      revenue,
      soldInventoryCost,
      unlistedInventoryCost,
      listedInventoryCost,
      totalInventoryValue,
      totalInventoryCost,
      inventoryCostCards,
      expensesTotal,
      expenseBreakdown,
      profit,
      notListedCards,
      listedCards,
      soldCards,
      filteredExpenses,
      soldCount: soldCards.length,
      listedCount: listedCards.length,
      notListedCount: notListedCards.length,
    };
  }, [cards, dateRange.end, dateRange.start, expenses, isAllTime]);

  const attentionGroups = useMemo<AttentionGroup[]>(() => {
    const cardsMissingPhotos = cards
      .filter((card) => card.status !== "Sold" && !card.frontPhotoUrl.trim())
      .map((card) => ({
        id: `photo-${card.id}`,
        recordId: card.id,
        kind: "card" as const,
        title: card.name || "Unnamed card",
        detail: `${card.status} • ${money(card.purchasePrice)} purchase cost`,
        action: "Edit card and add a front photo",
      }));

    const unlistedCards = cards
      .filter((card) => card.status === "Not Listed")
      .map((card) => ({
        id: `unlisted-${card.id}`,
        recordId: card.id,
        kind: "card" as const,
        title: card.name || "Unnamed card",
        detail: [card.category, card.purchaseDate ? `Bought ${card.purchaseDate}` : "No purchase date", money(card.purchasePrice)].filter(Boolean).join(" • "),
        action: "Edit card or mark as listed",
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
  }, [cards, expenses]);

  const listingReviewItems = useMemo<ListedReviewItem[]>(() => cards
    .filter((card) => card.status === "Listed")
    .map((card) => ({ card, referenceDate: listedAgeDate(card) }))
    .map(({ card, referenceDate }) => ({ card, referenceDate, age: daysSince(referenceDate) }))
    .filter((item): item is { card: CardRecord; referenceDate: string; age: number } => item.age !== null)
    .map(({ card, referenceDate, age }) => ({ card, referenceDate, age, tone: listingReviewTone(age) }))
    .sort((a, b) => b.age - a.age), [cards]);
  const listingReviewCounts = {
    current: listingReviewItems.filter((item) => item.tone === "current").length,
    warning: listingReviewItems.filter((item) => item.tone === "warning").length,
    urgent: listingReviewItems.filter((item) => item.tone === "urgent").length,
  };

  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const openGradingSubmissions = useMemo(() => gradingSubmissions.filter((submission) => submission.status === "At Grading"), [gradingSubmissions]);
  const gradingSubmissionCards = (submission: GradingSubmission) => submission.cardIds.map((cardId) => cardById.get(cardId)).filter((card): card is CardRecord => Boolean(card));
  const gradingPurchaseValue = (submission: GradingSubmission) => gradingSubmissionCards(submission).reduce((sum, card) => sum + card.purchasePrice, 0);
  const activeGradingCardIds = useMemo(() => new Set(openGradingSubmissions.flatMap((submission) => submission.cardIds)), [openGradingSubmissions]);
  const openGradingCardCount = Array.from(activeGradingCardIds).filter((cardId) => cardById.has(cardId)).length;
  const openGradingPurchaseValue = Array.from(activeGradingCardIds).reduce((sum, cardId) => sum + (cardById.get(cardId)?.purchasePrice ?? 0), 0);
  const selectedCards = selectedCardIds
    .map((cardId) => cardById.get(cardId))
    .filter((card): card is CardRecord => Boolean(card))
    .filter((card) => card.status !== "Sold");
  const selectedPurchaseValue = selectedCards.reduce((sum, card) => sum + card.purchasePrice, 0);
  const isSoldInventoryView = statusFilter === "Sold";

  useEffect(() => {
    if (!isSoldInventoryView) return;
    setSelectedCardIds([]);
  }, [isSoldInventoryView]);

  const totalAttentionItems = attentionGroups.reduce((sum, group) => sum + group.count, 0);
  const listedReviewTotal = listingReviewCounts.warning + listingReviewCounts.urgent;
  const listedValue = totals.listedCards.reduce((sum, card) => sum + card.askingPrice, 0);
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
  const dashboardActions: DashboardAction[] = [
    { id: "add", tab: "add", icon: "+", label: "Add Inventory", subtitle: "Log a new card", apply: showAddInventoryForm },
    { id: "attention", tab: "attention", icon: "!", label: "Needs Attention", subtitle: "Fix next actions", badge: totalAttentionItems },
    { id: "listingReview", tab: "listingReview", icon: "▣", label: "Listing Review", subtitle: "Listed-card age", badge: listedReviewTotal },
    { id: "inventory", tab: "inventory", icon: "▤", label: "Inventory", subtitle: `${activeInventoryCards.length} cards`, apply: showActiveInventory },
    { id: "soldInventory", tab: "inventory", icon: "◆", label: "Sold Inventory", subtitle: `${soldInventoryCards.length} cards`, apply: showSoldInventory },
    { id: "grading", tab: "grading", icon: "▥", label: "Grading", subtitle: "Open submissions", badge: openGradingCardCount },
    { id: "expenses", tab: "expenses", icon: "$", label: "Expenses", subtitle: money(totals.expensesTotal) },
    { id: "profit", tab: "profit", icon: "↗", label: "Profit", subtitle: money(totals.profit) },
  ];

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

  const uploadFrontPhoto = async (file: File, target: "active" | "editing" = "active") => {
    setError("");
    setNotice("");
    setPhotoUploading(true);

    const applyPhoto = (url: string) => {
      if (target === "editing") setEditingCard((card) => (card ? { ...card, frontPhotoUrl: url } : card));
      else setActiveCard((card) => ({ ...card, frontPhotoUrl: url }));
    };

    if (usingSupabase && supabase && session?.user.id) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("card-photos").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadError) {
        setError(`Photo upload failed. Make sure the card-photos storage SQL has been run. ${uploadError.message}`);
        setPhotoUploading(false);
        return;
      }

      const { data } = supabase.storage.from("card-photos").getPublicUrl(path);
      applyPhoto(data.publicUrl);
      setNotice("Front photo uploaded.");
    } else {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      applyPhoto(dataUrl);
      setNotice("Front photo added locally.");
    }

    setPhotoUploading(false);
  };

  const validateCardBusinessRules = (card: CardRecord) => {
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

  const saveCard = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeCard.name.trim()) return;
    setError("");
    setNotice("");

    const now = new Date().toISOString();
    const preparedCard = activeCard.status === "Listed" || activeCard.status === "Sold" ? prepareCardForStatus(activeCard, activeCard.status) : activeCard;
    const cardToSave: CardRecord = {
      ...preparedCard,
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

    if (usingSupabase && supabase && session?.user.id) {
      let insertResult = await supabase
        .from("cards")
        .insert(cardToInsert(cardToSave, session.user.id, workspaceId))
        .select("*")
        .single();
      if (insertResult.error && isAuditColumnError(insertResult.error.message)) {
        insertResult = await supabase
          .from("cards")
          .insert(cardToInsert(cardToSave, session.user.id, workspaceId, true, false))
          .select("*")
          .single();
        if (!insertResult.error) setNotice("Inventory added. Run the audit SQL migration so usernames save to account storage.");
      }
      if (insertResult.error && isListingPricingColumnError(insertResult.error.message)) {
        insertResult = await supabase
          .from("cards")
          .insert(cardToInsert(cardToSave, session.user.id, workspaceId, false, false))
          .select("*")
          .single();
        if (!insertResult.error) setNotice("Inventory added. Finish account storage setup so listing price/date fields save for both users.");
      }
      const { data, error: insertError } = insertResult;
      if (insertError) {
        setError(insertError.message);
        return;
      }
      setCards((current) => [rowToCard(data), ...current]);
    } else {
      setCards((current) => [{ ...cardToSave, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...current]);
    }

    setNotice((current) => current || "Inventory added.");
    setActiveCard(emptyCard());
    setTab("inventory");
  };

  const updateCard = async (card: CardRecord) => {
    setError("");
    if (usingSupabase && supabase && session?.user.id) {
      let updateQuery = supabase
        .from("cards")
        .update(cardToUpdate(card))
        .eq("id", card.id);
      updateQuery = card.workspaceId ? updateQuery.eq("workspace_id", card.workspaceId) : updateQuery.eq("user_id", session.user.id);
      let updateResult = await updateQuery.select("*").single();
      if (updateResult.error && isAuditColumnError(updateResult.error.message)) {
        let legacyAuditQuery = supabase
          .from("cards")
          .update(cardToUpdate(card, true, false))
          .eq("id", card.id);
        legacyAuditQuery = card.workspaceId ? legacyAuditQuery.eq("workspace_id", card.workspaceId) : legacyAuditQuery.eq("user_id", session.user.id);
        updateResult = await legacyAuditQuery.select("*").single();
        if (!updateResult.error) setNotice("Card updated. Run the audit SQL migration so usernames save to account storage.");
      }
      if (updateResult.error && isListingPricingColumnError(updateResult.error.message)) {
        let legacyUpdateQuery = supabase
          .from("cards")
          .update(cardToUpdate(card, false, false))
          .eq("id", card.id);
        legacyUpdateQuery = card.workspaceId ? legacyUpdateQuery.eq("workspace_id", card.workspaceId) : legacyUpdateQuery.eq("user_id", session.user.id);
        updateResult = await legacyUpdateQuery.select("*").single();
        if (!updateResult.error) setNotice("Card updated. Finish account storage setup so listing price/date fields save for both users.");
      }
      const { data, error: updateError } = updateResult;
      if (updateError) {
        setError(updateError.message);
        return false;
      }
      setCards((current) => current.map((item) => (item.id === card.id ? rowToCard(data) : item)));
      return true;
    }
    setCards((current) => current.map((item) => (item.id === card.id ? card : item)));
    return true;
  };

  const deleteCard = async (card: CardRecord) => {
    setError("");
    if (card.status === "Sold") {
      setError("Sold cards cannot be deleted. They are kept as sales history for profit and audit records.");
      return;
    }
    if (usingSupabase && supabase && session?.user.id) {
      let deleteQuery = supabase.from("cards").delete().eq("id", card.id);
      deleteQuery = card.workspaceId ? deleteQuery.eq("workspace_id", card.workspaceId) : deleteQuery.eq("user_id", session.user.id);
      const { error: deleteError } = await deleteQuery;
      if (deleteError) {
        setError(deleteError.message);
        return;
      }
    }
    setCards((current) => current.filter((item) => item.id !== card.id));
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
      const validationError = validateCardBusinessRules(nextCard);
      if (validationError) {
        setError(validationError);
        setSellingCard(nextCard);
        return;
      }
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

  const saveSale = async (event: FormEvent) => {
    event.preventDefault();
    if (!sellingCard) return;
    const now = new Date().toISOString();
    const soldCard = {
      ...sellingCard,
      status: "Sold" as const,
      soldAt: sellingCard.soldAt || now,
      soldBy: sellingCard.soldBy || currentUsername,
      updatedAt: now,
      updatedBy: currentUsername,
    };
    const validationError = validateCardBusinessRules(soldCard);
    if (validationError) {
      setError(validationError);
      return;
    }
    const ok = await updateCard(soldCard);
    if (ok) {
      setNotice(`Sold ${soldCard.name} for ${money(soldCard.soldPrice)}.`);
      setSellingCard(null);
      setTab("profit");
    }
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
    const validationError = validateExpenseBusinessRules(expenseToSave);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (usingSupabase && supabase && session?.user.id) {
      if (editingExpenseId) {
        let updateQuery = supabase
          .from("expenses")
          .update(expenseToUpdate(expenseToSave))
          .eq("id", expenseToSave.id);
        updateQuery = expenseToSave.workspaceId ? updateQuery.eq("workspace_id", expenseToSave.workspaceId) : updateQuery.eq("user_id", session.user.id);
        let updateResult = await updateQuery.select("*").single();
        if (updateResult.error && isAuditColumnError(updateResult.error.message)) {
          let legacyExpenseQuery = supabase
            .from("expenses")
            .update(expenseToUpdate(expenseToSave, false))
            .eq("id", expenseToSave.id);
          legacyExpenseQuery = expenseToSave.workspaceId ? legacyExpenseQuery.eq("workspace_id", expenseToSave.workspaceId) : legacyExpenseQuery.eq("user_id", session.user.id);
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
          .insert(expenseToInsert(expenseToSave, session.user.id, workspaceId))
          .select("*")
          .single();
        if (insertResult.error && isAuditColumnError(insertResult.error.message)) {
          insertResult = await supabase
            .from("expenses")
            .insert(expenseToInsert(expenseToSave, session.user.id, workspaceId, false))
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
        const exists = current.some((expense) => expense.id === expenseToSave.id);
        return exists ? current.map((expense) => (expense.id === expenseToSave.id ? expenseToSave : expense)) : [{ ...expenseToSave, id: crypto.randomUUID() }, ...current];
      });
    }

    setNotice("Expense saved.");
    setActiveExpense(emptyExpense());
    setEditingExpenseId(null);
  };

  const deleteExpense = async (expense: ExpenseRecord) => {
    setError("");
    if (usingSupabase && supabase && session?.user.id) {
      let deleteQuery = supabase.from("expenses").delete().eq("id", expense.id);
      deleteQuery = expense.workspaceId ? deleteQuery.eq("workspace_id", expense.workspaceId) : deleteQuery.eq("user_id", session.user.id);
      const { error: deleteError } = await deleteQuery;
      if (deleteError) {
        setError(deleteError.message);
        return;
      }
    }
    setExpenses((current) => current.filter((expenseRecord) => expenseRecord.id !== expense.id));
  };

  const toggleSelectedCard = (cardId: string) => {
    const card = cardById.get(cardId);
    if (!card || card.status === "Sold" || activeGradingCardIds.has(cardId)) return;
    setSelectedCardIds((current) => current.includes(cardId) ? current.filter((id) => id !== cardId) : [...current, cardId]);
  };

  const selectAllFilteredCards = () => setSelectedCardIds(filteredCards.filter((card) => card.status !== "Sold" && !activeGradingCardIds.has(card.id)).map((card) => card.id));
  const clearSelectedCards = () => setSelectedCardIds([]);

  const beginGradingSubmission = () => {
    setError("");
    if (!selectedCards.length) {
      setError("Select at least one unsold card before creating a grading submission.");
      return;
    }
    const submissionCardIds = selectedCards.map((card) => card.id);
    setGradingDraft({ ...emptyGradingSubmission(), cardIds: submissionCardIds });
    setShowGradingForm(true);
  };

  const saveGradingSubmission = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const now = new Date().toISOString();
    const submission: GradingSubmission = {
      ...gradingDraft,
      company: gradingDraft.company.trim(),
      reference: gradingDraft.reference.trim(),
      notes: gradingDraft.notes.trim(),
      cardIds: selectedCards.map((card) => card.id),
      status: "At Grading",
      returnedDate: "",
      createdAt: gradingDraft.createdAt || now,
      createdBy: gradingDraft.createdBy || currentUsername,
      updatedAt: now,
      updatedBy: currentUsername,
    };

    if (!submission.company) {
      setError("Choose the grading company before saving the submission.");
      return;
    }
    if (!submission.sentDate) {
      setError("Add the date the cards were sent to grading.");
      return;
    }
    if (!submission.cardIds.length) {
      setError("Select at least one card before saving the grading submission.");
      return;
    }

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
        setShowGradingForm(false);
        setTab("grading");
        return;
      }

      const linkRows = gradingSubmissionCardRows(submission);
      const linkResult = linkRows.length ? await supabase.from("grading_submission_cards").insert(linkRows) : { error: null };
      if (linkResult.error) {
        await supabase.from("grading_submissions").delete().eq("id", submission.id);
        setError(linkResult.error.message);
        return;
      }
      setGradingSubmissions((current) => [rowToGradingSubmission(data, linkRows), ...current]);
    } else {
      setGradingSubmissions((current) => [submission, ...current]);
    }

    setNotice(`Sent ${submission.cardIds.length} cards to ${submission.company} for grading.`);
    setSelectedCardIds([]);
    setShowGradingForm(false);
    setTab("grading");
  };

  const markGradingReturned = async (event: FormEvent) => {
    event.preventDefault();
    if (!returningSubmission) return;
    if (!returnDate) {
      setError("Add the return date before marking the submission returned.");
      return;
    }
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
        return;
      }
      setGradingSubmissions((current) => current.map((submission) => submission.id === returnedSubmission.id ? rowToGradingSubmission(data, gradingSubmissionCardRows(returnedSubmission)) : submission));
    } else {
      setGradingSubmissions((current) => current.map((submission) => submission.id === returnedSubmission.id ? returnedSubmission : submission));
    }

    setNotice(`${returnedSubmission.company} grading submission marked returned.`);
    setReturningSubmission(null);
  };

  const exportCards = () => downloadCsv(cardsToCsv(filteredCards), `card-inventory-filtered-${new Date().toISOString().slice(0, 10)}.csv`);
  const exportDateSuffix = selectedDateLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "all-time";
  const exportExpenses = () => downloadCsv(expensesToCsv(totals.filteredExpenses), `card-expenses-${exportDateSuffix}-${new Date().toISOString().slice(0, 10)}.csv`);
  const exportAllInventory = () => downloadCsv(cardsToCsv(activeInventoryCards), `card-inventory-all-${new Date().toISOString().slice(0, 10)}.csv`);
  const exportPeriodInventory = () => downloadCsv(cardsToCsv([...totals.notListedCards, ...totals.listedCards]), `card-inventory-${exportDateSuffix}-${new Date().toISOString().slice(0, 10)}.csv`);
  const exportPeriodSales = () => downloadCsv(salesToCsv(totals.soldCards), `card-sales-${exportDateSuffix}-${new Date().toISOString().slice(0, 10)}.csv`);
  const exportProfitSummary = () => downloadCsv(profitSummaryToCsv({
    periodLabel: selectedDateLabel,
    revenue: totals.revenue,
    totalInventoryCost: totals.soldInventoryCost,
    totalInventoryValue: totals.totalInventoryValue,
    expensesTotal: totals.expensesTotal,
    profit: totals.profit,
    unlistedInventoryCost: totals.unlistedInventoryCost,
    listedInventoryCost: totals.listedInventoryCost,
    soldInventoryCost: totals.soldInventoryCost,
    soldCardsRevenue: totals.revenue,
    soldCardsCount: totals.soldCount,
    listedCardsCount: totals.listedCount,
    unlistedCardsCount: totals.notListedCount,
  }), `card-profit-summary-${exportDateSuffix}-${new Date().toISOString().slice(0, 10)}.csv`);

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
  };

  if (usingSupabase && !session) {
    return (
      <main className="shell">
        <header className="hero logoHero">
          <Logo />
        </header>
        <AuthPanel />
      </main>
    );
  }

  return (
    <main className="shell mobileDashboardShell">
      <header className="mobileTopHeader" aria-label="Wicked Card Tracker dashboard header">
        <button className="iconCircle" type="button" aria-label="Jump to quick actions" onClick={() => document.getElementById("quick-actions")?.scrollIntoView({ behavior: "smooth", block: "start" })}>☰</button>
        <Logo />
        <div className="topHeaderActions">
          {session && <button className="secondary signOutButton" onClick={signOut} type="button">Sign out</button>}
        </div>
      </header>

      {session && (
        <section className="collectorHeroCard" aria-label="Logged in account and portfolio summary">
          <div className="collectorHeroContent">
            <span className="loginBadge"><span /> Logged In</span>
            <strong className="collectorEmail">{session.user.email || "Account"}</strong>
            <p className="collectorSince">▣ Collector workspace</p>
            <div className="heroStatsGrid compactHeroStats">
              <Stat label="Total Unsold Cards" value={String(activeInventoryCards.length)} />
              <Stat label="Total Profit" value={money(totals.profit)} tone={totals.profit >= 0 ? "positive" : "negative"} />
              <Stat label="Total Inventory Value" value={money(totals.totalInventoryValue)} />
            </div>
          </div>
          <div className="slabShowpiece" aria-label={mostExpensiveSoldCard ? `Top sold card ${mostExpensiveSoldCard.name} sold for ${money(mostExpensiveSoldCard.soldPrice)}` : "Top sold card placeholder"}>
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
          <button type="button" onClick={() => setTab("profit")}><span>▱</span><small>Inventory Value</small><strong>{money(totals.totalInventoryValue)}</strong></button>
          <button type="button" onClick={() => setTab("expenses")}><span>▥</span><small>Expenses</small><strong>{money(totals.expensesTotal)}</strong></button>
          <button type="button" onClick={() => setTab("listingReview")}><span>◇</span><small>Listed Value</small><strong>{money(listedValue)}</strong></button>
          <button type="button" onClick={() => setTab("attention")}><span>☆</span><small>Needs Attention</small><strong>{totalAttentionItems}</strong></button>
        </section>
      )}

      <section className="quickActionsPanel" id="quick-actions" aria-label="Quick actions">
        <div className="quickActionsHeader">
          <p className="eyebrow">Quick Actions</p>
        </div>
        <nav className="navBar quickActionGrid" aria-label="Main navigation">
          {dashboardActions.map((action) => (
            <NavButton active={action.id === "soldInventory" ? tab === "inventory" && statusFilter === "Sold" : tab === action.tab && !(action.id === "inventory" && statusFilter === "Sold")} badge={action.badge} icon={action.icon} key={action.id} onClick={() => action.apply ? action.apply() : setTab(action.tab)} subtitle={action.subtitle}>
              {action.label}
            </NavButton>
          ))}
        </nav>
      </section>

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="errorBox">{error}</p>}
      {loading && <p className="notice">Loading…</p>}

      {tab === "add" && (
        <section className="panel" id="add-inventory-panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Add Inventory</p>
              <h2>Add a card</h2>
            </div>
          </div>
          <form className="formGrid simpleForm" id="add-inventory-form" onSubmit={saveCard}>
            <Field label="Card/player name" value={activeCard.name} onChange={(v) => setActiveCard({ ...activeCard, name: v })} required />
            <Field label="Category" value={activeCard.category} onChange={(v) => setActiveCard({ ...activeCard, category: v })} placeholder="Sports, Pokemon, MTG..." />
            <Field label="Year" value={activeCard.year} onChange={(v) => setActiveCard({ ...activeCard, year: v })} />
            <Field label="Set" value={activeCard.setName} onChange={(v) => setActiveCard({ ...activeCard, setName: v })} />
            <Field label="Card #" value={activeCard.cardNumber} onChange={(v) => setActiveCard({ ...activeCard, cardNumber: v })} />
            <Field label="Purchase price" type="number" value={String(activeCard.purchasePrice)} onChange={(v) => setActiveCard({ ...activeCard, purchasePrice: Number(v || 0) })} />
            <Field label="Purchase date" type="date" value={activeCard.purchaseDate} onChange={(v) => setActiveCard({ ...activeCard, purchaseDate: v })} />
            <Select label="Status" value={activeCard.status} options={statuses} onChange={(v) => setActiveCard(prepareCardForStatus(activeCard, v as CardStatus))} />
            <Field label="Listed where?" value={activeCard.listedPlatform} onChange={(v) => setActiveCard({ ...activeCard, listedPlatform: v, status: v ? "Listed" : activeCard.status, listedDate: v ? activeCard.listedDate || todayIso() : activeCard.listedDate })} placeholder="eBay, Whatnot, TCGplayer..." />
            <Field label="Listing URL" value={activeCard.listingUrl} onChange={(v) => setActiveCard({ ...activeCard, listingUrl: v })} />
            {activeCard.status === "Listed" && (
              <>
                <Field label="Asking price" type="number" value={String(activeCard.askingPrice)} onChange={(v) => setActiveCard({ ...activeCard, askingPrice: Number(v || 0) })} required />
                <Field label="Minimum sale price" type="number" value={String(activeCard.lowestAcceptablePrice)} onChange={(v) => setActiveCard({ ...activeCard, lowestAcceptablePrice: Number(v || 0) })} />
                <Field label="Listed date" type="date" value={activeCard.listedDate} onChange={(v) => setActiveCard({ ...activeCard, listedDate: v })} required />
                <div className="calc">
                  <span>Potential profit: <strong className={listedPotentialProfit(activeCard) >= 0 ? "positive" : "negative"}>{money(listedPotentialProfit(activeCard))}</strong></span>
                </div>
              </>
            )}
            {activeCard.status === "Sold" && (
              <>
                <Field label="Sold for" type="number" value={String(activeCard.soldPrice)} onChange={(v) => setActiveCard({ ...activeCard, soldPrice: Number(v || 0) })} required />
                <Field label="Sale date" type="date" value={activeCard.saleDate} onChange={(v) => setActiveCard({ ...activeCard, saleDate: v })} required />
                <Field label="Sold where?" value={activeCard.salePlatform} onChange={(v) => setActiveCard({ ...activeCard, salePlatform: v })} placeholder="eBay, Whatnot, private sale..." required />
              </>
            )}
            <PhotoUploadControl
              helpText="Take a new card photo, or choose one from your gallery."
              onPick={(file) => uploadFrontPhoto(file)}
            />
            {activeCard.frontPhotoUrl && (
              <div className="photoPreview full">
                <img src={activeCard.frontPhotoUrl} alt="Front of card preview" />
                <button className="secondary" type="button" onClick={() => setActiveCard({ ...activeCard, frontPhotoUrl: "" })}>Remove photo</button>
              </div>
            )}
            <label className="full textareaLabel">Notes<textarea value={activeCard.notes} onChange={(e) => setActiveCard({ ...activeCard, notes: e.target.value })} /></label>
            <button className="primary full" type="submit" disabled={photoUploading}>{photoUploading ? "Uploading photo…" : "Add to inventory"}</button>
          </form>
        </section>
      )}

      {tab === "attention" && (
        <section className="panel">
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
                <AttentionGroupSection group={group} key={group.key} onOpenItem={openAttentionItem} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "listingReview" && (
        <section className="panel">
          <div className="panelHeader inventoryHeader">
            <div>
              <p className="eyebrow">Listing Review</p>
              <h2>{listingReviewItems.length ? `${listingReviewItems.length} listed cards` : "No listed cards yet"}</h2>
              <p className="muted">Cards listed 30–60 days are highlighted for review. Cards listed 60+ days are urgent.</p>
            </div>
            <button className="secondary" type="button" onClick={showActiveInventory}>Open inventory</button>
          </div>
          <section className="statsGrid listingReviewStats" aria-label="Listing review summary">
            <Stat label="Current listings (0–30 days)" value={String(listingReviewCounts.current)} />
            <Stat label="Review soon (30–60 days)" value={String(listingReviewCounts.warning)} tone={listingReviewCounts.warning ? "warning" : undefined} />
            <Stat label="Urgent review (60+ days)" value={String(listingReviewCounts.urgent)} tone={listingReviewCounts.urgent ? "negative" : undefined} />
          </section>
          <div className="cardsList listingReviewList">
            {listingReviewItems.map(({ card, age, referenceDate, tone }) => (
              <article className={`cardRow compactRow listingReviewRow ${tone}`} key={card.id}>
                <div>
                  <div className="rowTitle">
                    <strong>{card.name || "Unnamed card"}</strong>
                    <span className={`listingAgeBadge ${tone}`}>{age} days listed</span>
                  </div>
                  <p className="muted">
                    Listed {referenceDate ? formatDateLabel(referenceDate) : "date unknown"}{card.listedPlatform ? ` • ${card.listedPlatform}` : ""}
                  </p>
                  <p className="muted">
                    Asking {money(card.askingPrice)} • Cost {money(card.purchasePrice)} • Potential profit <strong className={listedPotentialProfit(card) >= 0 ? "positive" : "negative"}>{money(listedPotentialProfit(card))}</strong>{card.lowestAcceptablePrice ? ` • Minimum ${money(card.lowestAcceptablePrice)}` : ""}
                  </p>
                  {activeGradingCardIds.has(card.id) && (
                    <p className="gradingInline">At grading: {openGradingSubmissions.find((submission) => submission.cardIds.includes(card.id))?.company || "grading company"}</p>
                  )}
                  {card.listingUrl && <p><a href={card.listingUrl} target="_blank" rel="noreferrer">Open listing</a></p>}
                </div>
                <div className="rowActions">
                  <button className="secondary" onClick={() => setEditingCard(card)} type="button">Edit card</button>
                </div>
              </article>
            ))}
            {!listingReviewItems.length && <p className="empty">No cards are currently marked Listed.</p>}
          </div>
        </section>
      )}

      {tab === "grading" && (
        <section className="panel">
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
                          <small>{submissionCards.length} cards</small>
                        </div>
                      </button>
                      {isOpen && (
                        <div className="gradingOrderDetail">
                          {submission.notes && <p className="muted">{submission.notes}</p>}
                          <div className="cardsList">
                            {submissionCards.map((card) => (
                              <article className="cardRow compactRow" key={card.id}>
                                <div>
                                  <strong>{card.name}</strong>
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
                          <div className="rowActions">
                            {submission.status !== "Returned" && <button className="primary" type="button" onClick={() => { setReturningSubmission(submission); setReturnDate(todayIso()); }}>Mark returned</button>}
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
        <section className="panel">
          <div className="panelHeader inventoryHeader">
            <div>
              <p className="eyebrow">Inventory</p>
              <h2>Showing {filteredCards.length} of {inventoryTotalForCurrentView} {statusFilter === "Sold" ? "sold" : "active inventory"} cards</h2>
            </div>
            <button className="secondary" onClick={exportCards} type="button">Export filtered inventory</button>
          </div>

          <section className="inventoryFilterPanel" aria-label="Inventory search and filters">
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
              <button className="secondary" disabled={!filtersAreActive} onClick={clearInventoryFilters} type="button">Clear filters</button>
            </div>
          </section>

          {!isSoldInventoryView && (
          <section className="bulkGradingBar" aria-label="Bulk grading actions">
            <div>
              <p className="eyebrow">Bulk grading</p>
              <strong>{selectedCards.length} selected</strong>
              {selectedCards.length > 0 && <p className="muted">Selected purchase value: {money(selectedPurchaseValue)}</p>}
            </div>
            <div className="rowActions">
              <button className="secondary" type="button" onClick={selectAllFilteredCards} disabled={!filteredCards.some((card) => card.status !== "Sold")}>Select all shown</button>
              <button className="secondary" type="button" onClick={clearSelectedCards} disabled={!selectedCards.length}>Clear selected</button>
              <button className="primary" type="button" onClick={beginGradingSubmission} disabled={!selectedCards.length}>Send selected to grading</button>
            </div>
          </section>
          )}

          <div className="cardsList">
            {filteredCards.map((card) => (
              <article className="cardRow" key={card.id}>
                {!isSoldInventoryView && (
                <label className="selectCardBox" aria-label={`Select ${card.name} for grading`}>
                  <input type="checkbox" checked={selectedCardIds.includes(card.id)} disabled={card.status === "Sold" || activeGradingCardIds.has(card.id)} onChange={() => toggleSelectedCard(card.id)} />
                </label>
                )}
                {card.frontPhotoUrl ? (
                  <img className="cardThumb" src={card.frontPhotoUrl} alt={`Front of ${card.name}`} />
                ) : (
                  <div className="cardThumb placeholderThumb">No photo</div>
                )}
                <div>
                  <div className="rowTitle"><strong>{card.name}</strong><span className={`statusBadge ${card.status.replace(" ", "").toLowerCase()}`}>{card.status}</span></div>
                  <p>{[card.year, card.setName, card.cardNumber].filter(Boolean).join(" • ") || "No card details yet"}</p>
                  <p className="muted">{card.status === "Sold" ? `Sold on ${card.salePlatform || "unknown platform"} for ${money(card.soldPrice)}` : card.status === "Listed" ? `Listed on ${card.listedPlatform || "unknown platform"}${listedDays(card) !== null ? ` for ${listedDays(card)} days` : ""}` : "Not listed yet"}</p>
                  <p className="muted auditTrail">Added {formatDateTimeLabel(card.createdAt)} by {actorLabel(card.createdBy, currentUsername)}{card.status === "Listed" && ` • Listed ${formatDateTimeLabel(card.listedAt || card.updatedAt)} by ${actorLabel(card.listedBy || card.updatedBy, currentUsername)}`}{card.status === "Sold" && ` • Sold ${formatDateTimeLabel(card.soldAt || card.updatedAt)} by ${actorLabel(card.soldBy || card.updatedBy, currentUsername)}`}</p>
                  {card.status === "Listed" && (
                    <p className="muted">
                      Asking {money(card.askingPrice)} • Potential profit <strong className={listedPotentialProfit(card) >= 0 ? "positive" : "negative"}>{money(listedPotentialProfit(card))}</strong>{card.lowestAcceptablePrice ? ` • Minimum ${money(card.lowestAcceptablePrice)}` : ""}
                    </p>
                  )}
                  {card.listingUrl && <p><a href={card.listingUrl} target="_blank" rel="noreferrer">Open listing</a></p>}
                </div>
                <div className="rowMoney">
                  <span>{money(card.purchasePrice)}</span>
                  <small>purchase price</small>
                </div>
                <div className="inventoryControls">
                  <label className="miniLabel">Status
                    <select value={card.status} onChange={(e) => changeCardStatus(card, e.target.value as CardStatus)}>
                      {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </label>
                  {card.status === "Listed" && (
                    <>
                      <input aria-label={`Listed platform for ${card.name}`} placeholder="Listed where?" value={card.listedPlatform} onChange={(e) => updateListingInfo(card, { listedPlatform: e.target.value })} />
                      <input aria-label={`Listing URL for ${card.name}`} placeholder="Listing URL" value={card.listingUrl} onChange={(e) => updateListingInfo(card, { listingUrl: e.target.value })} />
                      <input aria-label={`Asking price for ${card.name}`} placeholder="Asking price" type="number" step="0.01" value={String(card.askingPrice)} onChange={(e) => updateListingInfo(card, { askingPrice: Number(e.target.value || 0) })} />
                      <input aria-label={`Minimum sale price for ${card.name}`} placeholder="Minimum sale price" type="number" step="0.01" value={String(card.lowestAcceptablePrice)} onChange={(e) => updateListingInfo(card, { lowestAcceptablePrice: Number(e.target.value || 0) })} />
                      <input aria-label={`Listed date for ${card.name}`} type="date" value={card.listedDate} onChange={(e) => updateListingInfo(card, { listedDate: e.target.value })} />
                    </>
                  )}
                </div>
                <div className="rowActions">
                  <button className="secondary" onClick={() => setEditingCard(card)} type="button">Edit</button>
                  <button className="secondary" onClick={() => setSellingCard({ ...card, saleDate: card.saleDate || new Date().toISOString().slice(0, 10) })} type="button">Enter sale</button>
                  {card.status !== "Sold" && <button className="danger" onClick={() => deleteCard(card)} type="button">Delete</button>}
                </div>
              </article>
            ))}
            {!filteredCards.length && <p className="empty">No cards match your filters.</p>}
          </div>
        </section>
      )}

      {tab === "expenses" && (
        <section className="panel">
          <div className="panelHeader inventoryHeader">
            <div>
              <p className="eyebrow">Expenses</p>
              <h2>Record HST, duties, grading, shipping, and other expenses</h2>
            </div>
            <button className="secondary" onClick={exportExpenses} type="button">Export filtered expenses ({totals.filteredExpenses.length})</button>
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

          <form className="formGrid expenseForm" id="expense-form" onSubmit={saveExpense}>
            <Select label="Expense type" value={activeExpense.category} options={expenseCategories} onChange={(v) => setActiveExpense({ ...activeExpense, category: v as ExpenseCategory })} placeholder="Select expense type" required />
            <Field label="Amount" type="number" value={String(activeExpense.amount)} onChange={(v) => setActiveExpense({ ...activeExpense, amount: Number(v || 0) })} required />
            <Field label="Date" type="date" value={activeExpense.expenseDate} onChange={(v) => setActiveExpense({ ...activeExpense, expenseDate: v })} required />
            <Field label="Vendor / source" value={activeExpense.vendor} onChange={(v) => setActiveExpense({ ...activeExpense, vendor: v })} placeholder="PSA, Canada Post, customs..." />
            <Field label="Description" value={activeExpense.description} onChange={(v) => setActiveExpense({ ...activeExpense, description: v })} placeholder="What was this for?" />
            <button className="primary" type="submit">{editingExpenseId ? "Save expense" : "Add expense"}</button>
          </form>

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
                  <button className="secondary" type="button" onClick={() => { setActiveExpense(expense); setEditingExpenseId(expense.id); }}>Edit</button>
                  <button className="danger" type="button" onClick={() => deleteExpense(expense)}>Delete</button>
                </div>
              </article>
            ))}
            {!totals.filteredExpenses.length && <p className="empty">No expenses for {selectedDateLabel.toLowerCase()}.</p>}
          </div>
        </section>
      )}

      {tab === "profit" && (
        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Profit</p>
              <h2>Sold revenue minus sold inventory cost and expenses</h2>
              <p className="muted">Showing {selectedDateLabel.toLowerCase()}. Profit only counts cards that are already sold; listed and unlisted cards stay in Total Inventory Value.</p>
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
            <Stat label="Total expenses" value={money(totals.expensesTotal)} />
            <Stat label="Total profit" value={money(totals.profit)} tone={totals.profit >= 0 ? "positive" : "negative"} />
            <Stat label="Total Inventory Value" value={money(totals.totalInventoryValue)} />
            <Stat label="Unlisted inventory" value={money(totals.unlistedInventoryCost)} />
            <Stat label="Listed inventory" value={money(totals.listedInventoryCost)} />
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
            <ProfitStatusSection title="Listed cards" cards={totals.listedCards} totalLabel="Money in listed cards" total={totals.listedInventoryCost} emptyText="No listed cards." />
            <ProfitStatusSection title="Sold cards" cards={totals.soldCards} totalLabel="Sold inventory cost" total={totals.soldInventoryCost} emptyText="No sold cards yet. Use Inventory → Enter sale." showSale />
          </div>
        </section>
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
              <Field label="Purchase price" type="number" value={String(editingCard.purchasePrice)} onChange={(v) => setEditingCard({ ...editingCard, purchasePrice: Number(v || 0) })} />
              <Field label="Purchase date" type="date" value={editingCard.purchaseDate} onChange={(v) => setEditingCard({ ...editingCard, purchaseDate: v })} />
              <Select label="Status" value={editingCard.status} options={statuses} onChange={(v) => setEditingCard(prepareCardForStatus(editingCard, v as CardStatus))} />
              <Field label="Listed where?" value={editingCard.listedPlatform} onChange={(v) => setEditingCard({ ...editingCard, listedPlatform: v, status: v ? "Listed" : editingCard.status, listedDate: v ? editingCard.listedDate || todayIso() : editingCard.listedDate })} placeholder="eBay, Whatnot, TCGplayer..." />
              <Field label="Listing URL" value={editingCard.listingUrl} onChange={(v) => setEditingCard({ ...editingCard, listingUrl: v })} />
              {editingCard.status === "Listed" && (
                <>
                  <Field label="Asking price" type="number" value={String(editingCard.askingPrice)} onChange={(v) => setEditingCard({ ...editingCard, askingPrice: Number(v || 0) })} required />
                  <Field label="Minimum sale price" type="number" value={String(editingCard.lowestAcceptablePrice)} onChange={(v) => setEditingCard({ ...editingCard, lowestAcceptablePrice: Number(v || 0) })} />
                  <Field label="Listed date" type="date" value={editingCard.listedDate} onChange={(v) => setEditingCard({ ...editingCard, listedDate: v })} required />
                  <div className="calc">
                    <span>Days listed: <strong>{listedDays(editingCard) ?? 0}</strong></span>
                    <span>Potential profit: <strong className={listedPotentialProfit(editingCard) >= 0 ? "positive" : "negative"}>{money(listedPotentialProfit(editingCard))}</strong></span>
                  </div>
                </>
              )}
              {editingCard.status === "Sold" && (
                <>
                  <Field label="Sold for" type="number" value={String(editingCard.soldPrice)} onChange={(v) => setEditingCard({ ...editingCard, soldPrice: Number(v || 0) })} required />
                  <Field label="Sale date" type="date" value={editingCard.saleDate} onChange={(v) => setEditingCard({ ...editingCard, saleDate: v })} required />
                  <Field label="Sold where?" value={editingCard.salePlatform} onChange={(v) => setEditingCard({ ...editingCard, salePlatform: v })} placeholder="eBay, Whatnot, private sale..." required />
                </>
              )}
              <PhotoUploadControl
                helpText="Take a new card photo, or choose a replacement from your gallery."
                onPick={(file) => uploadFrontPhoto(file, "editing")}
              />
              {editingCard.frontPhotoUrl && (
                <div className="photoPreview full">
                  <img src={editingCard.frontPhotoUrl} alt={`Front of ${editingCard.name}`} />
                  <button className="secondary" type="button" onClick={() => setEditingCard({ ...editingCard, frontPhotoUrl: "" })}>Remove photo</button>
                </div>
              )}
              <label className="full textareaLabel">Notes<textarea value={editingCard.notes} onChange={(e) => setEditingCard({ ...editingCard, notes: e.target.value })} /></label>
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
                <h2>{selectedCards.length} selected cards</h2>
                <p className="muted">Purchase value selected: {money(selectedPurchaseValue)}</p>
              </div>
              <button className="secondary" type="button" onClick={() => setShowGradingForm(false)}>Cancel</button>
            </div>
            <div className="formGrid simpleForm">
              <Field label="Grading company" value={gradingDraft.company} onChange={(v) => setGradingDraft({ ...gradingDraft, company: v })} placeholder="PSA, SGC, BGS, CGC..." required />
              <Field label="Date sent" type="date" value={gradingDraft.sentDate} onChange={(v) => setGradingDraft({ ...gradingDraft, sentDate: v })} required />
              <Field label="Order / reference" value={gradingDraft.reference} onChange={(v) => setGradingDraft({ ...gradingDraft, reference: v })} placeholder="Optional submission name or order #" />
              <label className="full textareaLabel">Notes<textarea value={gradingDraft.notes} onChange={(e) => setGradingDraft({ ...gradingDraft, notes: e.target.value })} placeholder="Optional notes about this grading order" /></label>
              <div className="calc full">
                <span>Cards in submission: <strong>{selectedCards.length}</strong></span>
                <span>Total purchase value: <strong>{money(selectedPurchaseValue)}</strong></span>
              </div>
              <button className="primary full" type="submit">Create grading submission</button>
            </div>
          </form>
        </div>
      )}

      {returningSubmission && (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Mark grading submission returned">
          <form className="modal panel" onSubmit={markGradingReturned}>
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Mark returned</p>
                <h2>{returningSubmission.reference || `${returningSubmission.company} submission`}</h2>
              </div>
              <button className="secondary" type="button" onClick={() => setReturningSubmission(null)}>Cancel</button>
            </div>
            <div className="formGrid simpleForm">
              <Field label="Return date" type="date" value={returnDate} onChange={setReturnDate} required />
              <div className="calc full">
                <span>Company: <strong>{returningSubmission.company}</strong></span>
                <span>Cards returning: <strong>{returningSubmission.cardIds.length}</strong></span>
                <span>Sent date: <strong>{formatDateLabel(returningSubmission.sentDate)}</strong></span>
              </div>
              <button className="primary full" type="submit">Mark order returned</button>
            </div>
          </form>
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
              <button className="secondary" type="button" onClick={() => setSellingCard(null)}>Cancel</button>
            </div>
            <div className="formGrid simpleForm">
              <Field label="Sold for" type="number" value={String(sellingCard.soldPrice)} onChange={(v) => setSellingCard({ ...sellingCard, soldPrice: Number(v || 0) })} required />
              <Field label="Sale date" type="date" value={sellingCard.saleDate} onChange={(v) => setSellingCard({ ...sellingCard, saleDate: v })} required />
              <Field label="Sold where?" value={sellingCard.salePlatform} onChange={(v) => setSellingCard({ ...sellingCard, salePlatform: v })} placeholder="eBay, Whatnot, private sale..." required />
              <div className="calc full">
                <span>Purchase price: <strong>{money(sellingCard.purchasePrice)}</strong></span>
                <span>Card profit before expenses: <strong className={cardProfit(sellingCard) >= 0 ? "positive" : "negative"}>{money(cardProfit(sellingCard))}</strong></span>
              </div>
              <button className="primary full" type="submit">Save sale</button>
            </div>
          </form>
        </div>
      )}

      <nav className="bottomMobileNav" aria-label="Mobile dashboard navigation">
        <button className={tab === "add" ? "active" : ""} type="button" onClick={showAddInventoryForm}><span>⌂</span><small>Home</small></button>
        <button className={tab === "inventory" ? "active" : ""} type="button" onClick={() => setTab("inventory")}><span>▤</span><small>Inventory</small></button>
        <button className="centerAdd" type="button" onClick={showAddInventoryForm}><span>+</span><small>Add</small></button>
        <button className={tab === "attention" ? "active" : ""} type="button" onClick={() => setTab("attention")}><span>☆</span><small>Attention</small></button>
        <button className={tab === "profit" ? "active" : ""} type="button" onClick={() => setTab("profit")}><span>•••</span><small>More</small></button>
      </nav>
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

function AttentionGroupSection({ group, onOpenItem }: { group: AttentionGroup; onOpenItem: (item: AttentionItem) => void }) {
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
        {group.items.map((item) => (
          <button className="attentionItem" key={item.id} onClick={() => onOpenItem(item)} type="button">
            <div>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
            {item.action && <span>{item.action}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

function PhotoUploadControl({ helpText, onPick }: { helpText: string; onPick: (file: File) => void }) {
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onPick(file);
  };

  return (
    <div className="full photoUploadLabel">
      <span>Front photo</span>
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

function AuthPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    const result = mode === "signup"
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setMessage(mode === "signup" ? "Account created. Check your email to confirm your account before signing in." : "Signed in.");
  };

  return (
    <section className="panel authPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Account login</p>
          <h2>{mode === "signup" ? "Create your account" : "Sign in"}</h2>
        </div>
        <button className="secondary" type="button" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
          {mode === "signup" ? "I already have an account" : "Create new account"}
        </button>
      </div>
      <form className="authForm" onSubmit={submit}>
        <Field label="Email" type="email" value={email} onChange={setEmail} required />
        <Field label="Password" type="password" value={password} onChange={setPassword} required />
        <button className="primary" disabled={submitting} type="submit">{submitting ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}</button>
      </form>
      {message && <p className="notice">{message}</p>}
      {error && <p className="errorBox">{error}</p>}
    </section>
  );
}

function NavButton({ active, onClick, children, icon, subtitle, badge }: { active: boolean; onClick: () => void; children: React.ReactNode; icon?: string; subtitle?: string; badge?: number }) {
  return (
    <button className={active ? "navButton active" : "navButton"} type="button" onClick={onClick}>
      {icon && <span className="navIcon">{icon}</span>}
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

function Stat({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" | "warning" }) {
  return <div className="stat"><span>{label}</span><strong className={tone}>{value}</strong></div>;
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
          <p className="muted">{cards.length} cards</p>
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
                <small>Sold {money(card.soldPrice)} · cost {money(card.purchasePrice)}</small>
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

function Field({ label, value, onChange, type = "text", placeholder, required }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  if (type === "date") return <DateField label={label} value={value} onChange={onChange} required={required} />;
  return <label>{label}<input required={required} type={type} step={type === "number" ? "0.01" : undefined} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>;
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
