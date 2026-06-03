import { useState, useEffect, useMemo } from 'react'
import {
  ArrowLeft, FileText, User, Calendar, Package,
  Clock, TrendingUp, AlertCircle, CheckCircle,
  XCircle, Target, Lightbulb, BarChart2, Search, ChevronRight,
} from 'lucide-react'

function formatDuration(secs) {
  const s = Number(secs)
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function SalesBadge({ result }) {
  const ok = result === 'Sale'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
      ok
        ? 'bg-success/15 text-success border-success/30'
        : 'bg-destructive/15 text-destructive border-destructive/30'
    }`}>
      {ok ? <CheckCircle className="size-3" /> : <XCircle className="size-3" />}
      {result}
    </span>
  )
}

function ScoreDots({ value, max = 5 }) {
  return (
    <div className="flex gap-1 items-center">
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          className={`size-2 rounded-full ${i < Number(value) ? 'bg-primary' : 'bg-border'}`}
        />
      ))}
      <span className="ml-1.5 text-xs text-muted-foreground">{value}/{max}</span>
    </div>
  )
}

function TranscriptLine({ line }) {
  const isAgent    = line.startsWith('Agent:')
  const isCustomer = line.startsWith('Customer:')

  if (!isAgent && !isCustomer) return null

  const speaker = isAgent ? 'Agent' : 'Customer'
  const text    = line.replace(/^(Agent|Customer):\s*/, '')

  return (
    <div className={`flex gap-3 ${isAgent ? '' : 'flex-row-reverse'}`}>
      <div className={`size-7 rounded-full shrink-0 grid place-items-center text-[10px] font-bold text-primary-foreground ${
        isAgent ? 'bg-gradient-to-br from-primary to-accent-cyan' : 'bg-surface-elevated border border-border text-muted-foreground'
      }`}>
        {isAgent ? 'A' : 'C'}
      </div>
      <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm lg:text-base ${
        isAgent
          ? 'bg-primary/10 border border-primary/20 text-foreground rounded-tl-none'
          : 'bg-surface-elevated border border-border text-foreground/90 rounded-tr-none'
      }`}>
        <div className={`text-[10px] font-semibold mb-1 ${isAgent ? 'text-primary' : 'text-muted-foreground'}`}>
          {speaker}
        </div>
        {text}
      </div>
    </div>
  )
}

