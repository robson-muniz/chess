import { create } from 'zustand'
import { Chess } from 'chess.js'
import { classifyMove, evaluatePosition, formatEval, rankLegalMoves } from '../lib/evaluation'

// ─── Constants ──────────────────────────────────────────────────────────────
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const PIECE_ORDER = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']

const BOT_RANKS = [
  { id: 'bronze',   label: 'Bronze',   elo: 600,  description: 'Frequent inaccuracies and occasional blunders.', candidateWindow: 10, topTierTolerance: 1.8,  blunderChance: 0.24, mistakeChance: 0.36 },
  { id: 'silver',   label: 'Silver',   elo: 900,  description: 'Solid basics, but still misses tactical shots.',  candidateWindow: 7,  topTierTolerance: 1.15, blunderChance: 0.15, mistakeChance: 0.24 },
  { id: 'gold',     label: 'Gold',     elo: 1200, description: 'Club-level play with occasional slips.',          candidateWindow: 5,  topTierTolerance: 0.7,  blunderChance: 0.09, mistakeChance: 0.15 },
  { id: 'platinum', label: 'Platinum', elo: 1500, description: 'Consistent moves with fewer clear mistakes.',      candidateWindow: 4,  topTierTolerance: 0.45, blunderChance: 0.04, mistakeChance: 0.09 },
  { id: 'diamond',  label: 'Diamond',  elo: 1800, description: 'Strong tactical play and rare inaccuracies.',      candidateWindow: 3,  topTierTolerance: 0.22, blunderChance: 0.01, mistakeChance: 0.04 },
]

// ─── Piece map helpers ───────────────────────────────────────────────────────
function buildInitialPieceMap() {
  const pieces = []
  FILES.forEach((file, index) => {
    const backRank = PIECE_ORDER[index]
    pieces.push({ id: `w-${backRank}-${file}1`, square: `${file}1`, type: backRank, color: 'w' })
    pieces.push({ id: `w-p-${file}2`,           square: `${file}2`, type: 'p',       color: 'w' })
    pieces.push({ id: `b-p-${file}7`,           square: `${file}7`, type: 'p',       color: 'b' })
    pieces.push({ id: `b-${backRank}-${file}8`, square: `${file}8`, type: backRank, color: 'b' })
  })
  return pieces
}

function applyMoveToPieceMap(pieceMap, move) {
  // En-passant captured pawn sits on a different square than move.to
  const capturedSquare = move.flags.includes('e')
    ? `${move.to[0]}${move.from[1]}`
    : move.to

  const capturedPiece = move.captured
    ? pieceMap.find((p) => p.square === capturedSquare && p.color !== move.color)
    : null

  if (move.captured && !capturedPiece) {
    // Defensive: pieceMap desynced — log and continue (chess.js state is still correct)
    console.warn('[pieceMap] Captured piece not found in map. Square:', capturedSquare, 'Move:', move)
  }

  const nextPieces = pieceMap
    .filter((p) => p.id !== capturedPiece?.id)
    .map((p) => ({ ...p }))

  const movedPiece = nextPieces.find((p) => p.square === move.from)
  if (movedPiece) {
    movedPiece.square = move.to
    if (move.promotion) movedPiece.type = move.promotion
  } else {
    console.warn('[pieceMap] Moving piece not found in map. From:', move.from)
  }

  // Kingside castling — rook h→f
  if (move.flags.includes('k')) {
    const rook = nextPieces.find((p) => p.square === `${FILES[7]}${move.from[1]}`)
    if (rook) rook.square = `${FILES[5]}${move.from[1]}`
  }
  // Queenside castling — rook a→d
  if (move.flags.includes('q')) {
    const rook = nextPieces.find((p) => p.square === `${FILES[0]}${move.from[1]}`)
    if (rook) rook.square = `${FILES[3]}${move.from[1]}`
  }

  return nextPieces
}

