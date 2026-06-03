import type { Metadata } from 'next';
import { LegalPage } from '@/components/bridge/legal-page';
import { PRIVACY_PAGE } from '@/config/legal_config';
import { APP_TITLE } from '@/config/ui_config';

export const metadata: Metadata = {
  title: `${PRIVACY_PAGE.title} — ${APP_TITLE}`,
  description: PRIVACY_PAGE.intro,
};

export default function PrivacyPage() {
  return <LegalPage content={PRIVACY_PAGE} />;
}
