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

export type CardRefund = {
  amount: number;
  refundDate: string;
  note: string;
};

export type ExpenseCategory = "HST" | "Marketplace Fees" | "Duties" | "Grading Fees" | "Shipping" | "Card Show Table" | "Supplies" | "Gas" | "Airfare" | "Other";

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

export const parseCardRefunds = (notes = ""): CardRefund[] => notes
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.startsWith("Refund: "))
  .map((line) => {
    const [amountText = "0", refundDate = "", note = ""] = line.replace(/^Refund:\s*/, "").split(" | ");
    return {
      amount: Math.max(0, Number(amountText.replace(/[^0-9.-]/g, "")) || 0),
      refundDate,
      note,
    };
  })
  .filter((refund) => refund.amount > 0);

type SaleAmountFields = Pick<CardRecord, "soldPrice"> & Partial<Pick<CardRecord, "notes" | "shippingCharge">>;

export const cardGrossSoldPrice = (card: Pick<CardRecord, "soldPrice"> & Partial<Pick<CardRecord, "shippingCharge">>) => card.soldPrice + (card.shippingCharge || 0);

export const cardRefundTotal = (card: SaleAmountFields) => Math.min(cardGrossSoldPrice(card), parseCardRefunds(card.notes || "").reduce((sum, refund) => sum + refund.amount, 0));

export const cardNetSoldPrice = (card: SaleAmountFields) => Math.max(0, cardGrossSoldPrice(card) - cardRefundTotal(card));

export const appendCardRefundNote = (notes: string, amount: number, refundDate: string, note = "") => [
  notes.trim(),
  `Refund: ${Math.max(0, amount).toFixed(2)} | ${refundDate} | ${note.trim()}`.trim(),
].filter(Boolean).join("\n");

export const cardProfit = (card: CardRecord) => cardNetSoldPrice(card) - cardPurchaseCost(card);

export const listedPotentialProfit = (card: CardRecord) => (card.askingPrice - card.purchasePrice) * cardQuantity(card);

export const cardRoi = (card: CardRecord) => {
  const purchaseCost = cardPurchaseCost(card);
  if (!purchaseCost) return 0;
  return (cardProfit(card) / purchaseCost) * 100;
};
