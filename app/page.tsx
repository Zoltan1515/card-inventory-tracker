"use client";

import type { Session } from "@supabase/supabase-js";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CardRecord, CardStatus, ExpenseCategory, ExpenseRecord, cardProfit, cardRoi, emptyCard, emptyExpense, money, percent } from "@/lib/card";
import { cardsToCsv, expensesToCsv } from "@/lib/csv";
import { cardToInsert, cardToUpdate, expenseToInsert, expenseToUpdate, rowToCard, rowToExpense } from "@/lib/dbCard";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Tab = "add" | "inventory" | "expenses" | "profit";
type DateFilterMode = "all" | "month" | "year" | "custom";


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
const filterLabel = (mode: DateFilterMode, start: string, end: string) => {
  if (mode === "all") return "All time";
  if (mode === "month") return "This month";
  if (mode === "year") return "This year";
  if (start && end) return `${start} to ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Through ${end}`;
  return "Custom range";
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
  const [session, setSession] = useState<Session | null>(null);
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
    setLoading(true);
    setError("");

    const [cardsResult, expensesResult] = await Promise.all([
      supabase.from("cards").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("expenses").select("*").eq("user_id", userId).order("expense_date", { ascending: false }),
    ]);

    if (cardsResult.error) setError(cardsResult.error.message);
    else setCards((cardsResult.data ?? []).map(rowToCard));

    if (expensesResult.error) setError(`Expenses table needs setup: ${expensesResult.error.message}`);
    else setExpenses((expensesResult.data ?? []).map(rowToExpense));

    setLoading(false);
  };

  useEffect(() => {
    if (!usingSupabase || !supabase) {
      const rawCards = window.localStorage.getItem(CARD_STORAGE_KEY);
      const rawExpenses = window.localStorage.getItem(EXPENSE_STORAGE_KEY);
      setCards(rawCards ? JSON.parse(rawCards) : sampleCards());
      setExpenses(rawExpenses ? JSON.parse(rawExpenses) : []);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user.id) loadSupabaseData(data.session.user.id);
      else setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user.id) loadSupabaseData(nextSession.user.id);
      else {
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

  const filteredCards = useMemo(() => {
    const q = query.toLowerCase();
    return cards.filter((card) => {
      const matchesStatus = statusFilter === "All" || card.status === statusFilter;
      const matchesQuery = [card.name, card.category, card.year, card.setName, card.cardNumber, card.listedPlatform, card.salePlatform]
        .join(" ")
        .toLowerCase()
        .includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [cards, query, statusFilter]);

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

    if (usingSupabase && supabase && session?.user.id) {
      const { data, error: insertError } = await supabase
        .from("cards")
        .insert(cardToInsert(activeCard, session.user.id))
        .select("*")
        .single();
      if (insertError) {
        setError(insertError.message);
        return;
      }
      setCards((current) => [rowToCard(data), ...current]);
    } else {
      setCards((current) => [{ ...activeCard, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...current]);
    }

    setNotice("Inventory added.");
    setActiveCard(emptyCard());
    setTab("inventory");
  };

  const updateCard = async (card: CardRecord) => {
    setError("");
    if (usingSupabase && supabase && session?.user.id) {
      const { data, error: updateError } = await supabase
        .from("cards")
        .update(cardToUpdate(card))
        .eq("id", card.id)
        .eq("user_id", session.user.id)
        .select("*")
        .single();
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
      const { error: deleteError } = await supabase.from("cards").delete().eq("id", id).eq("user_id", session.user.id);
      if (deleteError) {
        setError(deleteError.message);
        return;
      }
    }
    setCards((current) => current.filter((card) => card.id !== id));
  };

  const changeCardStatus = async (card: CardRecord, status: CardStatus) => {
    const nextCard = {
      ...card,
      status,
      saleDate: status === "Sold" ? card.saleDate || new Date().toISOString().slice(0, 10) : "",
      soldPrice: status === "Sold" ? card.soldPrice : 0,
      salePlatform: status === "Sold" ? card.salePlatform : "",
      updatedAt: new Date().toISOString(),
    };

    if (status === "Sold" && !card.soldPrice) {
      setSellingCard(nextCard);
      return;
    }

    const ok = await updateCard(nextCard);
    if (ok) setNotice(`${card.name} changed to ${status}.`);
  };

  const updateListingInfo = async (card: CardRecord, updates: Partial<Pick<CardRecord, "listedPlatform" | "listingUrl">>) => {
    const nextCard = { ...card, ...updates, updatedAt: new Date().toISOString() };
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
        const { data, error: updateError } = await supabase
          .from("expenses")
          .update(expenseToUpdate(activeExpense))
          .eq("id", activeExpense.id)
          .eq("user_id", session.user.id)
          .select("*")
          .single();
        if (updateError) {
          setError(updateError.message);
          return;
        }
        setExpenses((current) => current.map((expense) => (expense.id === activeExpense.id ? rowToExpense(data) : expense)));
      } else {
        const { data, error: insertError } = await supabase
          .from("expenses")
          .insert(expenseToInsert(activeExpense, session.user.id))
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
      const { error: deleteError } = await supabase.from("expenses").delete().eq("id", id).eq("user_id", session.user.id);
      if (deleteError) {
        setError(deleteError.message);
        return;
      }
    }
    setExpenses((current) => current.filter((expense) => expense.id !== id));
  };

  const exportCards = () => downloadCsv(cardsToCsv(cards), `card-inventory-${new Date().toISOString().slice(0, 10)}.csv`);
  const exportExpenses = () => downloadCsv(expensesToCsv(totals.filteredExpenses), `card-expenses-${new Date().toISOString().slice(0, 10)}.csv`);

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
  };

  if (usingSupabase && !session) {
    return (
      <main className="shell">
        <header className="hero">
          <div>
            <Logo />
            <h1>Sign in to your card inventory.</h1>
            <p className="subhead">Create your login below and your cards will save securely to your account.</p>
          </div>
          <span className="pill good">Account storage ready</span>
        </header>
        <AuthPanel />
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="hero compactHero">
        <div>
          <Logo />
          <h1>Inventory, expenses, and profit.</h1>
          <p className="subhead">Simple workflow: add inventory, mark cards sold with sale price, record expenses separately, and track profit.</p>
        </div>
        <div className="heroActions">
          <span className={usingSupabase ? "pill good" : "pill"}>{usingSupabase ? "Account storage" : "Local browser storage"}</span>
          {session && <button className="secondary" onClick={signOut} type="button">Sign out</button>}
        </div>
      </header>

      <nav className="navBar" aria-label="Main navigation">
        <NavButton active={tab === "add"} onClick={() => setTab("add")}>Add Inventory</NavButton>
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
            <Select label="Status" value={activeCard.status} options={statuses} onChange={(v) => setActiveCard({ ...activeCard, status: v as CardStatus })} />
            <Field label="Listed where?" value={activeCard.listedPlatform} onChange={(v) => setActiveCard({ ...activeCard, listedPlatform: v, status: v ? "Listed" : activeCard.status })} placeholder="eBay, Whatnot, TCGplayer..." />
            <Field label="Listing URL" value={activeCard.listingUrl} onChange={(v) => setActiveCard({ ...activeCard, listingUrl: v })} />
            <label className="full photoUploadLabel">
              Front photo
              <input
                accept="image/*"
                capture="environment"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFrontPhoto(file);
                }}
              />
              <span className="muted">Upload or take one front photo of the card.</span>
            </label>
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

      {tab === "inventory" && (
        <section className="panel">
          <div className="panelHeader inventoryHeader">
            <div>
              <p className="eyebrow">Inventory</p>
              <h2>{filteredCards.length} cards</h2>
            </div>
            <div className="filters">
              <input aria-label="Search inventory" placeholder="Search cards..." value={query} onChange={(e) => setQuery(e.target.value)} />
              <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as CardStatus | "All")}>
                <option value="All">All statuses</option>
                {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <button className="secondary" onClick={exportCards} type="button">Export inventory</button>
            </div>
          </div>

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
                  <p className="muted">{card.status === "Sold" ? `Sold on ${card.salePlatform || "unknown platform"} for ${money(card.soldPrice)}` : card.status === "Listed" ? `Listed on ${card.listedPlatform || "unknown platform"}` : "Not listed yet"}</p>
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
            <button className="secondary" onClick={exportExpenses} type="button">Export expenses</button>
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

          <form className="formGrid expenseForm" onSubmit={saveExpense}>
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
              <Select label="Status" value={editingCard.status} options={statuses} onChange={(v) => setEditingCard({
                ...editingCard,
                status: v as CardStatus,
                saleDate: v === "Sold" ? editingCard.saleDate || new Date().toISOString().slice(0, 10) : "",
                soldPrice: v === "Sold" ? editingCard.soldPrice : 0,
                salePlatform: v === "Sold" ? editingCard.salePlatform : "",
              })} />
              <Field label="Listed where?" value={editingCard.listedPlatform} onChange={(v) => setEditingCard({ ...editingCard, listedPlatform: v, status: v ? "Listed" : editingCard.status })} placeholder="eBay, Whatnot, TCGplayer..." />
              <Field label="Listing URL" value={editingCard.listingUrl} onChange={(v) => setEditingCard({ ...editingCard, listingUrl: v })} />
              {editingCard.status === "Sold" && (
                <>
                  <Field label="Sold for" type="number" value={String(editingCard.soldPrice)} onChange={(v) => setEditingCard({ ...editingCard, soldPrice: Number(v || 0) })} />
                  <Field label="Sale date" type="date" value={editingCard.saleDate} onChange={(v) => setEditingCard({ ...editingCard, saleDate: v })} />
                  <Field label="Sold where?" value={editingCard.salePlatform} onChange={(v) => setEditingCard({ ...editingCard, salePlatform: v })} placeholder="eBay, Whatnot, private sale..." />
                </>
              )}
              <label className="full photoUploadLabel">
                Front photo
                <input
                  accept="image/*"
                  capture="environment"
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadFrontPhoto(file, "editing");
                  }}
                />
                <span className="muted">Add or replace the front photo for this card.</span>
              </label>
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
      <span className="logoMark" aria-hidden="true">
        <span>W</span>
        <span>C</span>
      </span>
      <span className="logoText">
        <strong>Wicked</strong>
        <small>Card Tracker</small>
      </span>
    </div>
  );
}

function AuthPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signup");
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
        <strong>{selectedLabel}</strong>
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
