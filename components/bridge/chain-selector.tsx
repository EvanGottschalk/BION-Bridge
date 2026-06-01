"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, Lock } from "lucide-react"

interface Chain {
  id: string
  name: string
  icon: React.ReactNode
  comingSoon?: boolean
}

const SolanaIcon = () => (
  <svg viewBox="0 0 128 128" className="w-5 h-5" fill="none">
    <circle cx="64" cy="64" r="64" fill="#000" />
    <defs>
      <linearGradient id="sol-a" x1="20" y1="100" x2="108" y2="28" gradientUnits="userSpaceOnUse">
        <stop stopColor="#9945FF" />
        <stop offset="0.5" stopColor="#14F195" />
        <stop offset="1" stopColor="#00C2FF" />
      </linearGradient>
    </defs>
    <path
      d="M36.3 85.1a2.1 2.1 0 011.5-.6h56.9c.9 0 1.4 1.1.7 1.8l-11 11a2.1 2.1 0 01-1.5.6H26a1 1 0 01-.7-1.8l11-11zM36.3 31.7a2.1 2.1 0 011.5-.6h56.9c.9 0 1.4 1.1.7 1.8l-11 11a2.1 2.1 0 01-1.5.6H26a1 1 0 01-.7-1.8l11-11zM83.9 58.2a2.1 2.1 0 00-1.5-.6H25.5a1 1 0 00-.7 1.8l11 11c.4.4.9.6 1.5.6H94a1 1 0 00.7-1.8l-10.8-11z"
      fill="url(#sol-a)"
    />
  </svg>
)

const BaseIcon = () => (
  <svg viewBox="0 0 128 128" className="w-5 h-5" fill="none">
    <circle cx="64" cy="64" r="64" fill="#0052FF" />
    <path
      d="M64.1 108C39.8 108 20 88.1 20 63.9 20 39.6 39.8 20 64.1 20c22.4 0 41 16.7 43.8 38.3H72.6c-2.5-10.8-12.2-18.8-23.7-18.8C35.4 39.5 24.7 50.7 24.7 64s10.7 24.5 24.2 24.5c11.5 0 21.2-8 23.7-18.8h35.3C105.1 91.3 86.5 108 64.1 108z"
      fill="#fff"
    />
  </svg>
)

const PolygonIcon = () => (
  <svg viewBox="0 0 128 128" className="w-5 h-5" fill="none">
    <circle cx="64" cy="64" r="64" fill="#8247E5" />
    <path
      d="M84.2 50.9c-1.7-1-3.9-1-5.6 0L66.9 58l-8 4.5-11.6 7.1c-1.7 1-3.9 1-5.6 0l-9.2-5.4c-1.7-1-2.8-2.9-2.8-4.9V49c0-2 1-3.8 2.8-4.9l9.1-5.2c1.7-1 3.9-1 5.6 0l9.1 5.2c1.7 1 2.8 2.9 2.8 4.9v7.1l8-4.6V44c0-2-1-3.8-2.8-4.9l-17-9.8c-1.7-1-3.9-1-5.6 0l-17.3 10c-1.7 1-2.8 2.9-2.8 4.8v19.7c0 2 1 3.8 2.8 4.9l17.1 9.8c1.7 1 3.9 1 5.6 0l11.6-6.9 8-4.6 11.6-6.9c1.7-1 3.9-1 5.6 0l9.1 5.2c1.7 1 2.8 2.9 2.8 4.9v10.3c0 2-1 3.8-2.8 4.9l-9 5.3c-1.7 1-3.9 1-5.6 0l-9.1-5.2c-1.7-1-2.8-2.9-2.8-4.9v-7l-8 4.6v7.2c0 2 1 3.8 2.8 4.9l17.1 9.8c1.7 1 3.9 1 5.6 0l17.1-9.8c1.7-1 2.8-2.9 2.8-4.9V60.3c0-2-1-3.8-2.8-4.9l-17.2-9.5z"
      fill="#fff"
    />
  </svg>
)

const chains: Chain[] = [
  { id: "solana", name: "Solana", icon: <SolanaIcon /> },
  { id: "base", name: "Base", icon: <BaseIcon /> },
  { id: "polygon", name: "Polygon", icon: <PolygonIcon />, comingSoon: true },
]

interface ChainSelectorProps {
  label: string
  selectedChain: string
  onSelect: (chainId: string) => void
  excludeChain?: string
}

export function ChainSelector({ label, selectedChain, onSelect, excludeChain }: ChainSelectorProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const selected = chains.find((c) => c.id === selectedChain)

  return (
    <div className="flex flex-col gap-2" ref={ref}>
      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
        {label}
      </span>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between gap-3 bg-[#0c0e1e] rounded-lg px-4 py-3 border border-white/15 hover:border-white/30 transition-all duration-200 cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            {selected?.icon}
            <span className="text-foreground font-medium">{selected?.name}</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#0c0e1e] rounded-lg overflow-hidden z-50 border border-white/15 shadow-xl shadow-black/40 animate-in fade-in slide-in-from-top-2 duration-200">
            {chains.map((chain) => {
              const isExcluded = chain.id === excludeChain
              const isComingSoon = chain.comingSoon
              const isDisabled = isExcluded || isComingSoon

              return (
                <button
                  key={chain.id}
                  onClick={() => {
                    if (!isDisabled) {
                      onSelect(chain.id)
                      setOpen(false)
                    }
                  }}
                  disabled={isDisabled}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 transition-colors cursor-pointer ${
                    isDisabled
                      ? "opacity-40 cursor-not-allowed"
                      : chain.id === selectedChain
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-white/5 text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {chain.icon}
                    <span className="font-medium">{chain.name}</span>
                  </div>
                  {isComingSoon && (
                    <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      <Lock className="w-3 h-3" />
                      Coming Soon
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
