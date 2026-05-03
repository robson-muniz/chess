import { formatEval } from '../lib/evaluation'
import {
  getBotRank,
  getBotRanks,
  getCurrentSnapshot,
  getMoveHistory,
  getStatusFromFen,
  useChessStore,
} from '../store/useChessStore'

function EvalBar({ score }) {
  const clamped = Math.max(-6, Math.min(6, score))
  const fill = ((clamped + 6) / 12) * 100

  return (
    <div className="eval-card">
      <div className="eval-bar">
        <div className="eval-fill" style={{ height: `${fill}%` }} />
      </div>
      <div>
        <p className="panel-label">Evaluation</p>
        <strong className="eval-score">{formatEval(score)}</strong>
        <p className="muted">Positive values favor White.</p>
      </div>
    </div>
  )
}

export function Sidebar() {
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
  const moveHistory = getMoveHistory(snapshots)
  const activeRank = getBotRank(botRank)
  const ranks = getBotRanks()

  return (
    <aside className="sidebar">
      <EvalBar score={snapshot.evaluation} />

      <section className="panel status-card">
        <p className="panel-label">Game status</p>
        <h2>{status}</h2>
        <p className="mode-pill">{mode === 'bot' ? 'Mode: Vs Bot' : 'Mode: Local Analysis'}</p>
        {mode === 'bot' && <p className="rank-pill">{activeRank.label} · {activeRank.elo} Elo</p>}
        {isEngineThinking && <p className="thinking-line">Black is thinking...</p>}
        <p className="muted">Move quality is graded against the best legal move in the current position.</p>
      </section>

      <section className="panel controls-card controls-card-modes">
        <button
          type="button"
          className={`ui-button ${mode === 'bot' ? 'is-active' : ''}`}
          onClick={() => setMode('bot')}
        >
          Vs Bot
        </button>
        <button
          type="button"
          className={`ui-button ${mode === 'analysis' ? 'is-active' : ''}`}
          onClick={() => setMode('analysis')}
        >
          Analysis
        </button>
      </section>

      {mode === 'bot' && (
        <section className="panel rank-card">
          <div className="history-head">
            <p className="panel-label">Bot rank</p>
            <span className="muted">{activeRank.description}</span>
          </div>
          <div className="rank-list">
            {ranks.map((rank) => (
              <button
                key={rank.id}
                type="button"
                className={`rank-option ${rank.id === botRank ? 'is-active' : ''}`}
                onClick={() => setBotRank(rank.id)}
              >
                <strong>{rank.label}</strong>
                <span>{rank.elo} Elo</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="panel controls-card">
        <button type="button" className="ui-button" onClick={undo}>
          Undo
        </button>
        <button type="button" className="ui-button" onClick={redo}>
          Redo
        </button>
        <button type="button" className="ui-button" onClick={flipBoard}>
          Flip
        </button>
        <button type="button" className="ui-button ui-button-strong" onClick={showHint}>
          Hint
        </button>
      </section>

      {hint && (
        <section className="panel hint-card">
          <p className="panel-label">Suggested move</p>
          <h3>{hint.text}</h3>
          <p className="muted">
            The highlighted destination square shows the top heuristic continuation available right now.
          </p>
        </section>
      )}

      <section className="panel history-card">
        <div className="history-head">
          <p className="panel-label">Move history</p>
          <span className="muted">{moveHistory.length} plies</span>
        </div>

        <div className="history-list">
          {moveHistory.length === 0 && <p className="muted">No moves yet. Select a piece to begin.</p>}

          {moveHistory.map((entry, index) => (
            <article className="history-row" key={`${entry.ply}-${entry.san}-${index}`}>
              <span className="move-index">{entry.ply}.</span>
              <div>
                <strong>{entry.san}</strong>
                <p className={`quality-tag ${entry.classification?.id ?? ''}`}>
                  {entry.classification?.label ?? 'Played'} · {formatEval(entry.evaluation)}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </aside>
  )
}
