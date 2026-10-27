import { I18nProvider, useI18n } from '../i18n';
import { AboutPage } from '../pages/AboutPage';
import { ComparePage } from '../pages/ComparePage';
import { ExperimentsPage } from '../pages/ExperimentsPage';
import { LabPage } from '../pages/LabPage';
import { IntroDialog } from './IntroDialog';
import { Header, useRoute } from './shell';

function Footer() {
  const { t } = useI18n();
  return <footer className="mx-auto max-w-7xl px-4 pb-8 pt-2 text-xs text-muted">{t('footer.model')}</footer>;
}

export function App() {
  const [route, navigate] = useRoute();
  return (
    <I18nProvider>
      <Header route={route} navigate={navigate} />
      <main id="main">
        {route === '/about' && <AboutPage />}
        {route === '/compare' && <ComparePage />}
        {route === '/experiments' && <ExperimentsPage open={(query) => navigate('/', query)} />}
        {/* keyed by the query so opening another experiment starts a fresh lab */}
        {route === '/' && <LabPage key={window.location.search} />}
      </main>
      <IntroDialog onExperiments={() => navigate('/experiments')} />
      <Footer />
    </I18nProvider>
  );
}
