import { COMPLETION_BONUS, TRAY_CAPACITY } from '../config/gameConfig'
import { insertIntoTray } from './trayManager'
import { isTileSelectable, removeTile } from './tileBlocking'
import { calculateMatchScore } from './scoring'
import type { GameState, Tile } from './types'
export function applyTile(state:GameState,tile:Tile,fromHeld=false):GameState {
 if(state.status!=='playing'||state.tray.length>=TRAY_CAPACITY) return state
 if(fromHeld ? !state.held.some(item=>item.id===tile.id) : !isTileSelectable(tile,state.board)) return state
 const result=insertIntoTray(state.tray,{...tile,removed:true})
 if(!result) return state
 const board=fromHeld?state.board:removeTile(state.board,tile.id)
 const held=fromHeld?state.held.filter(item=>item.id!==tile.id):state.held
 const matched=result.matched.length>0
 const combo=matched?state.combo+1:0
 const won=board.every(item=>item.removed)&&result.tray.length===0&&held.length===0
 const status=won?'won':result.tray.length>=TRAY_CAPACITY?'lost':'playing'
 return {...state,board,held,tray:result.tray,moves:state.moves+1,score:state.score+(matched?calculateMatchScore(combo):0)+(won?COMPLETION_BONUS:0),matches:state.matches+(matched?1:0),combo,maxCombo:Math.max(state.maxCombo,combo),status,hintId:null,hintSource:null,feedback:won?'won':status==='lost'?'lost':matched?'match':fromHeld?'returned':'selected'}
}
