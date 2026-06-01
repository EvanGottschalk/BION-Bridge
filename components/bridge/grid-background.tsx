"use client"

export function GridBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(74,108,247,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(74,108,247,0.5) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Radial glow - blue */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[900px] h-[900px] rounded-full opacity-[0.08]"
        style={{
          background: "radial-gradient(circle, #4A6CF7 0%, transparent 65%)",
        }}
      />

      {/* Silver ambient bottom */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04]"
        style={{
          background: "radial-gradient(circle, #C0C8D8 0%, transparent 70%)",
        }}
      />

      {/* Side accent glow */}
      <div
        className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full opacity-[0.03]"
        style={{
          background: "radial-gradient(circle, #8B9FFF 0%, transparent 70%)",
        }}
      />

      {/* Scanning line effect */}
      <div className="absolute inset-0">
        <div
          className="absolute w-full h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-scan"
          style={{ animationDuration: "8s" }}
        />
      </div>
    </div>
  )
}
