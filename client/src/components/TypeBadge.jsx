export const TYPE_META = {
  add:       { letter: 'A', label: 'add',       hue: 152 },
  delete:    { letter: 'D', label: 'delete',    hue: 15  },
  move:      { letter: 'M', label: 'move',      hue: 220 },
  modify:    { letter: 'M', label: 'modify',    hue: 42  },
  dimension: { letter: '#', label: 'dimension', hue: 270 },
  note:      { letter: '·', label: 'note',      hue: 0   },
  clarify:   { letter: '?', label: 'clarify',   hue: 28  },
  detail:    { letter: '✚', label: 'detail',    hue: 190 },
}

export const ALL_TYPES = Object.keys(TYPE_META)

export default function TypeBadge({ type, showColors = false }) {
  const m = TYPE_META[type] ?? TYPE_META.note
  const color = showColors ? `oklch(0.7 0.12 ${m.hue})` : 'var(--fg-2)'
  return (
    <span
      className="mono inline-flex items-center justify-center w-5 h-5 rounded-[3px] text-[10px] font-medium border"
      style={{
        color,
        borderColor: showColors ? `oklch(0.35 0.08 ${m.hue})` : 'var(--line-2)',
        background: showColors ? `oklch(0.2 0.04 ${m.hue})` : 'var(--bg-2)',
      }}
      title={m.label}
    >
      {m.letter}
    </span>
  )
}
