'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { DOROTHY, FAUCET_COLORS, FAUCET_COPY, FAUCET_TYPEWRITER_MS_PER_CHAR } from '@/config/faucet_config';

interface DorothyDialogueProps {
  line: string;
  reducedMotion: boolean;
}

// Video-game NPC dialogue: Dorothy's portrait beside a box whose text types
// out one character at a time. Tapping the box reveals the full line.
export function DorothyDialogue({ line, reducedMotion }: DorothyDialogueProps) {
  const [shown, setShown] = useState(reducedMotion ? line.length : 0);

  useEffect(() => {
    if (reducedMotion) {
      setShown(line.length);
      return;
    }
    setShown(0);
    const id = window.setInterval(() => {
      setShown((n) => {
        if (n >= line.length) {
          window.clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, FAUCET_TYPEWRITER_MS_PER_CHAR);
    return () => window.clearInterval(id);
  }, [line, reducedMotion]);

  const speaking = shown < line.length;

  return (
    <button
      type="button"
      onClick={() => setShown(line.length)}
      title={speaking ? FAUCET_COPY.skipHint : undefined}
      className="faucet-dialogue w-full text-left flex items-stretch gap-3 sm:gap-4 rounded-2xl p-3 sm:p-4 glass-card cursor-pointer"
      style={{ borderColor: FAUCET_COLORS.panelBorder, background: FAUCET_COLORS.scenePanel }}
    >
      <div className="flex flex-col items-center gap-1.5 shrink-0">
        <div
          className={`faucet-portrait relative w-16 h-16 sm:w-24 sm:h-24 rounded-xl overflow-hidden border ${speaking ? 'is-speaking' : ''}`}
          style={{ borderColor: FAUCET_COLORS.walletEdge, '--faucet-glow': FAUCET_COLORS.energyGlow } as CSSProperties}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={DOROTHY.image.src}
            alt={DOROTHY.name}
            className="w-full h-full object-cover"
            style={{ objectPosition: DOROTHY.portraitFocus, transform: `scale(${DOROTHY.portraitZoom})` }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ boxShadow: `inset 0 0 18px ${FAUCET_COLORS.energySoft}` }}
          />
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-baseline gap-2">
          <span className="text-sm sm:text-base font-semibold" style={{ color: FAUCET_COLORS.energy }}>
            {DOROTHY.name}
          </span>
          <span className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">
            {DOROTHY.title}
          </span>
        </div>
        {/* The full line reserves height so the box doesn't grow while typing. */}
        <p className="relative mt-1 text-sm sm:text-base leading-relaxed text-foreground/90">
          <span className="sr-only" aria-live="polite">
            {line}
          </span>
          <span className="invisible" aria-hidden>
            {line}
          </span>
          <span className="absolute inset-0" aria-hidden>
            {line.slice(0, shown)}
            {speaking && (
              <span className="faucet-caret inline-block w-[0.5ch] ml-px" style={{ background: FAUCET_COLORS.energy }}>
                &nbsp;
              </span>
            )}
          </span>
        </p>
      </div>
    </button>
  );
}
