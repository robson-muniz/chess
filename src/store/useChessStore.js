import { create } from 'zustand'
import { Chess } from 'chess.js'
import { classifyMove, evaluatePosition, formatEval, rankLegalMoves } from '../lib/evaluation'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const PIECE_ORDER = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']
const BOT_RANKS = [
  {
    id: 'bronze',
    label: 'Bronze',
    elo: 600,
    description: 'Frequent inaccuracies and occasional blunders.',
    candidateWindow: 10,
    topTierTolerance: 1.8,
    blunderChance: 0.24,
    mistakeChance: 0.36,
  },
  {
    id: 'silver',
    label: 'Silver',
    elo: 900,
    description: 'Solid basics, but still misses tactical shots.',
    candidateWindow: 7,
    topTierTolerance: 1.15,
    blunderChance: 0.15,
    mistakeChance: 0.24,
  },
  {
    id: 'gold',
    label: 'Gold',
    elo: 1200,
    description: 'Club-level play with occasional slips.',
    candidateWindow: 5,
    topTierTolerance: 0.7,
    blunderChance: 0.09,
    mistakeChance: 0.15,
  },
  {
    id: 'platinum',
    label: 'Platinum',
    elo: 1500,
    description: 'Consistent moves with fewer clear mistakes.',
    candidateWindow: 4,
    topTierTolerance: 0.45,
    blunderChance: 0.04,
    mistakeChance: 0.09,
  },
  {
    id: 'diamond',
    label: 'Diamond',
    elo: 1800,
    description: 'Strong tactical play and rare inaccuracies.',
    candidateWindow: 3,
    topTierTolerance: 0.22,
    blunderChance: 0.01,
    mistakeChance: 0.04,
  },
]

function buildInitialPieceMap() {
  const pieces = []

  FILES.forEach((file, index) => {
    const backRank = PIECE_ORDER[index]
    pieces.push({ id: `w-${backRank}-${file}1`, square: `${file}1`, type: backRank, color: 'w' })
    pieces.push({ id: `w-p-${file}2`, square: `${file}2`, type: 'p', color: 'w' })
    pieces.push({ id: `b-p-${file}7`, square: `${file}7`, type: 'p', color: 'b' })
    pieces.push({ id: `b-${backRank}-${file}8`, square: `${file}8`, type: backRank, color: 'b' })
  })

  return pieces
}

function createSnapshot({ fen, pieceMap, move = null, classification = null, evaluation = 0 }) {
  return { fen, pieceMap, move, classification, evaluation }
}

function buildInitialState() {
  const chess = new Chess()
  const pieceMap = buildInitialPieceMap()
  return {
    snapshots: [createSnapshot({ fen: chess.fen(), pieceMap, evaluation: evaluatePosition(chess) })],
    pointer: 0,
    selectedSquare: null,
    legalTargets: [],
    orientation: 'white',
    mode: 'bot',
    engineColor: 'b',
    botRank: 'gold',
    pendingEngineMove: null,
    isEngineThinking: false,
    hint: null,
    floatingBadge: null,
    capturedAnimation: null,
  }
}

function currentSnapshot(state) {
  return state.snapshots[state.pointer]
}

export function getCurrentSnapshot(state) {
  return currentSnapshot(state)
}

function createChessFromState(state) {
  return new Chess(currentSnapshot(state).fen)
}

function getGameStatus(chess) {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? 'Checkmate - Black wins' : 'Checkmate - White wins'
  }

  if (chess.isStalemate()) return 'Draw by stalemate'
  if (chess.isThreefoldRepetition()) return 'Draw by repetition'
  if (chess.isInsufficientMaterial()) return 'Draw by insufficient material'
  if (chess.isDraw()) return 'Draw'
  if (chess.inCheck()) return `${chess.turn() === 'w' ? 'White' : 'Black'} to move - in check`
  return `${chess.turn() === 'w' ? 'White' : 'Black'} to move`
}

function clearTransientState() {
  return {
    selectedSquare: null,
    legalTargets: [],
    hint: null,
  }
}

function promoteIfNeeded(move) {
  return move.promotion ? move : { ...move, promotion: 'q' }
}

