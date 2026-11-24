import { planHeight, planWidth, type ProductionDocument, type ScreenplayScene, type ShootLocation } from './screenplay';

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]!);

export function floorPlanMarkup(location: ShootLocation, scene: ScreenplayScene, selectedId = '', selectedShotId = ''): string {
  const scope = escapeHtml(scene.id);
  const rooms = location.rooms.map((room) => `<g data-plan-id="${escapeHtml(room.id)}" data-plan-kind="room" class="plan-item">
    <rect x="${room.x}" y="${room.y}" width="${room.width}" height="${room.height}" fill="${room.id === scene.roomId ? '#eeedff' : '#ffffff'}" fill-opacity=".82" stroke="${room.id === selectedId ? '#5256e0' : '#545968'}" stroke-width="${room.id === selectedId ? 5 : 3}"/>
    <text x="${room.x + 12}" y="${room.y + 25}" font-size="16" fill="#36394b">${escapeHtml(room.name)}</text></g>`).join('');
  const fixtures = location.fixtures.map((fixture) => `<g data-plan-id="${escapeHtml(fixture.id)}" data-plan-kind="fixture" class="plan-item" transform="translate(${fixture.x} ${fixture.y}) rotate(${fixture.angle} ${fixture.width / 2} ${fixture.height / 2})">
    <rect width="${fixture.width}" height="${fixture.height}" rx="${fixture.type === 'furniture' ? 5 : 0}" fill="${fixture.type === 'window' ? '#dbf1ff' : '#f1ece3'}" stroke="${fixture.id === selectedId ? '#5256e0' : '#7c8190'}" stroke-width="${fixture.id === selectedId ? 4 : 2}"/>
    <text x="${fixture.width / 2}" y="${fixture.height / 2 + 5}" font-size="12" text-anchor="middle" fill="#36394b">${escapeHtml(fixture.label)}</text></g>`).join('');
  const markers = scene.markers.map((marker) => {
    const color = marker.id === selectedId || (selectedShotId && marker.shotId === selectedShotId) ? '#3333ad' : marker.type === 'actor' ? '#15846d' : '#5256e0';
    const shot = scene.shots.find((item) => item.id === marker.shotId);
    const label = escapeHtml([marker.label, shot?.label].filter(Boolean).join(' · '));
    if (marker.type === 'movement') return `<g data-plan-id="${escapeHtml(marker.id)}" data-plan-kind="marker" class="plan-item"><line x1="${marker.x}" y1="${marker.y}" x2="${marker.endX}" y2="${marker.endY}" stroke="${color}" stroke-width="5" marker-end="url(#arrow-${scope})"/><circle cx="${marker.x}" cy="${marker.y}" r="10" fill="${color}"/><text x="${(marker.x + marker.endX) / 2}" y="${(marker.y + marker.endY) / 2 - 12}" font-size="15" fill="${color}" paint-order="stroke" stroke="white" stroke-width="4">${label}</text></g>`;
    return `<g data-plan-id="${escapeHtml(marker.id)}" data-plan-kind="marker" class="plan-item" transform="translate(${marker.x} ${marker.y})">
      <g transform="rotate(${marker.angle})">${marker.type === 'camera'
        ? `<path d="M0 0 L-65 -100 L65 -100 Z" fill="#5256e0" fill-opacity=".12"/><rect x="-16" y="-12" width="32" height="24" rx="4" fill="${color}"/><path d="M-9 -17 L0 -32 L9 -17 Z" fill="${color}"/>`
        : `<circle r="18" fill="${color}"/><path d="M-7 -23 L0 -35 L7 -23 Z" fill="${color}"/>`}</g>
      <text x="0" y="40" text-anchor="middle" font-size="15" fill="${color}" paint-order="stroke" stroke="white" stroke-width="4">${label}</text></g>`;
  }).join('');
  const background = location.background && /^data:image\/(png|jpeg|webp);base64,/.test(location.background)
    ? `<image href="${escapeHtml(location.background)}" width="${planWidth}" height="${planHeight}" preserveAspectRatio="xMidYMid meet" opacity=".65"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${planWidth} ${planHeight}" role="img" aria-label="${escapeHtml(`${location.name} floor plan for ${scene.heading}`)}" style="width:100%;height:auto;display:block;font-family:Arial,sans-serif;user-select:none">
    <defs><pattern id="grid-${scope}" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#e4e6ed" stroke-width="1"/></pattern><marker id="arrow-${scope}" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0 0 L0 6 L8 3 Z" fill="#5256e0"/></marker></defs>
    <rect width="1000" height="700" fill="#fafbfe"/><rect width="1000" height="700" fill="url(#grid-${scope})"/>${background}${rooms}${fixtures}${markers}</svg>`;
}

