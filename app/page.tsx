"use client";

import type { Session } from "@supabase/supabase-js";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CardRecord, CardStatus, ExpenseCategory, ExpenseRecord, cardProfit, cardRoi, emptyCard, emptyExpense, listedPotentialProfit, money, percent } from "@/lib/card";
import { cardsToCsv, expensesToCsv } from "@/lib/csv";
import { cardToInsert, cardToUpdate, expenseToInsert, expenseToUpdate, rowToCard, rowToExpense } from "@/lib/dbCard";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Tab = "add" | "attention" | "inventory" | "expenses" | "profit";
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


const CARD_STORAGE_KEY = "card-inventory-tracker.cards.v2";
const EXPENSE_STORAGE_KEY = "card-inventory-tracker.expenses.v1";
const statuses: CardStatus[] = ["Not Listed", "Listed", "Sold"];
const expenseCategories: ExpenseCategory[] = ["HST", "Duties", "Grading Fees", "Shipping", "Other"];
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
  purchasePrice: Number(card.purchasePrice ?? 0) || 0,
  soldPrice: Number(card.soldPrice ?? 0) || 0,
  createdAt: card.createdAt || new Date().toISOString(),
  updatedAt: card.updatedAt || new Date().toISOString(),
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
const isListingPricingColumnError = (message: string) => /asking_price|lowest_acceptable_price|listed_date|schema cache|column/i.test(message);


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
  const [activeCard, setActiveCard] = useState<CardRecord>(emptyCard());
  const [activeExpense, setActiveExpense] = useState<ExpenseRecord>(emptyExpense());
  const [sellingCard, setSellingCard] = useState<CardRecord | null>(null);
  const [editingCard, setEditingCard] = useState<CardRecord | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
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

  const usingSupabase = Boolean(isSupabaseConfigured && supabase);

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

      const cardQuery = supabase.from("cards").select("*").order("created_at", { ascending: false });
      const expenseQuery = supabase.from("expenses").select("*").order("expense_date", { ascending: false });

      const [cardsResult, expensesResult] = await Promise.all([
        activeWorkspaceId ? cardQuery.eq("workspace_id", activeWorkspaceId) : cardQuery.eq("user_id", userId),
        activeWorkspaceId ? expenseQuery.eq("workspace_id", activeWorkspaceId) : expenseQuery.eq("user_id", userId),
      ]);

      if (cardsResult.error) setError(cardsResult.error.message);
      else setCards((cardsResult.data ?? []).map(rowToCard));

      if (expensesResult.error) setError(`Expenses table needs setup: ${expensesResult.error.message}`);
      else setExpenses((expensesResult.data ?? []).map(rowToExpense));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load your account data. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!usingSupabase || !supabase) {
      setWorkspaceId(null);
      const rawCards = window.localStorage.getItem(CARD_STORAGE_KEY);
      const rawExpenses = window.localStorage.getItem(EXPENSE_STORAGE_KEY);
      setCards(rawCards ? JSON.parse(rawCards).map(normalizeStoredCard) : sampleCards());
      setExpenses(rawExpenses ? JSON.parse(rawExpenses) : []);
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
        setCards([]);
        setExpenses([]);
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [usingSupabase]);

  useEffect(() => {
    if (!usingSupabase && !loading) {
      window.localStorage.setItem(CARD_STORAGE_KEY, JSON.stringify(cards));
      window.localStorage.setItem(EXPENSE_STORAGE_KEY, JSON.stringify(expenses));
    }
  }, [cards, expenses, loading, usingSupabase]);

  const inventoryCategories = useMemo(() => uniqueSorted(cards.map((card) => card.category)), [cards]);
  const inventoryPlatforms = useMemo(() => uniqueSorted(cards.map((card) => card.listedPlatform)), [cards]);
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

  const filteredCards = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = cards.filter((card) => {
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
  }, [cards, categoryFilter, inventorySort, listingUrlFilter, photoFilter, platformFilter, query, statusFilter]);

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
    const profit = revenue - totalInventoryCost - expensesTotal;
    return {
      revenue,
      soldInventoryCost,
      unlistedInventoryCost,
      listedInventoryCost,
      totalInventoryCost,
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
      .filter((card) => !card.frontPhotoUrl.trim())
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

    const listedMissingUrls = cards
      .filter((card) => card.status === "Listed" && !card.listingUrl.trim())
      .map((card) => ({
        id: `listing-url-${card.id}`,
        recordId: card.id,
        kind: "card" as const,
        title: card.name || "Unnamed card",
        detail: `Listed on ${card.listedPlatform || "unknown platform"}`,
        action: "Edit card and add the listing URL",
      }));

    const listedOverThirtyDays = cards
      .filter((card) => card.status === "Listed")
      .map((card) => ({ card, referenceDate: listedAgeDate(card) }))
      .map(({ card, referenceDate }) => ({ card, referenceDate, age: daysSince(referenceDate) }))
      .filter((item): item is { card: CardRecord; referenceDate: string; age: number } => item.age !== null && item.age > 30)
      .map(({ card, referenceDate, age }) => ({
        id: `listed-age-${card.id}`,
        recordId: card.id,
        kind: "card" as const,
        title: card.name || "Unnamed card",
        detail: `${age} days since listed/status date ${referenceDate}${card.listedPlatform ? ` • ${card.listedPlatform}` : ""}`,
        action: "Review price or listing",
      }));

    const soldMissingSaleInfo = cards
      .filter((card) => card.status === "Sold" && (!card.soldPrice || !card.saleDate))
      .map((card) => ({
        id: `sale-info-${card.id}`,
        recordId: card.id,
        kind: "card" as const,
        title: card.name || "Unnamed card",
        detail: `${!card.soldPrice ? "Missing sold price" : "Sold price saved"} • ${!card.saleDate ? "Missing sale date" : card.saleDate}`,
        action: "Edit card and complete sale details",
      }));

    const incompleteExpenses = expenses
      .filter((expense) => !expense.category || !expense.amount || !expense.expenseDate)
      .map((expense) => ({
        id: `expense-${expense.id}`,
        recordId: expense.id,
        kind: "expense" as const,
        title: expense.description || expense.vendor || "Expense record",
        detail: `${!expense.category ? "Missing type" : expense.category} • ${!expense.amount ? "Missing amount" : money(expense.amount)} • ${!expense.expenseDate ? "Missing date" : expense.expenseDate}`,
        action: "Edit expense details",
      }));

    return [
      {
        key: "missing-photos",
        title: "Cards missing photos",
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
      {
        key: "missing-listing-url",
        title: "Listed cards missing URLs",
        count: listedMissingUrls.length,
        description: "Add listing links so both users can quickly open live listings.",
        items: listedMissingUrls,
      },
      {
        key: "listed-over-30",
        title: "Listed over 30 days",
        count: listedOverThirtyDays.length,
        description: "Review older listed cards for pricing, photos, or platform changes.",
        items: listedOverThirtyDays,
      },
      {
        key: "missing-sale-info",
        title: "Sold cards missing sale info",
        count: soldMissingSaleInfo.length,
        description: "Complete sale price and date so profit stays accurate.",
        items: soldMissingSaleInfo,
      },
      {
        key: "incomplete-expenses",
        title: "Incomplete expenses",
        count: incompleteExpenses.length,
        description: "Fix expense records before exporting reports for bookkeeping.",
        items: incompleteExpenses,
      },
    ];
  }, [cards, expenses]);

  const totalAttentionItems = attentionGroups.reduce((sum, group) => sum + group.count, 0);

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

  const saveCard = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeCard.name.trim()) return;
    setError("");
    setNotice("");

    const cardToSave = activeCard.status === "Listed" ? prepareCardForStatus(activeCard, "Listed") : activeCard;

    if (usingSupabase && supabase && session?.user.id) {
      let insertResult = await supabase
        .from("cards")
        .insert(cardToInsert(cardToSave, session.user.id, workspaceId))
        .select("*")
        .single();
      if (insertResult.error && isListingPricingColumnError(insertResult.error.message)) {
        insertResult = await supabase
          .from("cards")
          .insert(cardToInsert(cardToSave, session.user.id, workspaceId, false))
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
      updateQuery = workspaceId ? updateQuery.eq("workspace_id", workspaceId) : updateQuery.eq("user_id", session.user.id);
      let updateResult = await updateQuery.select("*").single();
      if (updateResult.error && isListingPricingColumnError(updateResult.error.message)) {
        let legacyUpdateQuery = supabase
          .from("cards")
          .update(cardToUpdate(card, false))
          .eq("id", card.id);
        legacyUpdateQuery = workspaceId ? legacyUpdateQuery.eq("workspace_id", workspaceId) : legacyUpdateQuery.eq("user_id", session.user.id);
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

  const deleteCard = async (id: string) => {
    setError("");
    if (usingSupabase && supabase && session?.user.id) {
      let deleteQuery = supabase.from("cards").delete().eq("id", id);
      deleteQuery = workspaceId ? deleteQuery.eq("workspace_id", workspaceId) : deleteQuery.eq("user_id", session.user.id);
      const { error: deleteError } = await deleteQuery;
      if (deleteError) {
        setError(deleteError.message);
        return;
      }
    }
    setCards((current) => current.filter((card) => card.id !== id));
  };

  const changeCardStatus = async (card: CardRecord, status: CardStatus) => {
    const nextCard = prepareCardForStatus(card, status);

    if (status === "Sold" && !card.soldPrice) {
      setSellingCard(nextCard);
      return;
    }

    const ok = await updateCard(nextCard);
    if (ok) setNotice(`${card.name} changed to ${status}.`);
  };

  const updateListingInfo = async (card: CardRecord, updates: Partial<Pick<CardRecord, "listedPlatform" | "listingUrl" | "askingPrice" | "lowestAcceptablePrice" | "listedDate">>) => {
    const nextCard = { ...card, ...updates, status: "Listed" as const, listedDate: updates.listedDate ?? (card.listedDate || todayIso()), updatedAt: new Date().toISOString() };
    const ok = await updateCard(nextCard);
    if (ok) setNotice(`Updated listing info for ${card.name}.`);
  };

  const saveEditedCard = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingCard?.name.trim()) return;
    const nextCard = { ...editingCard, updatedAt: new Date().toISOString() };
    const ok = await updateCard(nextCard);
    if (ok) {
      setNotice(`Updated ${nextCard.name}.`);
      setEditingCard(null);
    }
  };

  const saveSale = async (event: FormEvent) => {
    event.preventDefault();
    if (!sellingCard) return;
    const soldCard = {
      ...sellingCard,
      status: "Sold" as const,
      saleDate: sellingCard.saleDate || new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString(),
    };
    const ok = await updateCard(soldCard);
    if (ok) {
      setNotice(`Sold ${soldCard.name} for ${money(soldCard.soldPrice)}.`);
      setSellingCard(null);
      setTab("profit");
    }
  };

  const saveExpense = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeExpense.amount) return;
    setError("");
    setNotice("");

    if (usingSupabase && supabase && session?.user.id) {
      if (editingExpenseId) {
        let updateQuery = supabase
          .from("expenses")
          .update(expenseToUpdate(activeExpense))
          .eq("id", activeExpense.id);
        updateQuery = workspaceId ? updateQuery.eq("workspace_id", workspaceId) : updateQuery.eq("user_id", session.user.id);
        const { data, error: updateError } = await updateQuery.select("*").single();
        if (updateError) {
          setError(updateError.message);
          return;
        }
        setExpenses((current) => current.map((expense) => (expense.id === activeExpense.id ? rowToExpense(data) : expense)));
      } else {
        const { data, error: insertError } = await supabase
          .from("expenses")
          .insert(expenseToInsert(activeExpense, session.user.id, workspaceId))
          .select("*")
          .single();
        if (insertError) {
          setError(insertError.message);
          return;
        }
        setExpenses((current) => [rowToExpense(data), ...current]);
      }
    } else {
      setExpenses((current) => {
        const exists = current.some((expense) => expense.id === activeExpense.id);
        return exists ? current.map((expense) => (expense.id === activeExpense.id ? activeExpense : expense)) : [{ ...activeExpense, id: crypto.randomUUID() }, ...current];
      });
    }

    setNotice("Expense saved.");
    setActiveExpense(emptyExpense());
    setEditingExpenseId(null);
  };

  const deleteExpense = async (id: string) => {
    setError("");
    if (usingSupabase && supabase && session?.user.id) {
      let deleteQuery = supabase.from("expenses").delete().eq("id", id);
      deleteQuery = workspaceId ? deleteQuery.eq("workspace_id", workspaceId) : deleteQuery.eq("user_id", session.user.id);
      const { error: deleteError } = await deleteQuery;
      if (deleteError) {
        setError(deleteError.message);
        return;
      }
    }
    setExpenses((current) => current.filter((expense) => expense.id !== id));
  };

  const exportCards = () => downloadCsv(cardsToCsv(cards), `card-inventory-${new Date().toISOString().slice(0, 10)}.csv`);
  const exportDateSuffix = selectedDateLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "all-time";
  const exportExpenses = () => downloadCsv(expensesToCsv(totals.filteredExpenses), `card-expenses-${exportDateSuffix}-${new Date().toISOString().slice(0, 10)}.csv`);

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
    <main className="shell">
      <header className="hero compactHero logoHero">
        <Logo />
        {session && <button className="secondary signOutButton" onClick={signOut} type="button">Sign out</button>}
      </header>

      <nav className="navBar" aria-label="Main navigation">
        <NavButton active={tab === "add"} onClick={() => setTab("add")}>Add Inventory</NavButton>
        <NavButton active={tab === "attention"} onClick={() => setTab("attention")}>Needs Attention{totalAttentionItems ? ` (${totalAttentionItems})` : ""}</NavButton>
        <NavButton active={tab === "inventory"} onClick={() => setTab("inventory")}>Inventory</NavButton>
        <NavButton active={tab === "expenses"} onClick={() => setTab("expenses")}>Expenses</NavButton>
        <NavButton active={tab === "profit"} onClick={() => setTab("profit")}>Profit</NavButton>
      </nav>

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="errorBox">{error}</p>}
      {loading && <p className="notice">Loading…</p>}

      {tab === "add" && (
        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Add Inventory</p>
              <h2>Add a card</h2>
            </div>
          </div>
          <form className="formGrid simpleForm" onSubmit={saveCard}>
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
                <Field label="Asking price" type="number" value={String(activeCard.askingPrice)} onChange={(v) => setActiveCard({ ...activeCard, askingPrice: Number(v || 0) })} />
                <Field label="Lowest acceptable price" type="number" value={String(activeCard.lowestAcceptablePrice)} onChange={(v) => setActiveCard({ ...activeCard, lowestAcceptablePrice: Number(v || 0) })} />
                <Field label="Listed date" type="date" value={activeCard.listedDate} onChange={(v) => setActiveCard({ ...activeCard, listedDate: v })} />
                <div className="calc">
                  <span>Potential profit: <strong className={listedPotentialProfit(activeCard) >= 0 ? "positive" : "negative"}>{money(listedPotentialProfit(activeCard))}</strong></span>
                </div>
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
            <button className="secondary" type="button" onClick={() => setTab("inventory")}>Open inventory</button>
          </div>

          <section className="attentionStats" aria-label="Needs attention summary">
            {attentionGroups.map((group) => (
              <button
                className={`attentionStat ${group.count ? "hasItems" : ""}`}
                disabled={!group.count}
                key={group.key}
                onClick={() => {
                  const element = document.getElementById(`attention-${group.key}`);
                  element?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                type="button"
              >
                <span>{group.title}</span>
                <strong>{group.count}</strong>
              </button>
            ))}
          </section>

          {totalAttentionItems === 0 ? (
            <p className="empty">No action items right now. New missing photos, unlisted cards, old listings, sale gaps, or incomplete expenses will show here.</p>
          ) : (
            <div className="attentionGroups">
              {attentionGroups.map((group) => (
                <AttentionGroupSection group={group} key={group.key} onOpenItem={openAttentionItem} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "inventory" && (
        <section className="panel">
          <div className="panelHeader inventoryHeader">
            <div>
              <p className="eyebrow">Inventory</p>
              <h2>Showing {filteredCards.length} of {cards.length} cards</h2>
            </div>
            <button className="secondary" onClick={exportCards} type="button">Export inventory</button>
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

          <div className="cardsList">
            {filteredCards.map((card) => (
              <article className="cardRow" key={card.id}>
                {card.frontPhotoUrl ? (
                  <img className="cardThumb" src={card.frontPhotoUrl} alt={`Front of ${card.name}`} />
                ) : (
                  <div className="cardThumb placeholderThumb">No photo</div>
                )}
                <div>
                  <div className="rowTitle"><strong>{card.name}</strong><span className={`statusBadge ${card.status.replace(" ", "").toLowerCase()}`}>{card.status}</span></div>
                  <p>{[card.year, card.setName, card.cardNumber].filter(Boolean).join(" • ") || "No card details yet"}</p>
                  <p className="muted">{card.status === "Sold" ? `Sold on ${card.salePlatform || "unknown platform"} for ${money(card.soldPrice)}` : card.status === "Listed" ? `Listed on ${card.listedPlatform || "unknown platform"}${listedDays(card) !== null ? ` for ${listedDays(card)} days` : ""}` : "Not listed yet"}</p>
                  {card.status === "Listed" && (
                    <p className="muted">
                      Asking {money(card.askingPrice)} • Potential profit <strong className={listedPotentialProfit(card) >= 0 ? "positive" : "negative"}>{money(listedPotentialProfit(card))}</strong>{card.lowestAcceptablePrice ? ` • Lowest ${money(card.lowestAcceptablePrice)}` : ""}
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
                      <input aria-label={`Listed date for ${card.name}`} type="date" value={card.listedDate} onChange={(e) => updateListingInfo(card, { listedDate: e.target.value })} />
                    </>
                  )}
                </div>
                <div className="rowActions">
                  <button className="secondary" onClick={() => setEditingCard(card)} type="button">Edit</button>
                  <button className="secondary" onClick={() => setSellingCard({ ...card, saleDate: card.saleDate || new Date().toISOString().slice(0, 10) })} type="button">Enter sale</button>
                  <button className="danger" onClick={() => deleteCard(card.id)} type="button">Delete</button>
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
            <Select label="Expense type" value={activeExpense.category} options={expenseCategories} onChange={(v) => setActiveExpense({ ...activeExpense, category: v as ExpenseCategory })} />
            <Field label="Amount" type="number" value={String(activeExpense.amount)} onChange={(v) => setActiveExpense({ ...activeExpense, amount: Number(v || 0) })} required />
            <Field label="Date" type="date" value={activeExpense.expenseDate} onChange={(v) => setActiveExpense({ ...activeExpense, expenseDate: v })} />
            <Field label="Vendor / source" value={activeExpense.vendor} onChange={(v) => setActiveExpense({ ...activeExpense, vendor: v })} placeholder="PSA, Canada Post, customs..." />
            <Field label="Description" value={activeExpense.description} onChange={(v) => setActiveExpense({ ...activeExpense, description: v })} placeholder="What was this for?" />
            <button className="primary" type="submit">{editingExpenseId ? "Save expense" : "Add expense"}</button>
          </form>

          <div className="expenseList">
            {totals.filteredExpenses.map((expense) => (
              <article className="expenseRow" key={expense.id}>
                <div><strong>{expense.category}</strong><p>{expense.description || expense.vendor || "No description"}</p></div>
                <span>{expense.expenseDate}</span>
                <strong>{money(expense.amount)}</strong>
                <div className="rowActions">
                  <button className="secondary" type="button" onClick={() => { setActiveExpense(expense); setEditingExpenseId(expense.id); }}>Edit</button>
                  <button className="danger" type="button" onClick={() => deleteExpense(expense.id)}>Delete</button>
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
              <h2>Revenue minus inventory cost and expenses</h2>
              <p className="muted">Showing {selectedDateLabel.toLowerCase()}.</p>
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
            <Stat label="Total inventory cost" value={money(totals.totalInventoryCost)} />
            <Stat label="Total expenses" value={money(totals.expensesTotal)} />
            <Stat label="Profit" value={money(totals.profit)} tone={totals.profit >= 0 ? "positive" : "negative"} />
            <Stat label="Unlisted inventory" value={money(totals.unlistedInventoryCost)} />
            <Stat label="Listed inventory" value={money(totals.listedInventoryCost)} />
            <Stat label="Sold inventory cost" value={money(totals.soldInventoryCost)} />
            <Stat label="Sold cards revenue" value={money(totals.revenue)} />
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
                  <Field label="Asking price" type="number" value={String(editingCard.askingPrice)} onChange={(v) => setEditingCard({ ...editingCard, askingPrice: Number(v || 0) })} />
                  <Field label="Lowest acceptable price" type="number" value={String(editingCard.lowestAcceptablePrice)} onChange={(v) => setEditingCard({ ...editingCard, lowestAcceptablePrice: Number(v || 0) })} />
                  <Field label="Listed date" type="date" value={editingCard.listedDate} onChange={(v) => setEditingCard({ ...editingCard, listedDate: v })} />
                  <div className="calc">
                    <span>Days listed: <strong>{listedDays(editingCard) ?? 0}</strong></span>
                    <span>Potential profit: <strong className={listedPotentialProfit(editingCard) >= 0 ? "positive" : "negative"}>{money(listedPotentialProfit(editingCard))}</strong></span>
                  </div>
                </>
              )}
              {editingCard.status === "Sold" && (
                <>
                  <Field label="Sold for" type="number" value={String(editingCard.soldPrice)} onChange={(v) => setEditingCard({ ...editingCard, soldPrice: Number(v || 0) })} />
                  <Field label="Sale date" type="date" value={editingCard.saleDate} onChange={(v) => setEditingCard({ ...editingCard, saleDate: v })} />
                  <Field label="Sold where?" value={editingCard.salePlatform} onChange={(v) => setEditingCard({ ...editingCard, salePlatform: v })} placeholder="eBay, Whatnot, private sale..." />
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
              <Field label="Sale date" type="date" value={sellingCard.saleDate} onChange={(v) => setSellingCard({ ...sellingCard, saleDate: v })} />
              <Field label="Sold where?" value={sellingCard.salePlatform} onChange={(v) => setSellingCard({ ...sellingCard, salePlatform: v })} placeholder="eBay, Whatnot, private sale..." />
              <div className="calc full">
                <span>Purchase price: <strong>{money(sellingCard.purchasePrice)}</strong></span>
                <span>Card profit before expenses: <strong className={cardProfit(sellingCard) >= 0 ? "positive" : "negative"}>{money(cardProfit(sellingCard))}</strong></span>
              </div>
              <button className="primary full" type="submit">Save sale</button>
            </div>
          </form>
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

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className={active ? "navButton active" : "navButton"} type="button" onClick={onClick}>{children}</button>;
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

function Stat({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
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

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label>{label}<select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
