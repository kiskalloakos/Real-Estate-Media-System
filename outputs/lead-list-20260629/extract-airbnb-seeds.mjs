import fs from "node:fs/promises";
import path from "node:path";

const outputDir = "/Users/kiskalloakos/Downloads/REALTY MEDIA/outputs/lead-list-20260629";
const tmpDir = "/tmp";

function decodeText(value) {
  return String(value ?? "")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/\\\//g, "/")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/\s+/g, " ")
    .trim();
}

function extractCandidateName(chunk, id) {
  const decoded = decodeText(chunk);
  const patterns = [
    new RegExp(`"listingId":"${id}"[\\s\\S]{0,1200}?"name":"([^"]{2,160})"`),
    new RegExp(`"id":"${id}"[\\s\\S]{0,1200}?"name":"([^"]{2,160})"`),
    /"title":"([^"]{2,160})"/,
    /"name":"([^"]{2,160})"/,
    /aria-label="([^"]{2,160})"/,
  ];
  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (match?.[1]) return decodeText(match[1]);
  }
  return "";
}

function extractStructuredCards(html, offset) {
  const cards = [];
  const pattern =
    /<meta itemProp="name" content="([^"]*)"\/><meta itemProp="position" content="(\d+)"\/><meta itemProp="url" content="\/rooms\/(\d+)([^"]*)"/g;
  let match;
  while ((match = pattern.exec(html))) {
    cards.push({
      roomId: match[3],
      url: `https://www.airbnb.com/rooms/${match[3]}`,
      name: decodeText(match[1]),
      position: Number(match[2]),
      firstOffset: offset,
    });
  }
  return cards;
}

const files = (await fs.readdir(tmpDir))
  .filter(
    (file) =>
      (file.startsWith("airbnb-cluj-offset-") || file.startsWith("airbnb-clujnapoca-city")) &&
      file.endsWith(".html"),
  )
  .sort((a, b) => {
    const an = Number(a.match(/(?:offset-|city-)(\d+)/)?.[1] ?? 0);
    const bn = Number(b.match(/(?:offset-|city-)(\d+)/)?.[1] ?? 0);
    if (an === bn) return a.localeCompare(b);
    return an - bn;
  });

const byId = new Map();
const pageSummaries = [];

for (const file of files) {
  const offset = Number(file.match(/(?:offset-|city-)(\d+)/)?.[1] ?? 0);
  const html = await fs.readFile(path.join(tmpDir, file), "utf8");
  const structuredCards = extractStructuredCards(html, offset);
  for (const card of structuredCards) {
    const existing = byId.get(card.roomId);
    byId.set(card.roomId, {
      ...card,
      name: existing?.name && !existing.name.startsWith("Previous photo:") ? existing.name : card.name,
      firstOffset: existing?.firstOffset ?? card.firstOffset,
    });
  }

  const ids = [...html.matchAll(/\/rooms\/(\d+)/g)].map((match) => match[1]);
  const uniqueIds = [...new Set(ids)];
  pageSummaries.push({ file, offset, bytes: html.length, roomIds: uniqueIds.length, structuredCards: structuredCards.length });

  for (const id of uniqueIds) {
    if (byId.has(id) && byId.get(id).name) continue;
    const marker = `/rooms/${id}`;
    const index = html.indexOf(marker);
    const chunk = html.slice(Math.max(0, index - 2500), index + 4500);
    const existing = byId.get(id);
    byId.set(id, {
      roomId: id,
      url: `https://www.airbnb.com/rooms/${id}`,
      name: existing?.name || extractCandidateName(chunk, id),
      firstOffset: existing?.firstOffset ?? offset,
    });
  }
}

const seeds = [...byId.values()].sort((a, b) => a.firstOffset - b.firstOffset || a.url.localeCompare(b.url));
await fs.writeFile(path.join(outputDir, "airbnb-cluj-seeds.json"), JSON.stringify({ pageSummaries, seeds }, null, 2));

console.log(JSON.stringify({ pageSummaries, seedCount: seeds.length, sample: seeds.slice(0, 30) }, null, 2));
