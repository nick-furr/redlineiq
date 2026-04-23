import { useState, useRef } from 'react'

const UPLOAD_PATH = 'M12 3v13 M6 9l6-6 6 6 M4 21h16'

function Icon({ d, size = 16, stroke = 1.5 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  )
}

export default function UploadZone({ onUpload, disabled }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  function handleDragOver(e) {
    e.preventDefault()
    if (!disabled) setDragging(true)
  }

  function handleDragLeave() { setDragging(false) }

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
      className={[
        'relative border border-dashed rounded-[4px] transition-colors',
        dragging || disabled
          ? 'border-[var(--accent)] bg-[var(--accent-f)]'
          : 'border-[var(--line-2)] hover:border-[var(--fg-3)]',
        disabled ? 'pointer-events-none' : '',
      ].join(' ')}
    >
      <button
        onClick={() => !disabled && inputRef.current?.click()}
        className="w-full py-10 px-6 flex flex-col items-center gap-3"
      >
        <div className="w-10 h-10 rounded-full border border-[var(--line-2)] flex items-center justify-center text-[var(--fg-2)]">
          <Icon d={UPLOAD_PATH}/>
        </div>
        <div className="text-[13.5px] text-[var(--fg-1)]">
          Drop a PDF here, or <span className="text-[var(--fg)] underline underline-offset-2 decoration-[var(--line-2)]">browse</span>
        </div>
        <div className="mono text-[10.5px] text-[var(--fg-3)]">PDF · up to 10 pages · max 20 MB</div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}
