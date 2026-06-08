import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Search, LayoutDashboard, MessagesSquare, FileSearch,
  BarChart3, Database, FileText, CornerDownLeft, ArrowUp, ArrowDown,
} from 'lucide-react'

const PAGES = [
  { id: 'overview',  label: 'Overview',       hint: 'Dashboard',            icon: LayoutDashboard },
  { id: 'analytics', label: 'Analytics',      hint: 'Trends & correlation', icon: BarChart3 },
  { id: 'data',      label: 'Data Sources',   hint: 'Browse transcripts',   icon: Database },
  { id: 'calls',     label: 'Sales Calls',    hint: 'Chat',                 icon: MessagesSquare },
  { id: 'knowledge', label: 'Knowledge Base', hint: 'Chat',                 icon: FileSearch },
]

// Rendered only while open (mounted fresh each time), so initial state is the
// reset — no reset-effect needed. `calls` is supplied by the parent so reopening
// never refetches.
export default function CommandPalette({ calls = [], onClose, onNavigate, onSelectCall }) {
  const [query, setQuery]   = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const listRef  = useRef(null)

  // Focus the input on mount (DOM side-effect only — no state writes).
  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pages = PAGES
      .filter(p => !q || p.label.toLowerCase().includes(q) || p.hint.toLowerCase().includes(q))
      .map(p => ({ type: 'page', ...p }))

    const callMatches = (q
      ? calls.filter(c =>
          c.call_id.toLowerCase().includes(q) ||
          c.employee_name.toLowerCase().includes(q) ||
          c.product_name.toLowerCase().includes(q))
      : calls
    ).slice(0, 8).map(c => ({ type: 'call', ...c }))

    return [...pages, ...callMatches]
  }, [query, calls])

  // Clamp during render rather than via an effect, so the highlighted row is
  // always valid even as results shrink.
  const activeIdx = Math.min(active, Math.max(0, results.length - 1))

  // Keep the active row visible.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  const choose = (item) => {
    if (!item) return
    if (item.type === 'page') onNavigate(item.id)
    else onSelectCall(item)
    onClose()
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(activeIdx + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(activeIdx - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[activeIdx]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh] bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-xl glass rounded-2xl shadow-elevated border border-border-strong overflow-hidden animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, calls, reps, products…"
            className="flex-1 bg-transparent py-3.5 text-sm lg:text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="text-xs px-1.5 py-0.5 rounded border border-border bg-surface text-muted-foreground shrink-0">esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">No matches.</div>
          )}

          {results.some(r => r.type === 'page') && (
            <div className="px-2 pt-1 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Pages</div>
          )}
          {results.map((item, i) => {
            const isFirstCall = item.type === 'call' && results[i - 1]?.type === 'page'
            return (
              <div key={item.type === 'page' ? `p-${item.id}` : `c-${item.call_id}`}>
                {isFirstCall && (
                  <div className="px-2 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Calls</div>
                )}
                <button
                  data-idx={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(item)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    activeIdx === i ? 'bg-primary/15 border border-primary/30' : 'border border-transparent hover:bg-accent'
                  }`}
                >
                  <div className="size-7 rounded-md bg-surface-elevated border border-border grid place-items-center shrink-0">
                    {item.type === 'page'
                      ? <item.icon className="size-3.5 text-primary" />
                      : <FileText className="size-3.5 text-primary" />}
                  </div>
                  {item.type === 'page' ? (
                    <>
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{item.hint}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-semibold text-foreground" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{item.call_id}</span>
                      <span className="text-xs text-muted-foreground truncate">{item.employee_name} · {item.product_name}</span>
                      <span className={`text-xs font-semibold ml-auto shrink-0 ${item.sale_result === 'Sale' ? 'text-success' : 'text-muted-foreground'}`}>
                        {item.sale_result}
                      </span>
                    </>
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><ArrowUp className="size-3" /><ArrowDown className="size-3" /> navigate</span>
          <span className="flex items-center gap-1"><CornerDownLeft className="size-3" /> open</span>
        </div>
      </div>
    </div>
  )
}
