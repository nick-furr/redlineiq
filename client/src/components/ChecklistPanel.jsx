import { useState, useMemo } from 'react'
import FilterBar from './FilterBar.jsx'
import MarkupCard from './MarkupCard.jsx'

const ALL_TYPES = ['add', 'delete', 'move', 'modify', 'dimension', 'note', 'clarify', 'detail']

export default function ChecklistPanel({ markups, selectedId, onSelect, onStatusChange, onFlag }) {
  const [activeTypes, setActiveTypes] = useState(ALL_TYPES)
  const [statusFilter, setStatusFilter] = useState('all')

  function toggleType(type) {
    setActiveTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const filtered = useMemo(() => {
    return markups.filter(item => {
      if (!activeTypes.includes(item.markup_type)) return false
      if (statusFilter === 'all') return true
      if (statusFilter === 'flagged') return item.flagged
      return item.status === statusFilter
    })
  }, [markups, activeTypes, statusFilter])

  return (
    <div className="flex flex-col h-full">
      <FilterBar
        activeTypes={activeTypes}
        statusFilter={statusFilter}
        onTypeToggle={toggleType}
        onStatusChange={setStatusFilter}
      />
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#4b5563] text-sm">
            No items match the current filters
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-3">
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
          </div>
        )}
      </div>
    </div>
  )
}
