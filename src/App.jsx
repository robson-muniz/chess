import { useEffect, useRef } from 'react'
import { ChessBoard } from './components/ChessBoard'
import { Sidebar } from './components/Sidebar'
import { playCaptureSound, playMoveSound } from './lib/sound'
import { useChessStore } from './store/useChessStore'

export default function App() {
  const snapshots = useChessStore((state) => state.snapshots)
  const pointer = useChessStore((state) => state.pointer)
  const pendingEngineMove = useChessStore((state) => state.pendingEngineMove)
  const playPendingEngineMove = useChessStore((state) => state.playPendingEngineMove)
  const lastPlayedMoveRef = useRef(null)

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
      <section className="hero-copy">
        <p className="eyebrow">Premium analysis board</p>
        <h1>Pulse Chess</h1>
        <p className="subtitle">
          A responsive chess workspace with instant move grading, animated feedback, and an
          intentionally polished board-first experience.
        </p>
      </section>

      <section className="workspace">
        <ChessBoard />
        <Sidebar />
      </section>
    </main>
  )
}
