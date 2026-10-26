import { describe, expect, it } from 'vitest'
import { createGame, gameReducer } from '../engine/gameEngine'
import { createVerificationState, verifyWitnessSolution } from '../engine/levelValidator'
import { getHint, solveCurrentState } from '../engine/puzzleSolver'
import { getSelectableTiles } from '../engine/tileBlocking'
import type { GameState, Tile, TileSymbol } from '../engine/types'
import { isValidGame } from '../utils/storage'

function fixture(symbols: TileSymbol[] = ['carrot', 'corn', 'apple', 'leaf', 'flower', 'milk', 'pumpkin']): GameState {
  const board: Tile[] = symbols.flatMap((symbol, group) => Array.from({ length: 3 }, (_, copy) => {
    const index = group * 3 + copy
    return { id: `${symbol}-${copy}`, symbol, x: index % 7, y: Math.floor(index / 7), layer: 0, order: index, removed: false }
  }))
  return { ...createVerificationState(board, board.map(tile => tile.id)), seed: 'audit', level: 3 }
}
function select(state: GameState, ...ids: string[]) {
  return ids.reduce((game, id) => gameReducer(game, { type: 'SELECT_TILE', id }), state)
}
function remainingCounts(state: GameState) {
  const counts: Record<string, number> = {}
  for (const tile of state.board.filter(tile => !tile.removed)) counts[tile.symbol] = (counts[tile.symbol] ?? 0) + 1
  return counts
}

