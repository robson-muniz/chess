import http from 'http'
import { WebSocketServer } from 'ws'
import { Chess } from 'chess.js'

const PORT = process.env.PORT || 3001
const games = new Map()

const createGameId = () => Math.random().toString(36).slice(2, 8)

function getOrCreateGame(gameId) {
  if (!games.has(gameId)) {
    const chess = new Chess()
    games.set(gameId, {
      id: gameId,
      chess,
      moveHistory: [],
      status: 'playing',
      whiteSocket: null,
      blackSocket: null,
      whiteToken: null,
      blackToken: null,
      clocks: { white: 300, black: 300 },
      activeColor: 'w',
      lastTickMs: Date.now(),
    })
  }
  return games.get(gameId)
}

function gameState(game) {
  return {
    id: game.id,
    fen: game.chess.fen(),
    moves: game.moveHistory,
    turn: game.chess.turn(),
    status: game.status,
    clocks: game.clocks,
  }
}

function send(ws, type, payload = {}) {
  if (ws?.readyState === ws.OPEN) ws.send(JSON.stringify({ type, ...payload }))
}

function broadcast(game, type, payload = {}) {
  send(game.whiteSocket, type, payload)
  send(game.blackSocket, type, payload)
}

function syncClocks(game) {
  if (game.status !== 'playing') return
  const now = Date.now()
  const elapsed = Math.floor((now - game.lastTickMs) / 1000)
  if (elapsed <= 0) return

  const side = game.activeColor === 'w' ? 'white' : 'black'
  game.clocks[side] = Math.max(0, game.clocks[side] - elapsed)
  game.lastTickMs += elapsed * 1000

  if (game.clocks[side] === 0) {
    game.status = `finished:${side}-flag`
  }
}

setInterval(() => {
  for (const game of games.values()) {
    syncClocks(game)
    broadcast(game, 'state', { state: gameState(game) })
  }
}, 1000)

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/games') {
    const gameId = createGameId()
    getOrCreateGame(gameId)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ gameId }))
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

const wss = new WebSocketServer({ server })

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw.toString()) } catch { return }

    if (msg.type === 'join') {
      const game = getOrCreateGame(msg.gameId)
      let color = null

      if (msg.playerToken && msg.playerToken === game.whiteToken) color = 'white'
      else if (msg.playerToken && msg.playerToken === game.blackToken) color = 'black'
      else if (!game.whiteSocket && !game.whiteToken) {
        color = 'white'
        game.whiteToken = Math.random().toString(36).slice(2)
      } else if (!game.blackSocket && !game.blackToken) {
        color = 'black'
        game.blackToken = Math.random().toString(36).slice(2)
      }

      if (!color) {
        send(ws, 'error', { message: 'Game already has 2 players' })
        return
      }

      ws.gameId = game.id
      ws.color = color
      ws.playerToken = color === 'white' ? game.whiteToken : game.blackToken
      if (color === 'white') game.whiteSocket = ws
      if (color === 'black') game.blackSocket = ws

      send(ws, 'joined', { color, playerToken: ws.playerToken, state: gameState(game) })
      broadcast(game, 'state', { state: gameState(game) })
      return
    }

    if (msg.type === 'move') {
      const game = games.get(ws.gameId)
      if (!game || game.status !== 'playing') return
      syncClocks(game)

      const expectedColor = game.chess.turn() === 'w' ? 'white' : 'black'
      if (ws.color !== expectedColor) {
        send(ws, 'error', { message: 'Not your turn' })
        return
      }

      const move = game.chess.move({ from: msg.from, to: msg.to, promotion: msg.promotion || 'q' })
      if (!move) {
        send(ws, 'error', { message: 'Illegal move' })
        return
      }

      game.moveHistory.push(move.san)
      game.activeColor = game.chess.turn()
      game.lastTickMs = Date.now()

      if (game.chess.isGameOver()) game.status = 'finished:board'
      broadcast(game, 'state', { state: gameState(game) })
    }
  })

  ws.on('close', () => {
    const game = games.get(ws.gameId)
    if (!game) return
    if (game.whiteSocket === ws) game.whiteSocket = null
    if (game.blackSocket === ws) game.blackSocket = null
  })
})

server.listen(PORT, () => {
  console.log(`Chess multiplayer server on http://localhost:${PORT}`)
})
