// Shared, framework-agnostic helpers for deriving stats from calls-data.json.
// Used by Dashboard, Analytics, and the chat InsightsPanel so the numbers
// stay consistent across every surface.

export const isSale = c => String(c.sale_result).toLowerCase() === 'sale'
export const fmtDur = secs => `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`
export const pct = n => `${Math.round(n * 100)}%`

/** Group rows into { key: rows[] }. */
export function groupBy(rows, key) {
  return rows.reduce((acc, r) => {
    (acc[r[key]] ??= []).push(r)
    return acc
  }, {})
}

/** Summary stats for a set of call rows. */
export function aggregate(rows) {
  const sales = rows.filter(isSale)
  const avg = sel => (rows.length ? rows.reduce((s, r) => s + Number(r[sel] || 0), 0) / rows.length : 0)
  return {
    count: rows.length,
    sales: sales.length,
    winRate: rows.length ? sales.length / rows.length : 0,
    avgPerf: avg('agent_performance_score'),
    avgObj: avg('objection_handling_quality'),
    avgDur: avg('duration_seconds'),
  }
}
