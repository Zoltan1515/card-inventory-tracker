"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CardRecord, CardStatus, costBasis, emptyCard, money, netProceeds, percent, profit, roi, totalFees } from "@/lib/card";
import { cardsToCsv } from "@/lib/csv";
import { isSupabaseConfigured } from "@/lib/supabase";

const STORAGE_KEY = "card-inventory-tracker.cards.v1";
const statuses: CardStatus[] = ["Purchased", "Ready to List", "Listed", "Sold", "Shipped"];
const numberFields = new Set<keyof CardRecord>([
  "purchasePrice",
  "purchaseTax",
  "inboundShipping",
  "askingPrice",
  "soldPrice",
  "platformFees",
  "paymentFees",
  "promotedFees",
  "outboundShipping",
  "packagingCost",
]);

const sampleCards = (): CardRecord[] => [
  {
    ...emptyCard(),
    id: "sample-1",
    name: "Example Rookie Card",
    category: "Basketball",
    year: "2023",
    setName: "Prizm",
    cardNumber: "101",
    variant: "Silver",
    condition: "Near Mint",
    status: "Listed",
    storageLocation: "Box A",
    purchaseSource: "Local show",
    purchasePrice: 40,
    purchaseTax: 0,
    inboundShipping: 0,
    listedPlatform: "eBay",
    askingPrice: 79.99,
    notes: "Sample card — delete or edit this.",
  },
  {
    ...emptyCard(),
    id: "sample-2",
    name: "Example Sold Holo",
    category: "Pokemon",
    year: "2021",
    setName: "Evolving Skies",
    cardNumber: "215",
    variant: "Holo",
    condition: "Near Mint",
    status: "Sold",
    storageLocation: "Sold bin",
    purchaseSource: "eBay lot",
    purchasePrice: 18,
    inboundShipping: 2,
    saleDate: new Date().toISOString().slice(0, 10),
    salePlatform: "eBay",
    soldPrice: 52,
    platformFees: 7.1,
    outboundShipping: 4.25,
    packagingCost: 0.5,
    notes: "Sample sold card with fees.",
  },
];

