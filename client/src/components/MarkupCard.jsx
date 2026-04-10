import { useState } from 'react'

const TYPE_COLORS = {
  add: 'bg-emerald-900/50 text-emerald-400 border-emerald-800',
  delete: 'bg-red-900/50 text-red-400 border-red-800',
  move: 'bg-blue-900/50 text-blue-400 border-blue-800',
  modify: 'bg-amber-900/50 text-amber-400 border-amber-800',
  dimension: 'bg-purple-900/50 text-purple-400 border-purple-800',
  note: 'bg-slate-700/50 text-slate-300 border-slate-600',
  clarify: 'bg-orange-900/50 text-orange-400 border-orange-800',
  detail: 'bg-cyan-900/50 text-cyan-400 border-cyan-800',
}

const CONFIDENCE_COLORS = {
  high: 'text-emerald-400',
  medium: 'text-amber-400',
  low: 'text-red-400',
}

export default function MarkupCard({ item, selected, onSelect, onStatusChange, onFlag }) {
  const [flagMode, setFlagMode] = useState(false)
  const [flagMessage, setFlagMessage] = useState('')

  const isDone = item.status === 'done'
  const isFlagged = item.flagged

  function handleFlag(e) {
    e.stopPropagation()
    if (isFlagged) {
      // Unflag: reset status to pending via the existing status-update path
      onStatusChange(item.id, 'pending')
    } else {
      setFlagMode(true)
    }
  }

  function submitFlag(e) {
    e.stopPropagation()
    if (!flagMessage.trim()) return
    onFlag(item.id, flagMessage.trim())
    setFlagMode(false)
    setFlagMessage('')
  }

  function toggleDone(e) {
    e.stopPropagation()
    onStatusChange(item.id, isDone ? 'pending' : 'done')
  }

  return (
    <div
      onClick={() => onSelect(item.id)}
      className={[
        'p-3 rounded-lg border cursor-pointer transition-colors',
        selected
          ? 'border-[#1D9E75] bg-teal-light'
          : 'border-[#1e2128] bg-[#13151a] hover:border-[#2e3340]',
        isDone ? 'opacity-50' : '',
      ].join(' ')}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${TYPE_COLORS[item.markup_type] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
            {item.markup_type}
          </span>
          {item.ambiguous && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-900/50 text-yellow-400 border border-yellow-800">
              ambiguous
            </span>
          )}
          <span className={`text-[10px] font-mono font-medium ${CONFIDENCE_COLORS[item.confidence] ?? 'text-slate-400'}`}>
            {item.confidence}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Flag button */}
          <button
            onClick={handleFlag}
            title="Flag this item"
            className={[
              'p-1 rounded transition-colors',
              isFlagged
                ? 'text-orange-400'
                : 'text-[#4b5563] hover:text-orange-400',
            ].join(' ')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={isFlagged ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
              <line x1="4" y1="22" x2="4" y2="15"/>
            </svg>
          </button>
          {/* Done toggle */}
          <button
            onClick={toggleDone}
            title={isDone ? 'Mark as pending' : 'Mark as done'}
            className={[
              'p-1 rounded transition-colors',
              isDone
                ? 'text-[#1D9E75]'
                : 'text-[#4b5563] hover:text-[#1D9E75]',
            ].join(' ')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20,6 9,17 4,12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Markup text */}
      <p className={`text-sm leading-snug mb-2 ${isDone ? 'line-through text-[#4b5563]' : 'text-[#d1d5db]'}`}>
        {item.markup_text}
      </p>

      {/* Meta */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[#4b5563] font-mono">
        {item.drawing_reference && (
          <span title="Drawing reference">
            <span className="text-[#374151]">ref </span>{item.drawing_reference}
          </span>
        )}
        {item.location_on_drawing && (
          <span title="Location">
            <span className="text-[#374151]">loc </span>{item.location_on_drawing}
          </span>
        )}
      </div>

      {/* Flag input */}
      {flagMode && (
        <div
          className="mt-2 flex gap-1.5"
          onClick={e => e.stopPropagation()}
        >
          <input
            autoFocus
            type="text"
            value={flagMessage}
            onChange={e => setFlagMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitFlag(e)}
            placeholder="What needs clarification?…"
            className="flex-1 bg-[#0f1014] border border-[#2e3340] rounded px-2 py-1 text-xs text-[#d1d5db] outline-none focus:border-[#1D9E75]"
          />
          <button
            onClick={submitFlag}
            disabled={!flagMessage.trim()}
            className="px-2 py-1 rounded text-xs bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Flag
          </button>
          <button
            onClick={e => { e.stopPropagation(); setFlagMode(false) }}
            className="px-2 py-1 rounded text-xs text-[#6b7280] hover:text-[#d1d5db]"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
