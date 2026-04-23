import TypeBadge from './TypeBadge.jsx'
import ConfDot from './ConfDot.jsx'

const FLAG_PATH = 'M4 22V4 M4 4s2-1 5 0 5 2 8 0v10c-3 2-5 0-8 0s-5 1-5 1'
const CHECK_PATH = 'M4 12l5 5 11-11'

function Icon({ d, size = 14, stroke = 1.5 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  )
}

export default function MarkupCard({ item, selected, onSelect, onStatusChange, onFlag, density = 'comfortable', showColors = false }) {
  const isDone = item.status === 'done'
  const isFlagged = item.flagged
  const padY = density === 'compact' ? 'py-[7px]' : density === 'spacious' ? 'py-[13px]' : 'py-[10px]'

  function toggleDone(e) {
    e.stopPropagation()
    onStatusChange(item.id, isDone ? 'pending' : 'done')
  }

  function toggleFlag(e) {
    e.stopPropagation()
    if (isFlagged) {
      onStatusChange(item.id, 'pending')
    } else {
      onFlag(item.id, '')
    }
  }

  return (
    <div
      onClick={() => onSelect(item.id)}
      className={[
        'group flex items-center gap-3 px-4 cursor-pointer relative',
        'transition-[background] duration-100',
        padY,
        selected ? 'bg-[var(--bg-2)]' : 'hover:bg-[var(--bg-1)]',
        isDone ? 'opacity-45' : '',
      ].join(' ')}
    >
      {selected && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--accent)]"/>}

      <button
        onClick={toggleDone}
        className={[
          'w-4 h-4 rounded-[3px] border shrink-0 inline-flex items-center justify-center transition',
          isDone
            ? 'bg-[var(--fg-1)] border-[var(--fg-1)] text-[var(--bg)]'
            : 'border-[var(--line-2)] text-transparent hover:border-[var(--fg-3)] hover:text-[var(--fg-3)]',
        ].join(' ')}
        title={isDone ? 'Mark pending' : 'Mark done'}
      >
        <Icon d={CHECK_PATH} size={10} stroke={3.5}/>
      </button>

      <TypeBadge type={item.markup_type} showColors={showColors}/>

      <div className={`flex-1 min-w-0 text-[13.5px] leading-tight truncate ${isDone ? 'line-through text-[var(--fg-3)]' : 'text-[var(--fg)]'}`}>
        {item.markup_text}
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {item.ambiguous && (
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" title="ambiguous"/>
        )}
        <ConfDot level={item.confidence}/>
        <button
          onClick={toggleFlag}
          className={[
            'w-5 h-5 inline-flex items-center justify-center rounded-[3px] transition',
            isFlagged
              ? 'text-[var(--accent)] opacity-100'
              : 'text-[var(--fg-3)] opacity-0 group-hover:opacity-100 hover:text-[var(--fg-1)]',
            selected ? 'opacity-100' : '',
          ].join(' ')}
          title={isFlagged ? 'Unflag' : 'Flag'}
        >
          <Icon d={FLAG_PATH} size={11}/>
        </button>
      </div>
    </div>
  )
}
