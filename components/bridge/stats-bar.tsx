"use client"

import { Activity, ArrowLeftRight, Users } from "lucide-react"

export function StatsBar() {
  return (
    <div className="w-full max-w-md mx-auto mt-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-panel rounded-xl px-3 py-3 flex flex-col items-center gap-1">
          <ArrowLeftRight className="w-3.5 h-3.5 text-primary" />
          <span className="text-foreground text-sm font-semibold tabular-nums">12.4K</span>
          <span className="text-muted-foreground text-[10px] tabular-nums uppercase tracking-wider">
            Bridges
          </span>
        </div>
        <div className="glass-panel rounded-xl px-3 py-3 flex flex-col items-center gap-1">
          <Activity className="w-3.5 h-3.5 text-primary" />
          <span className="text-foreground text-sm font-semibold tabular-nums">$2.1M</span>
          <span className="text-muted-foreground text-[10px] tabular-nums uppercase tracking-wider">
            Volume
          </span>
        </div>
        <div className="glass-panel rounded-xl px-3 py-3 flex flex-col items-center gap-1">
          <Users className="w-3.5 h-3.5 text-primary" />
          <span className="text-foreground text-sm font-semibold tabular-nums">3.2K</span>
          <span className="text-muted-foreground text-[10px] tabular-nums uppercase tracking-wider">
            Users
          </span>
        </div>
      </div>
    </div>
  )
}