function getBotRankProfile(rankId) {
  return BOT_RANKS.find((rank) => rank.id === rankId) ?? BOT_RANKS[2]
}

function chooseMoveFromPool(pool) {
  return pool[Math.floor(Math.random() * pool.length)]?.move ?? null
}

function chooseEngineMove(chess, rankId) {
  const rankedMoves = rankLegalMoves(chess)
  if (!rankedMoves.length) return null

  const profile = getBotRankProfile(rankId)
  const bestEval = rankedMoves[0].moverEval
  const candidatePool = rankedMoves.slice(0, profile.candidateWindow)
  const topTier = candidatePool.filter(
    (entry) => Math.abs(entry.moverEval - bestEval) <= profile.topTierTolerance,
  )
  const mistakePool = candidatePool.filter(
    (entry) => entry.moverEval <= bestEval - profile.topTierTolerance && entry.moverEval >= bestEval - 2.2,
  )
  const blunderPool = rankedMoves.filter((entry) => entry.moverEval < bestEval - 2.2)

  const roll = Math.random()
  if (blunderPool.length && roll < profile.blunderChance) {
    return chooseMoveFromPool(blunderPool)
  }

  if (mistakePool.length && roll < profile.blunderChance + profile.mistakeChance) {
    return chooseMoveFromPool(mistakePool)
  }

  return chooseMoveFromPool(topTier.length ? topTier : candidatePool) ?? rankedMoves[0].move
}

function applyMoveToPieceMap(pieceMap, move) {
  const nextPieces = pieceMap.map((piece) => ({ ...piece }))
  const movedPiece = nextPieces.find((piece) => piece.square === move.from)
  const targetPiece = nextPieces.find(
    (piece) => piece.square === move.to || (move.flags.includes('e') && piece.square === `${move.to[0]}${move.from[1]}`),
  )

  if (targetPiece) {
    const index = nextPieces.findIndex((piece) => piece.id === targetPiece.id)
    nextPieces.splice(index, 1)
  }

  if (movedPiece) {
    movedPiece.square = move.to
    if (move.promotion) movedPiece.type = move.promotion
  }

  if (move.flags.includes('k')) {
    const rook = nextPieces.find((piece) => piece.square === `${FILES[7]}${move.from[1]}`)
    if (rook) rook.square = `${FILES[5]}${move.from[1]}`
  }

  if (move.flags.includes('q')) {
    const rook = nextPieces.find((piece) => piece.square === `${FILES[0]}${move.from[1]}`)
    if (rook) rook.square = `${FILES[3]}${move.from[1]}`
  }

  return nextPieces
}

