export type CardStatus = "Purchased" | "Ready to List" | "Listed" | "Sold" | "Shipped";

export type CardRecord = {
  id: string;
  name: string;
  category: string;
  year: string;
  setName: string;
  cardNumber: string;
  variant: string;
  condition: string;
  rawOrGraded: "Raw" | "Graded";
  gradingCompany: string;
  grade: string;
  certNumber: string;
  status: CardStatus;
  storageLocation: string;
  purchaseDate: string;
  purchaseSource: string;
  purchasePrice: number;
  purchaseTax: number;
  inboundShipping: number;
  listedPlatform: string;
  listingUrl: string;
  askingPrice: number;
  saleDate: string;
  salePlatform: string;
  soldPrice: number;
  platformFees: number;
  paymentFees: number;
  promotedFees: number;
  outboundShipping: number;
  packagingCost: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export const emptyCard = (): CardRecord => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "",
    category: "Sports",
    year: "",
    setName: "",
    cardNumber: "",
    variant: "",
    condition: "Near Mint",
    rawOrGraded: "Raw",
    gradingCompany: "",
    grade: "",
    certNumber: "",
    status: "Purchased",
    storageLocation: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
    purchaseSource: "",
    purchasePrice: 0,
    purchaseTax: 0,
    inboundShipping: 0,
    listedPlatform: "",
    listingUrl: "",
    askingPrice: 0,
    saleDate: "",
    salePlatform: "",
    soldPrice: 0,
    platformFees: 0,
    paymentFees: 0,
    promotedFees: 0,
    outboundShipping: 0,
    packagingCost: 0,
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
};

export const costBasis = (card: CardRecord) =>
  card.purchasePrice + card.purchaseTax + card.inboundShipping;

export const totalFees = (card: CardRecord) =>
  card.platformFees + card.paymentFees + card.promotedFees + card.outboundShipping + card.packagingCost;

export const netProceeds = (card: CardRecord) => card.soldPrice - totalFees(card);

export const profit = (card: CardRecord) => netProceeds(card) - costBasis(card);

export const roi = (card: CardRecord) => {
  const basis = costBasis(card);
  if (!basis) return 0;
  return (profit(card) / basis) * 100;
};

export const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number.isFinite(value) ? value : 0);

export const percent = (value: number) => `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`;