// ── Call detail view ──────────────────────────────────────────────────────────
function CallDetail({ call, onBack }) {
  const txLines = call.transcript ? call.transcript.split('\n').filter(l => l.trim()) : []

  const meta = [
    { icon: User,     label: 'Agent',    value: call.employee_name },
    { icon: Target,   label: 'Team',     value: call.team_name },
    { icon: Calendar, label: 'Date',     value: call.call_date },
    { icon: Package,  label: 'Product',  value: call.product_name },
    { icon: Clock,    label: 'Duration', value: formatDuration(call.duration_seconds) },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-border">
        <button
          onClick={onBack}
          className="size-9 rounded-xl grid place-items-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-xl bg-primary/10 border border-primary/20 grid place-items-center shrink-0">
            <FileText className="size-4 text-primary" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base lg:text-lg text-foreground"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {call.call_id}
            </h2>
            <p className="text-xs text-muted-foreground">{call.product_name} · {call.employee_name}</p>
          </div>
        </div>
        <div className="ml-auto">
          <SalesBadge result={call.sale_result} />
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-6">

        {/* Meta pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {meta.map(({ icon: Icon, label, value }) => (
            <div key={label} className="glass rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                <Icon className="size-3" />{label}
              </div>
              <div className="text-sm lg:text-base font-semibold text-foreground truncate">{value}</div>
            </div>
          ))}
        </div>

        {/* Scores row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="glass rounded-xl p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Performance Score</div>
            <ScoreDots value={call.agent_performance_score} />
          </div>
          <div className="glass rounded-xl p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Objection Handling</div>
            <ScoreDots value={call.objection_handling_quality} />
          </div>
          <div className="glass rounded-xl p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Closing Attempt</div>
            <div className={`text-sm font-semibold ${call.closing_attempt === 'yes' ? 'text-success' : 'text-muted-foreground'}`}>
              {call.closing_attempt === 'yes' ? '✓ Yes' : call.closing_attempt === 'weak' ? '~ Weak' : '✗ No'}
            </div>
          </div>
        </div>

        {/* Insight cards */}
        {[
          { icon: BarChart2,    label: 'Call Summary',           value: call.call_summary,           color: 'text-primary'   },
          { icon: AlertCircle,  label: 'Missed Opportunity',     value: call.missed_opportunity,     color: 'text-warning'   },
          { icon: TrendingUp,   label: 'Success / Failure Reason', value: call.success_failure_reason, color: 'text-success' },
          { icon: Lightbulb,    label: 'Recommended Improvement', value: call.recommended_improvement, color: 'text-accent-cyan' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="glass rounded-xl p-4">
            <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2 ${color}`}>
              <Icon className="size-3.5" />{label}
            </div>
            <p className="text-sm lg:text-base text-foreground/90 leading-relaxed">{value}</p>
          </div>
        ))}

        {/* Transcript */}
        {txLines.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              <FileText className="size-3.5" />Transcript
            </div>
            <div className="glass rounded-xl p-4 space-y-3">
              {txLines.map((line, i) => <TranscriptLine key={i} line={line} />)}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ── List row ────────────────────────────────────────────────────────────────
function CallRow({ call, onClick }) {
  const ok = call.sale_result === 'Sale'
  return (
    <button
      onClick={onClick}
      className="group w-full glass rounded-xl px-3 sm:px-4 py-3 flex items-center gap-3 sm:gap-4
                 hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
    >
      {/* Icon + ID */}
      <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center shrink-0
                      group-hover:bg-primary/20 transition-colors">
        <FileText className="size-4 text-primary" />
      </div>
      <div className="min-w-0 w-28 sm:w-36 shrink-0">
        <div className="text-sm font-semibold text-foreground truncate" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          {call.call_id}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">{call.product_name}</div>
      </div>

      {/* Agent — hidden on mobile */}
      <div className="hidden md:block min-w-0 flex-1">
        <div className="text-sm text-foreground/90 truncate">{call.employee_name}</div>
        <div className="text-[11px] text-muted-foreground truncate">{call.team_name}</div>
      </div>

      {/* Date — lg+ */}
      <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground w-24 shrink-0">
        <Calendar className="size-3" />{call.call_date}
      </div>

      {/* Duration — sm+ */}
      <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground w-16 shrink-0">
        <Clock className="size-3" />{formatDuration(call.duration_seconds)}
      </div>

      {/* Perf score — xl+ */}
      <div className="hidden xl:flex items-center gap-1.5 w-20 shrink-0" title="Performance score">
        <Target className="size-3 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground/90">{call.agent_performance_score}/5</span>
      </div>

      {/* Result + chevron */}
      <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
        <span className={`inline-flex items-center justify-center gap-1 w-20 py-0.5 rounded-full text-[11px] font-semibold border ${
          ok ? 'bg-success/15 text-success border-success/30' : 'bg-destructive/15 text-destructive border-destructive/30'
        }`}>
          {ok ? <CheckCircle className="size-3" /> : <XCircle className="size-3" />}
          <span className="hidden sm:inline">{call.sale_result}</span>
        </span>
        <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
      </div>
    </button>
  )
}

const FILTERS = [
  { id: 'all',     label: 'All' },
  { id: 'Sale',    label: 'Won' },
  { id: 'No Sale', label: 'Lost' },
]

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DataSourcesPage({ focusCallId, onFocusConsumed }) {
  const [calls, setCalls]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState(null)
  const [query, setQuery]       = useState('')
  const [filter, setFilter]     = useState('all')

  useEffect(() => {
    fetch('/calls-data.json')
      .then(r => r.json())
      .then(data => { setCalls(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // The detail to show: an explicit row click wins; otherwise the call the
  // command palette navigated us to (derived in render — no effect needed).
  const shown = selected ?? (focusCallId ? calls.find(c => c.call_id === focusCallId) : null)

  const closeDetail = () => {
    setSelected(null)
    onFocusConsumed?.()  // clear the palette's navigation intent
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return calls.filter(c => {
      if (filter !== 'all' && c.sale_result !== filter) return false
      if (!q) return true
      return (
        c.call_id.toLowerCase().includes(q) ||
        c.employee_name.toLowerCase().includes(q) ||
        c.product_name.toLowerCase().includes(q)
      )
    })
  }, [calls, query, filter])

  if (shown) {
    return (
      <main className="flex flex-col h-full overflow-hidden grid-bg">
        <CallDetail call={shown} onBack={closeDetail} />
      </main>
    )
  }

  return (
    <main className="flex flex-col h-full overflow-hidden grid-bg">
      {/* Page header */}
      <div className="shrink-0 px-4 sm:px-6 lg:px-8 pt-5 pb-4 border-b border-border space-y-4">
        <div>
          <h1 className="font-display font-bold text-xl lg:text-2xl text-foreground">
            Data <span className="gradient-text">Sources</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} of {calls.length} sales call transcripts
          </p>
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by ID, rep, or product…"
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-input border border-border
                         text-sm lg:text-base text-foreground placeholder:text-muted-foreground
                         focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all"
            />
          </div>
          <div className="flex gap-1.5">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`h-10 px-4 rounded-xl text-sm font-medium border transition-all ${
                  filter === f.id
                    ? 'bg-primary/15 text-primary border-primary/30'
                    : 'bg-surface border-border text-muted-foreground hover:text-foreground hover:border-border-strong'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Call list */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4">
        {loading && (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            Loading…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-center gap-2">
            <Search className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No calls match your search.</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="space-y-2 max-w-[1400px] mx-auto">
            {filtered.map(call => (
              <CallRow key={call.call_id} call={call} onClick={() => setSelected(call)} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
