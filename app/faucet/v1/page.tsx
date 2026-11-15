import type { Metadata } from 'next';
import { BridgeHeader } from '@/components/bridge/header';
import { BridgeFooter } from '@/components/bridge/footer';
import { CyberForestBackground } from '@/components/faucet/v1/cyber-forest-background';
import { FaucetCard } from '@/components/faucet/v1/faucet-card';
import { FAUCET_COLORS, FAUCET_COPY, FAUCET_PAGE_META } from '@/config/faucet_config';
import { APP_TITLE } from '@/config/ui_config';

export const metadata: Metadata = {
  title: `${FAUCET_PAGE_META.title} — ${APP_TITLE}`,
  description: FAUCET_PAGE_META.description,
};

export default function FaucetV1Page() {
  return (
    <div className="min-h-screen text-foreground flex flex-col">
      <CyberForestBackground />
      <BridgeHeader />

      <main className="flex-1 flex flex-col items-center px-4 py-4 sm:py-6 relative z-10">
        <div className="mb-4 sm:mb-6 text-center">
          <h1
            className="text-3xl sm:text-4xl font-bold tracking-tight bg-clip-text text-transparent"
            style={{
              backgroundImage: `linear-gradient(90deg, ${FAUCET_COLORS.energy}, ${FAUCET_COLORS.energyDeep})`,
            }}
          >
            {FAUCET_COPY.heading}
          </h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto text-pretty">
            {FAUCET_COPY.subheading}
          </p>
        </div>

        <FaucetCard />
        <BridgeFooter />
      </main>
    </div>
  );
}
