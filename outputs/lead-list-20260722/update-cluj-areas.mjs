import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectRoot = "/Users/kiskalloakos/Downloads/REALTY MEDIA";
const outputDir = path.join(projectRoot, "outputs/lead-list-20260722");
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
  ["Casa Dinainte", "Cluj", "Sălicea 102i, 407236 Sălicea", "+40 725 595 937", "https://www.casadinainte.ro/", "", "", "", "https://www.casadinainte.ro/locatie", "Pending", "Cluj / Sălicea-Ciurila"],
  ["Casele cu Stuf", "Cluj", "Sălicea, Str. Principală nr. 88A, com. Ciurila", "+40 770 523 997", "https://www.caselecustuf.ro/", "", "", "", "https://www.caselecustuf.ro/", "Pending", "Cluj / Sălicea-Ciurila"],
  ["Claudia Elkan / Pensiunea Amurg", "Cluj", "SAT SĂLICEA 136F, Sălicea", "+40 723 577 670", "", "", "", "", "https://www.booking.com/hotel/ro/pensiunea-amurg.ro.html", "Pending", "Cluj / Sălicea-Ciurila"],
  ["Camping Moara de Vânt / DND Travel", "Cluj", "Drum DC 91, Sălicea, 407236", "+40 744 930 434", "https://www.dndtravel.ro/moara-de-vant/", "", "", "", "https://www.dndtravel.ro/moara-de-vant/", "Pending", "Cluj / Sălicea-Ciurila"],
  ["Domeniul Regilor / TIPOAVIAS SRL", "Cluj", "Ciurila nr. 147A, 407230 Ciurila", "+40 732 124 247", "https://domeniulregilor.ro/", "", "", "", "https://beta.domeniulregilor.ro/rezervari/", "Pending", "Cluj / Ciurila"],
  ["Casa Barolo", "Cluj", "Str. Principală nr. 358, Vlaha, Com. Săvădisla", "+40 734 771 140", "https://casabarolo.ro/", "", "https://www.facebook.com/CasaBaroloVlaha", "", "https://casabarolo.ro/contact/", "Pending", "Cluj / Săvădisla-Vlaha"],
  ["Copfos csárda", "Cluj", "Săvădisla nr. 151", "+40 742 053 700", "", "", "https://www.facebook.com/copfoscsarda", "", "https://www.welcometoromania.ro/E60_Oradea_Cluj/E60_Oradea_Cluj_Savadisla_Copfos_Csarda_r.htm", "Pending", "Cluj / Săvădisla"],
  ["Pensiunea La Conac", "Cluj", "Săliștea Veche nr. 3, 407212 Săliștea Veche", "+40 728 010 757", "", "", "", "", "https://www.booking.com/hotel/ro/pensiunea-la-conac.ro.html", "Pending", "Cluj / Chinteni-Săliștea Veche"],
  ["Casa Thor", "Cluj", "Localitatea Dângău Mic, 407151", "+40 770 441 378", "https://casathor.ro/", "", "", "", "https://casathor.ro/servicii-cabana-mare/", "Pending", "Cluj / Dângău-Căpușu Mare"],
  ["Pensiunea Casa Stan", "Cluj", "Str. Principală nr. 87B, Dângău Mare", "+40 743 571 461", "https://pensiuneacasastancluj.ro/", "", "", "", "https://pensiuneacasastancluj.ro/", "Pending", "Cluj / Dângău-Căpușu Mare"],
  ["Cuib 176", "Cluj", "Căpușu Mic, Str. Principală nr. 176A", "+40 724 143 849", "https://www.cuib176.ro/", "", "", "", "https://clujtourism.ro/pensiuni-agroturistice-cluj/", "Pending", "Cluj / Căpușu Mic"],
  ["Pensiunea Energy", "Cluj", "Strada Principală 260, 407148 Căpușu Mic", "+40 752 152 570", "https://www.pensiuneaenergy.ro/", "", "", "", "https://www.booking.com/hotel/ro/pensiunea-energy.ro.html", "Pending", "Cluj / Căpușu Mic"],
  ["Pensiunea Frații Iancu", "Cluj", "Dumbrava nr. 260, Căpușu Mare", "+40 740 914 176", "https://www.pensiuneafratiiiancu.ro/", "", "", "", "https://www.airbnb.it/rooms/817797212040092657", "Pending", "Cluj / Căpușu Mare-Dumbrava"],
  ["Complex Turistic Căpuș", "Cluj", "DN1, 407145 Căpușu Mare", "+40 741 264 330", "https://complexturisticcapus.eatbu.com/?lang=en", "", "", "", "https://complexturisticcapus.eatbu.com/?lang=en", "Pending", "Cluj / Căpușu Mare"],
  ["Casa Maria - Valea Drăganului", "Cluj", "Lunca Vișagului 123A, 407474", "+40 744 404 434", "https://valea-draganului.ro/", "", "", "", "https://valea-draganului.ro/", "Pending", "Cluj / Valea Drăganului-Poieni"],
  ["Casa Morar - Cabana 1", "Cluj", "Valea Drăganului nr. 226, com. Poieni", "+40 727 791 271", "https://casamorar.ro/", "", "https://www.facebook.com/pages/Pensiunea-Casa-Morar-Valea-Draganului/174431915910804", "", "https://casamorar.ro/cabana-1/", "Pending", "Cluj / Valea Drăganului-Poieni"],
  ["Cabana Drăgana", "Cluj", "Principala 29C, Lunca Vișagului, 407474", "+40 740 901 604", "https://dragana.ro/", "", "", "", "https://dragana.ro/", "Pending", "Cluj / Valea Drăganului-Poieni"],
  ["Cabana Iubu", "Cluj", "Valea Drăganului", "+40 724 336 966", "https://cabanaiubu.ro/", "", "", "", "https://cabanaiubu.ro/despre/", "Pending", "Cluj / Valea Drăganului-Poieni"],
  ["Cabana La Frăguțe", "Cluj", "Valea Drăganului", "+40 745 231 035", "", "", "", "", "https://www.lapensiuni.ro/cabane-transilvania/cluj/valea-draganului", "Pending", "Cluj / Valea Drăganului-Poieni"],
  ["Cabana Vlădeasa", "Cluj", "Rogojel 161A, 407496", "+40 743 062 378", "", "", "", "", "https://webcamromania.ro/webcam-munte/webcam-cabana-vladeasa/", "Pending", "Cluj / Rogojel-Săcuieu"],
  ["Cabana Ruth", "Cluj", "Valea Ierii nr. 275P", "+40 742 965 252", "https://www.cabanaruth.ro/", "", "", "", "https://www.cabanaruth.ro/", "Pending", "Cluj / Valea Ierii"],
  ["Cabana Valea Ierii Home", "Cluj", "Str. Principală nr. 2F, Valea Ierii", "+40 758 937 205", "", "", "", "", "https://www.turistinfo.ro/valea_ierii/cazare-valea_ierii/cabana_valea_ierii_home-c118225.html", "Pending", "Cluj / Valea Ierii"],
  ["Pensiunea Lara&Mara", "Cluj", "DJ107N, Valea Ierii", "+40 756 394 933", "https://www.pensiunealara.com/", "", "", "", "https://www.turismvaleaierii.ro/en/cazari-si-servicii", "Pending", "Cluj / Valea Ierii"],
  ["Pensiunea Sipos Lidia", "Cluj", "Valea Ierii nr. 56", "+40 747 409 381", "https://cazare-valea-ierii.business.site", "", "", "", "https://www.turismvaleaierii.ro/en/cazari-si-servicii", "Pending", "Cluj / Valea Ierii"],
  ["Montagnoli Luxury Cabin", "Cluj", "Valea Ierii, Strada Principală nr. 33A", "+40 787 465 770", "", "", "", "", "https://www.turismvaleaierii.ro/en/cazari-si-servicii", "Pending", "Cluj / Valea Ierii"],
  ["Cabana Karla", "Cluj", "Comuna Valea Ierii, sat Cerc", "+40 748 097 785", "", "", "", "", "https://www.turismvaleaierii.ro/en/cazari-si-servicii", "Pending", "Cluj / Valea Ierii-Cerc"],
  ["Ama Holiday Home", "Cluj", "Comuna Valea Ierii nr. 95", "+40 745 111 951", "", "", "", "", "https://www.turismvaleaierii.ro/en/cazari-si-servicii", "Pending", "Cluj / Valea Ierii"],
  ["Casa Călățele", "Cluj", "Călățele-Pădure nr. 534, comuna Călățele", "+40 734 771 177", "http://universt.ro/", "", "", "", "https://cluj.com/cazare/casa-calatele-cazare-judetul-cluj/", "Pending", "Cluj / Călățele"],
  ["hanul de vis", "Cluj", "Călățele-Pădure nr. 589", "+40 747 082 653", "https://www.hanuldevis.ro/", "", "", "", "https://clujtourism.ro/pensiuni-agroturistice-cluj/", "Pending", "Cluj / Călățele"],
  ["Steaua Apusenilor", "Cluj", "Călățele-Pădure nr. 586A", "+40 757 405 523", "", "", "", "", "https://clujtourism.ro/pensiuni-agroturistice-cluj/", "Pending", "Cluj / Călățele"],
  ["drag de apuseni", "Cluj", "Sat de Vacanță I nr. 143, Călățele", "+40 745 254 118", "https://www.dragdeapuseni.ro/", "", "", "", "https://www.google.ro/travel/hotels/entity/ChkI973ehqWO54kTGg0vZy8xMWp0dF9iNTJuEAE", "Pending", "Cluj / Călățele"],
  ["casa olivia", "Cluj", "Călățele nr. 517", "+40 764 399 609", "", "", "", "", "https://clujtourism.ro/pensiuni-agroturistice-cluj/", "Pending", "Cluj / Călățele"],
  ["carmina", "Cluj", "Călățele / Dealul Negru nr. 75", "+40 755 247 756", "", "", "", "", "https://clujtourism.ro/pensiuni-agroturistice-cluj/", "Pending", "Cluj / Călățele-Dealul Negru"],
  ["La Stan", "Cluj", "Călățele nr. 86", "+40 749 189 141", "", "", "", "", "https://clujtourism.ro/pensiuni-agroturistice-cluj/", "Pending", "Cluj / Călățele"],
  ["Cazare Pensiune Sancraiu - Saroklak Póka Erzsébet", "Cluj", "Strada Principală 170, Sâncraiu, 407515", "+40 742 050 702", "http://saroklak.xtadia.com", "", "", "", "https://sancraiu.cylex.ro/firma/cazare%2Bpensiune%2Bsancraiu%2B-%2Bsaroklak%2Bpoka%2Berzs%C3%A9bet-1322546.html", "Pending", "Cluj / Sâncraiu"],
  ["Pensiunea Tip-Top", "Cluj", "Str. Principală nr. 304, Sâncraiu, 407515", "+40 741 103 653", "https://pensiuneatiptop.cazare7.ro/contact", "", "", "", "https://pensiuneatiptop.cazare7.ro/contact", "Pending", "Cluj / Sâncraiu"],
  ["Casa Bica", "Cluj", "Cacova Ierii nr. 126, Iara", "+40 745 960 731", "", "", "", "", "https://clujtourism.ro/pensiuni-agroturistice-cluj/", "Pending", "Cluj / Iara-Cacova Ierii"],
  ["Cheile Apusenilor", "Cluj", "Săndulești nr. 382", "+40 742 104 813", "https://www.pensiuneacheileapusenilor.ro/", "", "", "", "https://clujtourism.ro/pensiuni-agroturistice-cluj/", "Pending", "Cluj / Săndulești"],
  ["Eden", "Cluj", "Săndulești / Copăceni nr. 327", "+40 785 204 233", "https://www.pensiuneaeden.ro/", "", "", "", "https://clujtourism.ro/pensiuni-agroturistice-cluj/", "Pending", "Cluj / Săndulești-Copăceni"],
  ["Roa", "Cluj", "Săndulești nr. 1B", "+40 770 467 544", "https://www.laroa.ro/", "", "", "", "https://clujtourism.ro/pensiuni-agroturistice-cluj/", "Pending", "Cluj / Săndulești"],
  ["Casa din Vale", "Cluj", "Săcuieu nr. 7", "+40 742 782 376", "https://www.casa-din-vale.ro/", "", "", "", "https://clujtourism.ro/pensiuni-agroturistice-cluj/", "Pending", "Cluj / Săcuieu"],
  ["MORĂRIȚA", "Cluj", "Bonțida, str. Cotuțiului nr. 841", "+40 757 038 886", "https://www.pensiuneamorarita.ro/", "", "", "", "https://clujtourism.ro/pensiuni-agroturistice-cluj/", "Pending", "Cluj / Bonțida"],
];

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/https?:\/\/(www\.)?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isDirectorySourceLink(value) {
  const normalized = normalize(value);
  return [
    "clujtourism ro pensiuni agroturistice cluj",
    "turismvaleaierii ro en cazari si servicii",
    "www turismvaleaierii ro en cazari si servicii",
  ].includes(normalized);
}

