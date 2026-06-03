import type { Metadata } from 'next';
import { LegalPage } from '@/components/bridge/legal-page';
import { TERMS_PAGE } from '@/config/legal_config';
import { APP_TITLE } from '@/config/ui_config';

export const metadata: Metadata = {
  title: `${TERMS_PAGE.title} — ${APP_TITLE}`,
  description: TERMS_PAGE.intro,
};

export default function TermsPage() {
  return <LegalPage content={TERMS_PAGE} />;
}
