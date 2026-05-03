import { useState, useEffect } from 'react'
import { useChessStore } from '../store/useChessStore'

export function GameOverModal() {
  const gameResult = useChessStore((state) => state.gameResult)
  const resetGame = useChessStore((state) => state.resetGame)
  const [isHidden, setIsHidden] = useState(false)

  // Reset hidden state if a new game starts
  useEffect(() => {
    if (gameResult.status === 'playing') {
      setIsHidden(false)
    }
  }, [gameResult.status])

  if (gameResult.status === 'playing' || isHidden) return null

  let title = ''
  if (gameResult.status === 'white_won') title = 'White Wins'
  else if (gameResult.status === 'black_won') title = 'Black Wins'
  else if (gameResult.status === 'draw') title = 'Draw'

  return (
    <div className="game-over-backdrop">
      <div className="game-over-modal">
        <h2 className="modal-title">{title}</h2>
        {gameResult.reason && <p className="reason-text">{gameResult.reason}</p>}
        <div className="game-over-actions">
          <button className="ui-button ui-button-strong" onClick={resetGame}>Play Again</button>
          <button className="ui-button" onClick={() => setIsHidden(true)}>Review Game</button>
        </div>
      </div>
    </div>
  )
}
