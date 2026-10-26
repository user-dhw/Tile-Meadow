import { DEFAULT_POWERS } from '../config/gameConfig'
import { generateLevel } from './levelGenerator'
import { createVerificationState } from './levelValidator'
import { applyTile } from './turn'
import { removeThree, shuffleTiles, snapshot, undoMove, activateHint } from './powerUps'
import type { GameAction, GameMode, GameState } from './types'

export function createGame(level:number,seed:string,mode:GameMode='levels'):GameState {
 const generated=generateLevel(level,seed)
 return {...createVerificationState(generated.board,generated.witness),level:generated.config.level,seed,mode,powers:{...DEFAULT_POWERS},rngState:generated.rngState}
}
export function gameReducer(state:GameState,action:GameAction):GameState {
 switch(action.type) {
  case 'START_GAME': return createGame(action.level,action.seed,action.mode)
  case 'NEXT_LEVEL': return state.status==='won'?createGame(state.level+1,action.seed,state.mode):state
  case 'RESTORE_GAME': return action.state
  case 'RESTART_LEVEL': return createGame(state.level,state.seed,state.mode)
  case 'TICK': return state.status==='playing'&&Number.isFinite(action.deltaMs)&&action.deltaMs>0?{...state,elapsedMs:state.elapsedMs+Math.min(5000,Math.floor(action.deltaMs))}:state
  case 'SELECT_TILE': {
   const tile=state.board.find(item=>item.id===action.id)
   if(!tile) return state
   const next=applyTile(state,tile)
   return next===state?state:{...next,history:[...state.history,snapshot(state)]}
  }
  case 'RETURN_HELD_TILE': {
   const tile=state.held.find(item=>item.id===action.id)
   if(!tile) return state
   const next=applyTile(state,tile,true)
   return next===state?state:{...next,history:[]}
  }
  case 'UNDO_MOVE': return undoMove(state)
  case 'SHUFFLE_TILES': return shuffleTiles(state)
  case 'REMOVE_THREE': return removeThree(state)
  case 'USE_HINT': return activateHint(state)
 }
}
export { getSelectableTiles, getAvailableMoves, isTileSelectable } from './tileBlocking'
export { BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE } from '../config/gameConfig'
