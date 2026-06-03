import { useState, useCallback, useEffect } from 'react'
import SplashScreen from './components/SplashScreen'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import ChatPanel from './components/ChatPanel'
import InsightsPanel from './components/InsightsPanel'
import DataSourcesPage from './components/DataSourcesPage'
import Dashboard from './components/Dashboard'
import Analytics from './components/Analytics'
import CommandPalette from './components/CommandPalette'

export default function App() {
  const [showSplash, setShowSplash]     = useState(true)
  const [messages, setMessages]         = useState([])
  const [isLoading, setIsLoading]       = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen]     = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeNav, setActiveNav]               = useState('overview')
  const [paletteOpen, setPaletteOpen]           = useState(false)
  const [focusCallId, setFocusCallId]           = useState(null)
  const [allCalls, setAllCalls]                 = useState([])

  // Load call data once for the command palette (browser-cached static file).
  useEffect(() => {
    fetch('/calls-data.json').then(r => r.json()).then(setAllCalls).catch(() => {})
  }, [])

  // Global ⌘K / Ctrl+K toggles the command palette.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const sendMessage = useCallback(async (question) => {
    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: question }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`)

      setMessages(prev => [...prev, {
        id: `b-${Date.now()}`,
        role: 'bot',
        content: payload.answer,
        sourceEngine: payload.source_engine,
        data: payload.data ?? null,
        citations: payload.citations ?? [],
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`,
        role: 'bot',
        content: `Could not reach the backend: ${err.message}`,
        sourceEngine: 'error',
      }])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const newChat = useCallback(() => {
    setMessages([])
    setActiveNav('calls')
  }, [])

  // Jump to chat from anywhere (e.g. dashboard CTA) and send a question.
  const askFromAnywhere = useCallback((question) => {
    setActiveNav('calls')
    sendMessage(question)
  }, [sendMessage])

  // Palette → open a specific call: route to Data Sources and flag it to open.
  const gotoCall = useCallback((call) => {
    setActiveNav('data')
    setFocusCallId(call.call_id)
  }, [])

  return (
    /*
      h-[100dvh]: uses dynamic viewport height so mobile browser chrome
      (address bar) doesn't clip the bottom of the UI.
    */
    <div className="h-[100dvh] overflow-hidden text-foreground bg-background">
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

      <div className={`flex h-full transition-opacity duration-500 ${showSplash ? 'opacity-0' : 'opacity-100'}`}>

        <Sidebar
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(c => !c)}
          active={activeNav}
          setActive={setActiveNav}
        />

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <TopBar
            onNewChat={newChat}
            onMobileMenuOpen={() => setMobileMenuOpen(true)}
            onOpenSearch={() => setPaletteOpen(true)}
          />

          {/*
            View router. The dashboard and data pages own their full width;
            the chat view keeps the insights rail on lg+ screens.
          */}
          {activeNav === 'overview' && (
            <div className="flex-1 min-h-0">
              <Dashboard onAsk={askFromAnywhere} />
            </div>
          )}

          {activeNav === 'analytics' && (
            <div className="flex-1 min-h-0">
              <Analytics onAsk={askFromAnywhere} />
            </div>
          )}

          {activeNav === 'data' && (
            <div className="flex-1 min-h-0">
              <DataSourcesPage
                focusCallId={focusCallId}
                onFocusConsumed={() => setFocusCallId(null)}
              />
            </div>
          )}

          {!['overview', 'analytics', 'data'].includes(activeNav) && (
            <div className="flex-1 grid min-h-0
                            grid-cols-1
                            lg:grid-cols-[1fr_290px]
                            xl:grid-cols-[1fr_340px]
                            2xl:grid-cols-[1fr_400px]">
              <ChatPanel messages={messages} isLoading={isLoading} onSend={sendMessage} />
              <InsightsPanel />
            </div>
          )}
        </div>

      </div>

      {paletteOpen && (
        <CommandPalette
          calls={allCalls}
          onClose={() => setPaletteOpen(false)}
          onNavigate={setActiveNav}
          onSelectCall={gotoCall}
        />
      )}
    </div>
  )
}
