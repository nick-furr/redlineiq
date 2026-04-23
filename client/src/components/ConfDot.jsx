export default function ConfDot({ level }) {
  const filled = level === 'high' ? 3 : level === 'medium' ? 2 : 1
  const color = level === 'low' ? 'var(--accent)' : 'var(--fg-2)'
  return (
    <span className="inline-flex items-end gap-[2px] h-3" title={`confidence ${level}`}>
      {[1, 2, 3].map(i => (
        <span
          key={i}
          className="w-[2px] rounded-[1px]"
          style={{
            height: `${i * 3 + 2}px`,
            background: i <= filled ? color : 'var(--line-2)',
          }}
        />
      ))}
    </span>
  )
}
