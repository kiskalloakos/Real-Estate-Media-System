import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectRoot = "/Users/kiskalloakos/Downloads/REALTY MEDIA";
const outputDir = path.join(projectRoot, "outputs/special-lead-list-20260717");
const workbookPath = path.join(projectRoot, "special lead list.xlsx");

const headers = [
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

const rows = [
  [
    "Elysium Cabin Transilvania",
    "Cluj",
    "Munții Apuseni, approx. 33 km from Cluj-Napoca",
    "+40 755 260 183",
    "https://elysiumcabintransilvania.ro/",
    "https://www.instagram.com/elysium.cabin/",
    "",
    "",
    "https://elysiumcabintransilvania.ro/about/",
    "Pending",
    "Special seeds / Instagram + official website",
  ],
  [
    "Cabana Alma",
    "Cluj",
    "Plopi, Cluj",
    "+40 757 107 679",
    "https://cabana-alma.ro/ro-RO",
    "",
    "",
    "",
    "https://cabana-alma.ro/ro-RO",
    "Pending",
    "Special seeds / official website",
  ],
  [
    "Bela M. / La Cuib - Sovata",
    "Mureș",
    "Strada Stâna de Vale, Sovata 545500",
    "+40 749 325 456",
    "https://lacuib-sovata.ro/",
    "",
    "",
    "",
    "https://lacuib-sovata.ro/",
    "Pending",
    "Special seeds / official website",
  ],
  [
    "The Altitude Cabin Resort",
    "Cluj",
    "Măguri, Str. Principala nr.22B, Cluj, România, 407366",
    "+40 757 807 048",
    "https://thealtitude.ro/",
    "",
    "https://www.facebook.com/thealtitudecabinresort",
    "",
    "https://thealtitude.ro/",
    "Pending",
    "Special seeds / official website",
  ],
  [
    "Cabana Ce La Vie",
    "Cluj",
    "Rîșca / Dealu Mare, Cluj",
    "",
    "",
    "",
    "https://www.facebook.com/groups/cabanecluj/posts/2524463371349642/",
    "",
    "https://www.facebook.com/groups/cabanecluj/posts/2524463371349642/",
    "Pending",
    "Special seeds / Facebook group post; no public phone exposed",
  ],
  [
    "Chalet Valisoaracluj",
    "",
    "",
    "",
    "",
    "",
    "https://www.facebook.com/people/Chalet-Valisoaracluj/pfbid0ZyXUzWsJkgeBJWjExeY93SyowANrFDmaWv8KUCG3Pb6oEhio7awEKae3BGSzwhF1l/",
    "",
    "https://www.facebook.com/people/Chalet-Valisoaracluj/pfbid0ZyXUzWsJkgeBJWjExeY93SyowANrFDmaWv8KUCG3Pb6oEhio7awEKae3BGSzwhF1l/",
    "Pending",
    "Special seeds / Facebook share link; no public phone exposed",
  ],
  [
    "R&B Travel Stays & Experiences",
    "",
    "",
    "",
    "",
    "",
    "https://www.facebook.com/people/RB-Travel-Stays-Experiences/61587196140700/",
    "",
    "https://www.facebook.com/people/RB-Travel-Stays-Experiences/61587196140700/",
    "Pending",
    "Special seeds / Facebook share link; no public phone exposed",
  ],
];

const seen = new Set();
const dedupedRows = rows.filter((row) => {
  const key = `${row[0].toLowerCase()}|${row[3]}|${row[8]}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Leads");
sheet.showGridLines = false;

sheet.getRange("A1:K1").values = [headers];
sheet.getRangeByIndexes(1, 0, dedupedRows.length, headers.length).values = dedupedRows;

sheet.freezePanes.freezeRows(1);
const usedRange = sheet.getRangeByIndexes(0, 0, dedupedRows.length + 1, headers.length);
usedRange.format.font = { name: "Aptos", size: 10, color: "#111827" };
usedRange.format.borders = {
  insideHorizontal: { style: "thin", color: "#E5E7EB" },
};

const headerRange = sheet.getRange("A1:K1");
headerRange.format = {
  fill: "#111827",
  font: { bold: true, color: "#FFFFFF" },
};
headerRange.format.rowHeightPx = 32;

sheet.getRangeByIndexes(1, 0, dedupedRows.length, headers.length).format.wrapText = true;
sheet.getRangeByIndexes(1, 0, dedupedRows.length, headers.length).format.rowHeightPx = 42;
sheet.getRange("A:A").format.columnWidthPx = 230;
sheet.getRange("B:B").format.columnWidthPx = 85;
sheet.getRange("C:C").format.columnWidthPx = 210;
sheet.getRange("D:D").format.columnWidthPx = 135;
sheet.getRange("E:I").format.columnWidthPx = 245;
sheet.getRange("J:J").format.columnWidthPx = 105;
sheet.getRange("K:K").format.columnWidthPx = 180;
sheet.getRange("A:K").format.verticalAlignment = "Top";
sheet.getRange("D:D").format.numberFormat = "@";
sheet.getRange("E:I").format.numberFormat = "@";

const statusRange = sheet.getRange(`J2:J${dedupedRows.length + 1}`);
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

const tableRange = `A1:K${dedupedRows.length + 1}`;
const table = sheet.tables.add(tableRange, true, "SpecialLeadList");
table.style = "TableStyleMedium2";
table.showFilterButton = true;

await fs.mkdir(outputDir, { recursive: true });

const finalInspect = await workbook.inspect({
  kind: "table",
  sheetId: "Leads",
  range: `A1:K${dedupedRows.length + 1}`,
  include: "values",
  tableMaxRows: dedupedRows.length + 1,
  tableMaxCols: 11,
  maxChars: 16000,
});
await fs.writeFile(path.join(outputDir, "special-lead-list.inspect.ndjson"), finalInspect.ndjson);
console.log(finalInspect.ndjson);

const errorScan = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|Match Confidence|Notes",
  options: { useRegex: true, maxResults: 300 },
  summary: "final banned-column and formula-error scan",
});
await fs.appendFile(path.join(outputDir, "special-lead-list.inspect.ndjson"), `\n${errorScan.ndjson}`);
console.log(errorScan.ndjson);

const preview = await workbook.render({
  sheetName: "Leads",
  range: `A1:K${dedupedRows.length + 1}`,
  scale: 1,
  format: "png",
});
await fs.writeFile(
  path.join(outputDir, "special-lead-list-preview.png"),
  new Uint8Array(await preview.arrayBuffer()),
);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(workbookPath);

await fs.writeFile(
  path.join(outputDir, "special-lead-list-summary.json"),
  JSON.stringify(
    {
      savedTo: workbookPath,
      rows: dedupedRows.length,
      headers,
      blankPhoneRows: dedupedRows.filter((row) => !row[3]).map((row) => row[0]),
      sourceHtmlDirectory: outputDir,
    },
    null,
    2,
  ),
);

console.log(`Saved ${dedupedRows.length} leads to ${workbookPath}`);
