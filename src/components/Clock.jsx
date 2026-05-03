import { getCurrentSnapshot, useChessStore } from '../store/useChessStore'

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function Clock({ color }) {
  const time = useChessStore((state) => color === 'w' ? state.whiteTime : state.blackTime)
  const gameResult = useChessStore((state) => state.gameResult)
  const snapshots = useChessStore((state) => state.snapshots)
  const pointer = useChessStore((state) => state.pointer)
  
  const snapshot = getCurrentSnapshot({ snapshots, pointer })
  // Fast extraction of turn from FEN string without initializing chess.js
  const turn = snapshot.fen.split(' ')[1] 
  const isTurn = turn === color && gameResult.status === 'playing'

  const isLowTime = time < 10 && time > 0

  return (
    <div className={`chess-clock ${isTurn ? 'is-active' : ''} ${isLowTime ? 'is-danger' : ''}`}>
      <span className="clock-time">{formatTime(time)}</span>
    </div>
  )
}
