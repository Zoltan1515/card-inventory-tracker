export type CardStatus = "Not Listed" | "Listed" | "Sold";

export type CardRecord = {
  id: string;
  name: string;
  category: string;
  year: string;
  setName: string;
  cardNumber: string;
  status: CardStatus;
  listedPlatform: string;
  listingUrl: string;
  frontPhotoUrl: string;
  purchaseDate: string;
  purchasePrice: number;
  saleDate: string;
  salePlatform: string;
  soldPrice: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseCategory = "HST" | "Duties" | "Grading Fees" | "Shipping" | "Other";

export type ExpenseRecord = {
  id: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  description: string;
  vendor: string;
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
    status: "Not Listed",
    listedPlatform: "",
    listingUrl: "",
    frontPhotoUrl: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
    purchasePrice: 0,
    saleDate: "",
    salePlatform: "",
    soldPrice: 0,
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
};

export const emptyExpense = (): ExpenseRecord => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    category: "Shipping",
    amount: 0,
    expenseDate: new Date().toISOString().slice(0, 10),
    description: "",
    vendor: "",
    createdAt: now,
    updatedAt: now,
  };
};

export const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number.isFinite(value) ? value : 0);

export const percent = (value: number) => `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`;

export const cardProfit = (card: CardRecord) => card.soldPrice - card.purchasePrice;

export const cardRoi = (card: CardRecord) => {
  if (!card.purchasePrice) return 0;
  return (cardProfit(card) / card.purchasePrice) * 100;
};
