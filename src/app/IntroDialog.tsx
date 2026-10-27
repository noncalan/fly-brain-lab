import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

const SEEN_KEY = 'fbl.introSeen';

function seen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

/** First-visit explanation of what the lab is and is not. Shown once; also skipped for shared experiment links. */
export function IntroDialog({ onExperiments }: { onExperiments: () => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const [open] = useState(() => !seen() && window.location.search === '');
  useEffect(() => {
    if (open) ref.current?.showModal();
  }, [open]);
  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // private mode: the dialog may show again next time
    }
    ref.current?.close();
  };
  if (!open) return null;
  return (
    <dialog
      ref={ref}
      onCancel={close}
      aria-labelledby="intro-title"
      className="max-w-lg rounded-2xl border border-line bg-surface p-6 text-ink shadow-2xl backdrop:bg-black/60"
    >
      <h2 id="intro-title" className="text-xl font-semibold">
        {t('intro.title')}
      </h2>
      <p className="mt-3">{t('intro.p1')}</p>
      <p className="mt-3">{t('intro.p2')}</p>
      <p className="mt-3 text-muted">{t('intro.p3')}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={close} className="rounded-md bg-accent px-4 py-2 font-medium text-accent-contrast" data-testid="intro-start">
          {t('intro.start')}
        </button>
        <button
          type="button"
          onClick={() => {
            close();
            onExperiments();
          }}
          className="rounded-md border border-line px-4 py-2"
        >
          {t('intro.experiments')}
        </button>
      </div>
    </dialog>
  );
}
