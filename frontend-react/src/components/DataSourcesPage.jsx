import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  ArrowLeft, FileText, User, Calendar, Package,
  Clock, TrendingUp, AlertCircle, CheckCircle,
  XCircle, Target, Lightbulb, BarChart2, Search, ChevronRight,
  UploadCloud, Loader2,
} from 'lucide-react'

function formatDuration(secs) {
  const s = Number(secs)
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function SalesBadge({ result }) {
  const ok      = result === 'Sale'
  const pending = result === 'Pending'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
      pending
        ? 'bg-warning/15 text-warning border-warning/30'
        : ok
        ? 'bg-success/15 text-success border-success/30'
        : 'bg-destructive/15 text-destructive border-destructive/30'
    }`}>
      {pending ? <Clock className="size-3" /> : ok ? <CheckCircle className="size-3" /> : <XCircle className="size-3" />}
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
      <div className={`size-7 rounded-full shrink-0 grid place-items-center text-xs font-bold text-primary-foreground ${
        isAgent ? 'bg-gradient-to-br from-primary to-accent-cyan' : 'bg-surface-elevated border border-border text-muted-foreground'
      }`}>
        {isAgent ? 'A' : 'C'}
      </div>
      <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm lg:text-base ${
        isAgent
          ? 'bg-primary/10 border border-primary/20 text-foreground rounded-tl-none'
          : 'bg-surface-elevated border border-border text-foreground/90 rounded-tr-none'
      }`}>
        <div className={`text-xs font-semibold mb-1 ${isAgent ? 'text-primary' : 'text-muted-foreground'}`}>
          {speaker}
        </div>
        {text}
      </div>
    </div>
  )
}

// ── Call detail view ──────────────────────────────────────────────────────────
function CallDetail({ call, onBack }) {
  const [fetched, setFetched]   = useState(null)
  const [loadingTx, setLoadingTx] = useState(false)

  // Analyzed calls (from the CSV) carry no transcript, so fetch it from S3 on
  // open. Calls that already have inline transcript text skip the request.
  useEffect(() => {
    if (call.transcript) { setFetched(null); return }
    let cancelled = false
    setLoadingTx(true)
    setFetched(null)
    fetch(`/api/calls/${encodeURIComponent(call.call_id)}/transcript`)
      .then(r => (r.ok ? r.text() : ''))
      .then(text => { if (!cancelled) setFetched(text) })
      .catch(() => { if (!cancelled) setFetched('') })
      .finally(() => { if (!cancelled) setLoadingTx(false) })
    return () => { cancelled = true }
  }, [call.call_id, call.transcript])

  const transcriptText = call.transcript || fetched || ''
  const txLines = transcriptText ? transcriptText.split('\n').filter(l => l.trim()) : []

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
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider mb-1">
                <Icon className="size-3" />{label}
              </div>
              <div className="text-sm lg:text-base font-semibold text-foreground truncate">{value}</div>
            </div>
          ))}
        </div>

        {/* Scores row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="glass rounded-xl p-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Performance Score</div>
            <ScoreDots value={call.agent_performance_score} />
          </div>
          <div className="glass rounded-xl p-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Objection Handling</div>
            <ScoreDots value={call.objection_handling_quality} />
          </div>
          <div className="glass rounded-xl p-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Closing Attempt</div>
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
        {(loadingTx || txLines.length > 0) && (
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              <FileText className="size-3.5" />Transcript
            </div>
            {loadingTx ? (
              <div className="glass rounded-xl p-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />Loading transcript…
              </div>
            ) : (
              <div className="glass rounded-xl p-4 space-y-3">
                {txLines.map((line, i) => <TranscriptLine key={i} line={line} />)}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// ── List row ────────────────────────────────────────────────────────────────
// Renders either a full analyzed call or, when the file exists in S3 but has no
// analyzed metadata yet, a compact "Pending" row (filename + upload date).
function CallRow({ call, onClick }) {
  const ok      = call.sale_result === 'Sale'
  const pending = call._pending

  return (
    <button
      onClick={onClick}
      className="group w-full glass rounded-xl px-3 sm:px-4 py-3 flex items-center gap-3 sm:gap-4
                 hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
    >
      {/* Icon */}
      <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center shrink-0
                      group-hover:bg-primary/20 transition-colors">
        <FileText className="size-4 text-primary" />
      </div>

      {pending ? (
        <>
          {/* Filename */}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground truncate" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {call._filename ?? `${call.call_id}.txt`}
            </div>
            <div className="text-xs text-muted-foreground truncate">Awaiting analysis</div>
          </div>

          {/* Upload date — sm+ */}
          {call._uploadedAt && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <Calendar className="size-3" />{formatDate(call._uploadedAt)}
            </div>
          )}

          {/* Pending badge + chevron */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border
                             bg-warning/15 text-warning border-warning/30">
              <Clock className="size-3" />
              <span className="hidden sm:inline">Pending</span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
          </div>
        </>
      ) : (
        <>
          {/* ID + product */}
          <div className="min-w-0 w-28 sm:w-36 shrink-0">
            <div className="text-sm font-semibold text-foreground truncate" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {call.call_id}
            </div>
            <div className="text-xs text-muted-foreground truncate">{call.product_name}</div>
          </div>

          {/* Agent — hidden on mobile */}
          <div className="hidden md:block min-w-0 flex-1">
            <div className="text-sm text-foreground/90 truncate">{call.employee_name}</div>
            <div className="text-xs text-muted-foreground truncate">{call.team_name}</div>
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
            <span className={`inline-flex items-center justify-center gap-1 w-20 py-0.5 rounded-full text-xs font-semibold border ${
              ok ? 'bg-success/15 text-success border-success/30' : 'bg-destructive/15 text-destructive border-destructive/30'
            }`}>
              {ok ? <CheckCircle className="size-3" /> : <XCircle className="size-3" />}
              <span className="hidden sm:inline">{call.sale_result}</span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
          </div>
        </>
      )}
    </button>
  )
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const FILTERS = [
  { id: 'all',     label: 'All' },
  { id: 'Sale',    label: 'Won' },
  { id: 'No Sale', label: 'Lost' },
]

