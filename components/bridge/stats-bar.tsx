'use client';

import { Activity, ArrowLeftRight, Users } from 'lucide-react';
import { STATS_PLACEHOLDERS } from '@/config/ui_config';

// Placeholder figures — real values require an indexer or /requests/v2 aggregation
// that is out of scope for the initial Relay integration.
export function StatsBar() {
  return (
    <div className="w-full max-w-md mx-auto mt-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-panel rounded-xl px-3 py-3 flex flex-col items-center gap-1">
          <ArrowLeftRight className="w-3.5 h-3.5 text-primary" />
          <span className="text-foreground text-sm font-semibold tabular-nums">
            {STATS_PLACEHOLDERS.bridges}
          </span>
          <span className="text-muted-foreground text-[10px] tabular-nums uppercase tracking-wider">
            Bridges
          </span>
        </div>
        <div className="glass-panel rounded-xl px-3 py-3 flex flex-col items-center gap-1">
          <Activity className="w-3.5 h-3.5 text-primary" />
          <span className="text-foreground text-sm font-semibold tabular-nums">
            {STATS_PLACEHOLDERS.volume}
          </span>
          <span className="text-muted-foreground text-[10px] tabular-nums uppercase tracking-wider">
            Volume
          </span>
        </div>
        <div className="glass-panel rounded-xl px-3 py-3 flex flex-col items-center gap-1">
          <Users className="w-3.5 h-3.5 text-primary" />
          <span className="text-foreground text-sm font-semibold tabular-nums">
            {STATS_PLACEHOLDERS.users}
          </span>
          <span className="text-muted-foreground text-[10px] tabular-nums uppercase tracking-wider">
            Users
          </span>
        </div>
      </div>
    </div>
  );
}
