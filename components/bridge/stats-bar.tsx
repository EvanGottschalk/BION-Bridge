'use client';

import type { ComponentType } from 'react';
import { Activity, ArrowLeftRight, Users } from 'lucide-react';
import { STATS_DISPLAY } from '@/config/ui_config';

type StatKey = 'bridges' | 'volume' | 'users';

type StatDef = {
  key: StatKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const STAT_DEFS: StatDef[] = [
  { key: 'bridges', label: 'Bridges', icon: ArrowLeftRight },
  { key: 'volume', label: 'Volume', icon: Activity },
  { key: 'users', label: 'Users', icon: Users },
];

const renderValue = (key: StatKey): string | null => {
  const cfg = STATS_DISPLAY[key];
  if (cfg.displayMode === 'hidden') return null;
  if (cfg.displayMode === 'string') return cfg.string;
  return null;
};

export function StatsBar() {
  const visible = STAT_DEFS.map((def) => ({ def, value: renderValue(def.key) })).filter(
    (entry): entry is { def: StatDef; value: string } => entry.value !== null
  );

  if (visible.length === 0) return null;

  return (
    <div className="w-full max-w-md mx-auto mt-6">
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}
      >
        {visible.map(({ def, value }) => {
          const Icon = def.icon;
          return (
            <div
              key={def.key}
              className="glass-panel rounded-xl px-3 py-3 flex flex-col items-center gap-1"
            >
              <Icon className="w-3.5 h-3.5 text-primary" />
              <span className="text-foreground text-sm font-semibold tabular-nums">
                {value}
              </span>
              <span className="text-muted-foreground text-[10px] tabular-nums uppercase tracking-wider">
                {def.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
