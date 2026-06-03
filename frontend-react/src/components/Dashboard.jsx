import { useState, useEffect, useMemo } from 'react'
import {
  Chart as ChartJS, ArcElement, BarElement,
  CategoryScale, LinearScale, Tooltip, Legend,
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import {
  TrendingUp, Clock, Users, Package,
  Target, Sparkles, ArrowRight, Trophy, AlertTriangle, Activity,
} from 'lucide-react'
import { fmtDur, pct, groupBy, aggregate } from '../lib/callStats'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

// ── KPI card ──────────────────────────────────────────────────────────────────
function Kpi({ icon: Icon, label, value, sub, tone = 'default' }) {
  const toneRing = {
    default: 'text-muted-foreground',
    good:    'text-success',
    warn:    'text-warning',
  }[tone]
  return (
    <div className="glass rounded-2xl p-4 lg:p-5 flex flex-col gap-3 hover:border-border-strong transition-colors">
      <div className="flex items-center justify-between">
        <div className="size-9 rounded-xl bg-primary/10 border border-primary/20 grid place-items-center">
          <Icon className="size-4 text-primary" />
        </div>
        {sub && <span className={`text-[11px] font-semibold ${toneRing}`}>{sub}</span>}
      </div>
      <div>
        <div className="font-display font-bold text-2xl lg:text-3xl leading-none gradient-text">{value}</div>
        <div className="text-xs lg:text-sm text-muted-foreground mt-1.5">{label}</div>
      </div>
    </div>
  )
}

// ── Horizontal bar list (objections / products) ────────────────────────────────
function BarList({ items, max, valueFmt = v => v, barClass = 'bg-primary' }) {
  return (
    <div className="space-y-2.5">
      {items.map(({ label, value }) => (
        <div key={label}>
          <div className="flex justify-between text-xs lg:text-sm mb-1">
            <span className="text-foreground/90 capitalize">{label.replace(/_/g, ' ')}</span>
            <span className="font-semibold tabular-nums text-muted-foreground">{valueFmt(value)}</span>
          </div>
          <div className="h-2 bg-input rounded-full overflow-hidden">
            <div
              className={`h-full ${barClass} rounded-full transition-all duration-700`}
              style={{ width: `${max ? (value / max) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function SectionCard({ title, icon: Icon, children, className = '' }) {
  return (
    <div className={`glass rounded-2xl p-4 lg:p-5 flex flex-col ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon className="size-4 text-muted-foreground" />}
        <h3 className="font-display font-semibold text-sm lg:text-base text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  )
}

export default function Dashboard({ onAsk }) {
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/calls-data.json')
      .then(r => r.json())
      .then(d => { setCalls(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const stats = useMemo(() => {
    if (!calls.length) return null
    const overall = aggregate(calls)

    // Agent leaderboard — sorted by win rate then volume
    const agents = Object.entries(groupBy(calls, 'employee_name'))
      .map(([name, rows]) => ({ name, ...aggregate(rows) }))
      .sort((a, b) => b.winRate - a.winRate || b.count - a.count)

    // Objection frequency
    const objCounts = Object.entries(groupBy(calls, 'main_objection'))
      .map(([label, rows]) => ({ label, value: rows.length }))
      .sort((a, b) => b.value - a.value)

    // Product win rate
    const products = Object.entries(groupBy(calls, 'product_name'))
      .map(([label, rows]) => ({ label, value: aggregate(rows).winRate, count: rows.length }))
      .sort((a, b) => b.value - a.value)

    // Sentiment split
    const sentiment = Object.entries(groupBy(calls, 'customer_sentiment'))
      .map(([label, rows]) => ({ label, value: rows.length }))
      .sort((a, b) => b.value - a.value)

    return { overall, agents, objCounts, products, sentiment }
  }, [calls])

  if (loading) {
    return (
      <main className="h-full grid-bg grid place-items-center text-muted-foreground text-sm">
        Loading insights…
      </main>
    )
  }
  if (!stats) {
    return (
      <main className="h-full grid-bg grid place-items-center text-muted-foreground text-sm">
        No call data available.
      </main>
    )
  }

  const { overall, agents, objCounts, products, sentiment } = stats
  const topAgent = agents[0]
  const topObjection = objCounts[0]

  const doughnut = {
    labels: ['Won', 'Lost'],
    datasets: [{
      data: [overall.sales, overall.count - overall.sales],
      backgroundColor: ['#6366f1', '#1e2a3a'],
      hoverBackgroundColor: ['#818cf8', '#2d3c52'],
      borderWidth: 0,
    }],
  }

  return (
    <main className="h-full overflow-y-auto grid-bg">
      <div className="w-full px-4 sm:px-6 lg:px-8 2xl:px-12 py-6 lg:py-8 max-w-[1800px] mx-auto space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl lg:text-3xl text-foreground">
              Sales <span className="gradient-text">Overview</span>
            </h1>
            <p className="text-sm lg:text-base text-muted-foreground mt-1 flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-success animate-pulse" />
              {overall.count} calls analysed · {agents.length} reps · live intelligence
            </p>
          </div>
          <button
            onClick={() => onAsk?.('Summarize this quarter and highlight the biggest risk')}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-primary to-accent-cyan text-primary-foreground
                       font-semibold text-sm flex items-center gap-2 hover:opacity-90 transition-opacity shadow-glow"
          >
            <Sparkles className="size-4" /> Ask XSight
            <ArrowRight className="size-3.5" />
          </button>
        </div>

        {/* ── KPI strip ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-3 lg:gap-4">
          <Kpi icon={Target} label="Total Calls" value={overall.count} />
          <Kpi icon={TrendingUp} label="Win Rate" value={pct(overall.winRate)}
               sub={overall.winRate >= 0.5 ? 'healthy' : 'below target'}
               tone={overall.winRate >= 0.5 ? 'good' : 'warn'} />
          <Kpi icon={Clock} label="Avg Duration" value={fmtDur(overall.avgDur)} />
          <Kpi icon={Activity} label="Avg Performance" value={`${overall.avgPerf.toFixed(1)}`} sub="of 5" />
          <Kpi icon={Users} label="Active Reps" value={agents.length} />
          <Kpi icon={Package} label="Products" value={products.length} />
        </div>

        {/* ── AI insight banner ───────────────────────────────────────────── */}
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-accent-cyan/5 p-4 lg:p-5
                        flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="size-10 rounded-xl bg-gradient-to-br from-primary to-accent-cyan grid place-items-center shadow-glow shrink-0">
            <Sparkles className="size-5 text-primary-foreground" />
          </div>
          <p className="text-sm lg:text-base text-foreground/90 leading-relaxed flex-1">
            <span className="font-semibold text-foreground">{topAgent.name}</span> leads with a{' '}
            <span className="font-semibold text-success">{pct(topAgent.winRate)}</span> win rate, while{' '}
            <span className="font-semibold text-warning capitalize">{topObjection.label.replace(/_/g, ' ')}</span>{' '}
            is the most common objection ({topObjection.value} calls). Closing this gap is the largest opportunity.
          </p>
          <button
            onClick={() => onAsk?.(`How should reps handle ${topObjection.label.replace(/_/g, ' ')} objections?`)}
            className="text-sm font-semibold text-primary hover:text-accent-cyan transition-colors whitespace-nowrap flex items-center gap-1.5"
          >
            Explore <ArrowRight className="size-3.5" />
          </button>
        </div>

        {/* ── Main analytics grid ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">

          {/* Win rate doughnut */}
          <SectionCard title="Win / Loss" icon={Target}>
            <div className="flex items-center gap-5">
              <div className="w-28 h-28 lg:w-32 lg:h-32 shrink-0 relative">
                <Doughnut data={doughnut} options={{
                  cutout: '70%',
                  plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}` } } },
                }} />
                <div className="absolute inset-0 grid place-items-center pointer-events-none">
                  <div className="text-center">
                    <div className="font-display font-bold text-xl lg:text-2xl text-foreground">{pct(overall.winRate)}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">win</div>
                  </div>
                </div>
              </div>
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2.5">
                  <span className="size-3 rounded-sm bg-primary shrink-0" />
                  <span className="text-sm text-muted-foreground">Won</span>
                  <span className="text-sm font-bold text-foreground ml-auto">{overall.sales}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="size-3 rounded-sm bg-border shrink-0" />
                  <span className="text-sm text-muted-foreground">Lost</span>
                  <span className="text-sm font-bold text-foreground ml-auto">{overall.count - overall.sales}</span>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Objection breakdown */}
          <SectionCard title="Top Objections" icon={AlertTriangle}>
            <BarList
              items={objCounts.slice(0, products.length)}
              max={objCounts[0]?.value || 1}
              barClass="bg-gradient-to-r from-warning to-warning/60"
            />
          </SectionCard>

          {/* Product performance */}
          <SectionCard title="Product Win Rate" icon={Package}>
            <BarList
              items={products}
              max={1}
              valueFmt={pct}
              barClass="bg-gradient-to-r from-primary to-accent-cyan"
            />
          </SectionCard>

          {/* Agent leaderboard — spans 2 cols on large screens */}
          <SectionCard title="Rep Leaderboard" icon={Trophy} className="lg:col-span-2">
            <div className="space-y-2">
              {agents.map((a, i) => (
                <div key={a.name} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent/50 transition-colors">
                  <div className={`size-8 rounded-lg grid place-items-center text-xs font-bold shrink-0 ${
                    i === 0 ? 'bg-gradient-to-br from-primary to-accent-cyan text-primary-foreground' : 'bg-surface-elevated border border-border text-muted-foreground'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm lg:text-base font-semibold text-foreground truncate">{a.name}</div>
                    <div className="text-[11px] text-muted-foreground">{a.count} calls · perf {a.avgPerf.toFixed(1)}</div>
                  </div>
                  <div className="w-28 hidden sm:block">
                    <div className="h-1.5 bg-input rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-accent-cyan rounded-full"
                           style={{ width: `${a.winRate * 100}%` }} />
                    </div>
                  </div>
                  <div className={`text-sm font-bold tabular-nums w-12 text-right ${a.winRate >= 0.5 ? 'text-success' : 'text-muted-foreground'}`}>
                    {pct(a.winRate)}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Sentiment */}
          <SectionCard title="Customer Sentiment" icon={Activity}>
            <div className="space-y-3">
              {sentiment.map(s => {
                const tone = s.label === 'positive' ? 'bg-success'
                  : s.label === 'negative' ? 'bg-destructive' : 'bg-muted-foreground'
                return (
                  <div key={s.label}>
                    <div className="flex justify-between text-xs lg:text-sm mb-1">
                      <span className="text-foreground/90 capitalize">{s.label}</span>
                      <span className="font-semibold tabular-nums text-muted-foreground">
                        {Math.round((s.value / overall.count) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 bg-input rounded-full overflow-hidden">
                      <div className={`h-full ${tone} rounded-full transition-all duration-700`}
                           style={{ width: `${(s.value / overall.count) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>

        </div>
      </div>
    </main>
  )
}
