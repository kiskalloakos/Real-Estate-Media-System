import { Button, Modal } from '@/components/web';

export interface ArchiveConfirmModalProps {
  busy: boolean;
  label: string;
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
}

export function ArchiveConfirmModal({
  busy,
  label,
  onClose,
  onConfirm,
  open,
}: ArchiveConfirmModalProps) {
  return (
    <Modal
      onClose={busy ? () => undefined : onClose}
      open={open}
      title={`Delete ${label}?`}
    >
      <div className="rm-archive-confirm">
        <footer className="rm-dialog-actions">
          <Button disabled={busy} onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button disabled={busy} onClick={onConfirm} variant="danger">
            {busy ? 'Deleting…' : `Delete ${label}`}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
