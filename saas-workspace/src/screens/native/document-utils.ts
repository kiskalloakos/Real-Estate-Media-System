import type { CompanyDocumentKind } from '@/screens/web/types';

export interface DocumentTextRun {
  bold?: boolean;
  text: string;
  underline?: boolean;
}

export interface DocumentContentBlock {
  kind: 'heading' | 'paragraph';
  runs: DocumentTextRun[];
}

const documentKindLabels: Record<CompanyDocumentKind, string> = {
  branding: 'Branding',
  company_file: 'Company files',
  curriculum_vitae: 'Curriculum Vitae',
  foundation: 'Foundations',
  note: 'Notes',
  production: 'Production',
  sales: 'Sales',
  sop: 'SOPs',
  template: 'Templates',
};

export function documentKindLabel(kind: CompanyDocumentKind) {
  return documentKindLabels[kind];
}

export function plainDocumentText(value?: string) {
  return (value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

function parseInlineContent(value: string) {
  const runs: DocumentTextRun[] = [];
  let bold = false;
  let underline = false;
  const tokenPattern = /<(strong|b|u|br)\s*\/?>|<\/(strong|b|u)>|([^<]+)/gi;

  for (const match of value.matchAll(tokenPattern)) {
    const openingTag = match[1]?.toLowerCase();
    const closingTag = match[2]?.toLowerCase();
    const text = match[3];

    if (text) {
      const decoded = decodeEntities(text);
      if (decoded) runs.push({ bold, text: decoded, underline });
      continue;
    }

    if (openingTag === 'strong' || openingTag === 'b') bold = true;
    if (openingTag === 'u') underline = true;
    if (openingTag === 'br') runs.push({ bold, text: '\n', underline });
    if (closingTag === 'strong' || closingTag === 'b') bold = false;
    if (closingTag === 'u') underline = false;
  }

  return runs;
}

function parsePlainSegment(value: string, kind: DocumentContentBlock['kind']) {
  const normalized = decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  );

  return normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const heading = line.match(/^#{1,6}\s+(.+)$/);
      const text = heading?.[1] ?? line;
      const markdownRuns = text.split(/(\*\*[^*]+\*\*|__[^_]+__)/g).filter(Boolean).map((part) => {
        const isBold = (part.startsWith('**') && part.endsWith('**'))
          || (part.startsWith('__') && part.endsWith('__'));
        return {
          bold: isBold,
          text: isBold ? part.slice(2, -2) : part,
        };
      });
      return {
        kind: heading ? 'heading' : kind,
        runs: markdownRuns,
      } satisfies DocumentContentBlock;
    });
}

export function parseDocumentContent(value?: string): DocumentContentBlock[] {
  const source = value?.replace(/\r\n?/g, '\n').trim() ?? '';
  if (!source) return [];

  const blocks: DocumentContentBlock[] = [];
  const blockPattern = /<(h[1-6]|p|div)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let cursor = 0;

  for (const match of source.matchAll(blockPattern)) {
    const start = match.index ?? 0;
    if (start > cursor) blocks.push(...parsePlainSegment(source.slice(cursor, start), 'paragraph'));

    const tag = match[1].toLowerCase();
    const kind = tag.startsWith('h') ? 'heading' : 'paragraph';
    const runs = parseInlineContent(match[2]);
    if (runs.some((run) => run.text.trim())) {
      blocks.push({ kind, runs });
    }
    cursor = start + match[0].length;
  }

  if (!blocks.length || cursor < source.length) {
    blocks.push(...parsePlainSegment(source.slice(cursor), 'paragraph'));
  }

  return blocks;
}

export function documentDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}
