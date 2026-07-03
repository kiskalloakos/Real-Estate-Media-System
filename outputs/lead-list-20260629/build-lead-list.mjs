import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "/Users/kiskalloakos/Downloads/REALTY MEDIA/outputs/lead-list-20260629";

const sources = [
  {
    label: "Feleacu",
    file: "/Users/kiskalloakos/Downloads/feleacu-airbnb-phone-enriched-contacts.csv",
  },
  {
    label: "Maguri-Racatau",
    file: "/Users/kiskalloakos/Downloads/maguri-racatau-airbnb-phone-enriched-contacts.csv",
  },
  {
    label: "Marisel",
    file: "/Users/kiskalloakos/Downloads/marisel-airbnb-phone-enriched-contacts.csv",
  },
  {
    label: "Belis",
    file: "/Users/kiskalloakos/Downloads/belis-airbnb-phone-enriched-contacts.csv",
  },
];

const headers = [
  "Research Name of OWNER",
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

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((item) => item.some((cell) => cell.trim() !== ""));
}

function normalizeHeader(value) {
  return value.trim().toLowerCase();
}

function mapRow(headersRow, row) {
  const mapped = {};
  headersRow.forEach((header, index) => {
    mapped[normalizeHeader(header)] = row[index]?.trim() ?? "";
  });
  return mapped;
}

function getFirstUrl(value) {
  const match = value.match(/https?:\/\/[^\s|;,"]+/i);
  if (!match) return "";
  return match[0].replace(/[.)\]]+$/, "");
}

function formatRomanianPhone(value) {
  const cleaned = value.replace(/[^\d+]/g, "");
  let digits = cleaned.replace(/\D/g, "");

  if (digits.startsWith("0040")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("40") && digits.length === 11) {
    const local = digits.slice(2);
    return `+40 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }

  if (digits.startsWith("0") && digits.length === 10) {
    const local = digits.slice(1);
    return `+40 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }

  return value.trim();
}

const rows = [];
for (const source of sources) {
  const text = await fs.readFile(source.file, "utf8");
  const parsed = parseCsv(text);
  const [headerRow, ...dataRows] = parsed;

  for (const dataRow of dataRows) {
    const row = mapRow(headerRow, dataRow);
    rows.push([
      row["original name of owner/profile"] || "",
      row.location || "",
      formatRomanianPhone(row["phone number"] || ""),
      row.website || "",
      row.instagram || "",
      row.facebook || "",
      row.tiktok || "",
      getFirstUrl(row["listing of airbnb/booking/olx"] || ""),
      "Pending",
      source.label,
    ]);
  }
}

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Leads");
sheet.showGridLines = false;

sheet.getRange("A1:J1").values = [headers];
sheet.getRangeByIndexes(1, 0, rows.length, headers.length).values = rows;

sheet.freezePanes.freezeRows(1);
const usedRange = sheet.getRangeByIndexes(0, 0, rows.length + 1, headers.length);
usedRange.format.font = { name: "Aptos", size: 10, color: "#111827" };
usedRange.format.borders = {
  insideHorizontal: { style: "thin", color: "#E5E7EB" },
};

const headerRange = sheet.getRange("A1:J1");
headerRange.format = {
  fill: "#111827",
  font: { bold: true, color: "#FFFFFF" },
};
headerRange.format.rowHeightPx = 32;

sheet.getRangeByIndexes(1, 0, rows.length, headers.length).format.wrapText = true;
sheet.getRangeByIndexes(1, 0, rows.length, headers.length).format.rowHeightPx = 42;
sheet.getRange("A:A").format.columnWidthPx = 230;
sheet.getRange("B:B").format.columnWidthPx = 190;
sheet.getRange("C:C").format.columnWidthPx = 135;
sheet.getRange("D:H").format.columnWidthPx = 245;
sheet.getRange("I:I").format.columnWidthPx = 105;
sheet.getRange("J:J").format.columnWidthPx = 115;
sheet.getRange("A:J").format.verticalAlignment = "Top";
sheet.getRange("C:C").format.numberFormat = "@";
sheet.getRange("D:H").format.numberFormat = "@";

const statusRange = sheet.getRange(`I2:I${rows.length + 1}`);
statusRange.dataValidation = {
  rule: { type: "list", values: ["Pending", "Outreached", "Rejected", "Closed"] },
};
statusRange.format = {
  fill: "#FEF3C7",
  font: { bold: true, color: "#92400E" },
};
statusRange.conditionalFormats.add("containsText", {
  text: "Outreached",
  format: { fill: "#DBEAFE", font: { bold: true, color: "#1D4ED8" } },
});
statusRange.conditionalFormats.add("containsText", {
  text: "Rejected",
  format: { fill: "#FEE2E2", font: { bold: true, color: "#B91C1C" } },
});
statusRange.conditionalFormats.add("containsText", {
  text: "Closed",
  format: { fill: "#DCFCE7", font: { bold: true, color: "#166534" } },
});

const tableRange = `A1:J${rows.length + 1}`;
const table = sheet.tables.add(tableRange, true, "LeadList");
table.style = "TableStyleMedium2";
table.showFilterButton = true;

const inspect = await workbook.inspect({
  kind: "table",
  sheetId: "Leads",
  range: "A1:J8",
  include: "values",
  tableMaxRows: 8,
  tableMaxCols: 10,
  maxChars: 6000,
});
console.log(inspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const preview = await workbook.render({
  sheetName: "Leads",
  range: "A1:J18",
  scale: 1,
  format: "png",
});
await fs.writeFile(path.join(outputDir, "lead-list-preview.png"), new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(path.join(outputDir, "merged-airbnb-leads.xlsx"));
console.log(`Saved ${rows.length} leads to ${path.join(outputDir, "merged-airbnb-leads.xlsx")}`);
