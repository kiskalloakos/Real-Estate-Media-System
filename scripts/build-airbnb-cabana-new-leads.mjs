import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const leadListDir = path.join(root, 'lead-lists');
const masterPath = path.join(leadListDir, 'Aribnb Lead List.numbers');
const outDir = leadListDir;
const batchDate = process.env.LEAD_BATCH_DATE || new Date().toISOString().slice(0, 10).replace(/-/g, '');
const csvPath = path.join(outDir, `new-airbnb-cabana-leads-${batchDate}.csv`);
const auditPath = path.join(outDir, `new-airbnb-cabana-leads-${batchDate}.audit.json`);

const headers = [
  'Name',
  'Judet, Location',
  'Phone number',
  'Listing Link',
  'Website',
  'TikTok',
  'Instagram',
  'Facebook',
  'Status',
  'Notes',
];

const previouslyDelivered = [
  'Muntele Rece Cabin',
  "Ana's Cabin",
  'Nestree',
  'Panoramic Retreat',
  'Goia Paltina Cottage',
  'Teo - wooden house',
  'Elysium Cabin',
  'A-Frame Dream Chalet',
  'Mountain Chalet',
  'Cabana Nord Side',
  'Cabana Ruku',
  'Cranberry Cabin Buscat',
  'Nivalis Resort',
  'The Nest on the Hill',
  'Krusta Panoramic Resort',
  'Cabana Alma',
];

const manualCandidates = [
  {
    name: 'Casa Delia',
    location: 'Cluj, Someșu Rece',
    phone: '+40 727 883 299',
    listingLink: 'https://www.airbnb.com/rooms/940198105049622732',
    notes: 'Phone source: RevNGo public partner listing; Airbnb listing is an entire cabin.',
    duplicateHints: ['940198105049622732', 'cabana-delia', 'Casa Delia'],
  },
  {
    name: 'CBN Cabana',
    location: 'Cluj, Muntele Cacovei',
    phone: '+40 750 223 640',
    listingLink: 'https://www.airbnb.com/rooms/1412906500873388465',
    notes: 'Phone source: Noclegi/Travelminit public operator listing; Airbnb listing is a private cabin.',
    duplicateHints: ['1412906500873388465', 'cbn-cabana', 'CBN Cabana'],
  },
  {
    name: 'Scrind 11 Madleine Chalet',
    location: 'Cluj, Scrind Frăsinet',
    phone: '+40 751 271 063',
    listingLink: 'https://www.booking.com/hotel/ro/scrind-11-madleine-chalet.en-gb.html',
    website: 'https://www.scrind11-madleinechalet.ro/',
    notes: 'Phone source: official contact page; Booking listing is an entire chalet.',
    duplicateHints: ['scrind-11-madleine-chalet', 'Scrind 11', 'Madleine Chalet'],
  },
  {
    name: 'The Hygge House',
    location: 'Cluj, Plopi',
    phone: '+40 743 253 284',
    listingLink: 'https://www.airbnb.com/rooms/43580098',
    facebook: 'https://www.facebook.com/thehyggehouseplopi',
    notes: 'Phone source: Waze public business listing; Airbnb listing is an entire cabin.',
    duplicateHints: ['43580098', 'The Hygge House', 'thehyggehouseplopi'],
  },
  {
    name: 'Chalet A Băișoara',
    location: 'Cluj, Muntele Băișorii',
    phone: '+40 771 434 732',
    listingLink: 'https://wel.ro/cazare-inedita/chalet-a-baisoara/',
    notes: 'Phone source: Travelminit/Noclegi public operator listing; Wel.ro category is Cabane.',
    duplicateHints: ['chalet-a-baisoara', 'Chalet A Băișoara'],
  },
];

