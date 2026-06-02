'use client';

import { ConnectButton } from './connect-button';
import { NAV_LINKS } from '@/config/ui_config';

export function BridgeHeader() {
  return (
    <header className="flex items-center justify-end px-4 sm:px-6 py-4 relative z-20">
      <nav className="hidden md:flex items-center gap-6 mr-6">
        {NAV_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="text-muted-foreground text-sm hover:text-primary transition-colors"
          >
            {link.label}
          </a>
        ))}
      </nav>
      <ConnectButton />
    </header>
  );
}
