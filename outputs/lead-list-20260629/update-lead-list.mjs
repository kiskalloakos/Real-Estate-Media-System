import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectRoot = "/Users/kiskalloakos/Downloads/REALTY MEDIA";
const outputDir = path.join(projectRoot, "outputs/lead-list-20260629");
const inspectFile = path.join(outputDir, "merged-airbnb-leads.xlsx.inspect.ndjson");
const workbookPath = path.join(projectRoot, "lead-list.xlsx");

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

const newLeads = [
  [
    "Pensiunea Junior",
    "Cluj",
    "str. Căii Ferate 12, Cluj-Napoca",
    "+40 726 228 697",
    "https://pensiuneajunior.ro/",
    "",
    "https://www.facebook.com/pensiunejunior/",
    "",
    "https://pensiuneajunior.ro/",
    "Pending",
    "Cluj-Napoca",
  ],
  [
    "Pensiunea Zbor",
    "Cluj",
    "Strada Tractoriștilor 2A, Cluj-Napoca",
    "+40 744 663 700",
    "https://www.pensiuneazbor.ro/",
    "",
    "",
    "",
    "https://www.pensiuneazbor.ro/",
    "Pending",
    "Cluj-Napoca",
  ],
  [
    "Vila Siago",
    "Cluj",
    "Strada Republicii, Cluj-Napoca",
    "+40 734 666 667",
    "https://www.vilasiago.ro/",
    "",
    "",
    "",
    "https://www.vilasiago.ro/",
    "Pending",
    "Cluj-Napoca",
  ],
  [
    "Pensiunea Sada",
    "Cluj",
    "Str. Traian Vuia nr. 4, Cluj-Napoca",
    "+40 730 083 226",
    "https://pensiuneasada.ro/",
    "",
    "",
    "",
    "https://pensiuneasada.ro/contact/",
    "Pending",
    "Cluj-Napoca",
  ],
  [
    "Transylvania Villa & SPA",
    "Cluj",
    "Muntele Băișorii 327, jud. Cluj",
    "+40 745 397 288",
    "http://baisoara.transylvaniavilla.com",
    "https://www.instagram.com/transylvaniavillabaisoara",
    "https://www.facebook.com/transylvaniavillabaisoara",
    "",
    "http://baisoara.transylvaniavilla.com",
    "Pending",
    "Muntele Băișorii",
  ],
  [
    "Pensiunea La Mesteceni",
    "Cluj",
    "Sălicea nr. 86, Cluj",
    "+40 371 789 110",
    "https://lamesteceni.ro/",
    "",
    "https://www.facebook.com/PensiuneaLaMesteceni",
    "",
    "https://lamesteceni.ro/",
    "Pending",
    "Sălicea",
  ],
  [
    "Pensiunea Cionca",
    "Cluj",
    "Str. Principală nr. 625, Gilău",
    "+40 744 643 389",
    "https://pensiuneacionca.ro/",
    "",
    "",
    "",
    "https://pensiuneacionca.ro/",
    "Pending",
    "Gilău",
  ],
  [
    "Pensiunea SKILAND",
    "Cluj",
    "Stațiunea Muntele Băișorii, nr. 326 F",
    "+40 728 182 032",
    "",
    "",
    "",
    "",
    "https://carta.ro/cazare-statiunea-muntele-baisorii/pensiunea-skiland/",
    "Pending",
    "Muntele Băișorii",
  ],
  [
    "Pensiunea EDY",
    "Cluj",
    "Turda, str. Roșiori, nr. 14, jud. Cluj",
    "+40 741 946 460",
    "",
    "",
    "",
    "",
    "https://carta.ro/cazare-turda/pensiunea-edy/",
    "Pending",
    "Turda",
  ],
  [
    "Pensiunea PERLA TRANSILVANIEI",
    "Cluj",
    "Turda, Moldovenești, nr. 215 C, jud. Cluj",
    "+40 747 936 523",
    "",
    "",
    "",
    "",
    "https://carta.ro/cazare-turda/pensiunea-perla-transilvaniei/",
    "Pending",
    "Moldovenești",
  ],
  [
    "Casa ALIN",
    "Cluj",
    "Turda, str. Aleea Mureș, nr. 6, jud. Cluj",
    "+40 745 659 212",
    "",
    "",
    "",
    "",
    "https://carta.ro/cazare-turda/casa-alin/",
    "Pending",
    "Turda",
  ],
  [
    "Pensiunea MARIA",
    "Cluj",
    "Florești, str. Prof. Ioan Rus, nr. 70, jud. Cluj",
    "+40 745 775 178",
    "",
    "",
    "",
    "",
    "https://carta.ro/cazare-floresti/pensiunea-maria/",
    "Pending",
    "Florești",
  ],
  [
    "Cabana LA IONEL",
    "Cluj",
    "Măguri-Răcătău, jud. Cluj",
    "+40 740 946 121",
    "",
    "",
    "",
    "",
    "https://carta.ro/cazare-maguri-racatau/cabana-la-ionel/",
    "Pending",
    "Măguri-Răcătău",
  ],
  [
    "Elite City / Elite Grup",
    "Cluj",
    "Bulevardul Muncii / zona Fabricii, Cluj-Napoca",
    "+40 740 711 200",
    "https://www.elite.ro/",
    "https://www.instagram.com/elitecitycluj/",
    "https://www.facebook.com/elitecitycluj",
    "",
    "https://www.elite.ro/elitecity/apartamente",
    "Pending",
    "Dezvoltatori Cluj / Cluj-Napoca",
  ],
  [
    "Maurer Panoramic / Maurer Imobiliare",
    "Cluj",
    "Str. Lalelelor nr. 14, Cluj-Napoca",
    "+40 784 441 111",
    "https://www.maurerpanoramic.ro/",
    "https://www.instagram.com/maurerpanoramic",
    "https://www.facebook.com/pages/category/Apartment---Condo-Building/Maurer-Panoramic-737527903245924/",
    "",
    "https://www.maurerpanoramic.ro/",
    "Pending",
    "Dezvoltatori Cluj / Cluj-Napoca",
  ],
  [
    "Oxygen Residence",
    "Cluj",
    "Piața Abator 1, Cluj-Napoca",
    "+40 734 335 104",
    "https://oxygencluj.ro/",
    "https://www.instagram.com/oxygenresidencecluj",
    "https://www.facebook.com/oxygencluj",
    "",
    "https://oxygencluj.ro/",
    "Pending",
    "Dezvoltatori Cluj / Cluj-Napoca",
  ],
  [
    "Studium Green",
    "Cluj",
    "Str. Teodor Mihali, nr. 39-43, Cluj-Napoca",
    "+40 788 421 669",
    "https://www.studiumgreen.ro/",
    "https://www.instagram.com/studium_green/",
    "https://www.facebook.com/studiumgreenimobiliare/",
    "",
    "https://www.studiumgreen.ro/",
    "Pending",
    "Dezvoltatori Cluj / Cluj-Napoca",
  ],
  [
    "SDC Properties",
    "Cluj",
    "Str. Gheorghe Marinescu 36-38, Cluj-Napoca",
    "+40 791 330 000",
    "https://www.sdcproperties.ro/",
    "https://www.instagram.com/sdc_properties",
    "https://www.facebook.com/sdcproperty",
    "",
    "https://www.sdcproperties.ro/",
    "Pending",
    "Dezvoltatori Cluj / Cluj-Napoca",
  ],
  [
    "Transilvania Smart City",
    "Cluj",
    "Strada Moș Ion Roată 29, Cluj-Napoca",
    "+40 790 330 000",
    "https://www.transilvaniasmartcity.ro/",
    "https://www.instagram.com/transilvaniasmartcity/",
    "https://www.facebook.com/transilvania.smart.city",
    "",
    "https://www.transilvaniasmartcity.ro/",
    "Pending",
    "Dezvoltatori Cluj / Cluj-Napoca",
  ],
  [
    "Grand Park Sud Residence",
    "Cluj",
    "Strada Bună Ziua nr. 37, Cluj-Napoca",
    "+40 753 053 203",
    "https://www.grandparksudresidence.ro/",
    "",
    "https://www.facebook.com/grandparksud",
    "",
    "https://www.grandparksudresidence.ro/",
    "Pending",
    "Dezvoltatori Cluj / Cluj-Napoca",
  ],
  [
    "CITIUS",
    "Cluj",
    "Strada Corneliu Coposu, nr. 167, Cluj-Napoca",
    "+40 371 780 065",
    "https://www.citius.ro/",
    "https://www.instagram.com/citius_cluj/",
    "https://www.facebook.com/profile.php?id=61557456396360",
    "",
    "https://www.citius.ro/",
    "Pending",
    "Dezvoltatori Cluj / Cluj-Napoca",
  ],
  [
    "Solaris Development",
    "Cluj",
    "Strada Burebista nr. 9, parter, Cluj-Napoca",
    "+40 749 126 643",
    "https://solarisdevelopment.ro/",
    "",
    "https://www.facebook.com/SolarisRealEstateInvestments/",
    "",
    "https://solarisdevelopment.ro/",
    "Pending",
    "Dezvoltatori Cluj / Cluj-Napoca",
  ],
  [
    "SCALA Sopor",
    "Cluj",
    "Strada Soporului nr. 21, Cluj-Napoca",
    "+40 371 781 764",
    "https://www.scalasopor.ro/",
    "https://www.instagram.com/scalasopor/",
    "https://www.facebook.com/profile.php?id=61565507230976",
    "",
    "https://www.scalasopor.ro/contact",
    "Pending",
    "Dezvoltatori Cluj / Cluj-Napoca",
  ],
];

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizePhone(value) {
  return String(value ?? "").replace(/\D/g, "").replace(/^0040/, "40");
}

