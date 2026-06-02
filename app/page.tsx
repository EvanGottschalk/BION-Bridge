import { BridgeHeader } from '@/components/bridge/header';
import { BridgeCard } from '@/components/bridge/bridge-card';
import { GridBackground } from '@/components/bridge/grid-background';
import { StatsBar } from '@/components/bridge/stats-bar';
import { BridgeFooter } from '@/components/bridge/footer';
import { BRIDGE_HERO_COPY, BRIDGE_LOGO_URL } from '@/config/ui_config';

export default function BridgePage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <GridBackground />
      <BridgeHeader />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 relative z-10">
        <div className="mb-6 flex flex-col items-center">
          <img
            src={BRIDGE_LOGO_URL}
            alt="AEX Bridge Logo"
            className="w-40 h-auto md:w-52 drop-shadow-[0_0_30px_rgba(74,108,247,0.3)]"
          />
          <p className="text-muted-foreground text-sm mt-3 max-w-md mx-auto text-center text-pretty">
            {BRIDGE_HERO_COPY}
          </p>
        </div>

        <BridgeCard />
        <StatsBar />
        <BridgeFooter />
      </main>
    </div>
  );
}