export default function Home() {
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [activeCard, setActiveCard] = useState<CardRecord>(emptyCard());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CardStatus | "All">("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    setCards(raw ? JSON.parse(raw) : sampleCards());
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  }, [cards]);

  const filteredCards = useMemo(() => {
    const q = query.toLowerCase();
    return cards.filter((card) => {
      const matchesStatus = statusFilter === "All" || card.status === statusFilter;
      const matchesQuery = [card.name, card.category, card.year, card.setName, card.cardNumber, card.variant, card.storageLocation, card.purchaseSource, card.salePlatform]
        .join(" ")
        .toLowerCase()
        .includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [cards, query, statusFilter]);

  const totals = useMemo(() => {
    const sold = cards.filter((card) => card.status === "Sold" || card.status === "Shipped");
    return {
      inventoryCount: cards.length,
      listedCount: cards.filter((card) => card.status === "Listed").length,
      needActionCount: cards.filter((card) => card.status === "Purchased" || card.status === "Ready to List").length,
      soldCount: sold.length,
      costBasis: cards.reduce((sum, card) => sum + costBasis(card), 0),
      listedValue: cards.reduce((sum, card) => sum + card.askingPrice, 0),
      grossSales: sold.reduce((sum, card) => sum + card.soldPrice, 0),
      fees: sold.reduce((sum, card) => sum + totalFees(card), 0),
      profit: sold.reduce((sum, card) => sum + profit(card), 0),
    };
  }, [cards]);

  const updateActive = (field: keyof CardRecord, value: string) => {
    setActiveCard((card) => ({
      ...card,
      [field]: numberFields.has(field) ? Number(value || 0) : value,
      updatedAt: new Date().toISOString(),
    }));
  };

  const resetForm = () => {
    setActiveCard(emptyCard());
    setSelectedId(null);
  };

  const saveCard = (event: FormEvent) => {
    event.preventDefault();
    if (!activeCard.name.trim()) return;
    setCards((current) => {
      const exists = current.some((card) => card.id === activeCard.id);
      return exists ? current.map((card) => (card.id === activeCard.id ? activeCard : card)) : [activeCard, ...current];
    });
    resetForm();
  };

  const editCard = (card: CardRecord) => {
    setActiveCard(card);
    setSelectedId(card.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteCard = (id: string) => {
    setCards((current) => current.filter((card) => card.id !== id));
    if (selectedId === id) resetForm();
  };

  const markSold = (card: CardRecord) => {
    setActiveCard({ ...card, status: "Sold", saleDate: card.saleDate || new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString() });
    setSelectedId(card.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const exportCsv = () => {
    const blob = new Blob([cardsToCsv(cards)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `card-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Card Inventory Tracker MVP</p>
          <h1>Track every card from purchase to sale.</h1>
          <p className="subhead">Add cards quickly, mark them listed or sold, enter fees, and see real profit/loss at a glance.</p>
        </div>
        <div className="heroActions">
          <button className="secondary" onClick={exportCsv} type="button">Export CSV</button>
          <span className={isSupabaseConfigured ? "pill good" : "pill"}>{isSupabaseConfigured ? "Supabase ready" : "Local browser storage"}</span>
        </div>
      </header>

      <section className="statsGrid" aria-label="Dashboard totals">
        <Stat label="Cards" value={String(totals.inventoryCount)} />
        <Stat label="Listed" value={String(totals.listedCount)} />
        <Stat label="Need action" value={String(totals.needActionCount)} />
        <Stat label="Sold" value={String(totals.soldCount)} />
        <Stat label="Cost basis" value={money(totals.costBasis)} />
        <Stat label="Listed value" value={money(totals.listedValue)} />
        <Stat label="Gross sales" value={money(totals.grossSales)} />
        <Stat label="Fees/shipping" value={money(totals.fees)} />
        <Stat label="Net profit" value={money(totals.profit)} tone={totals.profit >= 0 ? "positive" : "negative"} />
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">{selectedId ? "Edit card" : "Add card"}</p>
            <h2>{selectedId ? activeCard.name : "New inventory item"}</h2>
          </div>
          {selectedId && <button className="secondary" onClick={resetForm} type="button">Cancel edit</button>}
        </div>

        <form className="formGrid" onSubmit={saveCard}>
          <Field label="Card/player name" value={activeCard.name} onChange={(v) => updateActive("name", v)} required />
          <Field label="Category" value={activeCard.category} onChange={(v) => updateActive("category", v)} placeholder="Basketball, Pokemon, MTG..." />
          <Field label="Year" value={activeCard.year} onChange={(v) => updateActive("year", v)} />
          <Field label="Set" value={activeCard.setName} onChange={(v) => updateActive("setName", v)} />
          <Field label="Card #" value={activeCard.cardNumber} onChange={(v) => updateActive("cardNumber", v)} />
          <Field label="Variant/parallel" value={activeCard.variant} onChange={(v) => updateActive("variant", v)} />
          <Select label="Status" value={activeCard.status} options={statuses} onChange={(v) => updateActive("status", v)} />
          <Field label="Storage location" value={activeCard.storageLocation} onChange={(v) => updateActive("storageLocation", v)} placeholder="Box A, listed bin..." />
          <Field label="Condition" value={activeCard.condition} onChange={(v) => updateActive("condition", v)} />
          <Select label="Raw/graded" value={activeCard.rawOrGraded} options={["Raw", "Graded"]} onChange={(v) => updateActive("rawOrGraded", v)} />
          <Field label="Grading company" value={activeCard.gradingCompany} onChange={(v) => updateActive("gradingCompany", v)} placeholder="PSA, BGS, SGC..." />
          <Field label="Grade" value={activeCard.grade} onChange={(v) => updateActive("grade", v)} placeholder="10" />
          <Field label="Cert #" value={activeCard.certNumber} onChange={(v) => updateActive("certNumber", v)} />

          <h3 className="formSection">Purchase</h3>
          <Field label="Purchase date" type="date" value={activeCard.purchaseDate} onChange={(v) => updateActive("purchaseDate", v)} />
          <Field label="Purchase source" value={activeCard.purchaseSource} onChange={(v) => updateActive("purchaseSource", v)} placeholder="eBay, show, Facebook..." />
          <Field label="Purchase price" type="number" value={String(activeCard.purchasePrice)} onChange={(v) => updateActive("purchasePrice", v)} />
          <Field label="Tax" type="number" value={String(activeCard.purchaseTax)} onChange={(v) => updateActive("purchaseTax", v)} />
          <Field label="Inbound shipping" type="number" value={String(activeCard.inboundShipping)} onChange={(v) => updateActive("inboundShipping", v)} />

          <h3 className="formSection">Listing / Sale</h3>
          <Field label="Listed platform" value={activeCard.listedPlatform} onChange={(v) => updateActive("listedPlatform", v)} placeholder="eBay, TCGplayer..." />
          <Field label="Asking price" type="number" value={String(activeCard.askingPrice)} onChange={(v) => updateActive("askingPrice", v)} />
          <Field label="Listing URL" value={activeCard.listingUrl} onChange={(v) => updateActive("listingUrl", v)} />
          <Field label="Sale date" type="date" value={activeCard.saleDate} onChange={(v) => updateActive("saleDate", v)} />
          <Field label="Sale platform" value={activeCard.salePlatform} onChange={(v) => updateActive("salePlatform", v)} />
          <Field label="Sold price" type="number" value={String(activeCard.soldPrice)} onChange={(v) => updateActive("soldPrice", v)} />
          <Field label="Platform fees" type="number" value={String(activeCard.platformFees)} onChange={(v) => updateActive("platformFees", v)} />
          <Field label="Payment fees" type="number" value={String(activeCard.paymentFees)} onChange={(v) => updateActive("paymentFees", v)} />
          <Field label="Promoted/other fees" type="number" value={String(activeCard.promotedFees)} onChange={(v) => updateActive("promotedFees", v)} />
          <Field label="Outbound shipping" type="number" value={String(activeCard.outboundShipping)} onChange={(v) => updateActive("outboundShipping", v)} />
          <Field label="Packaging cost" type="number" value={String(activeCard.packagingCost)} onChange={(v) => updateActive("packagingCost", v)} />
          <label className="full textareaLabel">Notes<textarea value={activeCard.notes} onChange={(e) => updateActive("notes", e.target.value)} /></label>

          <div className="calc full">
            <span>Cost basis: <strong>{money(costBasis(activeCard))}</strong></span>
            <span>Net proceeds: <strong>{money(netProceeds(activeCard))}</strong></span>
            <span>Profit: <strong className={profit(activeCard) >= 0 ? "positive" : "negative"}>{money(profit(activeCard))}</strong></span>
            <span>ROI: <strong>{percent(roi(activeCard))}</strong></span>
          </div>

          <button className="primary full" type="submit">{selectedId ? "Save changes" : "Add card"}</button>
        </form>
      </section>

      <section className="panel">
        <div className="panelHeader inventoryHeader">
          <div>
            <p className="eyebrow">Inventory</p>
            <h2>{filteredCards.length} cards shown</h2>
          </div>
          <div className="filters">
            <input aria-label="Search inventory" placeholder="Search cards..." value={query} onChange={(e) => setQuery(e.target.value)} />
            <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as CardStatus | "All")}>
              <option value="All">All statuses</option>
              {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
        </div>

        <div className="cardsList">
          {filteredCards.map((card) => (
            <article className="cardRow" key={card.id}>
              <div>
                <div className="rowTitle"><strong>{card.name}</strong><span>{card.status}</span></div>
                <p>{[card.year, card.setName, card.cardNumber, card.variant].filter(Boolean).join(" • ") || "No card details yet"}</p>
                <p className="muted">Location: {card.storageLocation || "Not set"} · Cost: {money(costBasis(card))} · Asking: {money(card.askingPrice)}</p>
              </div>
              <div className="rowMoney">
                {card.status === "Sold" || card.status === "Shipped" ? (
                  <>
                    <span className={profit(card) >= 0 ? "positive" : "negative"}>{money(profit(card))}</span>
                    <small>{percent(roi(card))} ROI</small>
                  </>
                ) : (
                  <>
                    <span>{money(costBasis(card))}</span>
                    <small>open cost basis</small>
                  </>
                )}
              </div>
              <div className="rowActions">
                <button className="secondary" onClick={() => editCard(card)} type="button">Edit</button>
                <button className="secondary" onClick={() => markSold(card)} type="button">Mark sold</button>
                <button className="danger" onClick={() => deleteCard(card.id)} type="button">Delete</button>
              </div>
            </article>
          ))}
          {!filteredCards.length && <p className="empty">No cards match your filters.</p>}
        </div>
      </section>
    </main>
  );
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
