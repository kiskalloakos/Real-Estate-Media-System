import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const projectRoot = "/Users/kiskalloakos/Downloads/REALTY MEDIA";
const outputDir = path.join(projectRoot, "outputs/lead-list-20260722");
const workbookPath = path.join(projectRoot, "lead-list.xlsx");

const expectedHeaders = [
  "Research Name of OWNER",
  "County",
  "Location",
  "Phone number",
  "Website",
  "Instagram",
  "Facebook",
  "TikTok",
  "Listing link",
  "Status",
  "Source list",
];

function parseRows(ndjson) {
  const values = [];
  for (const line of ndjson.split("\n")) {
    if (!line.trim()) continue;
    const obj = JSON.parse(line);
    if (obj.kind === "table" && Array.isArray(obj.values)) values.push(...obj.values);
  }
  return values;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/https?:\/\/(www\.)?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function duplicateEntries(values) {
  const seen = new Map();
  const duplicates = [];
  values.forEach((value, index) => {
    const key = normalize(value);
    if (!key) return;
    if (seen.has(key)) duplicates.push({ firstRow: seen.get(key) + 2, row: index + 2, value });
    else seen.set(key, index);
  });
  return duplicates;
}

await fs.mkdir(outputDir, { recursive: true });

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(workbookPath));
const table = await workbook.inspect({
  kind: "table",
  sheetId: "Leads",
  range: "A1:K180",
  include: "values",
  tableMaxRows: 180,
  tableMaxCols: 11,
  tableMaxCellChars: 300,
  maxChars: 120000,
});
const rows = parseRows(table.ndjson);
const headers = rows[0] || [];
const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell !== null && cell !== ""));

const bannedScan = await workbook.inspect({
  kind: "match",
  searchTerm: "Match Confidence|Notes|#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "saved workbook banned-column and formula-error scan",
});

const linkDuplicates = duplicateEntries(dataRows.map((row) => row[8]).filter((link) => {
  const key = normalize(link);
  return key && key !== "clujtourism ro pensiuni agroturistice cluj" && key !== "turismvaleaierii ro en cazari si servicii";
}));
const phoneNameDuplicates = duplicateEntries(dataRows.map((row) => `${row[3] || ""}|${row[0] || ""}`));
const invalidStatuses = dataRows
  .map((row, index) => ({ row: index + 2, status: row[9] }))
  .filter(({ status }) => !["Pending", "Outreached", "Rejected", "Closed"].includes(status));
const missingRequired = dataRows
  .map((row, index) => ({ row: index + 2, name: row[0], county: row[1], phone: row[3], link: row[8], status: row[9] }))
  .filter((row) => !row.name || row.county !== "Cluj" || !row.phone || !row.link || !row.status);

const matchRows = [];
for (const line of bannedScan.ndjson.split("\n")) {
  if (!line.trim()) continue;
  const obj = JSON.parse(line);
  if (obj.kind === "match" && Array.isArray(obj.matches)) matchRows.push(...obj.matches);
}

const summary = {
  workbookPath,
  headers,
  headerOk: JSON.stringify(headers) === JSON.stringify(expectedHeaders),
  rowCount: dataRows.length,
  bannedOrFormulaMatches: matchRows.length,
  invalidStatuses,
  missingRequired,
  duplicateListingLinks: linkDuplicates,
  duplicatePhoneNamePairs: phoneNameDuplicates,
};

await fs.writeFile(path.join(outputDir, "lead-list-final-verification.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
