import { Chess } from 'chess.js'

const PIECE_VALUES = {
  p: 1,
  n: 3.15,
  b: 3.35,
  r: 5.1,
  q: 9.4,
  k: 0,
}

const CENTER_BONUS = {
  d4: 0.12,
  e4: 0.12,
  d5: 0.12,
  e5: 0.12,
  c3: 0.08,
  f3: 0.08,
  c6: 0.08,
  f6: 0.08,
}

const CLASSIFICATIONS = [
  { id: 'best', maxLoss: 0.15, label: 'Best', accent: 'var(--eval-best)' },
  { id: 'good', maxLoss: 0.45, label: 'Good', accent: 'var(--eval-good)' },
  { id: 'inaccuracy', maxLoss: 1.1, label: 'Inaccuracy', accent: 'var(--eval-inaccuracy)' },
  { id: 'mistake', maxLoss: 2.4, label: 'Mistake', accent: 'var(--eval-mistake)' },
  { id: 'blunder', maxLoss: Infinity, label: 'Blunder', accent: 'var(--eval-blunder)' },
]

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

function squareColorWeight(square) {
  return CENTER_BONUS[square] ?? 0
}

function evaluateMaterial(board) {
  let score = 0

  board.forEach((row, rowIndex) => {
    row.forEach((piece, colIndex) => {
      if (!piece) return

      const square = `${FILES[colIndex]}${8 - rowIndex}`
      const direction = piece.color === 'w' ? 1 : -1
      const advancement = piece.type === 'p' ? (piece.color === 'w' ? rowIndex : 7 - rowIndex) * -0.02 : 0
      score += direction * (PIECE_VALUES[piece.type] + squareColorWeight(square) + advancement)
    })
  })

  return score
}

export function evaluatePosition(chessLike) {
  const chess = chessLike instanceof Chess ? chessLike : new Chess(chessLike)
  const board = chess.board()
  const material = evaluateMaterial(board)

  const whiteMobility = chess.moves().length
  const turn = chess.turn()
  const fenParts = chess.fen().split(' ')
  fenParts[1] = turn === 'w' ? 'b' : 'w'
  const enemy = new Chess(fenParts.join(' '))
  const blackMobility = enemy.moves().length
  const mobility = (whiteMobility - blackMobility) * 0.025

  let kingPressure = 0
  if (chess.inCheck()) {
    kingPressure = turn === 'w' ? -0.35 : 0.35
  }

  if (chess.isCheckmate()) {
    return turn === 'w' ? -99 : 99
  }

  if (chess.isDraw() || chess.isStalemate() || chess.isInsufficientMaterial()) {
    return 0
  }

  return Number((material + mobility + kingPressure).toFixed(2))
}

export function rankLegalMoves(chess) {
  const mover = chess.turn()
  const moves = chess.moves({ verbose: true })

  return moves
    .map((move) => {
      const next = new Chess(chess.fen())
      next.move(move)
      const whiteEval = evaluatePosition(next)
      const moverEval = mover === 'w' ? whiteEval : -whiteEval

      return {
        move,
        whiteEval,
        moverEval,
      }
    })
    .sort((a, b) => b.moverEval - a.moverEval)
}

export function classifyMove(bestMoverEval, chosenMoverEval) {
  const loss = Math.max(0, Number((bestMoverEval - chosenMoverEval).toFixed(2)))
  return CLASSIFICATIONS.find((item) => loss <= item.maxLoss) ?? CLASSIFICATIONS[CLASSIFICATIONS.length - 1]
}

export function formatEval(score) {
  if (Math.abs(score) >= 90) {
    return score > 0 ? 'M+' : 'M-'
  }

  return `${score > 0 ? '+' : ''}${score.toFixed(1)}`
}
