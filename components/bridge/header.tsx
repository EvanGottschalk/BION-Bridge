"use client"

import { useState } from "react"
import { Wallet } from "lucide-react"

export function BridgeHeader() {
  const [walletConnected, setWalletConnected] = useState(false)

  return (
    <header className="flex items-center justify-end px-6 py-4 relative z-20">
      <nav className="hidden md:flex items-center gap-6 mr-6">
        <a href="#" className="text-muted-foreground text-sm hover:text-primary transition-colors">
          Bridge
        </a>
        <a href="#" className="text-muted-foreground text-sm hover:text-primary transition-colors">
          Explorer
        </a>
        <a href="#" className="text-muted-foreground text-sm hover:text-primary transition-colors">
          Docs
        </a>
      </nav>

      <button
        onClick={() => setWalletConnected(!walletConnected)}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 cursor-pointer ${
          walletConnected
            ? "glass-panel text-primary border border-primary/30"
            : "glass-button text-white shadow-[0_0_25px_rgba(74,108,247,0.25)]"
        }`}
      >
        <Wallet className="w-4 h-4" />
        {walletConnected ? "0x7f...3a4b" : "Connect Wallet"}
      </button>
    </header>
  )
}
