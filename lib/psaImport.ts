import { emptyCard, type CardRecord } from "./card";

export type PsaImportPreview = {
  id: string;
  sourceRow: number;
  card: CardRecord;
  selected: boolean;
  warnings: string[];
};

type CsvRow = Record<string, string>;

type ParseOptions = {
  idFactory?: (sourceRow: number) => string;
  now?: string;
  today?: string;
};

const normalizeCsvHeader = (value: string) => value.trim().replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

const csvValue = (row: CsvRow, aliases: string[]) => {
  for (const alias of aliases) {
    const value = row[normalizeCsvHeader(alias)];
    if (value?.trim()) return value.trim();
  }
  return "";
};

const parseCsvText = (text: string) => {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeCsvHeader);
  return rows.slice(1).map((cells, index) => ({
    sourceRow: index + 2,
    row: headers.reduce<CsvRow>((record, header, cellIndex) => {
      if (header) record[header] = cells[cellIndex]?.trim() ?? "";
      return record;
    }, {}),
  }));
};

const certNumber = (row: CsvRow) => csvValue(row, ["Cert #", "Cert Number", "Certification Number", "PSA Cert #"]);
const description = (row: CsvRow) => csvValue(row, ["Description", "Item Description", "Card Description", "Title"]);
const gradeLabel = (row: CsvRow) => csvValue(row, ["Grade", "PSA Grade"]);
const imageZip = (row: CsvRow) => csvValue(row, ["Images", "Image", "Image URL", "Photo URL"]);
const afterService = (row: CsvRow) => csvValue(row, ["After Service", "Status"]);
const itemType = (row: CsvRow) => csvValue(row, ["Type", "Item Type"]);

export const psaCsvLooksLikeOrderExport = (text: string) => {
  const [headerLine = ""] = text.split(/\r?\n/, 1);
  const normalized = headerLine.split(",").map(normalizeCsvHeader);
  return normalized.includes("cert") && normalized.includes("description") && normalized.includes("grade") && normalized.includes("images");
};

const inferCategory = (value: string) => {
  if (/\bpokemon\b/i.test(value)) return "Pokemon";
  if (/\bone piece\b/i.test(value)) return "One Piece";
  if (/\bmagic\b|\bmtg\b/i.test(value)) return "MTG";
  return "Sports";
};

const cleanPsaGrade = (value: string) => {
  const trailingNumber = value.trim().match(/(\d+(?:\.\d+)?)\s*$/);
  return trailingNumber ? trailingNumber[1] : value.trim();
};

const parsePsaDescription = (value: string) => {
  const clean = value.trim().replace(/\s+/g, " ");
  const yearMatch = clean.match(/^(\d{4})\s+(.+)$/);
  const year = yearMatch ? yearMatch[1] : "";
  const rest = yearMatch ? yearMatch[2] : clean;
  const cardMatch = rest.match(/^(.*?)\s+(\d{1,4})\s+([A-Z][A-Z0-9.'&/ -]+)$/);
  if (!cardMatch) return { year, setName: "", cardNumber: "", name: rest || clean };
  return {
    year,
    setName: cardMatch[1].trim(),
    cardNumber: cardMatch[2].trim(),
    name: cardMatch[3].trim(),
  };
};

const certUrl = (cert: string) => cert ? `https://www.psacard.com/cert/${cert}` : "";

export const parsePsaOrderCsv = (text: string, options: ParseOptions = {}): PsaImportPreview[] => {
  const now = options.now || new Date().toISOString();
  const today = options.today || now.slice(0, 10);
  const idFactory = options.idFactory || ((sourceRow: number) => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `psa-row-${sourceRow}-${Date.now()}`));

  return parseCsvText(text).map(({ row, sourceRow }) => {
    const cert = certNumber(row);
    const rawDescription = description(row);
    const parsedDescription = parsePsaDescription(rawDescription);
    const rawGrade = gradeLabel(row);
    const images = imageZip(row);
    const serviceStatus = afterService(row);
    const type = itemType(row);
    const id = idFactory(sourceRow);
    const notes = [
      cert ? `PSA Cert #: ${cert}` : "",
      cert ? `PSA Cert URL: ${certUrl(cert)}` : "",
      serviceStatus ? `PSA order status: ${serviceStatus}` : "",
      images ? `PSA image ZIP: ${images}` : "",
      rawDescription ? `PSA description: ${rawDescription}` : "",
      "Source: PSA CSV import",
    ].filter(Boolean).join("\n");

    const card: CardRecord = {
      ...emptyCard(),
      id,
      name: parsedDescription.name || rawDescription || `PSA cert ${cert || sourceRow}`,
      category: inferCategory(rawDescription || type),
      year: parsedDescription.year,
      setName: parsedDescription.setName,
      cardNumber: parsedDescription.cardNumber,
      status: "Not Listed",
      listedPlatform: "",
      listingUrl: certUrl(cert),
      gradingCompany: "PSA",
      grade: cleanPsaGrade(rawGrade),
      purchaseDate: today,
      purchasePrice: 0,
      frontPhotoUrl: "",
      backPhotoUrl: "",
      notes,
      createdAt: now,
      updatedAt: now,
    };

    const warnings = [
      !cert ? "Missing PSA cert number" : "",
      !rawDescription ? "Missing PSA description" : "",
      !rawGrade ? "Missing PSA grade" : "",
      images ? "PSA provided an image ZIP; import the photos later from the ZIP or add photos manually." : "",
    ].filter(Boolean);

    return { id, sourceRow, card, selected: Boolean(cert && rawDescription), warnings };
  }).filter((preview) => preview.card.name.trim());
};
