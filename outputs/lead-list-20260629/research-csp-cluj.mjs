import fs from "node:fs/promises";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

const pages = [
  "/tmp/cabanesipensiuni-cluj.html",
  "/tmp/cabanesipensiuni-cluj-p2.html",
  "/tmp/cabanesipensiuni-cluj-p3.html",
  "/tmp/cabanesipensiuni-cluj-p4.html",
  "/tmp/cabanesipensiuni-cluj-p5.html",
];

const outputDir = "/Users/kiskalloakos/Downloads/REALTY MEDIA/outputs/lead-list-20260629";
const skipUrls = new Set([
  "https://cabanesipensiuni.ro/5-cabane-de-top-situate-langa-partie/",
  "https://cabanesipensiuni.ro/cum-sa-faci-o-cerere-de-cazare-ca-sa-primesti-ce-te-intereseaza/",
  "https://cabanesipensiuni.ro/cabana-ta-e-o-afacere-sau-e-doar-venit-ocazional/",
  "https://cabanesipensiuni.ro/",
]);
const genericPhones = new Set(["0769053322", "40769053322"]);

function decodeHtml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&hellip;/g, "...")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0040")) digits = digits.slice(2);
  if (digits.startsWith("40") && digits.length === 11) {
    const local = digits.slice(2);
    return `+40 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    const local = digits.slice(1);
    return `+40 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return "";
}

function phoneKey(value) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0040")) digits = digits.slice(2);
  return digits;
}

function extractSearchCandidates() {
  const candidates = [];
  const seen = new Set();
  for (const file of pages) {
    const html = fs.readFile(file, "utf8");
    candidates.push(html);
  }
  return Promise.all(candidates).then((htmlPages) => {
    const rows = [];
    for (const html of htmlPages) {
      const re = /<h2 class="post-opt-title"><a href="([^"]+)">([\s\S]*?)<\/a><\/h2><p>([\s\S]*?)<\/p>/g;
      let match;
      while ((match = re.exec(html))) {
        const url = match[1];
        if (seen.has(url) || skipUrls.has(url)) continue;
        seen.add(url);
        rows.push({
          name: decodeHtml(match[2]),
          url,
          description: decodeHtml(match[3]),
        });
      }
    }
    return rows;
  });
}

async function curl(url) {
  const { stdout } = await execFile("curl", ["-L", "-s", url], {
    maxBuffer: 2 * 1024 * 1024,
  });
  return stdout;
}

function firstMatch(html, pattern) {
  const match = html.match(pattern);
  return match ? decodeHtml(match[1]) : "";
}

function extractLinks(html, hostPattern) {
  const links = new Set();
  const re = /href="(https?:\/\/[^"]+)"/g;
  let match;
  while ((match = re.exec(html))) {
    const url = decodeHtml(match[1]);
    if (hostPattern.test(url)) links.add(url);
  }
  return [...links];
}

function inferLocation(description) {
  const patterns = [
    /(?:în|in|situat[ăa]? în|se afl[ăa] în|localitatea|satul|comuna)\s+([^,.;]+),?\s+(?:jud\.?|jude[țt]ul)\s+Cluj/i,
    /(?:din|în|in)\s+([^,.;]+),?\s+(?:jud\.?|jude[țt]ul)\s+Cluj/i,
    /(?:în|in|din)\s+([A-ZĂÂÎȘȚ][^,.;]{2,40})/u,
  ];
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) return match[1].replace(/\s+/g, " ").trim();
  }
  return "";
}

const candidates = await extractSearchCandidates();
const records = [];

for (const candidate of candidates) {
  const html = await curl(candidate.url);
  const rawPhones = [
    ...html.matchAll(/href=["']tel:\s*([^"']+)["']/gi),
    ...html.matchAll(/phone=([0-9+\s]+)/gi),
  ].map((match) => match[1]);
  const phones = [...new Set(rawPhones.map(phoneKey))]
    .filter((phone) => phone && !genericPhones.has(phone))
    .map(normalizePhone)
    .filter(Boolean);

  const website = firstMatch(html, /class="aucontact-website"[\s\S]*?<a href="([^"]+)"/i);
  const facebook = extractLinks(html, /facebook\.com/i).find((url) => !url.includes("cabanesipensiuni")) || "";
  const instagram = extractLinks(html, /instagram\.com/i).find((url) => !url.includes("cabanesipensiuni")) || "";
  const booking = extractLinks(html, /booking\.com/i)[0] || "";
  const airbnb = extractLinks(html, /airbnb\./i)[0] || "";
  const olx = extractLinks(html, /olx\./i)[0] || "";
  const listing = airbnb || booking || olx || candidate.url;

  records.push({
    ...candidate,
    location: inferLocation(candidate.description),
    phone: phones[0] || "",
    website,
    instagram,
    facebook,
    listing,
    source: candidate.url,
    skippedReason: phones.length ? "" : "no non-generic phone found",
  });
}

await fs.writeFile(path.join(outputDir, "csp-cluj-research.json"), JSON.stringify(records, null, 2));

const usable = records.filter((record) => record.phone);
console.log(`Downloaded ${records.length} candidate pages.`);
console.log(`Usable public-phone candidates: ${usable.length}`);
for (const record of usable) {
  console.log(`${record.name} | ${record.location} | ${record.phone} | ${record.listing}`);
}

const skipped = records.filter((record) => record.skippedReason);
console.log(`Skipped without non-generic phone: ${skipped.length}`);
