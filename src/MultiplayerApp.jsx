import { useEffect, useMemo, useState } from 'react'
import { Chess } from 'chess.js'

const FILES = ['a','b','c','d','e','f','g','h']
const SYMBOL = {
  wp:'♙', wr:'♖', wn:'♘', wb:'♗', wq:'♕', wk:'♔',
  bp:'♟', br:'♜', bn:'♞', bb:'♝', bq:'♛', bk:'♚',
}

const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:3001`
const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:3001`

function Home() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const createGame = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/games`, { method: 'POST' })
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      const data = await res.json()
      window.location.href = `/game/${data.gameId}`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create game')
    } finally {
      setLoading(false)
    }
  }
  return <div className="mp-home"><button onClick={createGame} disabled={loading}>{loading ? 'Creating...' : 'Create Game'}</button>{error && <p style={{color:'#ff8f8f'}}>{error}</p>}</div>
}

function Game({ gameId }) {
  const [state, setState] = useState(null)
  const [color, setColor] = useState(null)
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [ws, setWs] = useState(null)

  const chess = useMemo(() => {
    const c = new Chess()
    if (state?.fen) c.load(state.fen)
    return c
  }, [state?.fen])

  useEffect(() => {
    const socket = new WebSocket(WS_URL)
    setWs(socket)
    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: 'join',
        gameId,
        playerToken: localStorage.getItem(`chess:${gameId}:token`) || null,
      }))
    }
    socket.onmessage = (evt) => {
      const msg = JSON.parse(evt.data)
      if (msg.type === 'joined') {
        setColor(msg.color)
        setState(msg.state)
        localStorage.setItem(`chess:${gameId}:token`, msg.playerToken)
      }
      if (msg.type === 'state') setState(msg.state)
      if (msg.type === 'error') setError(msg.message)
    }
    return () => socket.close()
  }, [gameId])

  const myTurn = state && ((state.turn === 'w' && color === 'white') || (state.turn === 'b' && color === 'black'))

  const clickSquare = (sq) => {
    setError('')
    if (!selected) {
      const piece = chess.get(sq)
      if (!piece) return
      const mine = (piece.color === 'w' && color === 'white') || (piece.color === 'b' && color === 'black')
      if (mine) setSelected(sq)
      return
    }

    if (selected === sq) return setSelected(null)
    if (!myTurn) return setSelected(null)
    ws?.send(JSON.stringify({ type: 'move', from: selected, to: sq }))
    setSelected(null)
  }

  return (
    <div className="mp-wrap">
      <h2>Game #{gameId}</h2>
      <p>Share link: <code>{window.location.href}</code></p>
      <p>You are: <b>{color || 'joining...'}</b> | Turn: <b>{state?.turn === 'w' ? 'White' : 'Black'}</b></p>
      <p>Status: {state?.status || 'connecting'} | Clocks: {state?.clocks?.white ?? 0}s / {state?.clocks?.black ?? 0}s</p>
      {error && <p style={{color:'#ff8f8f'}}>{error}</p>}
      <div className="mp-board">
        {Array.from({ length: 8 }).flatMap((_, row) =>
          FILES.map((file, col) => {
            const rank = 8 - row
            const sq = `${file}${rank}`
            const piece = chess.get(sq)
            const key = piece ? `${piece.color}${piece.type}` : ''
            const dark = (row + col) % 2 === 1
            return (
              <button key={sq} className={`mp-square ${dark ? 'dark' : 'light'} ${selected === sq ? 'selected' : ''}`} onClick={() => clickSquare(sq)}>
                {key ? SYMBOL[key] : ''}
              </button>
            )
          }),
        )}
      </div>
    </div>
  )
}

export default function MultiplayerApp() {
  const match = window.location.pathname.match(/^\/game\/([a-z0-9]+)$/)
  if (!match) return <Home />
  return <Game gameId={match[1]} />
}
