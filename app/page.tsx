"use client";

import type { Session } from "@supabase/supabase-js";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CardRecord, CardStatus, ExpenseCategory, ExpenseRecord, cardProfit, cardRoi, emptyCard, emptyExpense, money, percent } from "@/lib/card";
import { cardsToCsv, expensesToCsv } from "@/lib/csv";
import { cardToInsert, cardToUpdate, expenseToInsert, expenseToUpdate, rowToCard, rowToExpense } from "@/lib/dbCard";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Tab = "add" | "inventory" | "expenses" | "profit";

const CARD_STORAGE_KEY = "card-inventory-tracker.cards.v2";
const EXPENSE_STORAGE_KEY = "card-inventory-tracker.expenses.v1";
const statuses: CardStatus[] = ["Not Listed", "Listed", "Sold"];
const expenseCategories: ExpenseCategory[] = ["HST", "Duties", "Grading Fees", "Shipping", "Other"];

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
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("add");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CardStatus | "All">("All");
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const usingSupabase = Boolean(isSupabaseConfigured && supabase);

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

  const totals = useMemo(() => {
    const soldCards = cards.filter((card) => card.status === "Sold");
    const revenue = soldCards.reduce((sum, card) => sum + card.soldPrice, 0);
    const soldInventoryCost = soldCards.reduce((sum, card) => sum + card.purchasePrice, 0);
    const unsoldInventoryCost = cards.filter((card) => card.status !== "Sold").reduce((sum, card) => sum + card.purchasePrice, 0);
    const expensesTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const profit = revenue - soldInventoryCost - expensesTotal;
    return {
      revenue,
      soldInventoryCost,
      unsoldInventoryCost,
      expensesTotal,
      profit,
      soldCount: soldCards.length,
      listedCount: cards.filter((card) => card.status === "Listed").length,
      notListedCount: cards.filter((card) => card.status === "Not Listed").length,
    };
  }, [cards, expenses]);

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
  const exportExpenses = () => downloadCsv(expensesToCsv(expenses), `card-expenses-${new Date().toISOString().slice(0, 10)}.csv`);

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
  };

  if (usingSupabase && !session) {
    return (
      <main className="shell">
        <header className="hero">
          <div>
            <p className="eyebrow">Card Inventory Tracker</p>
            <h1>Sign in to your card inventory.</h1>
            <p className="subhead">Supabase is connected. Create your login below and your cards will save to the cloud database.</p>
          </div>
          <span className="pill good">Supabase connected</span>
        </header>
        <AuthPanel />
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="hero compactHero">
        <div>
          <p className="eyebrow">Card Inventory Tracker</p>
          <h1>Inventory, expenses, and profit.</h1>
          <p className="subhead">Simple workflow: add inventory, mark cards sold with sale price, record expenses separately, and track profit.</p>
        </div>
        <div className="heroActions">
          <span className={usingSupabase ? "pill good" : "pill"}>{usingSupabase ? "Supabase cloud storage" : "Local browser storage"}</span>
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
            <label className="full textareaLabel">Notes<textarea value={activeCard.notes} onChange={(e) => setActiveCard({ ...activeCard, notes: e.target.value })} /></label>
            <button className="primary full" type="submit">Add to inventory</button>
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
                <div className="rowActions">
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
          <form className="formGrid expenseForm" onSubmit={saveExpense}>
            <Select label="Expense type" value={activeExpense.category} options={expenseCategories} onChange={(v) => setActiveExpense({ ...activeExpense, category: v as ExpenseCategory })} />
            <Field label="Amount" type="number" value={String(activeExpense.amount)} onChange={(v) => setActiveExpense({ ...activeExpense, amount: Number(v || 0) })} required />
            <Field label="Date" type="date" value={activeExpense.expenseDate} onChange={(v) => setActiveExpense({ ...activeExpense, expenseDate: v })} />
            <Field label="Vendor / source" value={activeExpense.vendor} onChange={(v) => setActiveExpense({ ...activeExpense, vendor: v })} placeholder="PSA, Canada Post, customs..." />
            <Field label="Description" value={activeExpense.description} onChange={(v) => setActiveExpense({ ...activeExpense, description: v })} placeholder="What was this for?" />
            <button className="primary" type="submit">{editingExpenseId ? "Save expense" : "Add expense"}</button>
          </form>

          <div className="expenseList">
            {expenses.map((expense) => (
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
            {!expenses.length && <p className="empty">No expenses yet.</p>}
          </div>
        </section>
      )}

      {tab === "profit" && (
        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Profit</p>
              <h2>Revenue minus inventory cost and expenses</h2>
            </div>
          </div>
          <section className="statsGrid profitGrid" aria-label="Profit totals">
            <Stat label="Revenue from sold cards" value={money(totals.revenue)} />
            <Stat label="Sold inventory cost" value={money(totals.soldInventoryCost)} />
            <Stat label="Expenses" value={money(totals.expensesTotal)} />
            <Stat label="Profit" value={money(totals.profit)} tone={totals.profit >= 0 ? "positive" : "negative"} />
            <Stat label="Unsold inventory cost" value={money(totals.unsoldInventoryCost)} />
            <Stat label="Listed cards" value={String(totals.listedCount)} />
            <Stat label="Not listed" value={String(totals.notListedCount)} />
            <Stat label="Sold cards" value={String(totals.soldCount)} />
          </section>

          <h3>Sold cards</h3>
          <div className="cardsList">
            {cards.filter((card) => card.status === "Sold").map((card) => (
              <article className="cardRow compactRow" key={card.id}>
                <div><strong>{card.name}</strong><p className="muted">Sold for {money(card.soldPrice)} · Cost {money(card.purchasePrice)}</p></div>
                <div className="rowMoney"><span className={cardProfit(card) >= 0 ? "positive" : "negative"}>{money(cardProfit(card))}</span><small>{percent(cardRoi(card))} before expenses</small></div>
              </article>
            ))}
            {!cards.some((card) => card.status === "Sold") && <p className="empty">No sold cards yet. Use Inventory → Enter sale.</p>}
          </div>
        </section>
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
    setMessage(mode === "signup" ? "Account created. If Supabase asks for email confirmation, check your inbox before signing in." : "Signed in.");
  };

  return (
    <section className="panel authPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Supabase login</p>
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

function Stat({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  return <div className="stat"><span>{label}</span><strong className={tone}>{value}</strong></div>;
}

function Field({ label, value, onChange, type = "text", placeholder, required }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return <label>{label}<input required={required} type={type} step={type === "number" ? "0.01" : undefined} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label>{label}<select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
