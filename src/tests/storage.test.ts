import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameState, Tile } from '../engine/types'
import { createGame, gameReducer } from '../engine/gameEngine'
import { dailyDate, dailySeed, defaultSave, isValidGame, loadSave, recordWin, SAVE_KEY, saveGame } from '../utils/storage'

function fixture(): GameState {
  const symbols = ['carrot', 'corn', 'apple', 'leaf'] as const
  const board: Tile[] = Array.from({ length: 12 }, (_, i) => ({
    id: 'tile-' + i, symbol: symbols[Math.floor(i / 3)], x: i % 4, y: Math.floor(i / 4),
    layer: 0, order: i, removed: false,
  }))
  return {
    board, tray: [], held: [], score: 0, moves: 0, matches: 0, combo: 0, maxCombo: 0,
    status: 'playing', witness: board.map(tile => tile.id), mode: 'levels', level: 1,
    seed: 'test-seed', powers: { undo: 2, shuffle: 2, hold: 1, hint: 3 }, history: [],
    elapsedMs: 1000, powerUpsUsed: 0, rngState: 42, hintId: null, hintSource: null, feedback: null,
  }
}
function victory(mode: GameState['mode'] = 'levels'): GameState {
  const game = fixture()
  return { ...game, mode, board: game.board.map(tile => ({ ...tile, removed: true })),
    score: 900, moves: 12, matches: 4, status: 'won', witness: [] }
}
let store: Map<string, string>
beforeEach(() => {
  store = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('versioned local persistence', () => {
  it('returns independent Chinese defaults without a save', () => {
    expect(loadSave()).toEqual(defaultSave())
    expect(loadSave().settings.language).toBe('zh')
    const changed = defaultSave()
    changed.progress.unlockedLevel = 8
    expect(defaultSave().progress.unlockedLevel).toBe(1)
  })
  it('restores the exact active run, language, progress and settings', () => {
    const data = defaultSave()
    data.game = fixture()
    data.settings = { language: 'en', sound: false, volume: 0.7, reducedMotion: true }
    data.progress.unlockedLevel = 7
    expect(saveGame(data)).toBe(true)
    expect(loadSave()).toEqual(data)
  })
  it('restores tray and held tiles with their board removals', () => {
    const data = defaultSave()
    const game = fixture()
    game.board = game.board.map((tile, i) => ({ ...tile, removed: i < 2 }))
    game.tray = [game.board[0]]
    game.held = [game.board[1]]
    data.game = game
    saveGame(data)
    expect(loadSave().game).toEqual(game)
  })
  it.each(['{bad json', 'null', '7', '[]', 'true', '"hello"'])('ignores malformed data: %s', raw => {
    store.set(SAVE_KEY, raw)
    expect(loadSave()).toEqual(defaultSave())
  })
  it('ignores unsupported schema versions', () => {
    store.set(SAVE_KEY, JSON.stringify({ ...defaultSave(), version: 2, game: fixture() }))
    expect(loadSave()).toEqual(defaultSave())
  })
  it('preserves achievements while discarding a corrupted run', () => {
    const data = defaultSave()
    data.progress.unlockedLevel = 9
    store.set(SAVE_KEY, JSON.stringify({ ...data, game: { board: null } }))
    expect(loadSave().game).toBeNull()
    expect(loadSave().progress.unlockedLevel).toBe(9)
  })
  it('repairs malformed settings and progress fields', () => {
    store.set(SAVE_KEY, JSON.stringify({ version: 1, game: null,
      settings: { language: 'es', volume: 7, sound: 'yes', reducedMotion: false },
      progress: { unlockedLevel: -3, bestScore: 123, endlessStreak: '5', completedDailies: ['2026-10-26', 'bad', '2026-02-31', '2026-10-26'] },
    }))
    const data = loadSave()
    expect(data.settings).toEqual(defaultSave().settings)
    expect(data.progress.unlockedLevel).toBe(1)
    expect(data.progress.bestScore).toBe(123)
    expect(data.progress.endlessStreak).toBe(0)
    expect(data.progress.completedDailies).toEqual(['2026-10-26'])
  })
  it('handles disabled browser storage without throwing', () => {
    vi.stubGlobal('localStorage', { getItem() { throw new Error('disabled') }, setItem() { throw new Error('quota') } })
    expect(loadSave()).toEqual(defaultSave())
    expect(saveGame(defaultSave())).toBe(false)
  })
  it('handles unavailable browser storage', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(loadSave()).toEqual(defaultSave())
    expect(saveGame(defaultSave())).toBe(false)
  })
  it('bounds oversized saves before parsing', () => {
    store.set(SAVE_KEY, ' '.repeat(3_000_001))
    expect(loadSave()).toEqual(defaultSave())
  })
})

describe('game schema validation', () => {
  it('accepts a valid run and a valid win', () => {
    expect(isValidGame(fixture())).toBe(true)
    expect(isValidGame(victory())).toBe(true)
  })
  it.each([
    ['board', null], ['tray', null], ['held', null], ['history', null], ['powers', null],
    ['score', -1], ['moves', 1.5], ['level', 0], ['seed', ''], ['status', 'paused'],
    ['mode', 'fake'], ['elapsedMs', -4], ['rngState', 2 ** 32], ['hintId', 'unknown'],
    ['hintSource', 'guaranteed'], ['feedback', 'bad'], ['witness', ['unknown']],
  ])('rejects invalid %s', (key, value) => {
    expect(isValidGame({ ...fixture(), [key]: value })).toBe(false)
  })
  it('rejects duplicate tile identities', () => {
    const game = fixture()
    game.board[1].id = game.board[0].id
    expect(isValidGame(game)).toBe(false)
  })
  it('rejects unrecognized symbols and invalid geometry', () => {
    const game = fixture()
    expect(isValidGame({ ...game, board: game.board.map((tile, i) => i ? tile : { ...tile, symbol: 'fake' }) })).toBe(false)
    expect(isValidGame({ ...game, board: game.board.map((tile, i) => i ? tile : { ...tile, x: -1 }) })).toBe(false)
  })
  it('rejects fabricated tray tiles or a false victory with held tiles', () => {
    const game = fixture()
    expect(isValidGame({ ...game, tray: [game.board[0]] })).toBe(false)
    const won = victory()
    expect(isValidGame({ ...won, held: [won.board[0]] })).toBe(false)
  })
  it('rejects invalid undo snapshots and power counts', () => {
    expect(isValidGame({ ...fixture(), history: [{}] })).toBe(false)
    expect(isValidGame({ ...fixture(), powers: { undo: -1, shuffle: 1, hold: 1, hint: 1 } })).toBe(false)
  })
})

describe('progression and UTC daily challenges', () => {
  it('unlocks the next level while keeping previous achievements', () => {
    const progress = { ...defaultSave().progress, bestScore: 1500, unlockedLevel: 1 }
    const next = recordWin(progress, victory())
    expect(next.unlockedLevel).toBe(2)
    expect(next.bestScore).toBe(1500)
    expect(next.totalWins).toBe(1)
    expect(next.totalMatches).toBe(4)
    expect(progress.unlockedLevel).toBe(1)
  })
  it('does not regress unlocks when replaying a completed stage', () => {
    expect(recordWin({ ...defaultSave().progress, unlockedLevel: 8 }, victory()).unlockedLevel).toBe(8)
  })
  it('does not award progression for a playing or lost run', () => {
    const progress = defaultSave().progress
    expect(recordWin(progress, fixture())).toBe(progress)
    expect(recordWin(progress, { ...fixture(), status: 'lost' })).toBe(progress)
  })
  it('tracks endless streak and cumulative score independently', () => {
    const next = recordWin({ ...defaultSave().progress, endlessStreak: 4, endlessScore: 1000 }, victory('endless'))
    expect(next.endlessStreak).toBe(5)
    expect(next.bestStreak).toBe(5)
    expect(next.endlessScore).toBe(1900)
    expect(next.unlockedLevel).toBe(1)
  })
  it('marks only the puzzle seed date complete even across UTC rollover', () => {
    const game = { ...victory('daily'), seed: 'daily:2026-10-25' }
    const first = recordWin(defaultSave().progress, game)
    expect(first.completedDailies).toEqual(['2026-10-25'])
    expect(recordWin(first, game).completedDailies).toEqual(['2026-10-25'])
  })
  it('uses the same UTC date and seed regardless of local timezone', () => {
    const instant = new Date('2026-10-26T01:30:00+13:00')
    expect(dailyDate(instant)).toBe('2026-10-25')
    expect(dailySeed(instant)).toBe('daily:2026-10-25')
    expect(dailySeed(new Date('2026-10-25T12:30:00Z'))).toBe(dailySeed(instant))
  })
})


describe('live engine save compatibility', () => {
  it('restores generated states and every witness step including the win', () => {
    for (const level of [1, 2, 5, 10, 18]) {
      let game = createGame(level, 'storage-integration-' + level)
      const witness = [...game.witness]
      for (const id of witness) {
        game = gameReducer(game, { type: 'SELECT_TILE', id })
        expect(isValidGame(game)).toBe(true)
      }
      expect(game.status).toBe('won')
      saveGame({ ...defaultSave(), game })
      expect(loadSave().game).toEqual(game)
    }
  })
  it('restores a hint referring to a held tile', () => {
    let game = createGame(1, 'held-hint')
    game = gameReducer(game, { type: 'SELECT_TILE', id: game.witness[0] })
    game = gameReducer(game, { type: 'REMOVE_THREE' })
    game = { ...game, hintId: game.held[0].id, hintSource: 'legal' }
    expect(isValidGame(game)).toBe(true)
  })
})
