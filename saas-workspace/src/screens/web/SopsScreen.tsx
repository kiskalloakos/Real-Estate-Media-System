import { useMemo, useState } from 'react';

import { Card, cleanEditorHtml, Icon, Modal } from '@/components/web';

import type { CompanyDocumentSummary } from './types';

export interface SopsScreenProps {
  documents?: CompanyDocumentSummary[];
  userId?: string;
}

export function SopsScreen({ documents = [], userId }: SopsScreenProps) {
  const [selectedSop, setSelectedSop] = useState<CompanyDocumentSummary | null>(null);
  const assignedSops = documents.filter((document) =>
    document.kind === 'sop' && Boolean(userId && document.assigneeUserIds?.includes(userId)),
  );
  const selectedSopHtml = useMemo(
    () => selectedSop?.contentHtml ? cleanEditorHtml(selectedSop.contentHtml) : '',
    [selectedSop],
  );

  const handleCardKeyDown = (
    event: React.KeyboardEvent<HTMLElement>,
    document: CompanyDocumentSummary,
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setSelectedSop(document);
  };

  return (
    <div className="rm-page">
      <div className="rm-hub-toolbar"><div><h2>SOPs</h2></div></div>
      {assignedSops.length ? (
        <section className="rm-document-grid" aria-label="Assigned SOPs">
          {assignedSops.map((document) => (
            <Card
              aria-label={`Open ${document.title}`}
              className="rm-document-card rm-document-card--editable"
              key={document.id}
              onClick={() => setSelectedSop(document)}
              onKeyDown={(event) => handleCardKeyDown(event, document)}
              role="button"
              tabIndex={0}
              tone="bright"
            >
              <div className="rm-document-card__top"><span><Icon name="file" size={19} /></span></div>
              <div className="rm-document-card__body"><h3>{document.title}</h3><p>{document.contentHtml?.replace(/<[^>]+>/g, ' ').slice(0, 180) || document.fileName || 'Open this SOP from your team workspace.'}</p></div>
              <footer><small>Open SOP</small></footer>
            </Card>
          ))}
        </section>
      ) : (
        <Card className="rm-document-empty" tone="transparent"><Icon name="file" size={26} /><h2>No SOPs assigned yet</h2><p>Your assigned standard operating procedures will appear here.</p></Card>
      )}
      <Modal
        className="rm-sop-reader"
        onClose={() => setSelectedSop(null)}
        open={Boolean(selectedSop)}
        title={selectedSop?.title ?? 'SOP'}
      >
        {selectedSopHtml ? (
          <div
            className="rm-sop-reader__content"
            dangerouslySetInnerHTML={{ __html: selectedSopHtml }}
          />
        ) : (
          <p className="rm-sop-reader__empty">
            {selectedSop?.fileUrl
              ? 'This SOP is available as an attached file.'
              : 'This SOP does not have any content yet.'}
          </p>
        )}
        {selectedSop?.fileUrl ? (
          <footer className="rm-dialog-actions">
            <a
              className="rm-button rm-button--primary"
              href={selectedSop.fileUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open attached file
            </a>
          </footer>
        ) : null}
      </Modal>
    </div>
  );
}
