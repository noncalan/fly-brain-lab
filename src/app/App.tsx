import { I18nProvider, useI18n } from '../i18n';
import { AboutPage } from '../pages/AboutPage';
import { LabPage } from '../pages/LabPage';
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
      <main id="main">{route === '/about' ? <AboutPage /> : <LabPage />}</main>
      <Footer />
    </I18nProvider>
  );
}
