import Link from 'next/link';
import { APP_NAME, APP_LINK, APP_PARTNERS, FOOTER_LEGAL_LINKS } from '@/config/ui_config';

export function BridgeFooter() {
  const legalLinks = FOOTER_LEGAL_LINKS.filter((l) => l.label.trim().length > 0);
  const isExternal = (href: string) => /^(https?:)?\/\//.test(href) || href.startsWith('mailto:');

  return (
    <footer className="mt-8 text-center px-4">
      <p className="text-muted-foreground text-xs">
        Powered by{' '}
        <a
          href={APP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gradient-to-r from-[#4A6CF7] to-[#C0C8D8] bg-clip-text text-transparent font-semibold hover:opacity-80 transition-opacity"
        >
          {APP_NAME}
        </a>
        {APP_PARTNERS.map((p) => (
          <span key={p.label}>
            {' '}
            &middot;{' '}
            <a
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/60 hover:text-foreground transition-colors"
            >
              {p.label}
            </a>
          </span>
        ))}
      </p>
      {legalLinks.length > 0 && (
        <div className="flex items-center justify-center gap-4 mt-3">
          {legalLinks.map((link) =>
            isExternal(link.href) ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground text-[10px] uppercase tracking-wider hover:text-primary transition-colors"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.label}
                href={link.href}
                className="text-muted-foreground text-[10px] uppercase tracking-wider hover:text-primary transition-colors"
              >
                {link.label}
              </Link>
            )
          )}
        </div>
      )}
    </footer>
  );
}
