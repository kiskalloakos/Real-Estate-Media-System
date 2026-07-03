import fs from "node:fs/promises";
import path from "node:path";

const files = process.argv.slice(2);

function decodeEntities(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function decodeBingUrl(url) {
  const decoded = decodeEntities(url);
  const match = decoded.match(/[?&]u=([^&]+)/);
  if (!match) return decoded;
  const raw = decodeURIComponent(match[1]);
  if (!raw.startsWith("a1")) return raw;
  try {
    return Buffer.from(raw.slice(2), "base64").toString("utf8");
  } catch {
    return raw;
  }
}

for (const file of files) {
  const html = await fs.readFile(file, "utf8");
  console.log(`\n## ${path.basename(file)}`);
  const seen = new Set();
  const chunks = html.match(/<li class="b_algo"[\s\S]*?<\/li>/g) || [];
  for (const chunk of chunks) {
    const titleMatch = chunk.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!titleMatch) continue;
    const url = decodeBingUrl(titleMatch[1]);
    if (seen.has(url)) continue;
    seen.add(url);
    const title = decodeEntities(titleMatch[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    const snippetMatch = chunk.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const snippet = snippetMatch
      ? decodeEntities(snippetMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
      : "";
    console.log(`${title}\n${url}\n${snippet}\n`);
  }
}
