import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

export default function SplashScreen({ onDone }) {
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const fade = setTimeout(() => setFading(true), 1800)
    const done = setTimeout(() => onDone(), 2350)
    return () => { clearTimeout(fade); clearTimeout(done) }
  }, [onDone])

  return (
    <div
      className={`fixed inset-0 z-50 grid place-items-center bg-background transition-opacity duration-500 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center gap-6">
        {/* Logo with ambient glow */}
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary to-accent-cyan blur-2xl opacity-60 animate-pulse" />
          <div className="relative size-20 rounded-2xl bg-gradient-to-br from-primary to-accent-cyan grid place-items-center shadow-glow">
            <Sparkles className="size-10 text-primary-foreground" strokeWidth={2.5} />
          </div>
        </div>

        <div className="text-center space-y-1">
          <h1 className="font-display font-bold text-3xl tracking-tight text-foreground">
            X<span className="gradient-text">Sight</span>
          </h1>
          <p className="text-[11px] text-muted-foreground uppercase tracking-[0.3em]">
            Turn Past Calls Into Future Wins
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {['-0.3s', '-0.15s', '0s'].map((delay, i) => (
            <span
              key={i}
              className="size-1.5 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: delay }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
