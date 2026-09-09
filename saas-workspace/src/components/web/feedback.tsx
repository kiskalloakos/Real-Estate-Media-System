import React from 'react';

import { IconButton, cx } from './ui';

type ToastTone = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  notify: (message: string, tone?: ToastTone) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: React.PropsWithChildren) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);
  const nextId = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = React.useCallback((message: string, tone: ToastTone = 'success') => {
    if (tone !== 'error') return;

    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  const value = React.useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext value={value}>
      {children}
      <div aria-atomic="true" aria-live="assertive" className="rm-toast-viewport">
        {toasts.map((toast) => (
          <div className={cx('rm-toast', `rm-toast--${toast.tone}`)} key={toast.id} role="alert">
            <span>{toast.message}</span>
            <IconButton
              icon="x"
              label="Dismiss error"
              onClick={() => dismiss(toast.id)}
              size="sm"
            />
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast() {
  const context = React.use(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside ToastProvider.');
  }
  return context;
}
