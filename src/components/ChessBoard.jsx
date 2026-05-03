import { useEffect } from 'react'
import { PieceIcon } from './PieceIcon'
import { getCurrentSnapshot, useChessStore } from '../store/useChessStore'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

function orderedSquares(orientation) {
  const files = orientation === 'white' ? FILES : [...FILES].reverse()
  const ranks = orientation === 'white' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]
  return ranks.flatMap((rank) => files.map((file) => `${file}${rank}`))
}

function squareToPosition(square, orientation) {
  const file = FILES.indexOf(square[0])
  const rank = Number(square[1]) - 1
  const column = orientation === 'white' ? file : 7 - file
  const row = orientation === 'white' ? 7 - rank : rank
  return { x: column * 12.5, y: row * 12.5 }
}

function getTrailStyle(from, to, orientation) {
  const fromPos = squareToPosition(from, orientation)
  const toPos = squareToPosition(to, orientation)
  const x1 = fromPos.x + 6.25
  const y1 = fromPos.y + 6.25
  const x2 = toPos.x + 6.25
  const y2 = toPos.y + 6.25
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx)

  return {
    left: `${x1}%`,
    top: `${y1}%`,
    width: `${length}%`,
    transform: `translateY(-50%) rotate(${angle}rad)`,
  }
}

export function ChessBoard() {
  const snapshots = useChessStore((state) => state.snapshots)
  const pointer = useChessStore((state) => state.pointer)
  const orientation = useChessStore((state) => state.orientation)
  const selectedSquare = useChessStore((state) => state.selectedSquare)
  const legalTargets = useChessStore((state) => state.legalTargets)
  const selectSquare = useChessStore((state) => state.selectSquare)
  const floatingBadge = useChessStore((state) => state.floatingBadge)
  const dismissBadge = useChessStore((state) => state.dismissBadge)
  const hint = useChessStore((state) => state.hint)
  const capturedAnimation = useChessStore((state) => state.capturedAnimation)

  const snapshot = getCurrentSnapshot({ snapshots, pointer })
  const lastMove = snapshot.move
  const squares = orderedSquares(orientation)

  useEffect(() => {
    if (!floatingBadge) return undefined
    const timer = window.setTimeout(() => dismissBadge(), 1800)
    return () => window.clearTimeout(timer)
  }, [dismissBadge, floatingBadge])

  return (
    <section className="board-panel">
      <div className="board-frame">
        <div className="board-surface">
          {squares.map((square, index) => {
            const isLight = (Math.floor(index / 8) + index) % 2 === 0
            const isSelected = selectedSquare === square
            const isLegal = legalTargets.includes(square)
            const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square)
            const moveGrade = snapshot.classification?.square === square ? snapshot.classification.id : ''
            const hintTone = hint && hint.to === square ? 'hint-square' : ''
            const fileLabel = orientation === 'white' ? FILES[index % 8] : [...FILES].reverse()[index % 8]
            const rankLabel = orientation === 'white' ? 8 - Math.floor(index / 8) : Math.floor(index / 8) + 1

            return (
              <button
                key={square}
                type="button"
                className={[
                  'board-square',
                  isLight ? 'light' : 'dark',
                  isSelected ? 'selected' : '',
                  isLegal ? 'legal' : '',
                  isLastMove ? 'last-move' : '',
                  moveGrade,
                  hintTone,
                ].join(' ')}
                onClick={() => selectSquare(square)}
              >
                {index % 8 === 0 && <span className="rank-label">{rankLabel}</span>}
                {Math.floor(index / 8) === 7 && <span className="file-label">{fileLabel}</span>}
                {isLegal && <span className="move-dot" />}
              </button>
            )
          })}

          <div className="piece-layer">
            {snapshot.pieceMap.map((piece) => {
              const { x, y } = squareToPosition(piece.square, orientation)
              const isSelected = selectedSquare === piece.square
              return (
                <div
                  key={piece.id}
                  className={`piece ${isSelected ? 'active' : ''}`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  onClick={() => selectSquare(piece.square)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      selectSquare(piece.square)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${piece.color === 'w' ? 'White' : 'Black'} ${piece.type} on ${piece.square}`}
                >
                  <PieceIcon type={piece.type} color={piece.color} />
                </div>
              )
            })}

            {capturedAnimation && (
              <div
                className="piece piece-captured"
                style={{
                  left: `${squareToPosition(capturedAnimation.square, orientation).x}%`,
                  top: `${squareToPosition(capturedAnimation.square, orientation).y}%`,
                }}
                key={capturedAnimation.key}
              >
                <PieceIcon type={capturedAnimation.type} color={capturedAnimation.color} />
              </div>
            )}
          </div>

          {lastMove && (
            <div className="move-trail" style={getTrailStyle(lastMove.from, lastMove.to, orientation)} />
          )}

          {floatingBadge && (
            <div
              className={`floating-badge ${floatingBadge.tone}`}
              style={{
                left: `${squareToPosition(floatingBadge.square, orientation).x + 6.25}%`,
                top: `${squareToPosition(floatingBadge.square, orientation).y + 6.25}%`,
              }}
              key={floatingBadge.key}
            >
              {floatingBadge.text}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