function parseRowsFromInspect(ndjson) {
  const values = [];
  for (const line of ndjson.split("\n")) {
    if (!line.trim()) continue;
    const obj = JSON.parse(line);
    if (obj.kind === "table" && Array.isArray(obj.values)) values.push(...obj.values);
  }
  return values;
}

function dedupeRows(existingRows, incomingRows) {
  const rejected = [];
  const rows = [...existingRows];
  const seenLinks = new Set(
    existingRows
      .map((row) => row[8])
      .filter((link) => link && !isDirectorySourceLink(link))
      .map((link) => normalize(link)),
  );
  const seenNameLocation = new Set(existingRows.map((row) => `${normalize(row[0])}|${normalize(row[2])}`).filter((key) => key !== "|"));

  for (const row of incomingRows) {
    const linkKey = normalize(row[8]);
    const nameLocationKey = `${normalize(row[0])}|${normalize(row[2])}`;
    if (linkKey && !isDirectorySourceLink(row[8]) && seenLinks.has(linkKey)) {
      rejected.push({ reason: "duplicate listing link", row: row[0] });
      continue;
    }
    if (nameLocationKey !== "|" && seenNameLocation.has(nameLocationKey)) {
      rejected.push({ reason: "duplicate name/location", row: row[0] });
      continue;
    }
    rows.push(row);
    if (linkKey && !isDirectorySourceLink(row[8])) seenLinks.add(linkKey);
    if (nameLocationKey !== "|") seenNameLocation.add(nameLocationKey);
  }

  return { rows, rejected };
}

