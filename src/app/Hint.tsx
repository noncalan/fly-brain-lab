import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';

/** A small ⓘ button that shows an explanation on demand, so long notes do not crowd the page. */
export function Hint({ children, label, className = '' }: { children: ReactNode; label?: string; className?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  return (
    <span ref={root} className={`relative inline-block align-middle ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label ?? t('hint.more')}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-semibold leading-none ${open ? 'border-accent text-accent' : 'border-line text-muted hover:text-ink'}`}
      >
        i
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className="absolute right-0 top-7 z-30 block w-72 max-w-[80vw] rounded-lg border border-line bg-surface p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-ink shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  );
}
