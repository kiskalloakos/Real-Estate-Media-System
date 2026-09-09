import type { CreateClientInput } from './types';

export type AgreementPrefill = Pick<
  CreateClientInput,
  'contractMonths' | 'contractStartsOn' | 'monthlyDeliverables' | 'monthlyPrice' | 'totalContractValue'
>;

function amountFromContractText(value: string) {
  const cleaned = value.replace(/[^\d,.-]/g, '').replace(/\s/g, '');
  if (!cleaned) return '';
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/(?<=\d)\.(?=\d{3}(?:\D|$))/g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? String(amount) : '';
}

function dateFromContractText(value: string) {
  const iso = value.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];
  const european = value.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/);
  if (!european) return '';
  return `${european[3]}-${european[2].padStart(2, '0')}-${european[1].padStart(2, '0')}`;
}

function normalizedContractMonth(value: string) {
  const monthNames: Record<string, string> = {
    aprilie: 'April',
    august: 'August',
    decembrie: 'December',
    februarie: 'February',
    ianuarie: 'January',
    iulie: 'July',
    iunie: 'June',
    mai: 'May',
    martie: 'March',
    noiembrie: 'November',
    octombrie: 'October',
    septembrie: 'September',
  };
  const normalized = value
    .toLocaleLowerCase('ro')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return monthNames[normalized] ?? `${value[0].toUpperCase()}${value.slice(1)}`;
}

export async function prefillAgreementFromPdf(file: File): Promise<Partial<AgreementPrefill>> {
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    return {};
  }

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = await Promise.all(
    Array.from({ length: document.numPages }, async (_, index) => {
      const page = await document.getPage(index + 1);
      const content = await page.getTextContent();
      return content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
    }),
  );
  const text = pages.join('\n').replace(/[ \t]+/g, ' ').trim();
  if (text.length < 24) {
    throw new Error('This PDF has no selectable text. Use a text PDF, or add the agreement details manually.');
  }

  const valueAfter = (pattern: RegExp) => amountFromContractText(text.match(pattern)?.[1] ?? '');
  const monthlyPrice = valueAfter(
    /(?:(?:monthly|lunar(?:ă|a)?)[^\d]{0,48}|(?:sum[ăa]|pret(?:ul)?)[^\d]{0,36})([\d.,\s]+)\s*(?:ron|lei)(?:\s*(?:lunar|pe\s+lun[ăa]))?/i,
  );
  const totalContractValue = valueAfter(/(?:total(?:\s+(?:contract|agreement))?(?:\s+(?:value|amount))?|valoare\s+total[ăa])[^\d]{0,48}([\d.,\s]+)\s*(?:ron|lei)/i);
  const contractMonths = text.match(/(?:duration|term|period|perioad[ăa]|durata)[^\d]{0,48}(\d{1,2})\s*(?:months?|luni)/i)?.[1]
    ?? text.match(/\b(\d{1,2})\s*(?:months?|luni)\b/i)?.[1]
    ?? '';
  const contractStartsOn = dateFromContractText(
    text.match(/(?:start(?:ing)?(?:\s+date)?|commencement|încep(?:ere|ând)|incep(?:ere|and))[^\d]{0,40}(?:\d{1,2}[./-]\d{1,2}[./-]20\d{2}|20\d{2}-\d{2}-\d{2})/i)?.[0] ?? '',
  );
  const deliverableYear = contractStartsOn ? contractStartsOn.slice(0, 4) : String(new Date().getFullYear());
  const deliverableLines = Array.from(
    text.matchAll(/\b(\d+)\s+(videoclipuri|video(?:uri)?|reels?|fotografii|photos?|posts?|stories|clipuri)\s+(?:luna|în\s+luna|in\s+luna)\s+([a-zăâîșţț]+)/gi),
    (match) => `${normalizedContractMonth(match[3])} ${deliverableYear}: ${match[1]} ${match[2]}`,
  );
  const inferredTotal = monthlyPrice && contractMonths
    ? String(Number(monthlyPrice) * Number(contractMonths))
    : '';

  return {
    ...(contractMonths ? { contractMonths } : {}),
    ...(contractStartsOn ? { contractStartsOn } : {}),
    ...(monthlyPrice ? { monthlyPrice } : {}),
    ...(totalContractValue || inferredTotal ? { totalContractValue: totalContractValue || inferredTotal } : {}),
    ...(deliverableLines.length ? { monthlyDeliverables: deliverableLines.join('\n') } : {}),
  };
}
