import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, AlertTriangle, Clock, Users, Target, Zap } from 'lucide-react'

const isSale = c => String(c.sale_result).toLowerCase() === 'sale'
const fmtDur = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

function MetricCard({ icon: Icon, label, value, delta, positive }) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <Icon className="size-3.5 text-muted-foreground" />
        <span className={`text-xs font-semibold ${positive ? 'text-success' : 'text-muted-foreground'}`}>
          {delta}
        </span>
      </div>
      <div className="font-display font-bold text-lg xl:text-xl leading-none text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  )
}

function AlertCard({ icon: Icon, tone, title, desc }) {
  const toneClass = tone === 'warning'
    ? 'border-warning/30 bg-warning/5'
    : 'border-primary/30 bg-primary/5'
  const iconClass = tone === 'warning' ? 'text-warning' : 'text-primary'

  return (
    <div className={`rounded-xl border ${toneClass} p-3 flex gap-2.5`}>
      <Icon className={`size-4 shrink-0 mt-0.5 ${iconClass}`} />
      <div className="min-w-0">
        <div className="text-xs xl:text-sm font-semibold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{desc}</div>
      </div>
    </div>
  )
}

export default function InsightsPanel() {
  const [calls, setCalls] = useState([])

  useEffect(() => {
    fetch('/calls-data.json').then(r => r.json()).then(setCalls).catch(() => {})
  }, [])

  const insights = useMemo(() => {
    if (!calls.length) return null
    const sales = calls.filter(isSale)
    const winRate = sales.length / calls.length
    const avgDur = calls.reduce((s, c) => s + Number(c.duration_seconds || 0), 0) / calls.length
    const reps = new Set(calls.map(c => c.employee_name))

    // Sentiment split (real)
    const sentCounts = calls.reduce((acc, c) => {
      const k = c.customer_sentiment || 'unknown'
      acc[k] = (acc[k] || 0) + 1
      return acc
    }, {})
    const sentiment = ['positive', 'neutral', 'negative', 'hesitant'].filter(k => sentCounts[k]).map(k => ({
      label: k[0].toUpperCase() + k.slice(1),
      value: Math.round((sentCounts[k] / calls.length) * 100),
      color: k === 'positive' ? 'bg-success' : k === 'negative' ? 'bg-destructive' : 'bg-muted-foreground',
    }))

    // Top objections (real) — replaces the old fabricated word cloud
    const objCounts = calls.reduce((acc, c) => {
      acc[c.main_objection] = (acc[c.main_objection] || 0) + 1
      return acc
    }, {})
    const objections = Object.entries(objCounts)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    // Top performer (real)
    const byAgent = calls.reduce((acc, c) => {
      (acc[c.employee_name] ??= []).push(c)
      return acc
    }, {})
    const ranked = Object.entries(byAgent)
      .map(([name, rows]) => ({
        name,
        winRate: rows.filter(isSale).length / rows.length,
        avgPerf: rows.reduce((s, r) => s + Number(r.agent_performance_score || 0), 0) / rows.length,
      }))
      .sort((a, b) => b.winRate - a.winRate)
    const top = ranked[0]
    const topObj = objections[0]

    return {
      metrics: [
        { icon: Target,     label: 'Calls',        value: String(calls.length), delta: 'total',                   positive: false },
        { icon: TrendingUp, label: 'Win Rate',     value: `${Math.round(winRate * 100)}%`, delta: `${sales.length}/${calls.length}`, positive: winRate >= 0.5 },
        { icon: Clock,      label: 'Avg Duration', value: fmtDur(avgDur), delta: `${Math.round(avgDur)}s`,         positive: true },
        { icon: Users,      label: 'Active Reps',  value: String(reps.size), delta: 'agents',                     positive: false },
      ],
      sentiment,
      objections,
      alerts: [
        topObj && {
          icon: AlertTriangle, tone: 'warning',
          title: `${topObj.word.replace(/_/g, ' ')} objections high`,
          desc: `Most common objection across ${topObj.count} of ${calls.length} calls.`,
        },
        top && {
          icon: Zap, tone: 'primary',
          title: `${top.name} top performer`,
          desc: `${Math.round(top.winRate * 100)}% win rate · avg performance ${top.avgPerf.toFixed(1)}.`,
        },
      ].filter(Boolean),
    }
  }, [calls])

  return (
    <aside className="hidden lg:flex flex-col w-full border-l border-border bg-surface/40 backdrop-blur-xl overflow-y-auto">
      <div className="p-4 xl:p-5 border-b border-border min-h-[3.5rem] md:min-h-[4rem] flex flex-col justify-center">
        <h2 className="font-display font-semibold text-sm xl:text-base text-foreground">Real-Time Insights</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Live data · {calls.length || '…'} calls</p>
      </div>

      {!insights ? (
        <div className="flex-1 grid place-items-center text-xs text-muted-foreground">Loading…</div>
      ) : (
        <div className="p-3 xl:p-4 space-y-3 xl:space-y-4">
          {/* Key metrics */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Key Metrics</div>
            <div className="grid grid-cols-2 gap-2">
              {insights.metrics.map(m => <MetricCard key={m.label} {...m} />)}
            </div>
          </div>

          {/* Sentiment */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Call Sentiment</div>
            <div className="glass rounded-xl p-4 space-y-3">
              {insights.sentiment.map(s => (
                <div key={s.label}>
                  <div className="flex justify-between text-xs xl:text-sm mb-1">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="font-semibold tabular-nums text-foreground">{s.value}%</span>
                  </div>
                  <div className="h-1.5 bg-input rounded-full overflow-hidden">
                    <div className={`h-full ${s.color} rounded-full transition-all duration-700`} style={{ width: `${s.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Active Alerts</div>
            <div className="space-y-2">
              {insights.alerts.map(a => <AlertCard key={a.title} {...a} />)}
            </div>
          </div>

          {/* Top objections — sized by real frequency */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Top Objections</div>
            <div className="flex flex-wrap gap-1.5">
              {insights.objections.map(t => (
                <span
                  key={t.word}
                  className="px-2.5 py-1 rounded-md bg-surface border border-border text-muted-foreground capitalize text-xs"
                >
                  {t.word.replace(/_/g, ' ')}
                  <span className="text-muted-foreground/70 ml-1 text-xs">{t.count}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
