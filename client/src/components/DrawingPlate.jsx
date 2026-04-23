// SVG recreation of the sample bathroom vanity redlined drawing
const LOCS = {
  'MK-001': [380, 110, 520, 40],
  'MK-002': [360, 90, 560, 80],
  'MK-003': [95, 150, 20, 180],
  'MK-004': [560, 145, 70, 26],
  'MK-005': [[420, 225], [630, 225], [820, 225]],
  'MK-006': [380, 240, 180, 150],
  'MK-007': [270, 320, 120, 22],
  'MK-008': [760, 240, 180, 150],
  'MK-009': [200, 540, 90, 22],
  'MK-010': [380, 450, 180, 150],
  'MK-011': [760, 450, 180, 150],
  'MK-012': [330, 640, 30, 30],
  'MK-013': [410, 680, 30, 16],
  'MK-014': [490, 680, 34, 16],
  'MK-015': [610, 680, 30, 16],
  'MK-016': [740, 680, 30, 16],
  'MK-017': [830, 640, 30, 30],
  'MK-018': [220, 720, 180, 22],
  'MK-019': [220, 745, 180, 22],
}

export default function DrawingPlate({ selectedId }) {
  const sel = LOCS[selectedId]
  return (
    <div className="relative w-full h-full flex items-center justify-center p-8">
      <div className="relative bg-[#fafaf8] rounded-[2px] shadow-[0_30px_120px_-30px_rgba(0,0,0,0.9)] max-w-[920px] w-full aspect-[12/8.2] overflow-hidden">
        <svg viewBox="0 0 1200 820" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
          {/* base drawing */}
          <g stroke="#1a1a1e" strokeWidth="1" fill="none">
            <rect x="50" y="50" width="1100" height="720" stroke="#d4d4d0" strokeWidth="1.5"/>
            <line x1="50" y1="760" x2="1150" y2="760" stroke="#1a1a1e" strokeWidth="1.2"/>
            <text x="70" y="775" fontFamily="JetBrains Mono" fontSize="11" fill="#1a1a1e" letterSpacing="1">
              BATH 01 — E   ·   SCALE 3/8&quot;=1&apos;-0&quot;   ·   SHEET 3
            </text>
            <path d="M 160 130 L 1040 130" stroke="#1a1a1e" strokeWidth="1.5"/>
            <path d="M 160 620 L 1040 620" stroke="#1a1a1e" strokeWidth="1.5"/>
            <path d="M 160 130 L 160 620" strokeWidth="1.2"/>
            <path d="M 1040 130 L 1040 620" strokeWidth="1.2"/>
            <path d="M 575 150 L 575 620 M 645 150 L 645 620 M 575 180 L 645 180 M 575 600 L 645 600 M 610 150 L 610 600" strokeWidth="1"/>
            <circle cx="610" cy="380" r="14" strokeWidth="1"/>
            <text x="604" y="385" fontFamily="JetBrains Mono" fontSize="14" fill="#1a1a1e">20</text>
            <rect x="200" y="180" width="340" height="220" strokeWidth="1.2"/>
            <rect x="210" y="190" width="320" height="200" strokeWidth="0.8"/>
            <rect x="680" y="180" width="340" height="220" strokeWidth="1.2"/>
            <rect x="690" y="190" width="320" height="200" strokeWidth="0.8"/>
            <g strokeWidth="1">
              <rect x="200" y="430" width="340" height="180"/>
              <rect x="210" y="440" width="100" height="160"/>
              <rect x="320" y="440" width="110" height="160"/>
              <rect x="440" y="440" width="90" height="160"/>
              <text x="238" y="540" fontFamily="JetBrains Mono" fontSize="9" fill="#1a1a1e">FIXED</text>
              <text x="348" y="540" fontFamily="JetBrains Mono" fontSize="9" fill="#1a1a1e">FIXED</text>
              <text x="464" y="540" fontFamily="JetBrains Mono" fontSize="9" fill="#1a1a1e">FIXED</text>
            </g>
            <g strokeWidth="1">
              <rect x="680" y="430" width="340" height="180"/>
              <rect x="690" y="440" width="100" height="160"/>
              <rect x="800" y="440" width="110" height="160"/>
              <rect x="920" y="440" width="90" height="160"/>
              <text x="718" y="540" fontFamily="JetBrains Mono" fontSize="9" fill="#1a1a1e">FIXED</text>
              <text x="828" y="540" fontFamily="JetBrains Mono" fontSize="9" fill="#1a1a1e">FIXED</text>
              <text x="944" y="540" fontFamily="JetBrains Mono" fontSize="9" fill="#1a1a1e">FIXED</text>
            </g>
            <g stroke="#1a1a1e" strokeWidth="0.8">
              <line x1="1040" y1="210" x2="1100" y2="210"/>
              <circle cx="1110" cy="210" r="10" fill="#fff"/>
              <line x1="1040" y1="300" x2="1100" y2="300"/>
              <circle cx="1110" cy="300" r="10" fill="#fff"/>
            </g>
            <text x="1102" y="214" fontFamily="JetBrains Mono" fontSize="9" fill="#1a1a1e">GYP-1</text>
            <text x="1102" y="304" fontFamily="JetBrains Mono" fontSize="9" fill="#1a1a1e">MI-1</text>
            <g stroke="#1a1a1e" strokeWidth="0.6">
              <line x1="200" y1="650" x2="540" y2="650"/>
              <line x1="645" y1="650" x2="1020" y2="650"/>
              <line x1="200" y1="645" x2="200" y2="655"/>
              <line x1="540" y1="645" x2="540" y2="655"/>
              <line x1="645" y1="645" x2="645" y2="655"/>
              <line x1="1020" y1="645" x2="1020" y2="655"/>
            </g>
            <g fontFamily="JetBrains Mono" fontSize="9" fill="#1a1a1e">
              <text x="300" y="645">3&apos;-6&quot;</text>
              <text x="430" y="645">2&apos;-0&quot;</text>
              <text x="720" y="645">3&apos;-0&quot;</text>
              <text x="900" y="645">3&apos;-6&quot;</text>
            </g>
          </g>
          {/* redline overlay */}
          <g className="redline" strokeWidth="2.4">
            <path d="M 360 130 q -8 -18 8 -28 q 12 -18 30 -10 q 10 -20 32 -10 q 14 -18 34 -6 q 12 -22 34 -8 q 18 -20 38 -4 q 20 -18 40 -2 q 20 -22 42 -6 q 22 -18 42 0 q 22 -20 44 -4 q 22 -18 42 4 q 20 -14 36 6 q 22 -14 36 12 q 18 -4 20 22 q 14 2 12 26 q 6 10 -8 22 q -10 10 -30 4 q -14 16 -34 2 q -16 18 -36 4 q -18 16 -38 2 q -20 18 -40 2 q -22 16 -44 0 q -22 14 -44 -4 q -20 14 -42 -4 q -22 10 -42 -10 q -20 4 -40 -14 q -20 0 -34 -18 q -20 -4 -28 -24 q -14 -10 -6 -20 z"/>
            <g transform="translate(380,95)">
              <path d="M 0 12 q 30 -8 60 -2 t 60 0 t 60 -2 t 60 2 t 60 -4 t 60 0"/>
              <path d="M 0 24 q 30 -6 60 4"/>
            </g>
            <g transform="translate(85,210)">
              <path d="M 0 4 l 12 0"/>
              <path d="M 14 0 q 8 0 8 10 t -8 10 q 4 4 0 8"/>
              <path d="M 26 0 l 4 0 l -3 14 l 5 0"/>
            </g>
            <g transform="translate(555,160)">
              <path d="M 4 16 q -8 -4 -6 -12 q 2 -8 10 -6 q 8 2 4 10 q -4 4 -10 6 l 2 4"/>
              <path d="M 20 6 l 8 12 M 28 6 l -8 12"/>
              <path d="M 42 12 q 0 -8 -6 -8 q -6 0 -6 8 q 0 8 6 8 q 6 0 6 -8"/>
            </g>
            <g strokeWidth="3">
              <path d="M 420 215 l 24 24 M 444 215 l -24 24"/>
              <path d="M 620 215 l 24 24 M 644 215 l -24 24"/>
              <path d="M 820 215 l 24 24 M 844 215 l -24 24"/>
            </g>
            <g strokeWidth="1.8">
              <path d="M 220 200 L 540 400"/><path d="M 260 200 L 540 380"/><path d="M 300 200 L 540 360"/>
              <path d="M 340 200 L 540 340"/><path d="M 380 200 L 540 320"/><path d="M 420 200 L 540 300"/>
              <path d="M 460 200 L 540 280"/><path d="M 200 240 L 500 400"/><path d="M 200 280 L 460 400"/>
              <path d="M 200 320 L 420 400"/><path d="M 200 360 L 380 400"/>
            </g>
            <g transform="translate(240,330)">
              <path d="M 0 0 l 30 -8" strokeWidth="1.6"/>
              <path d="M 30 -8 l -6 -4 M 30 -8 l -2 -7" strokeWidth="1.6"/>
              <path d="M -120 4 q 30 -6 60 -2 t 60 -4"/>
              <path d="M -120 -10 q 40 -4 80 0"/>
            </g>
            <g strokeWidth="1.8">
              <path d="M 700 200 L 1020 400"/><path d="M 740 200 L 1020 380"/><path d="M 780 200 L 1020 360"/>
              <path d="M 820 200 L 1020 340"/><path d="M 860 200 L 1020 320"/><path d="M 900 200 L 1020 300"/>
              <path d="M 940 200 L 1020 280"/><path d="M 680 240 L 980 400"/><path d="M 680 280 L 940 400"/>
              <path d="M 680 320 L 900 400"/><path d="M 680 360 L 860 400"/>
            </g>
            <g transform="translate(210,555)">
              <path d="M 0 0 l 10 -4 l 4 10 l -8 4 z"/>
              <path d="M 20 0 q 0 8 6 8 q 6 0 6 -8 v -6"/>
              <path d="M 42 -6 q 0 14 8 14 q 8 0 8 -14"/>
            </g>
            <g strokeWidth="1.8">
              <path d="M 220 440 L 540 600"/><path d="M 260 440 L 540 580"/><path d="M 300 440 L 540 560"/>
              <path d="M 340 440 L 540 540"/><path d="M 380 440 L 540 520"/>
              <path d="M 200 480 L 500 600"/><path d="M 200 520 L 460 600"/><path d="M 200 560 L 420 600"/>
            </g>
            <g strokeWidth="1.8">
              <path d="M 700 440 L 1020 600"/><path d="M 740 440 L 1020 580"/><path d="M 780 440 L 1020 560"/>
              <path d="M 820 440 L 1020 540"/><path d="M 860 440 L 1020 520"/>
              <path d="M 680 480 L 980 600"/><path d="M 680 520 L 940 600"/><path d="M 680 560 L 900 600"/>
            </g>
            <g transform="translate(340,650)">
              <circle cx="10" cy="10" r="18" strokeWidth="2.2"/>
              <path d="M 2 14 l 6 -8 l 0 14" strokeWidth="2"/>
            </g>
            {[420, 505, 625, 755].map((x, i) => (
              <g key={i} transform={`translate(${x},690)`}>
                <path d="M 0 0 l 6 -10 l 0 14" strokeWidth="1.6"/>
                <path d="M 10 -10 l -4 14" strokeWidth="1.6"/>
              </g>
            ))}
            <g transform="translate(840,650)">
              <circle cx="10" cy="10" r="18" strokeWidth="2.2"/>
              <path d="M 4 14 l 6 -8 l 0 14" strokeWidth="2"/>
            </g>
            <g transform="translate(230,725)" strokeWidth="1.6">
              <path d="M 0 0 q 30 -4 60 -2 t 60 -2 t 60 2"/>
              <path d="M 0 16 q 30 -2 60 2 t 60 -4 t 60 0"/>
            </g>
          </g>
          {/* selection highlight */}
          {sel && !Array.isArray(sel[0]) && (
            <rect
              x={sel[0] - 10} y={sel[1] - 10}
              width={sel[2] + 20} height={sel[3] + 20}
              stroke="oklch(0.66 0.19 25)" strokeWidth="1.5"
              strokeDasharray="5 4" fill="oklch(0.66 0.19 25 / 0.08)" rx="4"
            />
          )}
          {sel && Array.isArray(sel[0]) && sel.map(([x, y], i) => (
            <rect key={i} x={x - 14} y={y - 14} width="52" height="52"
              stroke="oklch(0.66 0.19 25)" strokeWidth="1.5"
              strokeDasharray="5 4" fill="oklch(0.66 0.19 25 / 0.08)" rx="4"/>
          ))}
        </svg>
        {/* corner registration marks */}
        <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-[#d4d4d0]"/>
        <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-[#d4d4d0]"/>
        <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-[#d4d4d0]"/>
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-[#d4d4d0]"/>
      </div>
    </div>
  )
}
