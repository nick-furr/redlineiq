import { useState, useRef } from 'react'

export default function UploadZone({ onUpload, disabled }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  function handleDragOver(e) {
    e.preventDefault()
    if (!disabled) setDragging(true)
  }

  function handleDragLeave() {
    setDragging(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files[0]
    if (file?.type === 'application/pdf') onUpload(file)
  }

  function handleChange(e) {
    const file = e.target.files[0]
    if (file) onUpload(file)
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={[
        'flex flex-col items-center justify-center gap-4',
        'border-2 border-dashed rounded-lg p-16 cursor-pointer',
        'transition-colors duration-150 select-none',
        dragging
          ? 'border-teal bg-teal-light'
          : 'border-[#2e3340] hover:border-[#1D9E75] hover:bg-teal-light',
        disabled ? 'opacity-50 pointer-events-none' : '',
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleChange}
      />
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="12" y1="18" x2="12" y2="12"/>
        <polyline points="9,15 12,12 15,15"/>
      </svg>
      <div className="text-center">
        <p className="text-[#e2e4e9] font-medium text-sm">Drop a PDF here or click to browse</p>
        <p className="text-[#6b7280] text-xs mt-1">Construction drawings, redline sets, marked-up sheets</p>
      </div>
    </div>
  )
}
