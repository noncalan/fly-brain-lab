import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { LANGS, useI18n, type StringKey } from '../i18n';
import { FlyIcon } from './FlyIcon';

const THEME_KEY = 'fbl.theme';
export type Route = '/' | '/experiments' | '/compare' | '/about';
const ROUTES: Array<{ path: Route; label: StringKey }> = [
  { path: '/', label: 'nav.lab' },
  { path: '/experiments', label: 'nav.experiments' },
  { path: '/compare', label: 'nav.compare' },
  { path: '/about', label: 'nav.about' },
];

function readTheme(): 'dark' | 'light' {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // ignore unavailable storage
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(readTheme);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // ignore unavailable storage
      }
      return next;
    });
  }, []);
  return { theme, toggle };
}

function currentRoute(): Route {
  const p = window.location.pathname;
  return p === '/about' || p === '/experiments' || p === '/compare' ? p : '/';
}

/** Two-page client router on the History API; Vercel rewrites unknown paths to index.html. */
export function useRoute(): [Route, (r: Route, query?: string) => void] {
  const [route, setRoute] = useState<Route>(currentRoute);
  useEffect(() => {
    const onPop = () => setRoute(currentRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = useCallback((r: Route, query?: string) => {
    const search = query !== undefined ? (query ? `?${query}` : '') : r === '/' ? window.location.search : '';
    if (r !== currentRoute() || query !== undefined) window.history.pushState({}, '', r + search);
    setRoute(r);
    window.scrollTo(0, 0);
  }, []);
  return [route, navigate];
}

export function Header({ route, navigate }: { route: Route; navigate: (r: Route) => void }) {
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
          className="flex items-center gap-2 font-semibold"
        >
          <FlyIcon className="h-6 w-6 text-accent" />
          {t('app.title')}
        </a>
        <nav aria-label={t('nav.main')} className="flex gap-4 text-sm">
          {ROUTES.map((r) => (
            <a
              key={r.path}
              href={r.path}
              aria-current={route === r.path ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigate(r.path);
              }}
              className={route === r.path ? 'text-ink underline decoration-accent decoration-2 underline-offset-8' : 'text-muted hover:text-ink'}
            >
              {t(r.label)}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div role="group" aria-label={t('lang.label')} className="flex overflow-hidden rounded-md border border-line text-xs">
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                lang={l}
                aria-pressed={lang === l}
                onClick={() => setLang(l)}
                className={`px-2 py-1 uppercase ${lang === l ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}
              >
                {l}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
            title={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
            className="rounded-md border border-line p-1.5 text-muted hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {theme === 'dark' ? (
                <>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </>
              ) : (
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              )}
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

export function Panel({ title, children, className = '', aside }: { title: string; children: ReactNode; className?: string; aside?: ReactNode }) {
  return (
    <section aria-label={title} className={`rounded-xl border border-line bg-surface p-4 ${className}`}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
