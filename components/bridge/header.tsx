'use client';

import { ConnectButton } from './connect-button';
import { NAV_LINKS } from '@/config/ui_config';

export function BridgeHeader() {
  const links = NAV_LINKS.filter((l) => l.label.trim().length > 0);
  return (
    <header className="flex items-center justify-end px-4 sm:px-6 py-4 relative z-20">
      {links.length > 0 && (
        <nav className="hidden md:flex items-center gap-6 mr-6">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target={link.href.startsWith('http') ? '_blank' : undefined}
              rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="text-muted-foreground text-sm hover:text-primary transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
      <ConnectButton />
    </header>
  );
}