// ─── Snapshot helpers ────────────────────────────────────────────────────────
function createSnapshot({ fen, pieceMap, move = null, classification = null, evaluation = 0 }) {
  return { fen, pieceMap, move, classification, evaluation }
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

// ─── Game status ─────────────────────────────────────────────────────────────
function getGameStatus(chess) {
  if (chess.isCheckmate())          return chess.turn() === 'w' ? 'Checkmate — Black wins' : 'Checkmate — White wins'
  if (chess.isStalemate())          return 'Draw by stalemate'
  if (chess.isThreefoldRepetition()) return 'Draw by repetition'
  if (chess.isInsufficientMaterial()) return 'Draw — insufficient material'
  if (chess.isDraw())               return 'Draw'
  if (chess.inCheck())              return `${chess.turn() === 'w' ? 'White' : 'Black'} to move — in check ⚠️`
  return `${chess.turn() === 'w' ? 'White' : 'Black'} to move`
}

// ─── Bot helpers ──────────────────────────────────────────────────────────────
function getBotRankProfile(rankId) {
  return BOT_RANKS.find((r) => r.id === rankId) ?? BOT_RANKS[2]
}

function chooseMoveFromPool(pool) {
  return pool[Math.floor(Math.random() * pool.length)]?.move ?? null
}

function chooseEngineMove(chess, rankId) {
  const rankedMoves = rankLegalMoves(chess)
  if (!rankedMoves.length) return null

  const profile   = getBotRankProfile(rankId)
  const bestEval  = rankedMoves[0].moverEval
  const pool      = rankedMoves.slice(0, profile.candidateWindow)
  const topTier   = pool.filter((e) => Math.abs(e.moverEval - bestEval) <= profile.topTierTolerance)
  const mistakePool = pool.filter((e) => e.moverEval <= bestEval - profile.topTierTolerance && e.moverEval >= bestEval - 2.2)
  const blunderPool = rankedMoves.filter((e) => e.moverEval < bestEval - 2.2)

  const roll = Math.random()
  if (blunderPool.length && roll < profile.blunderChance)                              return chooseMoveFromPool(blunderPool)
  if (mistakePool.length && roll < profile.blunderChance + profile.mistakeChance)      return chooseMoveFromPool(mistakePool)
  return chooseMoveFromPool(topTier.length ? topTier : pool) ?? rankedMoves[0].move
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────
function clearTransientState() {
  return { selectedSquare: null, legalTargets: [], hint: null }
}

function promoteIfNeeded(move) {
  return move.promotion ? move : { ...move, promotion: 'q' }
}

function oppositeColor(color) {
  return color === 'w' ? 'b' : 'w'
}

// ─── Initial state ────────────────────────────────────────────────────────────
function buildInitialState() {
  const chess    = new Chess()
  const pieceMap = buildInitialPieceMap()
  // playerColor = color the human controls; engineColor = the bot's color
  const playerColor = 'w'
  const engineColor = oppositeColor(playerColor)
  const initialTime = 300 // 5 minutes

  return {
    snapshots:        [createSnapshot({ fen: chess.fen(), pieceMap, evaluation: evaluatePosition(chess) })],
    pointer:          0,
    playerColor,               // ← NEW: tracks which side the human plays
    engineColor,               // ← FIX: derived, not hardcoded
    selectedSquare:   null,
    legalTargets:     [],
    orientation:      'white',
    mode:             'bot',
    botRank:          'gold',
    pendingEngineMove: null,
    isEngineThinking: false,
    hint:             null,
    floatingBadge:    null,
    capturedAnimation: null,
    gameResult:       { status: 'playing', reason: '' },
    whiteTime:        initialTime,
    blackTime:        initialTime,
    timeConfig:       initialTime,
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useChessStore = create((set, get) => ({
  ...buildInitialState(),

  // ── selectSquare ─────────────────────────────────────────────────────────
  selectSquare: (square) => {
    const state = get()
    if (state.gameResult.status !== 'playing') return

    const chess = createChessFromState(state)
    const piece = chess.get(square)

    // Bug-fix: use state.engineColor (dynamic) not hardcoded 'b'
    const engineOwnsTurn =
      state.mode === 'bot' &&
      !state.pendingEngineMove &&
      chess.turn() === state.engineColor

    if (state.isEngineThinking || engineOwnsTurn) {
      console.debug('[select] Blocked — engine turn. isThinking:', state.isEngineThinking, 'engineOwnsTurn:', engineOwnsTurn)
      return
    }

    // Re-derive legal targets from the currently selected square (fresh, not stale)
    const selectedTargets = state.selectedSquare
      ? chess.moves({ square: state.selectedSquare, verbose: true }).map((m) => m.to)
      : []

    // ── Case 1: Execute a pending move (including captures) ─────────────────
    if (state.selectedSquare && selectedTargets.includes(square)) {
      console.debug(`[select] Executing move ${state.selectedSquare} → ${square}`)
      get().playMove(state.selectedSquare, square)
      return
    }

    // ── Case 2: Select a friendly piece ────────────────────────────────────
    // In bot mode: only allow selecting pieces the human owns (playerColor).
    // In analysis mode: allow selecting whichever color is to move.
    const isHumanPiece =
      state.mode === 'analysis'
        ? piece?.color === chess.turn()
        : piece?.color === chess.turn() && piece?.color === state.playerColor

    if (isHumanPiece) {
      const targets = chess.moves({ square, verbose: true }).map((m) => m.to)
      console.debug(`[select] Selected ${square} — ${targets.length} legal target(s):`, targets)
      set({ selectedSquare: square, legalTargets: targets, hint: null })
      return
    }

    // ── Case 3: Deselect ────────────────────────────────────────────────────
    console.debug(`[select] Deselected — clicked ${square} (piece: ${piece?.color ?? 'empty'}, turn: ${chess.turn()})`)
    set({ selectedSquare: null, legalTargets: [], hint: null })
  },

  // ── playMove ──────────────────────────────────────────────────────────────
  playMove: (from, to) => {
    const state    = get()
    if (state.gameResult.status !== 'playing') return

    const chess    = createChessFromState(state)
    const snapshot = currentSnapshot(state)

    // Verify legality via chess.js directly (source of truth)
    const legalMoves = chess.moves({ verbose: true })
    const isLegal    = legalMoves.some((m) => m.from === from && m.to === to)

    if (!isLegal) {
      console.warn(`[playMove] Illegal move rejected: ${from} → ${to}`)
      set(clearTransientState())
      return
    }

    // Rank moves for classification; fall back gracefully if ranking fails
    let rankedMoves = []
    try {
      rankedMoves = rankLegalMoves(chess)
    } catch (err) {
      console.error('[playMove] rankLegalMoves threw:', err)
    }

    const chosen = rankedMoves.find((e) => e.move.from === from && e.move.to === to)
    const best   = rankedMoves[0]

    // Execute the move (chess.js is the authoritative game state)
    const move = chess.move(promoteIfNeeded({ from, to }))
    if (!move) {
      console.error('[playMove] chess.move() returned null — should not happen after legality check')
      return
    }

    console.debug(`[playMove] ${move.san} | flags: ${move.flags} | captured: ${move.captured ?? 'none'}`)

    // Build classification (degrade gracefully if ranking was unavailable)
    const classification =
      chosen && best
        ? classifyMove(best.moverEval, chosen.moverEval)
        : { id: 'good', label: 'Played', accent: 'var(--eval-good)' }

    const evaluation = evaluatePosition(chess)
    const badgeText  =
      classification.id === 'blunder'
        ? `${classification.label} (${formatEval(evaluation)})`
        : `${classification.label} ${formatEval(evaluation)}`

    // Update visual piece map
    const nextPieceMap = applyMoveToPieceMap(snapshot.pieceMap, move)

    // Capture animation target
    const capturedSquare = move.flags.includes('e') ? `${move.to[0]}${move.from[1]}` : move.to
    const capturedPiece  = snapshot.pieceMap.find(
      (p) => p.square === capturedSquare && p.color !== move.color,
    )

    // Build snapshot history (truncate future on new branch)
    const nextSnapshots = state.snapshots.slice(0, state.pointer + 1)
    nextSnapshots.push(
      createSnapshot({
        fen:            chess.fen(),
        pieceMap:       nextPieceMap,
        move,
        classification: { ...classification, square: move.to, label: badgeText },
        evaluation,
      }),
    )

    // Check for game over
    let newResult = { status: 'playing', reason: '' }
    if (chess.isCheckmate()) {
      newResult = { status: chess.turn() === 'w' ? 'black_won' : 'white_won', reason: 'by checkmate' }
    } else if (chess.isStalemate()) {
      newResult = { status: 'draw', reason: 'by stalemate' }
    } else if (chess.isThreefoldRepetition()) {
      newResult = { status: 'draw', reason: 'by repetition' }
    } else if (chess.isInsufficientMaterial()) {
      newResult = { status: 'draw', reason: 'insufficient material' }
    } else if (chess.isDraw()) {
      newResult = { status: 'draw', reason: '50-move rule' }
    }
    const isGameOver = newResult.status !== 'playing'

    // Queue engine response if needed
    const shouldQueueEngine =
      state.mode === 'bot' && !isGameOver && chess.turn() === state.engineColor
    const pendingEngineMove = shouldQueueEngine ? chooseEngineMove(chess, state.botRank) : null

    set({
      snapshots:        nextSnapshots,
      pointer:          nextSnapshots.length - 1,
      pendingEngineMove,
      isEngineThinking: Boolean(pendingEngineMove),
      floatingBadge:    { square: move.to, text: badgeText, tone: classification.id, key: `${move.san}-${Date.now()}` },
      capturedAnimation: capturedPiece
        ? { ...capturedPiece, key: `${capturedPiece.id}-${Date.now()}` }
        : null,
      gameResult:       newResult,
      ...clearTransientState(),
    })
  },

  // ── Undo / Redo ──────────────────────────────────────────────────────────
  undo: () => {
    const state = get()
    if (state.pointer === 0) return
    set({ pointer: state.pointer - 1, pendingEngineMove: null, isEngineThinking: false, floatingBadge: null, capturedAnimation: null, ...clearTransientState() })
  },

  redo: () => {
    const state = get()
    if (state.pointer >= state.snapshots.length - 1) return
    set({ pointer: state.pointer + 1, pendingEngineMove: null, isEngineThinking: false, floatingBadge: null, capturedAnimation: null, ...clearTransientState() })
  },

  // ── flipBoard: BUG FIX — also switches playerColor + engineColor ──────────
  flipBoard: () => {
    const state         = get()
    const newOrientation = state.orientation === 'white' ? 'black' : 'white'
    // Flip which side the human controls
    const newPlayerColor = newOrientation === 'white' ? 'w' : 'b'
    const newEngineColor = oppositeColor(newPlayerColor)
    const chess          = createChessFromState(state)

    // If it's now the engine's turn after switching sides, queue its move
    const shouldQueueEngine =
      state.mode === 'bot' && !chess.isGameOver() && chess.turn() === newEngineColor
    const pendingEngineMove = shouldQueueEngine ? chooseEngineMove(chess, state.botRank) : null

    console.debug(`[flipBoard] Human now plays ${newPlayerColor}, engine plays ${newEngineColor}`)

    set({
      orientation:      newOrientation,
      playerColor:      newPlayerColor,
      engineColor:      newEngineColor,
      pendingEngineMove,
      isEngineThinking: Boolean(pendingEngineMove),
      ...clearTransientState(),
    })
  },

  // ── setMode ──────────────────────────────────────────────────────────────
  setMode: (mode) => {
    const state = get()
    const chess = createChessFromState(state)
    const shouldQueueEngine =
      mode === 'bot' && !chess.isGameOver() && chess.turn() === state.engineColor

    set({
      mode,
      pendingEngineMove:  shouldQueueEngine ? chooseEngineMove(chess, state.botRank) : null,
      isEngineThinking:   shouldQueueEngine,
      ...clearTransientState(),
    })
  },

  // ── setBotRank ────────────────────────────────────────────────────────────
  setBotRank: (botRank) => {
    const state = get()
    const chess = createChessFromState(state)
    const shouldQueueEngine =
      state.mode === 'bot' && !chess.isGameOver() && chess.turn() === state.engineColor

    set({
      botRank,
      pendingEngineMove: shouldQueueEngine ? chooseEngineMove(chess, botRank) : null,
      isEngineThinking:  shouldQueueEngine,
    })
  },

  // ── playPendingEngineMove ─────────────────────────────────────────────────
  playPendingEngineMove: () => {
    const state = get()
    if (!state.pendingEngineMove) return
    const move = state.pendingEngineMove
    // Clear pending first so no race re-triggers this
    set({ pendingEngineMove: null, isEngineThinking: false })
    get().playMove(move.from, move.to)
  },

  // ── showHint ──────────────────────────────────────────────────────────────
  showHint: () => {
    const state = get()
    const chess = createChessFromState(state)
    let rankedMoves = []
    try { rankedMoves = rankLegalMoves(chess) } catch { /* ignore */ }
    const best = rankedMoves[0]
    if (!best) return

    set({
      hint: { from: best.move.from, to: best.move.to, text: `Hint: ${best.move.san} ${formatEval(best.whiteEval)}` },
    })
  },

  dismissBadge: () => set({ floatingBadge: null }),

  // ── tickClock ─────────────────────────────────────────────────────────────
  tickClock: () => {
    const state = get()
    if (state.gameResult.status !== 'playing') return

    const chess = createChessFromState(state)
    const turn = chess.turn()

    if (turn === 'w') {
      const newTime = state.whiteTime - 1
      if (newTime <= 0) {
        set({ whiteTime: 0, gameResult: { status: 'black_won', reason: 'on time' } })
      } else {
        set({ whiteTime: newTime })
      }
    } else {
      const newTime = state.blackTime - 1
      if (newTime <= 0) {
        set({ blackTime: 0, gameResult: { status: 'white_won', reason: 'on time' } })
      } else {
        set({ blackTime: newTime })
      }
    }
  },

  // ── resetGame ─────────────────────────────────────────────────────────────
  resetGame: () => {
    set({ ...buildInitialState() })
  },
}))

// ─── Selectors ────────────────────────────────────────────────────────────────
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
    ply:            index + 1,
    san:            entry.move.san,
    evaluation:     entry.evaluation,
    classification: entry.classification,
  }))
}
