export function BridgeFooter() {
  return (
    <footer className="mt-8 text-center">
      <p className="text-muted-foreground text-xs">
        Powered by{" "}
        <span className="bg-gradient-to-r from-[#4A6CF7] to-[#C0C8D8] bg-clip-text text-transparent font-semibold">AEX</span>
        {" "}&middot;{" "}
        <span className="text-foreground/60">Bion DAO</span>
        {" "}&middot;{" "}
        <span className="text-foreground/60">Bion Foundation</span>
      </p>
      <div className="flex items-center justify-center gap-4 mt-3">
        <a href="#" className="text-muted-foreground text-[10px] uppercase tracking-wider hover:text-primary transition-colors">
          Terms
        </a>
        <a href="#" className="text-muted-foreground text-[10px] uppercase tracking-wider hover:text-primary transition-colors">
          Privacy
        </a>
        <a href="#" className="text-muted-foreground text-[10px] uppercase tracking-wider hover:text-primary transition-colors">
          Audit
        </a>
      </div>
    </footer>
  )
}