function loadExistingRows(ndjson) {
  const tableLine = ndjson
    .split("\n")
    .find((line) => line.includes('"kind":"table"') && line.includes('"values"'));
  if (!tableLine) throw new Error("Could not find table values in inspect file.");

  const table = JSON.parse(tableLine);
  const [oldHeaders, ...oldRows] = table.values;
  const index = new Map(oldHeaders.map((header, columnIndex) => [header, columnIndex]));

  return oldRows.map((row) => [
    row[index.get("Research Name of OWNER")] || "",
    "Cluj",
    row[index.get("Location")] || "",
    row[index.get("Phone number")] || "",
    row[index.get("Website")] || "",
    row[index.get("Instagram")] || "",
    row[index.get("Facebook")] || "",
    row[index.get("TikTok")] || "",
    row[index.get("Listing link")] || "",
    row[index.get("Status")] || "Pending",
    row[index.get("Source list")] || "",
  ]);
}

function dedupeRows(rows) {
  const byListing = new Set();
  const byPhoneAndName = new Set();
  const deduped = [];
  const rejected = [];

  for (const row of rows) {
    const name = row[0];
    const phone = normalizePhone(row[3]);
    const listing = String(row[8] || "").trim().toLowerCase();
    const nameKey = normalizeText(name).slice(0, 32);
    const phoneNameKey = phone && nameKey ? `${phone}|${nameKey}` : "";

    if (listing && byListing.has(listing)) {
      rejected.push({ name, listing, reason: "duplicate listing link" });
      continue;
    }
    if (phoneNameKey && byPhoneAndName.has(phoneNameKey)) {
      rejected.push({ name, listing, reason: "duplicate phone/name combination" });
      continue;
    }

    if (listing) byListing.add(listing);
    if (phoneNameKey) byPhoneAndName.add(phoneNameKey);
    deduped.push(row);
  }

  return { rows: deduped, rejected };
}

