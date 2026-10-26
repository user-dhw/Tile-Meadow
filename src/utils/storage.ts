import { SYMBOLS } from '../engine/types'
import { BOARD_HEIGHT, BOARD_WIDTH, TILE_SIZE } from '../config/gameConfig'
import type { GameSnapshot, GameState, Tile } from '../engine/types'

export const SAVE_KEY = 'tile-meadow.save.v1'
export interface Settings {
  language: 'zh' | 'en'
  sound: boolean
  volume: number
  reducedMotion: boolean
}
export interface Progress {
  unlockedLevel: number
  bestScore: number
  bestStreak: number
  endlessStreak: number
  endlessScore: number
  completedDailies: string[]
  totalWins: number
  totalMatches: number
}
export interface SaveData {
  version: 1
  game: GameState | null
  settings: Settings
  progress: Progress
}

export function defaultSave(): SaveData {
  return {
    version: 1,
    game: null,
    settings: { language: 'zh', sound: true, volume: 0.35, reducedMotion: false },
    progress: {
      unlockedLevel: 1, bestScore: 0, bestStreak: 0, endlessStreak: 0,
      endlessScore: 0, completedDailies: [], totalWins: 0, totalMatches: 0,
    },
  }
}

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const count = (value: unknown, max = Number.MAX_SAFE_INTEGER): value is number =>
  finite(value) && Number.isSafeInteger(value) && value >= 0 && value <= max
const text = (value: unknown, max = 300): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max
const validDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T00:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function validTile(value: unknown): value is Tile {
  return object(value) && text(value.id) &&
    typeof value.symbol === 'string' && SYMBOLS.includes(value.symbol as Tile['symbol']) &&
    finite(value.x) && value.x >= 0 && value.x + TILE_SIZE <= BOARD_WIDTH &&
    finite(value.y) && value.y >= 0 && value.y + TILE_SIZE <= BOARD_HEIGHT &&
    count(value.layer, 20) && count(value.order, 1000) && typeof value.removed === 'boolean'
}

function validSnapshot(value: unknown): value is GameSnapshot {
  if (!object(value) || !Array.isArray(value.board) || value.board.length < 3 ||
    value.board.length > 180 || value.board.length % 3 !== 0 || !value.board.every(validTile) ||
    !Array.isArray(value.tray) || value.tray.length > 7 || !value.tray.every(validTile) ||
    !Array.isArray(value.held) || value.held.length > 3 || !value.held.every(validTile)) return false
  const board = value.board as Tile[]
  const tray = value.tray as Tile[]
  const held = value.held as Tile[]
  const ids = new Map(board.map(tile => [tile.id, tile]))
  if (ids.size !== board.length) return false
  const collected = [...tray, ...held]
  if (new Set(collected.map(tile => tile.id)).size !== collected.length) return false
  if (!collected.every(tile => {
    const original = ids.get(tile.id)
    return original?.removed && original.symbol === tile.symbol && tile.removed
  })) return false
  if (SYMBOLS.some(symbol => board.filter(tile => tile.symbol === symbol).length % 3 !== 0)) return false
  const liveTiles = [...board.filter(tile => !tile.removed), ...collected]
  if (SYMBOLS.some(symbol => liveTiles.filter(tile => tile.symbol === symbol).length % 3 !== 0)) return false
  if (!['score', 'moves', 'matches', 'combo', 'maxCombo'].every(key => count(value[key]))) return false
  if (!['playing', 'won', 'lost'].includes(value.status as string)) return false
  if (value.status === 'playing' && tray.length >= 7) return false
  if (value.status === 'lost' && tray.length !== 7) return false
  const cleared = board.every(tile => tile.removed) && tray.length === 0 && held.length === 0
  if ((value.status === 'won') !== cleared) return false
  if (SYMBOLS.some(symbol => tray.filter(tile => tile.symbol === symbol).length >= 3)) return false
  if (!Array.isArray(value.witness) || value.witness.length > 240 ||
    !value.witness.every(id => text(id) && ids.has(id))) return false
  return true
}

