import { useState, useEffect } from 'react'
import TypeBadge from './TypeBadge.jsx'

const FLAG_PATH = 'M4 22V4 M4 4s2-1 5 0 5 2 8 0v10c-3 2-5 0-8 0s-5 1-5 1'

function Icon({ d, size = 14, stroke = 1.5 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  )
}

export default function DetailStrip({ item, onStatusChange, onFlag }) {
  const [flagMode, setFlagMode] = useState(false)
  const [flagText, setFlagText] = useState('')

  useEffect(() => { setFlagMode(false); setFlagText('') }, [item?.id])

  if (!item) {
    return (
      <div className="h-[72px] shrink-0 border-t border-[var(--line)] bg-[var(--bg)] flex items-center justify-center mono text-[11px] text-[var(--fg-3)]">
        select a markup
      </div>
    )
  }

  const isDone = item.status === 'done'
  const isInProgress = item.status === 'in_progress'

  function submitFlag() {
    if (!flagText.trim()) return
    onFlag(item.id, flagText.trim())
    setFlagMode(false)
    setFlagText('')
  }

  return (
    <div className="shrink-0 border-t border-[var(--line)] bg-[var(--bg)] px-6 py-4">
      <div className="flex items-start gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
            <span className="mono text-[11px] text-[var(--fg-2)] tabular-nums">{item.id}</span>
            <span className="text-[var(--fg-4)]">·</span>
            <TypeBadge type={item.markup_type}/>
            <span className="text-[var(--fg-4)]">·</span>
            <span className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--fg-3)]">conf {item.confidence}</span>
            {isInProgress && (
              <>
                <span className="text-[var(--fg-4)]">·</span>
                <span className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--fg-1)]">in progress</span>
              </>
            )}
            {item.ambiguous && (
              <>
                <span className="text-[var(--fg-4)]">·</span>
                <span className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent)] flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-[var(--accent)] redpulse"/>ambiguous
                </span>
              </>
            )}
          </div>

          <div className="text-[14px] text-[var(--fg)] leading-snug mb-1.5">{item.markup_text}</div>

          <div className="mono text-[10.5px] text-[var(--fg-3)] truncate">
            {item.drawing_reference}
            {item.location_on_drawing && (
              <><span className="text-[var(--fg-4)] mx-2">·</span>{item.location_on_drawing}</>
            )}
            {item.related_to && (
              <><span className="text-[var(--fg-4)] mx-2">·</span>related {item.related_to}</>
            )}
          </div>

          {item.clarification_request && (
            <div className="mt-2 text-[11.5px] text-[var(--accent)] pl-2.5 border-l border-[var(--accent)]">
              {item.clarification_request}
            </div>
          )}

          {flagMode && (
            <div className="mt-2.5 flex gap-1.5">
              <input
                autoFocus
                value={flagText}
                onChange={e => setFlagText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitFlag() }}
                placeholder="What needs clarification?"
                className="flex-1 bg-[var(--bg-1)] border border-[var(--line-2)] rounded-[3px] px-2 py-1.5 text-[11.5px] outline-none focus:border-[var(--accent)] transition"
              />
              <button onClick={submitFlag} className="mono text-[10.5px] px-2.5 rounded-[3px] bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-d)]">send</button>
              <button onClick={() => { setFlagMode(false); setFlagText('') }} className="mono text-[10.5px] px-2 rounded-[3px] text-[var(--fg-3)] hover:text-[var(--fg-1)]">cancel</button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* status cycle */}
          <div className="flex items-center border border-[var(--line-2)] rounded-[3px] overflow-hidden">
            {[['pending', 'todo'], ['in_progress', 'wip'], ['done', 'done']].map(([s, label]) => (
              <button key={s} onClick={() => onStatusChange(item.id, s)}
                title={s.replace('_', ' ')}
                className={[
                  'mono text-[10px] px-2 py-[6px] transition uppercase tracking-wider',
                  item.status === s
                    ? s === 'done'
                      ? 'bg-[var(--fg)] text-[var(--bg)]'
                      : s === 'in_progress'
                        ? 'bg-[var(--bg-3)] text-[var(--fg-1)]'
                        : 'bg-[var(--bg-2)] text-[var(--fg-1)]'
                    : 'text-[var(--fg-3)] hover:text-[var(--fg-1)] hover:bg-[var(--bg-2)]',
                ].join(' ')}>
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              if (item.flagged) {
                onStatusChange(item.id, 'pending')
              } else {
                setFlagMode(true)
              }
            }}
            className={[
              'h-7 px-3 inline-flex items-center gap-1.5 rounded-[3px] border mono text-[11px] transition',
              item.flagged
                ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-f)]'
                : 'border-[var(--line-2)] text-[var(--fg-2)] hover:text-[var(--fg-1)] hover:border-[var(--fg-3)]',
            ].join(' ')}
          >
            <Icon d={FLAG_PATH} size={11}/> {item.flagged ? 'unflag' : 'flag'}
          </button>
        </div>
      </div>
    </div>
  )
}
