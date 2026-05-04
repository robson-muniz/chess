import { getCurrentSnapshot, useChessStore } from '../store/useChessStore'

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function Clock({ color, playerName = 'Player', rank = 'Pro', avatar = '♟' }) {
  const time = useChessStore((state) => color === 'w' ? state.whiteTime : state.blackTime)
  const gameResult = useChessStore((state) => state.gameResult)
  const snapshots = useChessStore((state) => state.snapshots)
  const pointer = useChessStore((state) => state.pointer)

  const snapshot = getCurrentSnapshot({ snapshots, pointer })
  const turn = snapshot.fen.split(' ')[1]
  const isTurn = turn === color && gameResult.status === 'playing'

  const isLowTime = time < 20 && time > 0

  return (
    <div className={`chess-clock ${isTurn ? 'is-active' : ''} ${isLowTime ? 'is-danger' : ''}`}>
      <div className="clock-player">
        <div className="clock-avatar" aria-hidden="true">{avatar}</div>
        <div>
          <p className="clock-name">{playerName}</p>
          <p className="clock-rank">{rank}</p>
        </div>
      </div>
      <span className="clock-time">{formatTime(time)}</span>
    </div>
  )
}
