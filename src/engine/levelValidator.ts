import { BOARD_HEIGHT, BOARD_WIDTH, DEFAULT_POWERS } from '../config/gameConfig'
import { SYMBOLS } from './types'
import type { GameState, GeneratedLevel, Tile } from './types'
import { getBlockingTiles, getSelectableTiles } from './tileBlocking'
import { applyTile } from './turn'

export function createVerificationState(board:Tile[],witness:string[]=[]):GameState { return {board,tray:[],held:[],score:0,moves:0,matches:0,combo:0,maxCombo:0,status:'playing',witness,mode:'levels',level:1,seed:'verification',powers:{...DEFAULT_POWERS},history:[],elapsedMs:0,powerUpsUsed:0,rngState:0,hintId:null,hintSource:null,feedback:null} }
export function verifyWitnessSolution(board:Tile[],witness:readonly string[],initial?:GameState):boolean {
 let state=initial||createVerificationState(board,[...witness])
 if(new Set(witness).size!==witness.length) return false
 for(const id of witness) {
  const tile=state.board.find(item=>item.id===id&&!item.removed)
  const held=state.held.find(item=>item.id===id)
  const next=tile?applyTile(state,tile):held?applyTile(state,held,true):state
  if(next===state||next.tray.length>7||next.status==='lost') return false
  state=next
 }
 return state.status==='won'&&state.board.every(tile=>tile.removed)&&state.tray.length===0&&state.held.length===0
}
export function validateGeneratedLevel(level:GeneratedLevel):boolean {
 const {board,witness,config}=level
 if(board.length!==config.tileCount||board.length%3!==0||new Set(board.map(tile=>tile.id)).size!==board.length) return false
 if(board.some(tile=>!Number.isFinite(tile.x)||!Number.isFinite(tile.y)||tile.x<0||tile.y<0||tile.x+1>BOARD_WIDTH||tile.y+1>BOARD_HEIGHT||!Number.isInteger(tile.layer)||tile.layer<0||!SYMBOLS.includes(tile.symbol)||tile.removed)) return false
 const counts=new Map<string,number>()
 board.forEach(tile=>counts.set(tile.symbol,(counts.get(tile.symbol)||0)+1))
 if([...counts.values()].some(count=>count%3!==0)||!getSelectableTiles(board).length) return false
 if(board.some(tile=>getBlockingTiles(tile,board).some(other=>other.layer===tile.layer))) return false
 return witness.length===board.length&&verifyWitnessSolution(board,witness)
}
export function getBoardDifficultyMetrics(board:readonly Tile[]) {
 const remaining=board.filter(tile=>!tile.removed)
 return {tileCount:remaining.length,layers:new Set(remaining.map(tile=>tile.layer)).size,symbols:new Set(remaining.map(tile=>tile.symbol)).size,selectable:getSelectableTiles(board).length,blockingEdges:remaining.reduce((sum,tile)=>sum+getBlockingTiles(tile,board).length,0)}
}