const inspect = await fs.readFile(inspectFile, "utf8");
const existingRows = loadExistingRows(inspect);
const candidateRows = [...existingRows, ...newLeads];
const { rows, rejected } = dedupeRows(candidateRows);

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Leads");
sheet.showGridLines = false;

sheet.getRange("A1:K1").values = [headers];
sheet.getRangeByIndexes(1, 0, rows.length, headers.length).values = rows;

sheet.freezePanes.freezeRows(1);
const usedRange = sheet.getRangeByIndexes(0, 0, rows.length + 1, headers.length);
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

sheet.getRangeByIndexes(1, 0, rows.length, headers.length).format.wrapText = true;
sheet.getRangeByIndexes(1, 0, rows.length, headers.length).format.rowHeightPx = 42;
sheet.getRange("A:A").format.columnWidthPx = 230;
sheet.getRange("B:B").format.columnWidthPx = 85;
sheet.getRange("C:C").format.columnWidthPx = 190;
sheet.getRange("D:D").format.columnWidthPx = 135;
sheet.getRange("E:I").format.columnWidthPx = 245;
sheet.getRange("J:J").format.columnWidthPx = 105;
sheet.getRange("K:K").format.columnWidthPx = 130;
sheet.getRange("A:K").format.verticalAlignment = "Top";
sheet.getRange("D:D").format.numberFormat = "@";
sheet.getRange("E:I").format.numberFormat = "@";

const statusRange = sheet.getRange(`J2:J${rows.length + 1}`);
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

const tableRange = `A1:K${rows.length + 1}`;
const table = sheet.tables.add(tableRange, true, "LeadList");
table.style = "TableStyleMedium2";
table.showFilterButton = true;

const finalInspect = await workbook.inspect({
  kind: "table",
  sheetId: "Leads",
  range: `A1:K${Math.min(rows.length + 1, 12)}`,
  include: "values",
  tableMaxRows: 12,
  tableMaxCols: 11,
  maxChars: 12000,
});
await fs.writeFile(path.join(outputDir, "lead-list-final.inspect.ndjson"), finalInspect.ndjson);
console.log(finalInspect.ndjson);

const errorScan = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|Match Confidence|Notes",
  options: { useRegex: true, maxResults: 300 },
  summary: "final banned-column and formula-error scan",
});
await fs.appendFile(path.join(outputDir, "lead-list-final.inspect.ndjson"), `\n${errorScan.ndjson}`);
console.log(errorScan.ndjson);

const preview = await workbook.render({
  sheetName: "Leads",
  range: "A1:K18",
  scale: 1,
  format: "png",
});
await fs.writeFile(path.join(outputDir, "lead-list-final-preview.png"), new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(workbookPath);

await fs.writeFile(
  path.join(outputDir, "lead-list-update-summary.json"),
  JSON.stringify(
    {
      savedTo: workbookPath,
      existingRows: existingRows.length,
      newRows: newLeads.length,
      finalRows: rows.length,
      dedupeRejected: rejected,
      skippedResearchSource: path.join(outputDir, "csp-cluj-research.json"),
    },
    null,
    2,
  ),
);

console.log(`Saved ${rows.length} leads to ${workbookPath}`);
