import {
  LayoutDashboard, MessagesSquare, FileSearch,
  BarChart3, Database, Settings, LifeBuoy, Sparkles, X, Menu,
} from 'lucide-react'

const NAV = [
  { id: 'overview',  icon: LayoutDashboard, label: 'Overview' },
  { id: 'calls',     icon: MessagesSquare,  label: 'Sales Calls', badge: '20' },
  { id: 'knowledge', icon: FileSearch,      label: 'Knowledge Base' },
  { id: 'analytics', icon: BarChart3,       label: 'Analytics' },
  { id: 'data',      icon: Database,        label: 'Data Sources' },
]

const BOTTOM_NAV = [
  { id: 'settings', icon: Settings, label: 'Settings' },
  { id: 'support',  icon: LifeBuoy, label: 'Support' },
]

const RECENT_CALLS = Array.from({ length: 12 }, (_, i) => ({
  id: `CALL_${String(i + 1).padStart(3, '0')}`,
  time: i === 0 ? '12 min ago' : i < 2 ? '1 hour ago' : i < 4 ? 'Yesterday' : '2 days ago',
}))

function SidebarContent({ active, setActive, onClose, collapsed, onToggleCollapse }) {
  return (
    <>
      {/* Logo / header */}
      <div
        className={`flex items-center border-b border-border shrink-0 ${
          collapsed ? 'justify-center px-2' : 'gap-3 px-5'
        }`}
        style={{ height: 'var(--topbar-h, 3.75rem)' }}
      >
        {!collapsed && (
          <>
            <div className="size-8 rounded-lg bg-gradient-to-br from-primary to-accent-cyan grid place-items-center shadow-glow shrink-0">
              <Sparkles className="size-4 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-sm lg:text-base leading-tight text-foreground">XSight</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                Sales Intelligence
              </div>
            </div>
          </>
        )}

        {/* Toggle button — desktop collapses/expands; mobile drawer closes */}
        <button
          onClick={onClose ?? onToggleCollapse}
          aria-label={onClose ? 'Close menu' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="size-8 rounded-lg grid place-items-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
        >
          {onClose ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto min-h-0">
        {!collapsed && (
          <div className="px-3 pb-1.5 pt-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            Navigation
          </div>
        )}

        {NAV.map(item => (
          <button
            key={item.id}
            onClick={() => { setActive(item.id); onClose?.() }}
            title={collapsed ? item.label : undefined}
            className={`w-full flex items-center rounded-lg font-medium transition-all ${
              collapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2.5 text-sm lg:text-base'
            } ${
              active === item.id
                ? 'bg-gradient-to-r from-primary/15 to-transparent text-foreground border border-primary/20'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent'
            }`}
          >
            <item.icon className="size-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left truncate">{item.label}</span>
                {item.badge && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary shrink-0">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </button>
        ))}

        {!collapsed && (
          <>
            <div className="px-3 pb-1.5 pt-5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              Recent Calls
            </div>
            {RECENT_CALLS.map(call => (
              <button
                key={call.id}
                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-accent transition-colors"
              >
                <div className="text-xs lg:text-sm font-medium text-foreground/90 truncate"
                     style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {call.id}
                </div>
                <div className="text-[10px] text-muted-foreground">{call.time}</div>
              </button>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-border space-y-0.5 shrink-0">
        {BOTTOM_NAV.map(item => (
          <button
            key={item.id}
            title={collapsed ? item.label : undefined}
            className={`w-full flex items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors ${
              collapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2 text-sm lg:text-base'
            }`}
          >
            <item.icon className="size-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}

        <div className={`mt-2 flex items-center rounded-lg bg-surface-elevated border border-border ${
          collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-3 py-2.5'
        }`}>
          <div className="size-7 rounded-full bg-gradient-to-br from-accent-cyan to-primary grid place-items-center text-[11px] font-bold text-primary-foreground shrink-0">
            LB
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-xs lg:text-sm font-semibold truncate text-foreground">Lee Ben Shimon</div>
              <div className="text-[10px] text-muted-foreground truncate">Sales Analyst</div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function Sidebar({ mobileOpen, onMobileClose, collapsed, onToggleCollapse, active, setActive }) {

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`hidden md:flex flex-col shrink-0 border-r border-border bg-surface/60 backdrop-blur-xl
                        overflow-hidden transition-[width] duration-300 ease-in-out
                        ${collapsed ? 'w-14' : 'w-[240px] lg:w-64 2xl:w-[272px]'}`}>
        <SidebarContent
          active={active}
          setActive={setActive}
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
        />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex flex-col md:hidden border-r border-border
                            bg-surface/95 backdrop-blur-xl
                            w-[min(80vw,300px)]">
            <SidebarContent
              active={active}
              setActive={setActive}
              onClose={onMobileClose}
            />
          </aside>
        </>
      )}
    </>
  )
}
