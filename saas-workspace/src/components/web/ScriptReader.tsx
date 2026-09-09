import { Icon } from './Icon';
import { Button, Modal } from './ui';

export interface ScriptReaderData {
  assignees: string[];
  caption?: string;
  platform?: string;
  schedule?: string;
  script: string;
  status?: string;
  title: string;
}

interface ScriptReaderProps {
  data: ScriptReaderData | null;
  onClose: () => void;
  open: boolean;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] as string);
}

function scriptDocument(data: ScriptReaderData) {
  const metadata = [
    data.schedule ? ['Schedule', data.schedule] : null,
    data.platform ? ['Platform', data.platform] : null,
    data.status ? ['Status', data.status] : null,
    data.assignees.length ? ['Talent', data.assignees.join(', ')] : null,
  ].filter((item): item is [string, string] => Boolean(item));
  const metadataHtml = metadata.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
  const captionHtml = data.caption?.trim()
    ? `<section><h2>Caption</h2><p class="caption">${escapeHtml(data.caption)}</p></section>`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(data.title)} · Realty Media</title><style>
    @page { margin: 18mm; } * { box-sizing: border-box; } body { color: #101010; font-family: Arial, sans-serif; line-height: 1.6; margin: 0 auto; max-width: 760px; } header { border-bottom: 2px solid #101010; margin-bottom: 28px; padding-bottom: 20px; } h1 { font-size: 30px; line-height: 1.15; margin: 0 0 18px; } h2 { font-size: 13px; letter-spacing: .12em; margin: 30px 0 10px; text-transform: uppercase; } dl { display: grid; gap: 10px 24px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0; } dt { color: #676767; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; } dd { font-weight: 600; margin: 2px 0 0; } .caption { background: #f3f3f1; padding: 16px; white-space: pre-wrap; } .script { font-family: Georgia, serif; font-size: 15px; white-space: pre-wrap; } @media print { body { max-width: none; } }
  </style></head><body><header><h1>${escapeHtml(data.title)}</h1><dl>${metadataHtml}</dl></header>${captionHtml}<section><h2>Script</h2><div class="script">${escapeHtml(data.script || 'No script has been added yet.')}</div></section></body></html>`;
}

export function openScriptDocument(data: ScriptReaderData, print = false) {
  // Keep the reference while the document is written; the `noopener` feature
  // makes several browsers return null here, which would prevent PDF export.
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  printWindow.opener = null;
  printWindow.document.open();
  printWindow.document.write(scriptDocument(data));
  printWindow.document.close();
  printWindow.focus();
  if (print) window.setTimeout(() => printWindow.print(), 250);
  return true;
}

export function ScriptReader({ data, onClose, open }: ScriptReaderProps) {
  if (!data) return null;
  const metadata = [
    data.schedule ? { label: 'Schedule', value: data.schedule } : null,
    data.platform ? { label: 'Platform', value: data.platform } : null,
    data.status ? { label: 'Status', value: data.status } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <Modal fullscreen onClose={onClose} open={open} title={data.title}>
      <article className="rm-script-reader">
        <header className="rm-script-reader__toolbar">
          <div>
            <p className="rm-script-reader__eyebrow">Production script</p>
            <div className="rm-script-reader__meta">
              {metadata.map((item) => <span key={item.label}><strong>{item.label}</strong>{item.value}</span>)}
            </div>
          </div>
          <div className="rm-script-reader__actions">
            <Button icon="arrow-up-right" onClick={() => openScriptDocument(data)} variant="secondary">Open in tab</Button>
            <Button icon="download" onClick={() => openScriptDocument(data, true)}>Export PDF</Button>
          </div>
        </header>

        <div className="rm-script-reader__layout">
          <aside className="rm-script-reader__sidebar">
            <div>
              <p>Assigned talent</p>
              {data.assignees.length ? (
                <ul>{data.assignees.map((assignee) => <li key={assignee}><Icon name="user" size={16} />{assignee}</li>)}</ul>
              ) : <span>No talent assigned yet</span>}
            </div>
            {data.caption?.trim() ? <div><p>Caption</p><span className="rm-script-reader__caption">{data.caption}</span></div> : null}
          </aside>
          <main className="rm-script-reader__content">
            <p className="rm-script-reader__label">Script</p>
            <div className="rm-script-reader__copy">{data.script.trim() || 'No script has been added yet.'}</div>
          </main>
        </div>
      </article>
    </Modal>
  );
}
