'use client';

import { useEffect, useMemo, useState } from 'react';
import { ICON_SIZES_PX, TOKEN_ICON_URL, TOKEN_ICON_LOGO_DEV_URL } from '@/config/ui_config';

type Source = 'local' | 'logodev' | 'remote' | 'placeholder';

interface TokenIconProps {
  symbol: string;
  logoURI?: string;
  size?: number; // CSS pixels; callers pass a value from ICON_SIZES_PX
  className?: string;
}

const defaultClass = 'rounded-full bg-white/10 shrink-0';

export function TokenIcon({ symbol, logoURI, size = ICON_SIZES_PX.dropdownToken, className }: TokenIconProps) {
  const style = { width: size, height: size };
  const logoDevUrl = useMemo(() => TOKEN_ICON_LOGO_DEV_URL(symbol), [symbol]);

  // Order of attempts: local file ⇒ logo.dev ⇒ Relay-supplied logoURI ⇒
  // placeholder circle. Skip tiers whose URL is unavailable.
  const order = useMemo<Source[]>(() => {
    const tiers: Source[] = ['local'];
    if (logoDevUrl) tiers.push('logodev');
    if (logoURI) tiers.push('remote');
    tiers.push('placeholder');
    return tiers;
  }, [logoDevUrl, logoURI]);

  const [tierIndex, setTierIndex] = useState(0);

  useEffect(() => {
    setTierIndex(0);
  }, [symbol, logoURI, logoDevUrl]);

  const source = order[Math.min(tierIndex, order.length - 1)];
  const cls = `${defaultClass} ${className ?? ''}`.trim();

  if (source === 'placeholder') {
    return (
      <div
        style={style}
        className={`${cls} flex items-center justify-center text-[10px] font-semibold uppercase text-foreground/70`}
      >
        {symbol.slice(0, 3)}
      </div>
    );
  }

  const src =
    source === 'local'
      ? TOKEN_ICON_URL(symbol)
      : source === 'logodev'
        ? (logoDevUrl as string)
        : (logoURI as string);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={symbol}
      width={size}
      height={size}
      style={style}
      loading="lazy"
      className={`${cls} object-cover`}
      onError={() => setTierIndex((i) => Math.min(i + 1, order.length - 1))}
    />
  );
}