// Build a placeholder call entry from an S3 file record (GET /api/calls) that
// has no analyzed metadata yet. Flagged _pending so the UI styles it as such.
function pendingCallFromFile(file) {
  return {
    call_id:                    file.name.replace(/\.txt$/i, ''),
    _filename:                  file.name,
    _uploadedAt:                file.last_modified,
    _size:                      file.size,
    product_name:               '—',
    employee_name:              '—',
    team_name:                  '—',
    call_date:                  file.last_modified ? new Date(file.last_modified).toISOString().slice(0, 10) : '',
    duration_seconds:           0,
    sale_result:                'Pending',
    agent_performance_score:    0,
    objection_handling_quality: 0,
    closing_attempt:            'no',
    call_summary:               'This call exists in storage but has not been analyzed yet.',
    missed_opportunity:         '—',
    success_failure_reason:     '—',
    recommended_improvement:    '—',
    transcript:                 '',
    _pending: true,
  }
}

// ── Upload section ────────────────────────────────────────────────────────────
function UploadSection({ onUploaded }) {
  const [file, setFile]           = useState(null)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus]       = useState(null)  // { type: 'success'|'error', message }
  const inputRef = useRef(null)

  const pickFile = (e) => {
    const f = e.target.files?.[0] ?? null
    setStatus(null)
    if (f && !f.name.toLowerCase().endsWith('.txt')) {
      setFile(null)
      setStatus({ type: 'error', message: 'Only .txt files are allowed.' })
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setFile(f)
  }

  const upload = async () => {
    if (!file) return
    setUploading(true)
    setStatus(null)

    try {
      const body = new FormData()
      body.append('file', file)
      const res  = await fetch('/upload', { method: 'POST', body })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setStatus({ type: 'success', message: data.message || `Uploaded ${file.name}.` })
        onUploaded?.(file)
        setFile(null)
        if (inputRef.current) inputRef.current.value = ''
      } else {
        setStatus({ type: 'error', message: data.error || 'Upload failed.' })
      }
    } catch {
      setStatus({ type: 'error', message: 'Network error during upload.' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="glass rounded-xl p-3 flex flex-col gap-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
          <UploadCloud className="size-4 text-primary" />
          Upload transcript
        </div>

        {/* File picker — styled label wrapping a hidden input */}
        <label className="flex-1 min-w-0 h-10 flex items-center px-3 rounded-xl bg-input border border-border
                          text-sm text-foreground cursor-pointer hover:border-primary/50 transition-colors">
          <input
            ref={inputRef}
            type="file"
            accept=".txt"
            onChange={pickFile}
            className="hidden"
          />
          <span className={`truncate ${file ? 'text-foreground' : 'text-muted-foreground'}`}>
            {file ? file.name : 'Choose a .txt file…'}
          </span>
        </label>

        <button
          onClick={upload}
          disabled={!file || uploading}
          className="h-10 px-4 rounded-xl text-sm font-medium border transition-all shrink-0
                     inline-flex items-center justify-center gap-1.5
                     bg-primary/15 text-primary border-primary/30 hover:bg-primary/25
                     disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary/15"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      {status && (
        <div className={`flex items-center gap-1.5 text-xs font-medium ${
          status.type === 'success' ? 'text-success' : 'text-destructive'
        }`}>
          {status.type === 'success'
            ? <CheckCircle className="size-3.5 shrink-0" />
            : <AlertCircle className="size-3.5 shrink-0" />}
          {status.message}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DataSourcesPage({ focusCallId, onFocusConsumed }) {
  const [analyzed, setAnalyzed] = useState([])   // analyzed metadata (GET /api/analyzed-calls)
  const [s3Files, setS3Files]   = useState([])   // raw file list (GET /api/calls)
  const [loadingAnalyzed, setLoadingAnalyzed] = useState(true)
  const [loadingFiles, setLoadingFiles]       = useState(true)
  const [selected, setSelected] = useState(null)
  const [query, setQuery]       = useState('')
  const [filter, setFilter]     = useState('all')

  // Analyzed metadata — read live from the CSV in S3 so freshly processed
  // uploads show up as full rows after a refresh.
  useEffect(() => {
    fetch('/api/analyzed-calls')
      .then(r => r.json())
      .then(data => setAnalyzed(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingAnalyzed(false))
  }, [])

  // S3 file list — re-runnable so we can refresh after an upload.
  const loadFiles = useCallback(() => {
    setLoadingFiles(true)
    fetch('/api/calls')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setS3Files(data) })
      .catch(() => {})
      .finally(() => setLoadingFiles(false))
  }, [])
  useEffect(() => { loadFiles() }, [loadFiles])

  const loading = loadingAnalyzed || loadingFiles

  // After a successful upload: optimistically put the new file on top, then
  // reconcile with the server (the file has no analyzed metadata yet, so it
  // surfaces as a "Pending" row).
  const handleUploaded = (file) => {
    setS3Files(prev => [
      { name: file.name, size: file.size, last_modified: new Date().toISOString() },
      ...prev.filter(f => f.name !== file.name),
    ])
    loadFiles()
  }

  // The unified list: S3 files with no analyzed metadata become "Pending" rows
  // (newest first, on top); analyzed calls follow in their natural order.
  const calls = useMemo(() => {
    const analyzedIds = new Set(analyzed.map(c => c.call_id))
    const pending = s3Files
      .filter(f => !analyzedIds.has(f.name.replace(/\.txt$/i, '')))
      .map(pendingCallFromFile)
    return [...pending, ...analyzed]
  }, [analyzed, s3Files])

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
        (c.call_id || '').toLowerCase().includes(q) ||
        (c.employee_name || '').toLowerCase().includes(q) ||
        (c.product_name || '').toLowerCase().includes(q)
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

        {/* Upload */}
        <UploadSection onUploaded={handleUploaded} />
      </div>

      {/* Unified call list */}
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
