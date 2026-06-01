import { BridgeHeader } from "@/components/bridge/header"
import { BridgeCard } from "@/components/bridge/bridge-card"
import { GridBackground } from "@/components/bridge/grid-background"
import { StatsBar } from "@/components/bridge/stats-bar"
import { BridgeFooter } from "@/components/bridge/footer"

const BRIDGE_LOGO = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/a9f1d408-e45b-45f7-b6b8-2ad075c052c3_r-pgxvhoPUPBXjXE407UUVaHfcYcAIeQ.png"

export default function BridgePage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <GridBackground />
      <BridgeHeader />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 relative z-10">
        {/* Centered Logo */}
        <div className="mb-6 flex flex-col items-center">
          <img
            src={BRIDGE_LOGO}
            alt="AEX Bridge Logo"
            className="w-40 h-auto md:w-52 drop-shadow-[0_0_30px_rgba(74,108,247,0.3)]"
          />
          <p className="text-muted-foreground text-sm mt-3 max-w-md mx-auto text-center text-pretty">
            Seamlessly transfer BION tokens between supported networks with lightning speed and minimal fees.
          </p>
        </div>

        <BridgeCard />
        <StatsBar />
        <BridgeFooter />
      </main>
    </div>
  )
}