await fs.mkdir(outputDir, { recursive: true });

const input = await FileBlob.load(workbookPath);
const imported = await SpreadsheetFile.importXlsx(input);
const tableInspect = await imported.inspect({
  kind: "table",
  sheetId: "Leads",
  range: "A1:K300",
  include: "values",
  tableMaxRows: 300,
  tableMaxCols: 11,
  tableMaxCellChars: 400,
  maxChars: 120000,
});

const importedValues = parseRowsFromInspect(tableInspect.ndjson);
const headerRow = importedValues[0] || [];
if (JSON.stringify(headerRow) !== JSON.stringify(headers)) {
  throw new Error(`Unexpected headers: ${JSON.stringify(headerRow)}`);
}

const existingRows = importedValues.slice(1).filter((row) => row.some((cell) => cell !== null && cell !== ""));
const { rows, rejected } = dedupeRows(existingRows, newLeads);

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
sheet.getRange("C:C").format.columnWidthPx = 210;
sheet.getRange("D:D").format.columnWidthPx = 135;
sheet.getRange("E:I").format.columnWidthPx = 245;
sheet.getRange("J:J").format.columnWidthPx = 105;
sheet.getRange("K:K").format.columnWidthPx = 150;
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
  range: `A1:K${Math.min(rows.length + 1, 125)}`,
  include: "values",
  tableMaxRows: 125,
  tableMaxCols: 11,
  tableMaxCellChars: 240,
  maxChars: 90000,
});
await fs.writeFile(path.join(outputDir, "lead-list-after.inspect.ndjson"), finalInspect.ndjson);
console.log(finalInspect.ndjson);

const errorScan = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|Match Confidence|Notes",
  options: { useRegex: true, maxResults: 300 },
  summary: "final banned-column and formula-error scan",
});
await fs.appendFile(path.join(outputDir, "lead-list-after.inspect.ndjson"), `\n${errorScan.ndjson}`);
console.log(errorScan.ndjson);

const preview = await workbook.render({
  sheetName: "Leads",
  range: "A1:K24",
  scale: 1,
  format: "png",
});
await fs.writeFile(path.join(outputDir, "lead-list-after-preview.png"), new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(workbookPath);

await fs.writeFile(
  path.join(outputDir, "lead-list-update-summary.json"),
  JSON.stringify(
    {
      savedTo: workbookPath,
      existingRows: existingRows.length,
      researchedRows: newLeads.length,
      appendedRows: rows.length - existingRows.length,
      finalRows: rows.length,
      rejected,
      appendedNames: rows.slice(existingRows.length).map((row) => row[0]),
    },
    null,
    2,
  ),
);

console.log(`Saved ${rows.length} rows to ${workbookPath}`);
