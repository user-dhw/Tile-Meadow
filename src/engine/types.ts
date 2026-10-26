export const SYMBOLS = ['carrot','corn','strawberry','apple','mushroom','sunflower','leaf','flower','milk','watermelon','acorn','pumpkin'] as const
export type TileSymbol = typeof SYMBOLS[number]
export interface TilePosition { x: number; y: number; layer: number }
export interface Tile extends TilePosition { id: string; symbol: TileSymbol; order: number; removed: boolean }
export type BoardState = Tile[]
export type TrayState = Tile[]
export type GameMode = 'levels' | 'endless' | 'daily'
export type GameStatus = 'playing' | 'won' | 'lost'
export interface PowerUpState { undo: number; shuffle: number; hold: number; hint: number }
export interface LevelConfig { level: number; tileCount: number; layers: number; symbolCount: number; interleaving: number }
export type Feedback = 'selected'|'match'|'won'|'lost'|'undo'|'shuffled'|'shuffleUnavailable'|'held'|'returned'|'hintVerified'|'hintLegal'|null
export interface GameSnapshot { board: Tile[]; tray: Tile[]; held: Tile[]; score: number; moves: number; matches: number; combo: number; maxCombo: number; status: GameStatus; witness: string[] }
export interface GameState extends GameSnapshot { mode: GameMode; level: number; seed: string; powers: PowerUpState; history: GameSnapshot[]; elapsedMs: number; powerUpsUsed: number; rngState: number; hintId: string|null; hintSource: 'verified'|'legal'|null; feedback: Feedback }
export type GameAction = {type:'SELECT_TILE';id:string}|{type:'RETURN_HELD_TILE';id:string}|{type:'UNDO_MOVE'}|{type:'SHUFFLE_TILES'}|{type:'REMOVE_THREE'}|{type:'USE_HINT'}|{type:'TICK';deltaMs:number}|{type:'RESTART_LEVEL'}|{type:'START_GAME';level:number;seed:string;mode:GameMode}|{type:'NEXT_LEVEL';seed:string}|{type:'RESTORE_GAME';state:GameState}
export interface GeneratedLevel { board: Tile[]; witness: string[]; seed: string; config: LevelConfig; rngState: number }
export interface SolutionResult { moves: string[]; verified: boolean; visited: number }
