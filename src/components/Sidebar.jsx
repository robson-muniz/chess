import { formatEval } from '../lib/evaluation'
import {
  getBotRank,
  getBotRanks,
  getCurrentSnapshot,
  getMoveHistory,
  getStatusFromFen,
  useChessStore,
} from '../store/useChessStore'
import { Clock } from './Clock'

function EvalBar({ score }) {
  const clamped = Math.max(-6, Math.min(6, score))
  const fill = ((clamped + 6) / 12) * 100

  return (
    <div className="eval-card">
      <div className="eval-bar"><div className="eval-fill" style={{ height: `${fill}%` }} /></div>
      <div>
        <p className="panel-label">Evaluation</p>
        <strong className="eval-score">{formatEval(score)}</strong>
        <p className="muted">Engine perspective</p>
      </div>
    </div>
  )
}

export function LeftPanel() {
  const snapshots = useChessStore((state) => state.snapshots)
  const pointer = useChessStore((state) => state.pointer)
  const mode = useChessStore((state) => state.mode)
  const botRank = useChessStore((state) => state.botRank)
  const isEngineThinking = useChessStore((state) => state.isEngineThinking)
  const undo = useChessStore((state) => state.undo)
  const redo = useChessStore((state) => state.redo)
  const flipBoard = useChessStore((state) => state.flipBoard)
  const showHint = useChessStore((state) => state.showHint)
  const setMode = useChessStore((state) => state.setMode)
  const setBotRank = useChessStore((state) => state.setBotRank)
  const hint = useChessStore((state) => state.hint)

  const snapshot = getCurrentSnapshot({ snapshots, pointer })
  const status = getStatusFromFen(snapshot.fen)
  const activeRank = getBotRank(botRank)
  const ranks = getBotRanks()

  return (
    <>
      <Clock color="b" playerName="Astra Engine" rank={`${activeRank.elo} ELO`} avatar="♚" />
      <EvalBar score={snapshot.evaluation} />
      <section className="panel status-card">
        <p className="panel-label">Match</p><h2>{status}</h2>
        <p className="mode-pill">{mode === 'bot' ? 'Duel Mode' : 'Studio Analysis'}</p>
        {isEngineThinking && <p className="thinking-line">Calculating best line…</p>}
      </section>
      <section className="panel controls-card controls-card-modes">
        <button type="button" className={`ui-button ${mode === 'bot' ? 'is-active' : ''}`} onClick={() => setMode('bot')}>Duel</button>
        <button type="button" className={`ui-button ${mode === 'analysis' ? 'is-active' : ''}`} onClick={() => setMode('analysis')}>Analyze</button>
      </section>
      {mode === 'bot' && <section className="panel rank-card"><div className="history-head"><p className="panel-label">Engine persona</p></div><div className="rank-list">{ranks.map((rank) => <button key={rank.id} type="button" className={`rank-option ${rank.id === botRank ? 'is-active' : ''}`} onClick={() => setBotRank(rank.id)}><strong>{rank.label}</strong><span>{rank.elo} Elo</span></button>)}</div></section>}
      <section className="panel controls-card">
        <button type="button" className="ui-button" onClick={undo}>Undo</button>
        <button type="button" className="ui-button" onClick={redo}>Redo</button>
        <button type="button" className="ui-button" onClick={flipBoard}>Rotate</button>
        <button type="button" className="ui-button ui-button-strong" onClick={showHint}>Hint</button>
      </section>
      {hint && <section className="panel hint-card"><p className="panel-label">Suggested move</p><h3>{hint.text}</h3><p className="muted">Top continuation available.</p></section>}
      <Clock color="w" playerName="You" rank="Challenger" avatar="♔" />
    </>
  )
}

export function RightPanel() {
  const snapshots = useChessStore((state) => state.snapshots)
  const pointer = useChessStore((state) => state.pointer)
  const moveHistory = getMoveHistory(snapshots)
  void pointer
  return (
    <section className="panel history-card">
      <div className="history-head"><p className="panel-label">Move history</p><span className="muted">{moveHistory.length} plies</span></div>
      <div className="history-list">{moveHistory.length === 0 ? <p className="muted">No moves yet. Select a piece to begin.</p> : moveHistory.map((entry, index) => <article className="history-row" key={`${entry.ply}-${entry.san}-${index}`}><span className="move-index">{entry.ply}.</span><div><strong>{entry.san}</strong><p className={`quality-tag ${entry.classification?.id ?? ''}`}>{entry.classification?.label ?? 'Played'} · {formatEval(entry.evaluation)}</p></div></article>)}</div>
    </section>
  )
}

export function Sidebar() { return null }
