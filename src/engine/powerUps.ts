import { createRandom, shuffled } from './random'
import { generateRemovalSequence } from './levelGenerator'
import { verifyWitnessSolution } from './levelValidator'
import { getHint } from './puzzleSolver'
import type { GameSnapshot, GameState, TileSymbol } from './types'

export function snapshot(state:GameState):GameSnapshot {
 const {board,tray,held,score,moves,matches,combo,maxCombo,status,witness}=state
 return {board,tray,held,score,moves,matches,combo,maxCombo,status,witness}
}
export function undoMove(state:GameState):GameState {
 if(state.status==='won'||state.powers.undo<=0||!state.history.length) return state
 const previous=state.history[state.history.length-1]
 return {...state,...previous,status:'playing',history:state.history.slice(0,-1),powers:{...state.powers,undo:state.powers.undo-1},powerUpsUsed:state.powerUpsUsed+1,hintId:null,hintSource:null,feedback:'undo'}
}
export function removeThree(state:GameState):GameState {
 if(state.status==='won'||state.powers.hold<=0||!state.tray.length||state.held.length) return state
 return {...state,tray:state.tray.slice(3),held:state.tray.slice(0,3),status:'playing',history:[],powers:{...state.powers,hold:state.powers.hold-1},powerUpsUsed:state.powerUpsUsed+1,hintId:null,hintSource:null,feedback:'held'}
}
export function activateHint(state:GameState):GameState {
 if(state.status!=='playing'||state.powers.hint<=0) return state
 const hint=getHint(state)
 if(!hint.id) return state
 return {...state,hintId:hint.id,hintSource:hint.verified?'verified':'legal',powers:{...state.powers,hint:state.powers.hint-1},powerUpsUsed:state.powerUpsUsed+1,feedback:hint.verified?'hintVerified':'hintLegal'}
}
export function shuffleTiles(state:GameState):GameState {
 if(state.status!=='playing'||state.powers.shuffle<=0||state.board.every(tile=>tile.removed)) return state
 const random=createRandom(state.rngState)
 const remaining=state.board.filter(tile=>!tile.removed)
 const originalSymbols=remaining.map(tile=>tile.symbol)
 const geometry=generateRemovalSequence(remaining,random)
 const boardCounts=new Map<TileSymbol,number>()
 originalSymbols.forEach(symbol=>boardCounts.set(symbol,(boardCounts.get(symbol)||0)+1))
 const order=shuffled([...new Set([...remaining,...state.tray,...state.held].map(tile=>tile.symbol))],random)
 // Clear the symbols already in the tray first. This needs at most two free slots.
 order.sort((a,b)=>state.tray.filter(tile=>tile.symbol===b).length-state.tray.filter(tile=>tile.symbol===a).length)
 const assignment:TileSymbol[]=[]
 const witness:string[]=[]
 let position=0
 for(const symbol of order) {
  const held=state.held.filter(tile=>tile.symbol===symbol)
  const count=boardCounts.get(symbol)||0
  for(const tile of held) witness.push(tile.id)
  for(let i=0;i<count;i++) {assignment.push(symbol);witness.push(geometry[position++])}
 }
 const symbolsById=new Map(geometry.map((id,i)=>[id,assignment[i]]))
 const board=state.board.map(tile=>tile.removed?tile:{...tile,symbol:symbolsById.get(tile.id)!})
 const candidate={...state,board,witness}
 const changed=board.some((tile,i)=>tile.symbol!==state.board[i].symbol)
 if(!changed||!verifyWitnessSolution(board,witness,candidate)) return {...state,feedback:'shuffleUnavailable'}
 return {...candidate,rngState:random.state(),history:[],powers:{...state.powers,shuffle:state.powers.shuffle-1},powerUpsUsed:state.powerUpsUsed+1,hintId:null,hintSource:null,feedback:'shuffled'}
}
