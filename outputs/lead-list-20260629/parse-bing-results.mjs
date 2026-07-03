import fs from "node:fs/promises";

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeBingUrl(url) {
  const decoded = decodeHtml(url);
  const match = decoded.match(/[?&]u=([^&]+)/);
  if (!match) return decoded;
  let target = decodeURIComponent(match[1]);
  if (target.startsWith("a1")) {
    try {
      target = Buffer.from(target.slice(2).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    } catch {}
  }
  return target;
}

for (const file of process.argv.slice(2)) {
  const html = await fs.readFile(file, "utf8");
  console.log(`\n## ${file}${html.includes("captcha") ? " CAPTCHA" : ""}`);
  const pattern =
    /<li class="b_algo"[\s\S]*?<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/g;
  let match;
  let count = 0;
  while ((match = pattern.exec(html)) && count < 8) {
    count += 1;
    console.log(`${count}. ${decodeHtml(match[2])}`);
    console.log(`   ${decodeBingUrl(match[1])}`);
    console.log(`   ${decodeHtml(match[3]).slice(0, 240)}`);
  }
  const phones = [...html.matchAll(/(?:\+40|0040|0)\s?7[0-9\s.-]{7,12}/g)].map((phoneMatch) => phoneMatch[0]);
  if (phones.length) console.log(`phones: ${phones.join(" | ")}`);
}