export function isValidGame(value: unknown): value is GameState {
  if (!validSnapshot(value) || !object(value)) return false
  if (!['levels', 'endless', 'daily'].includes(value.mode as string) || !count(value.level, 100000) || value.level < 1 ||
    !text(value.seed) || !count(value.elapsedMs) || !count(value.powerUpsUsed) || !count(value.rngState, 0xffffffff)) return false
  if (!object(value.powers) || !['undo', 'shuffle', 'hold', 'hint'].every(key => count((value.powers as Record<string, unknown>)[key], 100))) return false
  if (!Array.isArray(value.history) || value.history.length > 180 || !value.history.every(validSnapshot)) return false
  if (value.hintId !== null && (!text(value.hintId) || ![...(value.board as Tile[]).filter(tile => !tile.removed), ...(value.held as Tile[])].some(tile => tile.id === value.hintId))) return false
  if (value.hintSource !== null && value.hintSource !== 'verified' && value.hintSource !== 'legal') return false
  const feedbacks = ['selected', 'match', 'won', 'lost', 'undo', 'shuffled', 'shuffleUnavailable', 'held', 'returned', 'hintVerified', 'hintLegal']
  if (value.feedback !== null && !feedbacks.includes(value.feedback as string)) return false
  return true
}

function readSettings(value: unknown, fallback: Settings): Settings {
  if (!object(value)) return fallback
  return {
    language: value.language === 'en' ? 'en' : 'zh',
    sound: typeof value.sound === 'boolean' ? value.sound : fallback.sound,
    volume: finite(value.volume) && value.volume >= 0 && value.volume <= 1 ? value.volume : fallback.volume,
    reducedMotion: typeof value.reducedMotion === 'boolean' ? value.reducedMotion : fallback.reducedMotion,
  }
}
function readProgress(value: unknown, fallback: Progress): Progress {
  if (!object(value)) return fallback
  const result = { ...fallback }
  for (const key of ['unlockedLevel', 'bestScore', 'bestStreak', 'endlessStreak', 'endlessScore', 'totalWins', 'totalMatches'] as const) {
    if (count(value[key], key === 'unlockedLevel' ? 100000 : Number.MAX_SAFE_INTEGER)) result[key] = value[key]
  }
  result.unlockedLevel = Math.max(1, result.unlockedLevel)
  if (Array.isArray(value.completedDailies)) result.completedDailies = [...new Set(value.completedDailies.filter(validDate))].slice(-730)
  return result
}

export function loadSave(): SaveData {
  const fallback = defaultSave()
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw || raw.length > 3_000_000) return fallback
    const parsed: unknown = JSON.parse(raw)
    if (!object(parsed) || parsed.version !== 1) return fallback
    return {
      version: 1,
      game: isValidGame(parsed.game) ? parsed.game : null,
      settings: readSettings(parsed.settings, fallback.settings),
      progress: readProgress(parsed.progress, fallback.progress),
    }
  } catch { return fallback }
}

export function saveGame(data: SaveData): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    return true
  } catch { return false }
}

export function dailyDate(date: Date = new Date()): string { return date.toISOString().slice(0, 10) }
export function dailySeed(date: Date = new Date()): string { return 'daily:' + dailyDate(date) }

/** Call once when a run transitions into a win, before persisting the combined save. */
export function recordWin(progress: Progress, game: GameState): Progress {
  if (game.status !== 'won') return progress
  const streak = game.mode === 'endless' ? progress.endlessStreak + 1 : progress.endlessStreak
  const date = game.seed.startsWith('daily:') ? game.seed.slice(6) : dailyDate()
  return {
    ...progress,
    unlockedLevel: game.mode === 'levels' ? Math.max(progress.unlockedLevel, game.level + 1) : progress.unlockedLevel,
    bestScore: Math.max(progress.bestScore, game.score),
    bestStreak: Math.max(progress.bestStreak, streak),
    endlessStreak: streak,
    endlessScore: game.mode === 'endless' ? progress.endlessScore + game.score : progress.endlessScore,
    completedDailies: game.mode === 'daily' && validDate(date)
      ? [...new Set([...progress.completedDailies, date])].slice(-730)
      : progress.completedDailies,
    totalWins: progress.totalWins + 1,
    totalMatches: progress.totalMatches + game.matches,
  }
}