function sceneHtml(scene: ScreenplayScene, index: number): string {
  const chunks: string[] = [];
  for (let i = 0; i < scene.blocks.length; i += 1) {
    const block = scene.blocks[i];
    const blockHtml = (type: string, text: string) => `<p class="${type}">${escapeHtml(type === 'character' || type === 'transition' ? text.toUpperCase() : type === 'parenthetical' ? `(${text.replace(/^\(|\)$/g, '')})` : text)}</p>`;
    if (block.type === 'character') {
      let speech = blockHtml(block.type, block.text);
      while (i + 1 < scene.blocks.length && ['dialogue', 'parenthetical'].includes(scene.blocks[i + 1].type)) {
        i += 1;
        speech += blockHtml(scene.blocks[i].type, scene.blocks[i].text);
      }
      chunks.push(`<div class="speech">${speech}</div>`);
    } else chunks.push(blockHtml(block.type, block.text));
  }
  return `<section class="scene"><h2><span>${index + 1}</span>${escapeHtml(scene.heading.toUpperCase())}</h2>${chunks.join('')}</section>`;
}

export function productionPrintHtml(title: string, production: ProductionDocument, includePlans = false): string {
  const plans = includePlans ? production.locations.map((location) => {
    const scenes = production.scenes.filter((scene) => scene.locationId === location.id);
    return scenes.map((scene) => `<section class="plan-page"><h2>${escapeHtml(location.name)} · Scene ${production.scenes.indexOf(scene) + 1}</h2><h3>${escapeHtml(scene.heading)}</h3><p class="small">Schematic · not to scale · blue: cameras/movement · green: talent</p>${floorPlanMarkup(location, scene)}
      ${scene.cast ? `<p><strong>Cast:</strong> ${escapeHtml(scene.cast)}</p>` : ''}${scene.notes ? `<p><strong>Production notes:</strong> ${escapeHtml(scene.notes)}</p>` : ''}
      <h3>Shot list</h3>${scene.shots.length ? scene.shots.map((shot) => {
        const dialogue = scene.blocks.find((block) => block.id === shot.dialogueBlockId);
        return `<div class="shot"><strong>${escapeHtml(shot.label)}</strong> · ${escapeHtml([shot.framing, shot.movement].filter(Boolean).join(' / '))}<p>${escapeHtml(shot.action)}</p>${dialogue ? `<p><em>${escapeHtml(dialogue.text)}</em></p>` : ''}</div>`;
      }).join('') : '<p>No shots added.</p>'}</section>`).join('');
  }).join('') : '';
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>${escapeHtml(title)}${includePlans ? ' – Production pack' : ' – Screenplay'}</title><style>
    @page{size:letter;margin:1in 1in 1in 1.5in;@top-right{content:counter(page) ".";font:12pt Courier,monospace}}
    *{box-sizing:border-box}body{margin:30px auto;max-width:6in;color:#111;background:white;font:12pt/1.1 "Courier New",Courier,monospace}h1{font-size:18pt;text-align:center;margin:36pt 0}h2,h3{font-size:12pt}h2{position:relative;margin:24pt 0 12pt;break-after:avoid}h2 span{position:absolute;left:-.4in}p{white-space:pre-wrap;margin:0 0 12pt;orphans:3;widows:3}.character{margin:0 0 0 2.2in}.dialogue{margin:0 1.1in 12pt 1in}.parenthetical{margin:0 1.5in 0 1.6in}.transition{text-align:right}.speech{break-inside:avoid}.plan-page{break-before:page;font:11pt/1.5 Arial,sans-serif}.plan-page h2{font:bold 16pt Arial}.plan-page svg{max-height:4in}.small{font-size:9pt;color:#666}.shot{break-inside:avoid;border-top:1px solid #ddd;padding:10pt 0}.shot p{margin:5pt 0}.print-toolbar{font:14px Arial;padding:14px;text-align:center;background:#f2f2f7;margin-bottom:30px}.print-toolbar button{padding:10px 20px;cursor:pointer}@media print{body{margin:0;max-width:none}.print-toolbar{display:none}}
    </style></head><body><div class="print-toolbar">Use your browser’s Print menu to save this ${includePlans ? 'production pack' : 'screenplay'} as PDF.</div><h1>${escapeHtml(title || 'Untitled screenplay')}</h1>${production.scenes.map(sceneHtml).join('')}${plans}</body></html>`;
}

export function openProductionDocument(title: string, production: ProductionDocument, includePlans = false): boolean {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  printWindow.opener = null;
  printWindow.document.open();
  printWindow.document.write(productionPrintHtml(title, production, includePlans));
  printWindow.document.close();
  const images = Array.from(printWindow.document.images).map((image) => image.decode().catch(() => undefined));
  void Promise.all([printWindow.document.fonts.ready, ...images]).then(() => {
    if (!printWindow.closed) { printWindow.focus(); printWindow.print(); }
  });
  return true;
}