export const useChessStore = create((set, get) => ({
  ...buildInitialState(),

  selectSquare: (square) => {
    const state = get()
    const chess = createChessFromState(state)
    const piece = chess.get(square)
    const engineOwnsTurn =
      state.mode === 'bot' && !state.pendingEngineMove && chess.turn() === state.engineColor
    const selectedTargets = state.selectedSquare
      ? chess
          .moves({ square: state.selectedSquare, verbose: true })
          .map((move) => move.to)
      : []

    if (state.isEngineThinking || engineOwnsTurn) {
      return
    }

    if (state.selectedSquare && selectedTargets.includes(square)) {
      get().playMove(state.selectedSquare, square)
      return
    }

    if (piece && piece.color === chess.turn()) {
      const targets = chess
        .moves({ square, verbose: true })
        .map((move) => move.to)
      set({ selectedSquare: square, legalTargets: targets, hint: null })
      return
    }

    set({ selectedSquare: null, legalTargets: [], hint: null })
  },

  playMove: (from, to) => {
    const state = get()
    const chess = createChessFromState(state)
    const snapshot = currentSnapshot(state)
    const rankedMoves = rankLegalMoves(chess)
    const chosen = rankedMoves.find((entry) => entry.move.from === from && entry.move.to === to)

    if (!chosen) return

    const best = rankedMoves[0]
    const move = chess.move(promoteIfNeeded({ from, to }))
    const classification = classifyMove(best.moverEval, chosen.moverEval)
    const nextPieceMap = applyMoveToPieceMap(snapshot.pieceMap, move)
    const evaluation = evaluatePosition(chess)
    const badgeText =
      classification.id === 'blunder'
        ? `${classification.label} (${formatEval(evaluation)})`
        : `${classification.label} ${formatEval(evaluation)}`

    const capturedSquare = move.flags.includes('e') ? `${move.to[0]}${move.from[1]}` : move.to
    const capturedPiece = snapshot.pieceMap.find((piece) => piece.square === capturedSquare && piece.color !== move.color)
    const nextSnapshots = state.snapshots.slice(0, state.pointer + 1)

    nextSnapshots.push(
      createSnapshot({
        fen: chess.fen(),
        pieceMap: nextPieceMap,
        move,
        classification: {
          ...classification,
          square: move.to,
          label: badgeText,
        },
        evaluation,
      }),
    )

    const shouldQueueEngine =
      state.mode === 'bot' && !chess.isGameOver() && chess.turn() === state.engineColor
    const pendingEngineMove = shouldQueueEngine ? chooseEngineMove(chess, state.botRank) : null

    set({
      snapshots: nextSnapshots,
      pointer: nextSnapshots.length - 1,
      pendingEngineMove,
      isEngineThinking: Boolean(pendingEngineMove),
      floatingBadge: { square: move.to, text: badgeText, tone: classification.id, key: `${move.san}-${Date.now()}` },
      capturedAnimation: capturedPiece
        ? { ...capturedPiece, key: `${capturedPiece.id}-${Date.now()}` }
        : null,
      ...clearTransientState(),
    })
  },

  undo: () => {
    const state = get()
    if (state.pointer === 0) return
    set({
      pointer: state.pointer - 1,
      pendingEngineMove: null,
      isEngineThinking: false,
      floatingBadge: null,
      capturedAnimation: null,
      ...clearTransientState(),
    })
  },

  redo: () => {
    const state = get()
    if (state.pointer >= state.snapshots.length - 1) return
    set({
      pointer: state.pointer + 1,
      pendingEngineMove: null,
      isEngineThinking: false,
      floatingBadge: null,
      capturedAnimation: null,
      ...clearTransientState(),
    })
  },

  flipBoard: () => {
    set((state) => ({ orientation: state.orientation === 'white' ? 'black' : 'white' }))
  },

  setMode: (mode) => {
    const state = get()
    const chess = createChessFromState(state)
    const shouldQueueEngine = mode === 'bot' && !chess.isGameOver() && chess.turn() === state.engineColor

    set({
      mode,
      pendingEngineMove: shouldQueueEngine ? chooseEngineMove(chess, state.botRank) : null,
      isEngineThinking: shouldQueueEngine,
      ...clearTransientState(),
    })
  },

  setBotRank: (botRank) => {
    const state = get()
    const chess = createChessFromState(state)
    const shouldQueueEngine = state.mode === 'bot' && !chess.isGameOver() && chess.turn() === state.engineColor

    set({
      botRank,
      pendingEngineMove: shouldQueueEngine ? chooseEngineMove(chess, botRank) : null,
      isEngineThinking: shouldQueueEngine,
    })
  },

  playPendingEngineMove: () => {
    const state = get()
    if (!state.pendingEngineMove) return

    const move = state.pendingEngineMove
    set({ pendingEngineMove: null, isEngineThinking: false })
    get().playMove(move.from, move.to)
  },

  showHint: () => {
    const state = get()
    const chess = createChessFromState(state)
    const rankedMoves = rankLegalMoves(chess)
    const best = rankedMoves[0]
    if (!best) return

    set({
      hint: {
        from: best.move.from,
        to: best.move.to,
        text: `Hint: ${best.move.san} ${formatEval(best.whiteEval)}`,
      },
    })
  },

  dismissBadge: () => set({ floatingBadge: null }),
}))

export function getStatusFromFen(fen) {
  return getGameStatus(new Chess(fen))
}

export function getBotRanks() {
  return BOT_RANKS
}

export function getBotRank(rankId) {
  return getBotRankProfile(rankId)
}

export function getMoveHistory(snapshots) {
  return snapshots.slice(1).map((entry, index) => ({
    ply: index + 1,
    san: entry.move.san,
    evaluation: entry.evaluation,
    classification: entry.classification,
  }))
}
