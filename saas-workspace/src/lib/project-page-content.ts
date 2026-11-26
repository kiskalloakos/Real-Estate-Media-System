import { newPageBlock, type PageBlock } from './project-pages';

const escapeText = (text: string) => text.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]!);

/** Convert older blocks for editing while leaving the stored version intact until an edit. */
export function projectPageHtml(blocks: readonly PageBlock[]) {
  const markup: string[] = [];
  let list: 'ul' | 'ol' | undefined;
  for (const block of blocks) {
    const listType = block.type === 'bullet' ? 'ul' : block.type === 'number' ? 'ol' : undefined;
    if (listType !== list) {
      if (list) markup.push(`</${list}>`);
      if (listType) markup.push(`<${listType}>`);
      list = listType;
    }
    if (typeof block.html === 'string') {
      markup.push(block.html);
      continue;
    }
    const text = escapeText(block.text).replaceAll('\n', '<br>');
    if (listType) markup.push(`<li>${text}</li>`);
    else if (block.type === 'heading1' || block.type === 'scene') markup.push(`<h2>${text}</h2>`);
    else if (block.type === 'heading2' || block.type === 'character') markup.push(`<h3>${text}</h3>`);
    else if (block.type === 'quote' || block.type === 'callout') markup.push(`<blockquote>${text}</blockquote>`);
    else if (block.type === 'code') markup.push(`<pre>${escapeText(block.text)}</pre>`);
    else if (block.type === 'divider') markup.push('<hr>');
    else if (block.type === 'check') markup.push(`<p>${block.checked ? '☑' : '☐'} ${text}</p>`);
    else markup.push(`<p>${text || '<br>'}</p>`);
  }
  if (list) markup.push(`</${list}>`);
  return markup.join('');
}

export function richPageBlock(html: string, text: string): PageBlock {
  return { ...newPageBlock('paragraph', text), html };
}
