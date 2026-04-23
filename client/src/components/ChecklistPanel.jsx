import { useState, useMemo } from 'react'
import TypeBadge, { TYPE_META, ALL_TYPES } from './TypeBadge.jsx'
import MarkupCard from './MarkupCard.jsx'

const STATUS_TABS = ['all', 'pending', 'in_progress', 'flagged', 'done']

const SEARCH_PATH = 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3'

function Icon({ d, size = 14, stroke = 1.5 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  )
}

export default function ChecklistPanel({ markups, selectedId, onSelect, onStatusChange, onFlag }) {
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [activeTypes, setActiveTypes] = useState(new Set(ALL_TYPES))
  const [typeMenuOpen, setTypeMenuOpen] = useState(false)

  const counts = useMemo(() => ({
    all: markups.length,
    pending: markups.filter(m => m.status === 'pending' || !m.status).length,
    in_progress: markups.filter(m => m.status === 'in_progress').length,
    flagged: markups.filter(m => m.flagged).length,
    done: markups.filter(m => m.status === 'done').length,
  }), [markups])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return markups.filter(m => {
      if (!activeTypes.has(m.markup_type)) return false
      if (statusFilter === 'flagged') { if (!m.flagged) return false }
      else if (statusFilter !== 'all' && m.status !== statusFilter) return false
      if (needle) {
        const hay = [m.markup_text, m.drawing_reference, m.location_on_drawing, m.id].join(' ').toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [markups, q, statusFilter, activeTypes])

  const toggleType = (t) => setActiveTypes(s => {
    const n = new Set(s)
    n.has(t) ? n.delete(t) : n.add(t)
    return n
  })

  const resetFilters = () => {
    setQ('')
    setStatusFilter('all')
    setActiveTypes(new Set(ALL_TYPES))
  }

  return (
    <div className="flex flex-col h-full">
      {/* search + type facet */}
      <div className="px-3 pt-3 pb-2 flex items-center gap-1.5">
        <div className="flex-1 relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-3)]">
            <Icon d={SEARCH_PATH} size={12}/>
          </span>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search markups…"
            className="w-full bg-[var(--bg-1)] border border-[var(--line)] rounded-[3px] pl-7 pr-2 py-[6px] text-[12px] placeholder:text-[var(--fg-4)] outline-none focus:border-[var(--accent)] transition"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setTypeMenuOpen(o => !o)}
            className={[
              'mono text-[11px] px-2.5 py-[6px] rounded-[3px] border transition',
              typeMenuOpen
                ? 'border-[var(--line-2)] bg-[var(--bg-2)] text-[var(--fg-1)]'
                : 'border-[var(--line)] text-[var(--fg-2)] hover:text-[var(--fg-1)]',
            ].join(' ')}
          >
            types <span className="text-[var(--fg-4)]">·</span> <span className="tabular-nums">{activeTypes.size}</span>
          </button>
          {typeMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setTypeMenuOpen(false)}/>
              <div className="absolute right-0 top-full mt-1 z-20 w-[220px] bg-[var(--bg-2)] border border-[var(--line-2)] rounded-[4px] shadow-2xl p-1">
                {ALL_TYPES.map(t => {
                  const on = activeTypes.has(t)
                  return (
                    <button key={t} onClick={() => toggleType(t)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[2px] hover:bg-[var(--bg-3)] text-left">
                      <span className={[
                        'w-3.5 h-3.5 rounded-[2px] border flex items-center justify-center',
                        on ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--line-2)]',
                      ].join(' ')}>
                        {on && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="4"><path d="M4 12l5 5 11-11"/></svg>}
                      </span>
                      <TypeBadge type={t} showColors={false}/>
                      <span className="text-[12px] text-[var(--fg-1)]">{TYPE_META[t].label}</span>
                      <span className="ml-auto mono text-[10px] text-[var(--fg-3)] tabular-nums">
                        {markups.filter(i => i.markup_type === t).length}
                      </span>
                    </button>
                  )
                })}
                <div className="flex items-center justify-between px-2 py-1.5 mt-1 border-t border-[var(--line)]">
                  <button onClick={() => setActiveTypes(new Set(ALL_TYPES))} className="mono text-[10px] text-[var(--fg-3)] hover:text-[var(--fg-1)]">all</button>
                  <button onClick={() => setActiveTypes(new Set())} className="mono text-[10px] text-[var(--fg-3)] hover:text-[var(--fg-1)]">none</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* status tabs */}
      <div className="px-5 pb-3 flex items-center gap-4 border-b border-[var(--line)]">
        {STATUS_TABS.map(s => {
          const active = statusFilter === s
          return (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={[
                'relative mono text-[10.5px] uppercase tracking-[0.14em] transition py-1',
                active ? 'text-[var(--fg)]' : 'text-[var(--fg-3)] hover:text-[var(--fg-1)]',
              ].join(' ')}
            >
              {s.replace('_', ' ')} <span className="text-[var(--fg-4)] tabular-nums ml-0.5">{counts[s]}</span>
              {active && <span className="absolute left-0 right-0 -bottom-[13px] h-[1.5px] bg-[var(--accent)]"/>}
            </button>
          )
        })}
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 p-8 text-center">
            <div className="mono text-[10px] text-[var(--fg-3)] uppercase tracking-widest">no matches</div>
            <button onClick={resetFilters} className="mono text-[11px] text-[var(--accent)] hover:underline">
              reset filters
            </button>
          </div>
        ) : (
          <div>
            {filtered.map(item => (
              <MarkupCard
                key={item.id}
                item={item}
                selected={item.id === selectedId}
                onSelect={onSelect}
                onStatusChange={onStatusChange}
                onFlag={onFlag}
              />
            ))}
            <div className="h-4"/>
          </div>
        )}
      </div>
    </div>
  )
}
