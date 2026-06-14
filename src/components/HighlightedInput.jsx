import { useMemo, useRef } from 'react'

// A textarea with a highlight layer behind it: matched entities get a colored backdrop
// (location / item / color / time), so the user sees exactly what we understood, live.
// The technique is a transparent textarea stacked over an aria-hidden mirror div that
// renders the same text with <mark> backgrounds; their box metrics are kept identical.

export const TYPE_STYLE = {
  place: { mark: 'bg-sky-400/40', chip: 'bg-sky-400/20 text-sky-700 dark:text-sky-300 border-sky-400/40', label: 'Location' },
  item: { mark: 'bg-lime/50', chip: 'bg-lime/30 text-ink dark:text-lime border-lime/50', label: 'Item' },
  color: { mark: 'bg-fuchsia-300/50', chip: 'bg-fuchsia-300/25 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-300/50', label: 'Color' },
  brand: { mark: 'bg-indigo-300/50', chip: 'bg-indigo-300/25 text-indigo-700 dark:text-indigo-300 border-indigo-300/50', label: 'Brand' },
  material: { mark: 'bg-teal-300/50', chip: 'bg-teal-300/25 text-teal-700 dark:text-teal-300 border-teal-300/50', label: 'Material' },
  time: { mark: 'bg-amber-300/55', chip: 'bg-amber-300/25 text-amber-700 dark:text-amber-300 border-amber-300/50', label: 'Time' },
  qualifier: { mark: 'bg-slate-300/50', chip: 'bg-slate-400/15 text-slate-600 dark:text-slate-300 border-slate-400/30', label: 'Detail' },
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function buildHtml(text, spans) {
  if (!text) return '&nbsp;'
  let html = ''
  let i = 0
  for (const s of spans) {
    if (s.start < i) continue // safety: skip overlaps
    html += esc(text.slice(i, s.start))
    const cls = (TYPE_STYLE[s.type] || TYPE_STYLE.qualifier).mark
    html += `<mark class="rounded-[4px] ${cls} ${s.learned ? 'ring-1 ring-ink/30' : ''}">${esc(text.slice(s.start, s.end))}</mark>`
    i = s.end
  }
  html += esc(text.slice(i))
  // a trailing newline needs an extra space or the mirror collapses one line short
  return html.replace(/\n$/, '\n ')
}

const BOX = 'block w-full p-4 text-[15px] leading-6 font-sans whitespace-pre-wrap break-words'

export default function HighlightedInput({ value, onChange, placeholder, rows = 3, spans = [], autoFocus }) {
  const taRef = useRef(null)
  const backRef = useRef(null)
  const html = useMemo(() => buildHtml(value, spans), [value, spans])

  const sync = () => {
    if (backRef.current && taRef.current) backRef.current.scrollTop = taRef.current.scrollTop
  }

  return (
    <div className="relative mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur transition focus-within:border-lime dark:border-white/10 dark:bg-slate-800/60">
      <div
        ref={backRef}
        aria-hidden
        className={`${BOX} pointer-events-none absolute inset-0 overflow-auto text-transparent`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <textarea
        ref={taRef}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onScroll={sync}
        placeholder={placeholder}
        rows={rows}
        spellCheck={false}
        className={`${BOX} relative resize-none bg-transparent text-ink caret-ink outline-none placeholder:text-slate-400 dark:text-slate-100 dark:caret-white`}
      />
    </div>
  )
}