function curl(args) {
  return execFileSync('curl', ['-L', '-sS', '--max-time', '30', ...args], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/https?:\/\/(www\.)?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function phoneFormat(value) {
  let d = digits(value);
  if (d.startsWith('0040')) d = d.slice(2);
  if (d.startsWith('0')) d = `40${d.slice(1)}`;
  if (!d.startsWith('40') || d.length !== 11) return '';
  return `+40 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8, 11)}`;
}

function normalizeRomanianPlace(value) {
  return String(value || '')
    .replace(/ǎ/g, 'ă')
    .replace(/Ǎ/g, 'Ă')
    .replace(/\s+/g, ' ')
    .trim();
}

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function htmlDecode(value) {
  return String(value || '')
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#038;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\\\//g, '/');
}

function stripTags(value) {
  return htmlDecode(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readMasterText() {
  const pieces = [];
  pieces.push(execFileSync('strings', [masterPath], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }));
  pieces.push(readFileSync(masterPath, 'latin1'));
  for (const file of readdirSync(leadListDir)) {
    if (/\.csv$/i.test(file) && path.join(leadListDir, file) !== csvPath) {
      pieces.push(readFileSync(path.join(leadListDir, file), 'utf8'));
    }
  }
  return pieces.join('\n');
}

const masterText = readMasterText();
const masterFold = fold(masterText);
const masterDigits = new Set((masterText.match(/(?:\+?40|0)?7\d[\d\s().-]{7,14}/g) || []).map(digits));
const blockedNameFolds = new Set(previouslyDelivered.map(fold));
const knownDuplicateNameCompacts = new Set(
  [
    'cabana balu',
    'balu',
    'gray aframe',
    'grey aframe',
    'gery aframe',
    'gray ai',
    'greenheart',
    'greenheart maguri',
    'marisel tiny house',
    'monte rosso',
    'monterosso',
    'rosso',
  ].map((name) => fold(name).replace(/\s/g, '')),
);
const knownDuplicatePhones = new Set(
  [
    '+40 754 327 876',
    '+40 755 461 100',
    '+40 754 435 130',
    '+40 740 729 051',
    '+40 771 376 061',
  ].flatMap((phone) => {
    const d = digits(phone);
    const national = d.replace(/^40/, '');
    return [d, national, national.slice(-8), national.slice(-7), national.slice(-6)].filter(Boolean);
  }),
);

function inMaster(candidate) {
  const phoneDigits = digits(candidate.phone);
  const urlFold = fold(candidate.listingLink);
  const nameFold = fold(candidate.name);
  const nameCompact = nameFold.replace(/\s/g, '');
  const nationalPhone = phoneDigits.replace(/^40/, '');
  const hintFolds = (candidate.duplicateHints || []).map(fold);

  if (knownDuplicatePhones.has(phoneDigits) || knownDuplicatePhones.has(nationalPhone)) {
    return 'known duplicate phone from master fragments';
  }
  if (knownDuplicateNameCompacts.has(nameCompact)) return 'known duplicate name alias in master';
  if (phoneDigits && (masterDigits.has(phoneDigits) || masterDigits.has(phoneDigits.replace(/^40/, '0')))) {
    return 'duplicate phone in master';
  }
  if (nationalPhone.length === 9 && digits(masterText).includes(nationalPhone)) return 'duplicate phone in master';
  if (urlFold && masterFold.includes(urlFold)) return 'duplicate listing link in master';
  if (nameFold.length > 5 && masterFold.includes(nameFold)) return 'duplicate name in master';
  for (const variant of nameVariants(candidate.name)) {
    if (knownDuplicateNameCompacts.has(variant.replace(/\s/g, ''))) return 'known duplicate name alias in master';
    if (variant.length >= 5 && masterFold.includes(variant)) return 'close duplicate name in master';
  }
  if (hintFolds.some((hint) => hint.length > 5 && masterFold.includes(hint))) return 'duplicate hint in master';
  return '';
}

function nameVariants(name) {
  const full = fold(name);
  const generic = new Set([
    'a',
    'the',
    'cabana',
    'cabană',
    'cabin',
    'chalet',
    'aframe',
    'a-frame',
    'frame',
    'house',
    'home',
    'tiny',
    'marisel',
    'belis',
    'maguri',
    'risca',
    'rasca',
    'baisoara',
    'plopi',
    'somesu',
    'rece',
    'muntele',
  ]);
  const tokens = full.split(' ').filter(Boolean);
  const significant = tokens.filter((token) => !generic.has(token) && token.length > 2);
  const variants = new Set([full]);
  if (significant.length >= 2) variants.add(significant.join(' '));
  if (tokens.length >= 2) variants.add(tokens.slice(0, 2).join(' '));
  if (significant.length >= 2) variants.add(significant.slice(0, 2).join(' '));
  if (significant.length >= 3) variants.add(significant.slice(0, 3).join(' '));
  for (const token of significant) {
    if (token.length >= 5) variants.add(token);
  }
  return [...variants];
}

function parseListingLinksFromHtml(html) {
  const links = new Set();
  const re = /https:\\\/\\\/wel\.ro\\\/cazare-inedita\\\/[^\\"]+|https:\/\/wel\.ro\/cazare-inedita\/[^"']+/g;
  for (const match of html.matchAll(re)) links.add(htmlDecode(match[0]));
  return [...links].map((link) => link.replace(/\\/g, ''));
}

function postWelPage(page) {
  return curl([
    '-X',
    'POST',
    '-F',
    'action=load_items',
    '-F',
    'ajax_quick_filters=[]',
    '-F',
    'ajax_filters=[]',
    '-F',
    'ajax_sort=null',
    '-F',
    'price=[null,null]',
    '-F',
    'location=cluj',
    '-F',
    'type=["cazare"]',
    '-F',
    `page=${page}`,
    'https://wel.ro/wp-admin/admin-ajax.php',
  ]);
}

function fetchWelLinks() {
  const links = new Set(parseListingLinksFromHtml(curl(['https://wel.ro/cazari-inedite/locatie/cluj/'])));

  for (let page = 2; page <= 8; page++) {
    const raw = postWelPage(page);
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      continue;
    }
    for (const link of parseListingLinksFromHtml(json.message || '')) links.add(link);
    if (links.size >= Number(json.total || 0)) break;
  }
  return [...links].sort();
}

function parseWelDetail(url) {
  const html = curl([url]);
  const pageText = stripTags(html);
  const title = htmlDecode((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || html.match(/<title>(.*?) - Wel\.ro<\/title>/i)?.[1] || '').trim());
  const locRaw = stripTags(html.match(/<a[^>]+cazari-inedite\/locatie\/cluj\/[^>]*>([\s\S]*?)<\/a>/i)?.[1] || '');
  const locName = normalizeRomanianPlace(locRaw.replace(/\s*-\s*Cluj\b.*/i, ''));
  const location = locName ? `Cluj, ${locName}` : 'Cluj,';
  const rawPhone =
    html.match(/data-tel="([^"]+)"/i)?.[1] ||
    html.match(/href="tel:([^"]+)"/i)?.[1] ||
    html.match(/wa\.me\/(\+?\d+)/i)?.[1] ||
    '';
  const phone = phoneFormat(rawPhone);

  const social = {
    instagram: html.match(/https?:\/\/(?:www\.)?instagram\.com\/[^"' <)]+/i)?.[0] || '',
    facebook: html.match(/https?:\/\/(?:www\.)?facebook\.com\/[^"' <)]+/i)?.[0] || '',
    tiktok: html.match(/https?:\/\/(?:www\.)?tiktok\.com\/[^"' <)]+/i)?.[0] || '',
  };
  if (/facebook\.com\/wel\.travell/i.test(social.facebook)) social.facebook = '';

  const accommodationInfo = stripTags(html.match(/<ul[^>]+class="[^"]*accomodation-infos[^"]*"[^>]*>([\s\S]*?)<\/ul>/i)?.[1] || '');
  const propertyIdentity = `${title} ${accommodationInfo}`;
  const isCabana =
    /(^|\s)(1\s+)?caban[ăa](\s|$)/i.test(propertyIdentity) ||
    /Cabane|Tiny House|toat[ăa]\s+(cabana|locația|locatia)|cabin|chalet|a-frame|bungalow|cas[ăa]|cottage|house/i.test(propertyIdentity);

  return {
    name: title,
    location,
    phone,
    listingLink: url,
    website: '',
    tiktok: social.tiktok,
    instagram: social.instagram,
    facebook: social.facebook,
    status: 'Lead',
    notes: '',
    pageText,
    propertyIdentity,
    isCabana,
    duplicateHints: [title, url.split('/').filter(Boolean).at(-1)],
  };
}

function allowedListing(link) {
  return /^https:\/\/(www\.)?airbnb\./i.test(link) || /^https:\/\/(www\.)?booking\.com\//i.test(link) || /^https:\/\/wel\.ro\//i.test(link);
}

function validateCandidate(candidate) {
  const propertyIdentity = fold(`${candidate.name} ${candidate.propertyIdentity || ''}`);
  if (!candidate.name) return 'missing name';
  if (!candidate.phone) return 'missing phone';
  if (!/^Cluj,\s*[^,\s]/.test(candidate.location || '')) return 'missing specific location';
  if (!allowedListing(candidate.listingLink)) return 'listing link domain not allowed';
  if (!candidate.isCabana && /^https:\/\/wel\.ro\//i.test(candidate.listingLink)) return 'not clearly cabana';
  if (/(^|\s)(pensiune|pensiunea|pensiuni|agropensiune|agropensiunea|agroturistica|agroturistica|agroturistic|restaurant|restaurante|apartament|apartamente|hotel|spa)(\s|$)/i.test(propertyIdentity)) {
    return 'forbidden property type wording';
  }
  if (candidate.status !== 'Lead') return 'invalid status';
  if (blockedNameFolds.has(fold(candidate.name))) return 'already delivered in previous batch';
  return '';
}

mkdirSync(outDir, { recursive: true });

const audit = {
  startedAt: new Date().toISOString(),
  welLinksFound: 0,
  skipped: [],
  output: csvPath,
};

const candidates = [...manualCandidates.map((c) => ({ status: 'Lead', website: '', tiktok: '', instagram: '', facebook: '', isCabana: true, ...c }))];
const welLinks = fetchWelLinks();
audit.welLinksFound = welLinks.length;

for (const link of welLinks) {
  try {
    candidates.push(parseWelDetail(link));
  } catch (error) {
    audit.skipped.push({ link, reason: `fetch/parse failed: ${error.message}` });
  }
}

const seenLinks = new Set();
const seenPhones = new Set();
const seenNameLocation = new Set();
const rows = [];

for (const candidate of candidates) {
  const validReason = validateCandidate(candidate);
  if (validReason) {
    audit.skipped.push({ name: candidate.name, link: candidate.listingLink, reason: validReason });
    continue;
  }

  const linkKey = fold(candidate.listingLink);
  const phoneKey = digits(candidate.phone);
  const nameLocKey = fold(`${candidate.name} ${candidate.location}`);
  if (seenLinks.has(linkKey) || seenPhones.has(phoneKey) || seenNameLocation.has(nameLocKey)) {
    audit.skipped.push({ name: candidate.name, link: candidate.listingLink, reason: 'duplicate inside new batch' });
    continue;
  }

  const masterReason = inMaster(candidate);
  if (masterReason) {
    audit.skipped.push({ name: candidate.name, link: candidate.listingLink, phone: candidate.phone, reason: masterReason });
    continue;
  }

  seenLinks.add(linkKey);
  seenPhones.add(phoneKey);
  seenNameLocation.add(nameLocKey);
  rows.push({
    Name: candidate.name,
    'Judet, Location': candidate.location,
    'Phone number': candidate.phone,
    'Listing Link': candidate.listingLink,
    Website: candidate.website || '',
    TikTok: candidate.tiktok || '',
    Instagram: candidate.instagram || '',
    Facebook: candidate.facebook || '',
    Status: 'Lead',
    Notes: '',
  });
}

const csv = [headers.map(csvEscape).join(','), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))].join('\n');
writeFileSync(csvPath, `${csv}\n`);
audit.finishedAt = new Date().toISOString();
audit.rowCount = rows.length;
audit.rows = rows;
writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(JSON.stringify({ csvPath, auditPath, rowCount: rows.length, welLinksFound: welLinks.length }, null, 2));
