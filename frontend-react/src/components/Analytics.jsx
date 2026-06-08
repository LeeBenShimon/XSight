import { useState, useEffect, useMemo } from 'react'
import {
  Chart as ChartJS, PointElement, LineElement, BarElement,
  CategoryScale, LinearScale, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line, Scatter, Bar } from 'react-chartjs-2'
import { TrendingUp, GitCompare, Clock, AlertTriangle, Grid3x3, Sparkles, ArrowRight } from 'lucide-react'
import { isSale, pct, groupBy, aggregate } from '../lib/callStats'

ChartJS.register(PointElement, LineElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Filler)

const DAY = 86_400_000
const jitter = () => (Math.random() - 0.5) * 0.34

const AXIS = '#64748b'
const GRID = '#1e2a3a'
const baseScaleTicks = { color: AXIS, font: { size: 13 } }

function SectionCard({ title, icon: Icon, hint, children, className = '' }) {
  return (
    <div className={`glass rounded-2xl p-4 lg:p-5 flex flex-col ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="size-4 text-muted-foreground" />}
          <h3 className="font-display font-semibold text-sm lg:text-base text-foreground">{title}</h3>
        </div>
        {hint && <span className="text-xs text-muted-foreground text-right max-w-[55%]">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

// Win-rate → background colour for the agent×product heatmap.
function heatColor(winRate, count) {
  if (!count) return 'transparent'
  return `rgba(99, 102, 241, ${0.1 + winRate * 0.65})`
}

export default function Analytics({ onAsk }) {
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/calls-data.json')
      .then(r => r.json())
      .then(d => { setCalls(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const model = useMemo(() => {
    if (!calls.length) return null

    // ── Win-rate trend, bucketed by week ──────────────────────────────────
    const dated = calls
      .map(c => ({ ...c, t: Date.parse(c.call_date) }))
      .filter(c => !Number.isNaN(c.t))
      .sort((a, b) => a.t - b.t)
    const t0 = dated[0]?.t ?? 0
    const weeks = {}
    for (const c of dated) {
      const w = Math.floor((c.t - t0) / (7 * DAY))
      ;(weeks[w] ??= []).push(c)
    }
    const weekKeys = Object.keys(weeks).map(Number).sort((a, b) => a - b)
    const trend = weekKeys.map(w => {
      const rows = weeks[w]
      const start = new Date(t0 + w * 7 * DAY)
      return {
        label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        winRate: aggregate(rows).winRate,
        n: rows.length,
      }
    })

    // ── Score correlation: performance vs objection-handling ──────────────
    const won = calls.filter(isSale)
    const lost = calls.filter(c => !isSale(c))
    const toPoints = rows => rows.map(c => ({
      x: Number(c.agent_performance_score) + jitter(),
      y: Number(c.objection_handling_quality) + jitter(),
      id: c.call_id,
    }))

    // ── Duration: won vs lost (avg seconds) ───────────────────────────────
    const durWon = aggregate(won).avgDur
    const durLost = aggregate(lost).avgDur

    // ── Objection → win rate ──────────────────────────────────────────────
    const objections = Object.entries(groupBy(calls, 'main_objection'))
      .map(([label, rows]) => ({ label, ...aggregate(rows) }))
      .sort((a, b) => b.count - a.count)

    // ── Agent × Product win-rate matrix ───────────────────────────────────
    const agents = [...new Set(calls.map(c => c.employee_name))].sort()
    const products = [...new Set(calls.map(c => c.product_name))].sort()
    const matrix = agents.map(agent => ({
      agent,
      cells: products.map(product => {
        const rows = calls.filter(c => c.employee_name === agent && c.product_name === product)
        return { product, count: rows.length, winRate: rows.length ? aggregate(rows).winRate : 0 }
      }),
    }))

    // Correlation coefficient (Pearson) between performance score and outcome.
    const xs = calls.map(c => Number(c.agent_performance_score))
    const ys = calls.map(c => (isSale(c) ? 1 : 0))
    const mean = a => a.reduce((s, v) => s + v, 0) / a.length
    const mx = mean(xs), my = mean(ys)
    const cov = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0)
    const sdx = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0))
    const sdy = Math.sqrt(ys.reduce((s, y) => s + (y - my) ** 2, 0))
    const corr = sdx && sdy ? cov / (sdx * sdy) : 0

    return { trend, won: toPoints(won), lost: toPoints(lost), durWon, durLost, objections, agents, products, matrix, corr }
  }, [calls])

  if (loading) return <main className="h-full grid-bg grid place-items-center text-muted-foreground text-sm">Loading analytics…</main>
  if (!model) return <main className="h-full grid-bg grid place-items-center text-muted-foreground text-sm">No call data available.</main>

  const { trend, won, lost, durWon, durLost, objections, products, matrix, corr } = model

  const trendData = {
    labels: trend.map(t => t.label),
    datasets: [{
      label: 'Win rate',
      data: trend.map(t => Math.round(t.winRate * 100)),
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.15)',
      fill: true,
      tension: 0.35,
      pointBackgroundColor: '#22d3ee',
      pointRadius: 4,
      pointHoverRadius: 6,
    }],
  }

  const scatterData = {
    datasets: [
      { label: 'Won',  data: won,  backgroundColor: 'rgba(16, 185, 129, 0.7)',  pointRadius: 6, pointHoverRadius: 8 },
      { label: 'Lost', data: lost, backgroundColor: 'rgba(239, 68, 68, 0.65)',  pointRadius: 6, pointHoverRadius: 8 },
    ],
  }

  const durData = {
    labels: ['Won', 'Lost'],
    datasets: [{
      label: 'Avg duration (min)',
      data: [durWon / 60, durLost / 60],
      backgroundColor: ['#10b981', '#475569'],
      borderRadius: 6,
      borderSkipped: false,
    }],
  }

  return (
    <main className="h-full overflow-y-auto grid-bg">
      <div className="w-full px-4 sm:px-6 lg:px-8 2xl:px-12 py-6 lg:py-8 max-w-[1800px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl lg:text-3xl text-foreground">
              Advanced <span className="gradient-text">Analytics</span>
            </h1>
            <p className="text-sm lg:text-base text-muted-foreground mt-1">
              Correlations, trends, and segment performance across {calls.length} calls
            </p>
          </div>
          <button
            onClick={() => onAsk?.('Which factors most correlate with closing a sale?')}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-primary to-accent-cyan text-primary-foreground
                       font-semibold text-sm flex items-center gap-2 hover:opacity-90 transition-opacity shadow-glow"
          >
            <Sparkles className="size-4" /> Ask XSight <ArrowRight className="size-3.5" />
          </button>
        </div>

        {/* Correlation insight banner */}
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-accent-cyan/5 p-4 lg:p-5 flex items-center gap-3">
          <GitCompare className="size-5 text-primary shrink-0" />
          <p className="text-sm lg:text-base text-foreground/90 leading-relaxed">
            Agent performance score correlates with winning at{' '}
            <span className="font-bold text-success">r = {corr.toFixed(2)}</span>
            {' '}— {corr > 0.6 ? 'a strong positive relationship. Coaching the score moves the outcome.'
              : corr > 0.3 ? 'a moderate relationship worth coaching toward.'
              : 'a weak relationship; other factors dominate outcomes.'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">

          {/* Win-rate trend */}
          <SectionCard title="Win-Rate Trend" icon={TrendingUp} hint="Weekly, % of calls won">
            <div style={{ height: 240 }}>
              <Line data={trendData} options={{
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y}% win · ${trend[ctx.dataIndex].n} calls` } },
                },
                scales: {
                  x: { ticks: baseScaleTicks, grid: { color: GRID } },
                  y: { min: 0, max: 100, ticks: { ...baseScaleTicks, callback: v => `${v}%` }, grid: { color: GRID } },
                },
              }} />
            </div>
          </SectionCard>

          {/* Score correlation scatter */}
          <SectionCard title="Score Correlation" icon={GitCompare} hint="Performance × objection-handling, by outcome">
            <div style={{ height: 240 }}>
              <Scatter data={scatterData} options={{
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 13 }, boxWidth: 10, boxHeight: 10, usePointStyle: true } },
                  tooltip: { callbacks: { label: ctx => ` ${ctx.raw.id}: perf ${Math.round(ctx.raw.x)}, obj ${Math.round(ctx.raw.y)}` } },
                },
                scales: {
                  x: { min: 0.5, max: 5.5, title: { display: true, text: 'Performance', color: AXIS, font: { size: 13 } }, ticks: { ...baseScaleTicks, stepSize: 1 }, grid: { color: GRID } },
                  y: { min: 0.5, max: 5.5, title: { display: true, text: 'Objection handling', color: AXIS, font: { size: 13 } }, ticks: { ...baseScaleTicks, stepSize: 1 }, grid: { color: GRID } },
                },
              }} />
            </div>
          </SectionCard>

          {/* Duration won vs lost */}
          <SectionCard title="Duration vs Outcome" icon={Clock} hint="Avg call length, minutes">
            <div style={{ height: 200 }}>
              <Bar data={durData} options={{
                indexAxis: 'y',
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x.toFixed(1)} min avg` } },
                },
                scales: {
                  x: { min: 0, ticks: { ...baseScaleTicks, callback: v => `${v}m` }, grid: { color: GRID } },
                  y: { ticks: { color: '#94a3b8', font: { size: 13 } }, grid: { display: false } },
                },
              }} />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Won calls run {((durWon - durLost) / 60).toFixed(1)} min longer on average — discovery depth tracks with closing.
            </p>
          </SectionCard>

          {/* Objection → win rate */}
          <SectionCard title="Objection → Win Rate" icon={AlertTriangle} hint="How often each objection still closes">
            <div className="space-y-2.5">
              {objections.map(o => (
                <div key={o.label}>
                  <div className="flex justify-between text-xs lg:text-sm mb-1">
                    <span className="text-foreground/90 capitalize">{o.label.replace(/_/g, ' ')}</span>
                    <span className="font-semibold tabular-nums text-muted-foreground">{pct(o.winRate)} · {o.count}</span>
                  </div>
                  <div className="h-2 bg-input rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${o.winRate >= 0.5 ? 'bg-gradient-to-r from-success to-success/60' : 'bg-gradient-to-r from-destructive to-destructive/50'}`}
                      style={{ width: `${o.winRate * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Agent × Product heatmap — full width */}
          <SectionCard title="Rep × Product Win Rate" icon={Grid3x3} hint="Darker = higher win rate · — = no calls" className="lg:col-span-2">
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1 min-w-[520px]">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider p-2">Rep</th>
                    {products.map(p => (
                      <th key={p} className="text-center text-xs font-medium text-muted-foreground p-2">{p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map(row => (
                    <tr key={row.agent}>
                      <td className="text-sm font-medium text-foreground/90 p-2 whitespace-nowrap">{row.agent}</td>
                      {row.cells.map(cell => (
                        <td
                          key={cell.product}
                          className="text-center rounded-lg p-2 border border-border"
                          style={{ background: heatColor(cell.winRate, cell.count) }}
                          title={cell.count ? `${row.agent} · ${cell.product}: ${pct(cell.winRate)} (${cell.count} calls)` : 'No calls'}
                        >
                          {cell.count ? (
                            <span className="text-sm font-semibold text-foreground">{pct(cell.winRate)}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

        </div>
      </div>
    </main>
  )
}
