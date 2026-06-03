import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send, Sparkles, FileText, TrendingUp,
  Copy, ThumbsUp, ThumbsDown, RotateCcw,
} from 'lucide-react'
import {
  Chart as ChartJS, ArcElement, BarElement,
  CategoryScale, LinearScale, Tooltip, Legend,
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const CALL_RE = /\bCALL_\d{3}\b/g
const parseCallRefs = text => [...new Set(text.match(CALL_RE) || [])]

// ── Analytics: doughnut ───────────────────────────────────────────────────────
function DoughnutChart({ data }) {
  const labels = Object.keys(data.counts)
  const values = Object.values(data.counts)
  const bg = ['#6366f1', '#334155']
  const hoverBg = ['#818cf8', '#475569']
  const chartData = { labels, datasets: [{ data: values, backgroundColor: bg, hoverBackgroundColor: hoverBg, borderWidth: 0 }] }

  return (
    <div className="mt-3 glass rounded-xl p-3 sm:p-4">
      {/* Row on sm+, column on mobile — sm is 640px, always available in Tailwind */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="w-24 h-24 sm:w-28 sm:h-28 shrink-0">
          <Doughnut data={chartData} options={{
            cutout: '68%',
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}` } } },
          }} />
        </div>
        <div className="space-y-2 w-full sm:w-auto">
          {labels.map((label, i) => (
            <div key={label} className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: bg[i] }} />
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="text-sm font-bold text-foreground ml-auto pl-3">{values[i]}</span>
            </div>
          ))}
          {data.win_rate !== undefined && (
            <div className="pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">Win rate </span>
              <span className="text-xs font-semibold text-primary">{Math.round(data.win_rate * 100)}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Analytics: comparison bar ─────────────────────────────────────────────────
function ComparisonChart({ successful: s, unsuccessful: u }) {
  const barData = {
    labels: ['Performance', 'Objection Handling'],
    datasets: [
      { label: 'Successful',   data: [s.avg_performance_score, s.avg_objection_handling], backgroundColor: '#6366f1', borderRadius: 4, borderSkipped: false },
      { label: 'Unsuccessful', data: [u.avg_performance_score, u.avg_objection_handling], backgroundColor: '#475569', borderRadius: 4, borderSkipped: false },
    ],
  }
  const fmt = secs => `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`

  return (
    <div className="mt-3 glass rounded-xl p-3 sm:p-4">
      {/* 1 col mobile → 2 col sm+ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        <div className="bg-surface-elevated rounded-lg p-2.5 border border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Successful avg</p>
          <p className="text-sm font-bold text-success">{fmt(s.avg_duration_seconds)}</p>
          <p className="text-[10px] text-muted-foreground">{s.count} calls · top: {s.top_objection}</p>
        </div>
        <div className="bg-surface-elevated rounded-lg p-2.5 border border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Unsuccessful avg</p>
          <p className="text-sm font-bold text-muted-foreground">{fmt(u.avg_duration_seconds)}</p>
          <p className="text-[10px] text-muted-foreground">{u.count} calls · top: {u.top_objection}</p>
        </div>
      </div>
      <div style={{ height: 80 }}>
        <Bar data={barData} options={{
          indexAxis: 'y',
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12, boxHeight: 12 } } },
          scales: {
            x: { min: 0, max: 5, ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: '#1e2a3a' } },
            y: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { display: false } },
          },
        }} />
      </div>
    </div>
  )
}

// ── Analytics: agent stat pills ───────────────────────────────────────────────
function AgentMetrics({ data }) {
  const pills = [
    { label: 'Total Calls', value: data.total_calls },
    { label: 'Sales',       value: data.sales ?? '—' },
    { label: 'Win Rate',    value: data.win_rate !== undefined ? `${Math.round(data.win_rate * 100)}%` : '—' },
    { label: 'Avg Perf.',   value: data.avg_performance_score ?? '—' },
    { label: 'Avg Obj.',    value: data.avg_objection_handling ?? '—' },
    { label: 'No Sales',    value: data.no_sales ?? '—' },
  ]
  return (
    /* 2 cols on mobile so values are never squished; 3 cols on sm+ */
    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
      {pills.map(p => (
        <div key={p.label} className="glass rounded-xl p-2.5 sm:p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{p.label}</div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="font-display font-bold text-base sm:text-lg gradient-text">{p.value}</span>
            {p.label === 'Win Rate' && data.win_rate > 0.6 && (
              <TrendingUp className="size-3 text-success" />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function AnalyticsChart({ data }) {
  if (!data) return null
  if (data.counts) return <DoughnutChart data={data} />
  if (data.successful && data.unsuccessful) return <ComparisonChart {...data} />
  if (data.agent && data.total_calls !== undefined) return <AgentMetrics data={data} />
  return null
}

// ── Call reference card ───────────────────────────────────────────────────────
function CallCard({ callId }) {
  return (
    <div className="flex items-center gap-2.5 bg-surface-elevated border border-border rounded-lg px-3 py-2 hover:border-primary/30 transition-colors cursor-pointer">
      <div className="size-7 rounded-md bg-primary/10 border border-primary/20 grid place-items-center shrink-0">
        <FileText className="size-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs lg:text-sm font-semibold text-foreground truncate" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{callId}</p>
        <p className="text-[10px] text-muted-foreground">Sales transcript</p>
      </div>
      <TrendingUp className="size-3 text-muted-foreground shrink-0" />
    </div>
  )
}

// ── Bold markdown renderer ────────────────────────────────────────────────────
function formatMarkdown(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  )
}

// ── User bubble ───────────────────────────────────────────────────────────────
function UserBubble({ content }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] sm:max-w-[78%] lg:max-w-[70%]
                      bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/20
                      rounded-2xl rounded-tr-sm px-3 sm:px-4 py-2.5 text-base lg:text-lg text-foreground break-words">
        {content}
      </div>
    </div>
  )
}

// ── Bot bubble ────────────────────────────────────────────────────────────────
function BotBubble({ message }) {
  const [copied, setCopied] = useState(false)
  const [reaction, setReaction] = useState(null)

  const copy = () => {
    navigator.clipboard.writeText(message.content).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const engineBadge = () => {
    if (message.sourceEngine === 'analytics')
      return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/20 whitespace-nowrap">⊞ Computed</span>
    if (message.sourceEngine === 'bedrock' || message.sourceEngine === 'knowledge')
      return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/20 whitespace-nowrap">◈ Knowledge Base</span>
    return null
  }

  return (
    <div className="flex gap-2.5 sm:gap-3 animate-fade-in-up">
      <div className="size-8 sm:size-9 rounded-xl bg-gradient-to-br from-primary to-accent-cyan shrink-0 grid place-items-center shadow-glow mt-0.5">
        <Sparkles className="size-3.5 sm:size-4 text-primary-foreground" strokeWidth={2.5} />
      </div>

      <div className="flex-1 min-w-0 space-y-2 sm:space-y-3">
        <div className="flex items-center flex-wrap gap-2">
          <span className="font-display font-semibold text-base lg:text-lg text-foreground">XSight</span>
          {engineBadge()}
        </div>

        <div className={`text-base lg:text-lg leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere ${
          message.sourceEngine === 'error' ? 'text-destructive' : 'text-foreground/90'
        }`}>
          {formatMarkdown(message.content)}
        </div>

        {message.sourceEngine === 'analytics' && message.data && (
          <AnalyticsChart data={message.data} />
        )}

        {parseCallRefs(message.content).length > 0 && (
          <div className="space-y-1.5">
            {parseCallRefs(message.content).map(id => <CallCard key={id} callId={id} />)}
          </div>
        )}

        {message.citations && message.citations.length > 0 && (
          <div className="glass rounded-xl p-2.5 sm:p-3 space-y-2">
            <div className="flex items-center gap-2 text-[11px] lg:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <FileText className="size-3 shrink-0" />
              Sources ({message.citations.length})
            </div>
            <div className="space-y-1.5">
              {message.citations.map((c, i) => (
                <div key={i} className="text-xs lg:text-sm p-2.5 rounded-lg bg-surface/50 border border-border hover:border-primary/30 transition-colors cursor-pointer break-words">
                  {typeof c === 'string'
                    ? <div className="text-muted-foreground italic">{c}</div>
                    : <>
                        {c.source && <div className="text-[10px] font-semibold text-primary mb-1">{c.source}</div>}
                        <div className="text-muted-foreground italic">{c.content || c.text || JSON.stringify(c)}</div>
                      </>
                  }
                </div>
              ))}
            </div>
          </div>
        )}

        {message.sourceEngine !== 'error' && (
          <div className="flex items-center gap-0.5">
            <button onClick={copy} className={`size-7 rounded-md grid place-items-center transition-colors ${copied ? 'text-success' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
              <Copy className="size-3.5" />
            </button>
            <button onClick={() => setReaction(r => r === 'up' ? null : 'up')} className={`size-7 rounded-md grid place-items-center transition-colors ${reaction === 'up' ? 'text-success' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
              <ThumbsUp className="size-3.5" />
            </button>
            <button onClick={() => setReaction(r => r === 'down' ? null : 'down')} className={`size-7 rounded-md grid place-items-center transition-colors ${reaction === 'down' ? 'text-destructive' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
              <ThumbsDown className="size-3.5" />
            </button>
            <button className="size-7 rounded-md grid place-items-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <RotateCcw className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Suggestions ───────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  'Summarize win rate',
  'Compare successful vs unsuccessful calls',
  'How did Sarah Levi perform?',
  'Top objections this quarter',
  'Compare rep performance',
  'Tell me about pricing objections',
]

// ── Main component ────────────────────────────────────────────────────────────
export default function ChatPanel({ messages, isLoading, onSend }) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const textareaRef    = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const submit = useCallback(() => {
    const q = input.trim()
    if (!q || isLoading) return
    onSend(q)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [input, isLoading, onSend])

  const handleKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const handleChange = e => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }

  return (
    <main className="flex flex-col overflow-hidden min-w-0 grid-bg">

      {/* ── Messages list ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/*
          NO max-w centering here — the chat fills the panel naturally.
          Padding scales with viewport: tight on mobile, generous on desktop.
          This prevents the "narrow column floating in empty space" problem.
        */}
        <div className="w-full max-w-4xl 2xl:max-w-5xl mx-auto px-3 sm:px-5 md:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5">

          {/* Empty state — centered inside the full-width container */}
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center text-center
                            min-h-[40vh] sm:min-h-[50vh] px-2">
              <div className="relative mb-4 sm:mb-6">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary to-accent-cyan blur-2xl opacity-30 animate-pulse" />
                <div className="relative size-14 sm:size-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent-cyan/20 border border-primary/20 grid place-items-center">
                  <Sparkles className="size-6 sm:size-7 text-primary" strokeWidth={1.5} />
                </div>
              </div>
              <h2 className="font-display font-bold text-xl sm:text-2xl lg:text-3xl text-foreground mb-2">
                Ask X<span className="gradient-text">Sight</span> anything
              </h2>
              <p className="text-sm lg:text-base text-muted-foreground mb-6 sm:mb-8 max-w-sm leading-relaxed">
                Query your sales data using natural language. Compare agents,
                analyse objections, or explore call transcripts.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => onSend(s)}
                    className="text-sm lg:text-base px-3 py-1.5 rounded-full border border-border bg-surface
                               hover:bg-accent hover:border-border-strong transition-all
                               text-muted-foreground hover:text-foreground">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg =>
            msg.role === 'user'
              ? <UserBubble key={msg.id} content={msg.content} />
              : <BotBubble  key={msg.id} message={msg} />
          )}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex gap-2.5 sm:gap-3 animate-fade-in-up">
              <div className="size-8 sm:size-9 rounded-xl bg-gradient-to-br from-primary to-accent-cyan shrink-0 grid place-items-center shadow-glow">
                <Sparkles className="size-3.5 sm:size-4 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <div className="glass rounded-2xl rounded-tl-sm px-4 py-3.5">
                <div className="flex gap-1.5 items-center">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="size-1.5 rounded-full bg-muted-foreground animate-bounce"
                         style={{ animationDelay: `${i * 0.16}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Composer ───────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border bg-surface/60 backdrop-blur-xl">
        {/*
          Same horizontal padding as the message list so the composer
          aligns visually with the messages above it.
        */}
        <div className="w-full max-w-4xl 2xl:max-w-5xl mx-auto px-3 sm:px-5 md:px-6 lg:px-8 py-2.5 sm:py-3 md:py-4">

          {/* Suggestion chips — shown when a conversation is active */}
          {messages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2 sm:mb-3">
              {SUGGESTIONS.slice(0, 4).map(s => (
                <button key={s} onClick={() => onSend(s)}
                  className="text-sm lg:text-base px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-border
                             bg-surface hover:bg-accent hover:border-border-strong
                             transition-all text-muted-foreground hover:text-foreground">
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input area */}
          <div className="bg-surface/80 backdrop-blur-xl border border-border rounded-xl sm:rounded-2xl
                          p-1.5 sm:p-2 flex items-end gap-1.5 sm:gap-2 shadow-elevated
                          focus-within:border-primary/40 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your sales calls…"
              rows={1}
              className="flex-1 bg-transparent resize-none py-2 sm:py-2.5 px-1
                         text-base lg:text-lg text-foreground placeholder:text-muted-foreground
                         focus:outline-none min-h-[20px] max-h-32"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            />

            <button
              onClick={submit}
              disabled={!input.trim() || isLoading}
              className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl
                         bg-gradient-to-r from-primary to-accent-cyan text-primary-foreground
                         font-semibold text-sm flex items-center gap-1.5 hover:opacity-90
                         transition-opacity shadow-glow disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <span className="hidden sm:inline">Send</span>
              <Send className="size-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between mt-1.5 sm:mt-2 px-0.5">
            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 min-w-0">
              <Sparkles className="size-3 shrink-0" />
              <span className="truncate">Powered by Amazon Bedrock · Deterministic Analytics</span>
            </div>
            <div className="text-[10px] text-muted-foreground hidden md:block shrink-0 ml-2">
              Enter to send
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