describe('independent engine edge audit', () => {
  it('resolves a triple on insertion seven before testing capacity', () => {
    let state = select(fixture(), 'carrot-0', 'carrot-1', 'corn-0', 'apple-0', 'leaf-0', 'flower-0')
    expect(state.tray).toHaveLength(6)
    state = select(state, 'carrot-2')
    expect(state.status).toBe('playing')
    expect(state.tray).toHaveLength(4)
    expect(state.matches).toBe(1)
    expect(state.score).toBe(100)
  })
  it('ignores rapid duplicate board selections and rejects further moves after loss', () => {
    let state = select(fixture(), 'carrot-0')
    const once = state
    state = select(state, 'carrot-0', 'carrot-0', 'missing')
    expect(state).toBe(once)
    state = select(state, 'corn-0', 'apple-0', 'leaf-0', 'flower-0', 'milk-0', 'pumpkin-0')
    expect(state.status).toBe('lost')
    expect(state.tray).toHaveLength(7)
    expect(select(state, 'carrot-1')).toBe(state)
  })
  it('can recover a seven-slot loss into a holding area without destroying any collected tile', () => {
    const state = select(fixture(), 'carrot-0', 'corn-0', 'apple-0', 'leaf-0', 'flower-0', 'milk-0', 'pumpkin-0')
    const recovered = gameReducer(state, { type: 'REMOVE_THREE' })
    expect(recovered.status).toBe('playing')
    expect(recovered.tray).toHaveLength(4)
    expect(recovered.held).toHaveLength(3)
    expect(new Set([...recovered.tray, ...recovered.held].map(tile => tile.id))).toEqual(new Set(state.tray.map(tile => tile.id)))
    expect(recovered.score).toBe(state.score)
    expect(recovered.powers.hold).toBe(state.powers.hold - 1)
    expect(gameReducer(recovered, { type: 'REMOVE_THREE' })).toBe(recovered)
  })
  it('does not award victory until held tiles have actually matched', () => {
    const initial = fixture(['carrot'])
    let state = select(initial, 'carrot-0', 'carrot-1')
    state = gameReducer(state, { type: 'REMOVE_THREE' })
    state = select(state, 'carrot-2')
    expect(state.board.every(tile => tile.removed)).toBe(true)
    expect(state.status).toBe('playing')
    expect(state.score).toBe(0)
    state = gameReducer(state, { type: 'RETURN_HELD_TILE', id: 'carrot-0' })
    expect(state.status).toBe('playing')
    state = gameReducer(state, { type: 'RETURN_HELD_TILE', id: 'carrot-1' })
    expect(state.status).toBe('won')
    expect(state.tray).toHaveLength(0)
    expect(state.held).toHaveLength(0)
    expect(state.score).toBe(600)
  })
  it('prevents duplicate held returns, and invalid IDs consume nothing', () => {
    let state = select(fixture(), 'carrot-0')
    state = gameReducer(state, { type: 'REMOVE_THREE' })
    state = gameReducer(state, { type: 'RETURN_HELD_TILE', id: 'carrot-0' })
    const once = state
    state = gameReducer(state, { type: 'RETURN_HELD_TILE', id: 'carrot-0' })
    expect(state).toBe(once)
    expect(gameReducer(state, { type: 'RETURN_HELD_TILE', id: 'unknown' })).toBe(state)
    expect(state.history).toHaveLength(0)
  })
  it('undo restores a matched triple atomically and never refunds earlier hint charges', () => {
    let state = select(fixture(), 'carrot-0', 'carrot-1')
    state = gameReducer(state, { type: 'USE_HINT' })
    const before = state
    state = select(state, 'carrot-2')
    expect(state.tray).toHaveLength(0)
    expect(state.matches).toBe(1)
    state = gameReducer(state, { type: 'UNDO_MOVE' })
    expect(state.board).toEqual(before.board)
    expect(state.tray).toEqual(before.tray)
    expect(state.score).toBe(before.score)
    expect(state.moves).toBe(before.moves)
    expect(state.matches).toBe(before.matches)
    expect(state.powers.hint).toBe(before.powers.hint)
    expect(state.powers.undo).toBe(before.powers.undo - 1)
    expect(state.powerUpsUsed).toBe(before.powerUpsUsed + 1)
  })
  it('repeated undo consumes its independent limited charges', () => {
    let state = select(fixture(), 'carrot-0', 'corn-0', 'apple-0')
    const charges = state.powers.undo
    const beforeUses = state.powerUpsUsed
    for (let i = 0; i < charges; i++) {
      state = gameReducer(state, { type: 'UNDO_MOVE' })
      expect(state.powers.undo).toBe(charges - i - 1)
    }
    expect(state.powerUpsUsed).toBe(beforeUses + charges)
    expect(gameReducer(state, { type: 'UNDO_MOVE' })).toBe(state)
  })
  it('invalid or inapplicable powers never consume a charge', () => {
    const state = fixture()
    expect(gameReducer(state, { type: 'UNDO_MOVE' })).toBe(state)
    expect(gameReducer(state, { type: 'REMOVE_THREE' })).toBe(state)
    const noPowers = { ...state, powers: { undo: 0, shuffle: 0, hold: 0, hint: 0 } }
    for (const type of ['UNDO_MOVE', 'SHUFFLE_TILES', 'REMOVE_THREE', 'USE_HINT'] as const) expect(gameReducer(noPowers, { type })).toBe(noPowers)
  })
  it('elapsed time survives undo, ignores malformed deltas, and stops at a terminal state', () => {
    let state = select(fixture(), 'carrot-0')
    state = gameReducer(state, { type: 'TICK', deltaMs: 1200 })
    state = gameReducer(state, { type: 'UNDO_MOVE' })
    expect(state.elapsedMs).toBe(1200)
    for (const deltaMs of [NaN, Infinity, -Infinity, -100, 0]) {
      state = gameReducer(state, { type: 'TICK', deltaMs })
      expect(state.elapsedMs).toBe(1200)
    }
    const won = { ...state, status: 'won' as const }
    expect(gameReducer(won, { type: 'TICK', deltaMs: 1000 })).toBe(won)
    const lost = { ...state, status: 'lost' as const }
    expect(gameReducer(lost, { type: 'TICK', deltaMs: 1000 })).toBe(lost)
    const restarted = gameReducer(state, { type: 'RESTART_LEVEL' })
    expect(restarted.elapsedMs).toBe(0)
    expect(restarted.seed).toBe(state.seed)
    expect(restarted.powers.undo).toBeGreaterThan(0)
  })
  it('bounded solver never labels a legal fallback a guaranteed continuation', () => {
    let state = select(fixture(), 'carrot-0', 'corn-0')
    state = { ...state, witness: [] }
    const result = solveCurrentState(state, 0)
    expect(result.verified).toBe(false)
    expect(result.moves).toEqual([])
    const hint = getHint(state)
    expect(hint.id).not.toBeNull()
    if (hint.verified) {
      const solved = solveCurrentState(state)
      expect(verifyWitnessSolution(state.board, solved.moves, state)).toBe(true)
    } else expect(getSelectableTiles(state.board).some(tile => tile.id === hint.id)).toBe(true)
  })
  it('every mixed-power shuffle either proves a continuation or preserves the original puzzle and charge', () => {
    let changed = 0
    for (const level of [2, 5, 10]) for (let seed = 0; seed < 8; seed++) {
      let state = createGame(level, `audit-mixed-${level}-${seed}`)
      state = select(state, ...state.witness.slice(0, seed % 6 + 1))
      if (state.tray.length && seed % 2 === 0) state = gameReducer(state, { type: 'REMOVE_THREE' })
      const before = state
      const countBefore = remainingCounts(before)
      state = gameReducer(state, { type: 'SHUFFLE_TILES' })
      expect(remainingCounts(state)).toEqual(countBefore)
      expect(state.tray).toEqual(before.tray)
      expect(state.held).toEqual(before.held)
      expect(state.board.map(({ id, x, y, layer, order, removed }) => ({ id, x, y, layer, order, removed }))).toEqual(before.board.map(({ id, x, y, layer, order, removed }) => ({ id, x, y, layer, order, removed })))
      if (state.feedback === 'shuffled') {
        changed++
        expect(state.powers.shuffle).toBe(before.powers.shuffle - 1)
        expect(state.history).toHaveLength(0)
        expect(verifyWitnessSolution(state.board, state.witness, state)).toBe(true)
        expect(isValidGame(state)).toBe(true)
      } else {
        expect(state.board).toEqual(before.board)
        expect(state.powers.shuffle).toBe(before.powers.shuffle)
      }
    }
    expect(changed).toBeGreaterThan(0)
  })
  it('selection and powers preserve immutable old state objects', () => {
    const state = fixture()
    const original = structuredClone(state)
    const selected = select(state, 'carrot-0')
    const selectedCopy = structuredClone(selected)
    gameReducer(selected, { type: 'SHUFFLE_TILES' })
    gameReducer(selected, { type: 'REMOVE_THREE' })
    gameReducer(selected, { type: 'USE_HINT' })
    gameReducer(selected, { type: 'UNDO_MOVE' })
    expect(state).toEqual(original)
    expect(selected).toEqual(selectedCopy)
  })
})

describe('restoration integrity audit', () => {
  it('rejects a missing unpaired tile rather than restoring an impossible run', () => {
    const state = fixture()
    expect(isValidGame({ ...state, board: state.board.map((tile, index) => index === 0 ? { ...tile, removed: true } : tile) })).toBe(false)
  })
  it('rejects invisible out-of-board tile geometry', () => {
    const state = createGame(2, 'audit-storage-bounds')
    for (const tileChange of [{ x: 7 }, { y: 7 }, { x: 20 }, { y: 20 }]) {
      expect(isValidGame({ ...state, board: state.board.map((tile, index) => index === 0 ? { ...tile, ...tileChange } : tile) })).toBe(false)
    }
  })
  it('rejects an unfinished status for an already cleared puzzle', () => {
    const state = fixture()
    expect(isValidGame({ ...state, board: state.board.map(tile => ({ ...tile, removed: true })), tray: [], held: [], status: 'playing' })).toBe(false)
  })
})
