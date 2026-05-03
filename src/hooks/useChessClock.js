import { useEffect } from 'react'
import { useChessStore } from '../store/useChessStore'

export function useChessClock() {
  const gameResult = useChessStore((state) => state.gameResult)
  const tickClock = useChessStore((state) => state.tickClock)

  useEffect(() => {
    // If the game is not active, don't run the timer
    if (gameResult.status !== 'playing') {
      return
    }

    const intervalId = setInterval(() => {
      tickClock()
    }, 1000)

    return () => clearInterval(intervalId)
  }, [gameResult.status, tickClock])
}
