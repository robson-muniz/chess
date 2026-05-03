import { useEffect, useRef } from 'react'
import { ChessBoard } from './components/ChessBoard'
import { LeftPanel, RightPanel } from './components/Sidebar'
import { GameOverModal } from './components/GameOverModal'
import { playCaptureSound, playMoveSound } from './lib/sound'
import { useChessStore } from './store/useChessStore'
import { useChessClock } from './hooks/useChessClock'

export default function App() {
  const snapshots = useChessStore((state) => state.snapshots)
  const pointer = useChessStore((state) => state.pointer)
  const pendingEngineMove = useChessStore((state) => state.pendingEngineMove)
  const playPendingEngineMove = useChessStore((state) => state.playPendingEngineMove)
  const lastPlayedMoveRef = useRef(null)

  // Initialize clock hook
  useChessClock()

  const snapshot = snapshots[pointer]
  const move = snapshot?.move ?? null

  useEffect(() => {
    if (!pendingEngineMove) return undefined
    const timer = window.setTimeout(() => {
      playPendingEngineMove()
    }, 500)
    return () => window.clearTimeout(timer)
  }, [pendingEngineMove, playPendingEngineMove])

  useEffect(() => {
    if (!move) return
    const moveKey = `${pointer}:${move.from}-${move.to}-${move.san}`
    if (lastPlayedMoveRef.current === moveKey) return
    lastPlayedMoveRef.current = moveKey
    if (move.captured) {
      playCaptureSound()
      return
    }
    playMoveSound()
  }, [move, pointer])

  return (
    <main className="app-shell">
      <div className="app-backdrop" />
      <GameOverModal />

      {/* ── Slim top bar ── */}
      <header className="top-bar">
        <div className="top-bar-brand">
          <h1>Pulse Chess</h1>
          <span className="top-bar-badge">Premium Analysis</span>
        </div>
      </header>

      {/* ── 3-column workspace ── */}
      <section className="workspace">
        <div className="left-col">
          <LeftPanel />
        </div>

        <ChessBoard />

        <div className="right-col">
          <RightPanel />
        </div>
      </section>
    </main>
  )
}
