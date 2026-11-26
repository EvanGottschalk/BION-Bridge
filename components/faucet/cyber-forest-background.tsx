import { FAUCET_COLORS, FAUCET_FOREST } from '@/config/faucet_config';

// Fixed, full-viewport cyber forest: circuit-trace trees, pulsing nodes and
// drifting data motes. Generated from a seed so server and client render the
// same markup.

const VIEW_W = 1600;
const VIEW_H = 900;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Tree {
  trunk: string;
  branches: string[];
  nodes: { x: number; y: number; r: number; delay: number }[];
  width: number;
}

function buildTrees(rand: () => number, count: number, minH: number, maxH: number, scale: number): Tree[] {
  const trees: Tree[] = [];
  const slot = VIEW_W / count;
  for (let i = 0; i < count; i++) {
    const x = slot * i + slot * (0.2 + rand() * 0.6);
    const h = minH + rand() * (maxH - minH);
    const top = VIEW_H - h;
    const trunk = `M ${x} ${VIEW_H} L ${x} ${top}`;
    const branches: string[] = [];
    const nodes: Tree['nodes'] = [{ x, y: top, r: 3.5 * scale, delay: rand() * 4 }];
    const levels = 3 + Math.floor(rand() * 4);
    for (let j = 0; j < levels; j++) {
      const by = top + (h * 0.75 * (j + 0.4)) / levels;
      const dir = (j + i) % 2 === 0 ? 1 : -1;
      const diag = (18 + rand() * 30) * scale;
      const run = (20 + rand() * 60) * scale;
      const ex = x + dir * (diag + run);
      const ey = by - diag;
      branches.push(`M ${x} ${by} L ${x + dir * diag} ${ey} L ${ex} ${ey}`);
      nodes.push({ x: ex, y: ey, r: (2 + rand() * 2) * scale, delay: rand() * 4 });
    }
    trees.push({ trunk, branches, nodes, width: 2.5 * scale });
  }
  return trees;
}

const rand = mulberry32(FAUCET_FOREST.seed);
const FAR_TREES = buildTrees(rand, FAUCET_FOREST.treesFar, 260, 560, 0.8);
const NEAR_TREES = buildTrees(rand, FAUCET_FOREST.treesNear, 420, 780, 1.3);
const MOTES = Array.from({ length: FAUCET_FOREST.motes }, () => ({
  left: rand() * 100,
  top: 30 + rand() * 70,
  size: 1.5 + rand() * 2.5,
  duration: 9 + rand() * 10,
  delay: -rand() * 18,
}));

function TreeLayer({ trees, color, nodeOpacity }: { trees: Tree[]; color: string; nodeOpacity: number }) {
  return (
    <g>
      {trees.map((t, i) => (
        <g key={i}>
          <path d={t.trunk} stroke={color} strokeWidth={t.width * 3} strokeLinecap="round" fill="none" />
          {t.branches.map((b, j) => (
            <path key={j} d={b} stroke={color} strokeWidth={t.width} strokeLinejoin="round" fill="none" />
          ))}
          {t.nodes.map((n, j) => (
            <circle
              key={j}
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill={FAUCET_COLORS.node}
              opacity={nodeOpacity}
              className="faucet-node"
              style={{ animationDelay: `${n.delay}s` }}
            />
          ))}
        </g>
      ))}
    </g>
  );
}

export function CyberForestBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ background: `linear-gradient(180deg, ${FAUCET_COLORS.skyTop} 0%, ${FAUCET_COLORS.skyBottom} 100%)` }}
    >
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <radialGradient id="faucet-forest-glow" cx="50%" cy="55%" r="45%">
            <stop offset="0%" stopColor={FAUCET_COLORS.energySoft} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <linearGradient id="faucet-forest-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="100%" stopColor={FAUCET_COLORS.ground} />
          </linearGradient>
        </defs>

        <rect width={VIEW_W} height={VIEW_H} fill="url(#faucet-forest-glow)" />

        <g opacity={0.55}>
          <TreeLayer trees={FAR_TREES} color={FAUCET_COLORS.treeFar} nodeOpacity={0.35} />
          {FAR_TREES.map((t, i) => (
            <path key={i} d={t.trunk} stroke={FAUCET_COLORS.circuitDim} strokeWidth={1} fill="none" />
          ))}
        </g>

        <g>
          <TreeLayer trees={NEAR_TREES} color={FAUCET_COLORS.treeNear} nodeOpacity={0.8} />
          {NEAR_TREES.map((t, i) => (
            <g key={i}>
              <path d={t.trunk} stroke={FAUCET_COLORS.circuit} strokeWidth={1.2} fill="none" className="faucet-trace" />
              {t.branches.map((b, j) => (
                <path key={j} d={b} stroke={FAUCET_COLORS.circuit} strokeWidth={1} fill="none" />
              ))}
            </g>
          ))}
        </g>

        <rect y={VIEW_H * 0.7} width={VIEW_W} height={VIEW_H * 0.3} fill="url(#faucet-forest-ground)" />
      </svg>

      {MOTES.map((m, i) => (
        <span
          key={i}
          className="faucet-mote absolute rounded-full"
          style={{
            left: `${m.left}%`,
            top: `${m.top}%`,
            width: m.size,
            height: m.size,
            background: FAUCET_COLORS.mote,
            boxShadow: `0 0 ${m.size * 4}px ${FAUCET_COLORS.energyGlow}`,
            animationDuration: `${m.duration}s`,
            animationDelay: `${m.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
