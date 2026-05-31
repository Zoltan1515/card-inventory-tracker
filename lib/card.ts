export type CardStatus = "Not Listed" | "Listed" | "Sold";

export type CardRecord = {
  id: string;
  workspaceId?: string;
  name: string;
  category: string;
  year: string;
  setName: string;
  cardNumber: string;
  quantity: number;
  status: CardStatus;
  listedPlatform: string;
  listingUrl: string;
  askingPrice: number;
  lowestAcceptablePrice: number;
  shippingCharge: number;
  gradingCompany: string;
  grade: string;
  listedDate: string;
  listedAt: string;
  listedBy: string;
  frontPhotoUrl: string;
  backPhotoUrl: string;
  purchaseDate: string;
  purchasePrice: number;
  saleDate: string;
  salePlatform: string;
  soldPrice: number;
  soldAt: string;
  soldBy: string;
  notes: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export type ExpenseCategory = "HST" | "Duties" | "Grading Fees" | "Shipping" | "Card Show Table" | "Supplies" | "Gas" | "Airfare" | "Other";

export type ExpenseRecord = {
  id: string;
  workspaceId?: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  description: string;
  vendor: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export type CashAdjustmentType = "Starting Cash" | "Cash Added" | "Cash Removed";

export type CashAdjustmentRecord = {
  id: string;
  workspaceId?: string;
  adjustmentType: CashAdjustmentType;
  amount: number;
  adjustmentDate: string;
  description: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export type GradingSubmissionStatus = "At Grading" | "Returned";

export type GradingSubmission = {
  id: string;
  workspaceId?: string;
  company: string;
  sentDate: string;
  returnedDate: string;
  status: GradingSubmissionStatus;
  reference: string;
  notes: string;
  cardIds: string[];
  cardQuantities: Record<string, number>;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  returnedBy: string;
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
    quantity: 1,
    status: "Not Listed",
    listedPlatform: "",
    listingUrl: "",
    askingPrice: 0,
    lowestAcceptablePrice: 0,
    shippingCharge: 0,
    gradingCompany: "",
    grade: "",
    listedDate: "",
    listedAt: "",
    listedBy: "",
    frontPhotoUrl: "",
    backPhotoUrl: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
    purchasePrice: 0,
    saleDate: "",
    salePlatform: "",
    soldPrice: 0,
    soldAt: "",
    soldBy: "",
    notes: "",
    createdAt: now,
    createdBy: "",
    updatedAt: now,
    updatedBy: "",
  };
};

export const emptyExpense = (): ExpenseRecord => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    category: "" as ExpenseCategory,
    amount: 0,
    expenseDate: new Date().toISOString().slice(0, 10),
    description: "",
    vendor: "",
    createdAt: now,
    createdBy: "",
    updatedAt: now,
    updatedBy: "",
  };
};

export const emptyCashAdjustment = (): CashAdjustmentRecord => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    adjustmentType: "Starting Cash",
    amount: 0,
    adjustmentDate: new Date().toISOString().slice(0, 10),
    description: "",
    createdAt: now,
    createdBy: "",
    updatedAt: now,
    updatedBy: "",
  };
};

export const emptyGradingSubmission = (): GradingSubmission => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    company: "",
    sentDate: new Date().toISOString().slice(0, 10),
    returnedDate: "",
    status: "At Grading",
    reference: "",
    notes: "",
    cardIds: [],
    cardQuantities: {},
    createdAt: now,
    createdBy: "",
    updatedAt: now,
    updatedBy: "",
    returnedBy: "",
  };
};

export const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number.isFinite(value) ? value : 0);

export const percent = (value: number) => `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`;

export const cardQuantity = (card: Pick<CardRecord, "quantity">) => Math.max(1, Math.floor(Number(card.quantity) || 1));

export const cardPurchaseCost = (card: Pick<CardRecord, "purchasePrice" | "quantity">) => card.purchasePrice * cardQuantity(card);

export const cardProfit = (card: CardRecord) => card.soldPrice - cardPurchaseCost(card);

export const listedPotentialProfit = (card: CardRecord) => (card.askingPrice - card.purchasePrice) * cardQuantity(card);

export const cardRoi = (card: CardRecord) => {
  const purchaseCost = cardPurchaseCost(card);
  if (!purchaseCost) return 0;
  return (cardProfit(card) / purchaseCost) * 100;
};
