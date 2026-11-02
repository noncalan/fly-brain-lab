import { Suspense, lazy, useEffect } from 'react';
import { I18nProvider, useI18n, type StringKey } from '../i18n';
import { LabPage } from '../pages/LabPage';
import { IntroDialog } from './IntroDialog';
import { Header, useRoute, type Route } from './shell';

// the lab is the landing page; every other page loads on demand
const AboutPage = lazy(() => import('../pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const ComparePage = lazy(() => import('../pages/ComparePage').then((m) => ({ default: m.ComparePage })));
const CompressPage = lazy(() => import('../pages/CompressPage').then((m) => ({ default: m.CompressPage })));
const ExperimentsPage = lazy(() => import('../pages/ExperimentsPage').then((m) => ({ default: m.ExperimentsPage })));
const LessonsPage = lazy(() => import('../pages/LessonsPage').then((m) => ({ default: m.LessonsPage })));
const ScalePage = lazy(() => import('../pages/ScalePage').then((m) => ({ default: m.ScalePage })));

const SITE = 'https://fly.noncalan.xyz';
const PAGE_TITLE: Record<Route, StringKey> = {
  '/': 'nav.lab',
  '/experiments': 'nav.experiments',
  '/compare': 'nav.compare',
  '/compress': 'nav.compress',
  '/scale': 'nav.scale',
  '/lessons': 'nav.lessons',
  '/about': 'nav.about',
};

/** Title, canonical URL and og:url follow the current page (the static ones in index.html describe the lab). */
function PageHead({ route }: { route: Route }) {
  const { t } = useI18n();
  useEffect(() => {
    const url = `${SITE}${route}`;
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', url);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', url);
    if (route !== '/') document.title = `${t(PAGE_TITLE[route])} — Fly Brain Lab`;
  }, [route, t]);
  return null;
}

function Footer() {
  const { t } = useI18n();
  return <footer className="mx-auto max-w-7xl px-4 pb-8 pt-2 text-xs text-muted">{t('footer.model')}</footer>;
}

export function App() {
  const [route, navigate] = useRoute();
  return (
    <I18nProvider>
      <PageHead route={route} />
      <Header route={route} navigate={navigate} />
      <main id="main">
        <Suspense fallback={<div className="mx-auto h-64 max-w-7xl animate-pulse p-4" />}>
          {route === '/about' && <AboutPage />}
          {route === '/compare' && <ComparePage />}
          {route === '/compress' && <CompressPage />}
          {route === '/scale' && <ScalePage />}
          {route === '/lessons' && <LessonsPage />}
          {route === '/experiments' && <ExperimentsPage open={(query) => navigate('/', query)} />}
        </Suspense>
        {/* keyed by the query so opening another experiment starts a fresh lab */}
        {route === '/' && <LabPage key={window.location.search} />}
      </main>
      <IntroDialog onExperiments={() => navigate('/experiments')} />
      <Footer />
    </I18nProvider>
  );
}
