"use client"

import { useState } from "react"
import { ArrowRight, Loader2, Zap, Shield, Clock } from "lucide-react"
import { ChainSelector } from "./chain-selector"

const BION_LOGO = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/bion_blackcircuit_upscale_2000px-c7eJVyhWUSwAaONEqpRETh3K1guQgX.avif"

export function BridgeCard() {
  const [fromChain, setFromChain] = useState("solana")
  const [toChain, setToChain] = useState("base")
  const [amount, setAmount] = useState("")
  const [isBridging, setIsBridging] = useState(false)

  const handleSwapChains = () => {
    if (toChain === "polygon") return
    const temp = fromChain
    setFromChain(toChain)
    setToChain(temp)
  }

  const handleFromSelect = (chainId: string) => {
    if (chainId === toChain) {
      setToChain(fromChain)
    }
    setFromChain(chainId)
  }

  const handleToSelect = (chainId: string) => {
    if (chainId === fromChain) {
      setFromChain(toChain)
    }
    setToChain(chainId)
  }

  const handleBridge = () => {
    if (!amount || parseFloat(amount) <= 0) return
    setIsBridging(true)
    setTimeout(() => setIsBridging(false), 3000)
  }

  const estimatedReceive = amount ? (parseFloat(amount) * 0.998).toFixed(4) : "0.0000"

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Main Bridge Card */}
      <div className="relative glass-card rounded-2xl overflow-hidden">
        {/* Blue glow top accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-px bg-primary shadow-[0_0_30px_8px_rgba(74,108,247,0.25)]" />

        <div className="p-6">
          {/* Title */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-foreground text-lg font-semibold">Bridge</h2>
              <div className="px-2 py-0.5 glass-panel rounded-md text-primary text-[10px] font-medium uppercase tracking-wider">
                Live
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Operational
            </div>
          </div>

          {/* Horizontal From / Swap / To layout */}
          <div className="flex flex-col md:flex-row items-stretch gap-3">
            {/* From Section */}
            <div className="flex-1 glass-panel rounded-xl p-4">
              <ChainSelector
                label="From"
                selectedChain={fromChain}
                onSelect={handleFromSelect}
                excludeChain={undefined}
              />
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Amount
                  </span>
                  <button
                    className="text-xs text-primary hover:text-[#8B9FFF] font-medium cursor-pointer transition-colors"
                    onClick={() => setAmount("1000")}
                  >
                    MAX
                  </button>
                </div>
                <div className="flex items-center gap-3 glass-inner rounded-lg px-4 py-3 focus-within:border-primary/40 transition-colors">
                  <img
                    src={BION_LOGO}
                    alt="BION Token"
                    className="w-6 h-6 rounded-full"
                  />
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="flex-1 bg-transparent text-foreground text-lg font-medium outline-none placeholder:text-muted-foreground/40 min-w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-sm text-muted-foreground font-medium">BION</span>
                </div>
              </div>
            </div>

            {/* Swap Button - centered between panels */}
            <div className="flex items-center justify-center md:self-center">
              <button
                onClick={handleSwapChains}
                className="w-10 h-10 rounded-xl glass-card border border-white/10 flex items-center justify-center hover:border-primary/50 transition-all duration-200 cursor-pointer group"
              >
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors md:rotate-0 rotate-90" />
              </button>
            </div>

            {/* To Section */}
            <div className="flex-1 glass-panel rounded-xl p-4">
              <ChainSelector
                label="To"
                selectedChain={toChain}
                onSelect={handleToSelect}
                excludeChain={undefined}
              />
              <div className="mt-4">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block mb-2">
                  You Receive
                </span>
                <div className="flex items-center gap-3 glass-inner rounded-lg px-4 py-3">
                  <img
                    src={BION_LOGO}
                    alt="BION Token"
                    className="w-6 h-6 rounded-full"
                  />
                  <span className="flex-1 text-foreground text-lg font-medium">
                    {estimatedReceive}
                  </span>
                  <span className="text-sm text-muted-foreground font-medium">BION</span>
                </div>
              </div>
            </div>
          </div>

          {/* Info Strip */}
          <div className="flex items-center justify-between mt-5 px-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-primary" />
                <span className="font-medium">0.2% fee</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-primary" />
                <span className="font-medium">~2 min</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-primary" />
              <span className="font-medium">Secured</span>
            </div>
          </div>

          {/* Bridge Button */}
          <button
            onClick={handleBridge}
            disabled={isBridging || !amount || parseFloat(amount) <= 0}
            className="w-full mt-5 py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 glass-button text-white hover:shadow-[0_0_40px_rgba(74,108,247,0.35)] active:scale-[0.98]"
          >
            {isBridging ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Bridging...
              </span>
            ) : (
              "Bridge BION"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
