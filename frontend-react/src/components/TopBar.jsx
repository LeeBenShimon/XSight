import { Search, Bell, Plus, ChevronDown, Activity, Menu } from 'lucide-react'

/*
  TopBar height is defined here as a CSS custom property so Sidebar can
  match it without hardcoding duplicated pixel values.
*/
export default function TopBar({ onNewChat, onMobileMenuOpen, onOpenSearch }) {
  return (
    <header
      style={{ '--topbar-h': '3.75rem' }}
      className="h-[var(--topbar-h)] md:h-16 shrink-0 border-b border-border
                 bg-surface/40 backdrop-blur-xl
                 flex items-center gap-2 md:gap-3 px-3 md:px-5"
    >
      {/* ── Hamburger (mobile only) ─────────────────────────────────────── */}
      <button
        onClick={onMobileMenuOpen}
        aria-label="Open navigation menu"
        className="md:hidden size-9 shrink-0 rounded-lg grid place-items-center
                   text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <Menu className="size-5" />
      </button>

      {/* ── Title ──────────────────────────────────────────────────────── */}
      <div className="shrink-0">
        <h1 className="font-display font-semibold text-sm md:text-base lg:text-lg leading-tight text-foreground whitespace-nowrap">
          Sales Call Analysis
        </h1>
        <div className="hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success animate-pulse" />
          <span className="hidden md:inline">Knowledge Base Connected ·</span>
          <span className="hidden md:inline">20 calls · 4 agents</span>
          <span className="md:hidden">Live</span>
        </div>
      </div>

      {/* ── Search trigger (opens ⌘K palette; hidden below md) ──────────── */}
      <button
        onClick={onOpenSearch}
        className="hidden md:flex flex-1 min-w-0 max-w-[min(100%,28rem)] items-center gap-2 mx-auto
                   h-9 px-3 rounded-lg bg-input border border-border text-muted-foreground
                   hover:border-border-strong hover:text-foreground transition-all"
      >
        <Search className="size-4 shrink-0" />
        <span className="text-sm lg:text-base truncate">Search calls, reps, products…</span>
        <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-border bg-surface
                        text-muted-foreground hidden lg:flex items-center shrink-0">
          ⌘K
        </kbd>
      </button>

      {/* ── Spacer (pushes actions right on mobile) ─────────────────────── */}
      <div className="flex-1 md:hidden" />

      {/* ── Actions ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 md:gap-1.5 shrink-0">

        {/* Search — mobile only (full bar shows on md+) */}
        <button
          onClick={onOpenSearch}
          aria-label="Search"
          className="md:hidden size-9 rounded-lg grid place-items-center
                     text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Search className="size-4" />
        </button>

        {/* Status — lg+ only */}
        <button className="hidden lg:flex h-9 px-3 rounded-lg text-xs lg:text-sm font-medium
                           text-muted-foreground hover:bg-accent hover:text-foreground
                           items-center gap-1.5 transition-colors">
          <Activity className="size-4" />
          Status
        </button>

        {/* Bell — sm+ */}
        <button aria-label="Notifications"
                className="hidden sm:grid h-9 w-9 rounded-lg place-items-center relative
                           text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
          <Bell className="size-4" />
          <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-destructive" />
        </button>

        {/* Quarter selector — md+ */}
        <button className="hidden md:flex h-9 px-2.5 rounded-lg text-xs lg:text-sm font-medium
                           text-foreground hover:bg-accent items-center gap-1.5
                           transition-colors border border-border">
          Q4 2025
          <ChevronDown className="size-3.5" />
        </button>

        {/* New chat — always visible */}
        <button
          onClick={onNewChat}
          className="h-9 px-3 md:px-4 rounded-lg text-xs font-semibold
                     bg-gradient-to-r from-primary to-accent-cyan text-primary-foreground
                     hover:opacity-90 flex items-center gap-1.5 transition-opacity shadow-glow
                     text-xs lg:text-sm whitespace-nowrap"
        >
          <Plus className="size-4 shrink-0" />
          <span className="hidden sm:inline">New Chat</span>
        </button>

      </div>
    </header>
  )
}
