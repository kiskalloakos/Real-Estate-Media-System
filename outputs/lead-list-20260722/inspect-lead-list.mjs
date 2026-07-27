import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const projectRoot = "/Users/kiskalloakos/Downloads/REALTY MEDIA";
const outputDir = path.join(projectRoot, "outputs/lead-list-20260722");
const workbookPath = path.join(projectRoot, "lead-list.xlsx");

await fs.mkdir(outputDir, { recursive: true });

const input = await FileBlob.load(workbookPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const overview = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 8000,
  tableMaxRows: 8,
  tableMaxCols: 12,
  tableMaxCellChars: 120,
});

const table = await workbook.inspect({
  kind: "table",
  sheetId: "Leads",
  range: "A1:K250",
  include: "values",
  tableMaxRows: 250,
  tableMaxCols: 11,
  tableMaxCellChars: 200,
  maxChars: 70000,
});

const preview = await workbook.render({
  sheetName: "Leads",
  range: "A1:K18",
  scale: 1,
  format: "png",
});

await fs.writeFile(path.join(outputDir, "lead-list-before.inspect.ndjson"), `${overview.ndjson}\n${table.ndjson}`);
await fs.writeFile(path.join(outputDir, "lead-list-before-preview.png"), new Uint8Array(await preview.arrayBuffer()));

const rows = [];
for (const line of table.ndjson.split("\n")) {
  if (!line.trim()) continue;
  const obj = JSON.parse(line);
  if (obj.kind === "table" && Array.isArray(obj.values)) rows.push(...obj.values);
}

const headers = rows[0] || [];
const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell !== null && cell !== ""));
const locationIndex = headers.indexOf("Location");
const nameIndex = headers.indexOf("Research Name of OWNER");
const phoneIndex = headers.indexOf("Phone number");
const linkIndex = headers.indexOf("Listing link");

const summary = {
  headers,
  rowCount: dataRows.length,
  locations: [...new Set(dataRows.map((row) => row[locationIndex]).filter(Boolean))].sort(),
  names: dataRows.map((row) => row[nameIndex]).filter(Boolean),
  phones: dataRows.map((row) => row[phoneIndex]).filter(Boolean),
  listingLinks: dataRows.map((row) => row[linkIndex]).filter(Boolean),
};

await fs.writeFile(path.join(outputDir, "lead-list-before-summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
