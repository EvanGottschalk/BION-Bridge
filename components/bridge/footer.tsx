import { APP_NAME, APP_PARTNERS, FOOTER_LEGAL_LINKS } from '@/config/ui_config';

export function BridgeFooter() {
  return (
    <footer className="mt-8 text-center px-4">
      <p className="text-muted-foreground text-xs">
        Powered by{' '}
        <span className="bg-gradient-to-r from-[#4A6CF7] to-[#C0C8D8] bg-clip-text text-transparent font-semibold">
          {APP_NAME}
        </span>
        {APP_PARTNERS.map((p) => (
          <span key={p}>
            {' '}
            &middot; <span className="text-foreground/60">{p}</span>
          </span>
        ))}
      </p>
      <div className="flex items-center justify-center gap-4 mt-3">
        {FOOTER_LEGAL_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="text-muted-foreground text-[10px] uppercase tracking-wider hover:text-primary transition-colors"
          >
            {link.label}
          </a>
        ))}
      </div>
    </footer>
  );
}
