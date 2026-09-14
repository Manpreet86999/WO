import { useEffect, useRef, type ReactNode } from 'react';

export function Modal({
  open,
  title,
  children,
  onClose,
  actions,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        if (!ref.current) return;
        const focusable = Array.from(
          ref.current.querySelectorAll<HTMLElement>(
            'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
          )
        ).filter(el => !el.hasAttribute('disabled'));
        
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input,button,textarea')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="modal" ref={ref} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <div>{children}</div>
        {actions ? <div className="modal-actions mt-4">{actions}</div> : null}
      </div>
    </div>
  );
}
