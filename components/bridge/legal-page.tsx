import { BridgeHeader } from '@/components/bridge/header';
import { GridBackground } from '@/components/bridge/grid-background';
import { BridgeFooter } from '@/components/bridge/footer';
import type { LegalPageContent } from '@/config/legal_config';
import { LEGAL_PAGE_LAST_UPDATED_LABEL } from '@/config/ui_config';

export function LegalPage({ content }: { content: LegalPageContent }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <GridBackground />
      <BridgeHeader />

      <main className="flex-1 px-4 py-10 sm:py-16 relative z-10">
        <article className="mx-auto w-full max-w-3xl">
          <header className="mb-8 sm:mb-10">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight bg-gradient-to-r from-[#4A6CF7] to-[#C0C8D8] bg-clip-text text-transparent">
              {content.title}
            </h1>
            <p className="text-muted-foreground text-xs mt-2 uppercase tracking-wider">
              {LEGAL_PAGE_LAST_UPDATED_LABEL}: {content.lastUpdated}
            </p>
            <p className="text-foreground/80 text-sm sm:text-base leading-relaxed mt-5 text-pretty">
              {content.intro}
            </p>
          </header>

          <div className="space-y-8">
            {content.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-3">
                  {section.heading}
                </h2>
                <div className="space-y-3">
                  {section.paragraphs.map((p, i) => (
                    <p
                      key={i}
                      className="text-foreground/75 text-sm sm:text-base leading-relaxed text-pretty"
                    >
                      {p}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-12">
            <BridgeFooter />
          </div>
        </article>
      </main>
    </div>
  );
}
