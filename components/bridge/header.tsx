'use client';

import Link from 'next/link';
import { ConnectButton } from './connect-button';
import { APP_NAME, LOGO_IMAGE, NAV_LINKS } from '@/config/ui_config';

const isExternal = (href: string) => /^(https?:)?\/\//.test(href) || href.startsWith('mailto:');

export function BridgeHeader() {
  const links = NAV_LINKS.filter((l) => l.label.trim().length > 0);

  const logoPadding = {
    paddingLeft: LOGO_IMAGE.paddingLeft,
    paddingTop: LOGO_IMAGE.paddingTop,
    paddingRight: LOGO_IMAGE.paddingRight,
    paddingBottom: LOGO_IMAGE.paddingBottom,
  };
  const logoImg = (
    <img
      src={LOGO_IMAGE.asset.src}
      alt={`${APP_NAME} logo`}
      width={LOGO_IMAGE.size}
      height={LOGO_IMAGE.size}
      style={{ width: LOGO_IMAGE.size, height: 'auto' }}
      className="block"
    />
  );
  const logoClassName = 'inline-flex items-center shrink-0 hover:opacity-80 transition-opacity';
  const logoAriaLabel = `${APP_NAME} home`;

  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-4 relative z-20">
      {isExternal(LOGO_IMAGE.href) ? (
        <a
          href={LOGO_IMAGE.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={logoAriaLabel}
          className={logoClassName}
          style={logoPadding}
        >
          {logoImg}
        </a>
      ) : (
        <Link
          href={LOGO_IMAGE.href}
          aria-label={logoAriaLabel}
          className={logoClassName}
          style={logoPadding}
        >
          {logoImg}
        </Link>
      )}

      <div className="flex items-center">
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
      </div>
    </header>
  );
}
