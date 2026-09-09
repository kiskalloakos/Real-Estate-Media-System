type ScriptPdfBlock = {
  kind: 'heading' | 'body';
  text: string;
};

const SCRIPT_PDF_LOGO_SRC = '/realty-media-brandmark-black.png';
const SCRIPT_PDF_WIDTH = 1440;
const SCRIPT_PDF_HEIGHT = 2036;
const SCRIPT_PDF_MARGIN_X = 210;
const SCRIPT_PDF_FIRST_PAGE_TOP = 270;
const SCRIPT_PDF_NEXT_PAGE_TOP = 150;
const SCRIPT_PDF_BOTTOM = 170;

function scriptPdfFilename(title: string) {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${slug || 'realty-media'}-script.pdf`;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load the PDF logo.'));
    image.src = src;
  });
}

function scriptTextToBlocks(scriptText: string): ScriptPdfBlock[] {
  return scriptText
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((text) => ({
      kind: /^HOOK\s+\d+:/i.test(text) ? 'heading' : 'body',
      text,
    }));
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const wrappedLines: string[] = [];
  const explicitLines = text.split('\n');
  explicitLines.forEach((line) => {
    const words = line.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      wrappedLines.push('');
      return;
    }

    let currentLine = '';
    words.forEach((word) => {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (context.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
        return;
      }
      if (currentLine) wrappedLines.push(currentLine);
      currentLine = word;
    });
    if (currentLine) wrappedLines.push(currentLine);
  });
  return wrappedLines;
}

function buildPdfFromJpegs(jpegDataUrls: string[]) {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const objects: string[] = [];
  const pageRefs: number[] = [];
  let nextObject = 3;

  jpegDataUrls.forEach(() => {
    pageRefs.push(nextObject);
    nextObject += 3;
  });

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`;

  jpegDataUrls.forEach((dataUrl, index) => {
    const pageRef = pageRefs[index];
    const imageRef = pageRef + 1;
    const contentRef = pageRef + 2;
    const imageBytes = atob(dataUrl.split(',')[1] ?? '');
    const imageName = `Im${index + 1}`;
    const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/${imageName} Do\nQ`;

    objects[pageRef] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /${imageName} ${imageRef} 0 R >> >> /Contents ${contentRef} 0 R >>`;
    objects[imageRef] = `<< /Type /XObject /Subtype /Image /Width ${SCRIPT_PDF_WIDTH} /Height ${SCRIPT_PDF_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n${imageBytes}\nendstream`;
    objects[contentRef] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  let output = '%PDF-1.4\n%\xFF\xFF\xFF\xFF\n';
  const offsets = [0];
  for (let objectNumber = 1; objectNumber < objects.length; objectNumber += 1) {
    offsets[objectNumber] = output.length;
    output += `${objectNumber} 0 obj\n${objects[objectNumber]}\nendobj\n`;
  }
  const xrefOffset = output.length;
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let objectNumber = 1; objectNumber < objects.length; objectNumber += 1) {
    output += `${String(offsets[objectNumber]).padStart(10, '0')} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const pdfBytes = new Uint8Array(output.length);
  for (let index = 0; index < output.length; index += 1) {
    pdfBytes[index] = output.charCodeAt(index) & 0xff;
  }
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

export async function downloadScriptPdf(title: string, scriptText: string) {
  const logo = await loadImage(SCRIPT_PDF_LOGO_SRC);
  const blocks = scriptTextToBlocks(scriptText);
  const canvases: HTMLCanvasElement[] = [];
  let canvas = document.createElement('canvas');
  let context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create the PDF canvas.');

  const maxTextWidth = SCRIPT_PDF_WIDTH - SCRIPT_PDF_MARGIN_X * 2;
  let y = 0;
  let isFirstPage = true;

  const startPage = () => {
    canvas = document.createElement('canvas');
    canvas.width = SCRIPT_PDF_WIDTH;
    canvas.height = SCRIPT_PDF_HEIGHT;
    context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create the PDF canvas.');

    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, SCRIPT_PDF_WIDTH, SCRIPT_PDF_HEIGHT);
    context.fillStyle = '#000000';
    context.textBaseline = 'top';

    if (isFirstPage) {
      const logoWidth = 155;
      const logoHeight = logoWidth * (logo.naturalHeight / logo.naturalWidth);
      context.drawImage(logo, (SCRIPT_PDF_WIDTH - logoWidth) / 2, 95, logoWidth, logoHeight);
      y = SCRIPT_PDF_FIRST_PAGE_TOP;
      isFirstPage = false;
    } else {
      y = SCRIPT_PDF_NEXT_PAGE_TOP;
    }
    canvases.push(canvas);
  };

  const ensureSpace = (height: number) => {
    if (y + height <= SCRIPT_PDF_HEIGHT - SCRIPT_PDF_BOTTOM) return;
    startPage();
  };

  startPage();

  blocks.forEach((block) => {
    if (!context) return;
    const isHeading = block.kind === 'heading';
    const fontSize = isHeading ? 36 : 28;
    const lineHeight = isHeading ? 48 : 44;
    const gapAfter = isHeading ? 24 : 20;
    context.font = `${isHeading ? '700' : '400'} ${fontSize}px Arial, sans-serif`;

    const lines = wrapCanvasText(context, block.text, maxTextWidth);
    if (isHeading) ensureSpace(lineHeight * Math.min(lines.length + 1, 2));
    lines.forEach((line) => {
      ensureSpace(lineHeight);
      if (line) context?.fillText(line, SCRIPT_PDF_MARGIN_X, y);
      y += line ? lineHeight : lineHeight * 0.6;
    });
    y += gapAfter;
  });

  const pdfBlob = buildPdfFromJpegs(canvases.map((page) => page.toDataURL('image/jpeg', 0.94)));
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = scriptPdfFilename(title);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
