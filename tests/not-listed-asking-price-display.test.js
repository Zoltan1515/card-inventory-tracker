const fs = require("fs");
const path = require("path");
const assert = require("assert");

const page = fs.readFileSync(path.join(__dirname, "../app/page.tsx"), "utf8");

assert(
  page.includes('const activeInventoryDisplayPrice = (card: CardRecord) => card.status === "Listed" ? card.askingPrice : (Number(card.askingPrice || 0) > 0 ? card.askingPrice : card.purchasePrice);'),
  "Active Not Listed inventory should display an imported PrimeLot asking/listing price when purchase cost is still $0."
);

assert(
  page.includes('const activeInventoryPriceLabel = (card: CardRecord) => {') &&
    page.includes('return `asking${cardQuantity(card) > 1 ? ` each • Qty ${cardQuantity(card)}` : ""} • cost ${money(card.purchasePrice)}`;'),
  "Not Listed cards with an asking/listing price should label the visible price as asking and still show purchase cost separately."
);

assert(
  page.includes('<span>{money(activeInventoryDisplayPrice(card))}</span>') &&
    page.includes('<small>{activeInventoryPriceLabel(card)}</small>'),
  "Inventory rows should render the shared display price/label helper instead of hard-coding purchase cost for every Not Listed card."
);

console.log("Not Listed asking price display checks passed.");
