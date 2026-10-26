import { SOLVER_NODE_BUDGET } from '../config/gameConfig'
import { getBlockingTiles, getSelectableTiles } from './tileBlocking'
import { verifyWitnessSolution } from './levelValidator'
import type { GameState, SolutionResult, TileSymbol } from './types'

export function solveCurrentState(state:GameState,budget=SOLVER_NODE_BUDGET):SolutionResult {
 if(state.status==='won') return {moves:[],verified:true,visited:0}
 const pending=new Set([...state.board.filter(tile=>!tile.removed),...state.held].map(tile=>tile.id))
 const certificate=state.witness.filter(id=>pending.has(id))
 if(certificate.length===pending.size&&verifyWitnessSolution(state.board,certificate,{...state,status:'playing'})) return {moves:certificate,verified:true,visited:0}
 const tiles=[...state.board.filter(tile=>!tile.removed),...state.held]
 const count=tiles.length
 const all=count===0?0n:(1n<<BigInt(count))-1n
 const bit=tiles.map((_,i)=>1n<<BigInt(i))
 const blockers=tiles.map(tile=>state.held.some(item=>item.id===tile.id)?0n:getBlockingTiles(tile,state.board).reduce((mask,other)=>{const index=tiles.findIndex(item=>item.id===other.id);return index<0?mask:mask|bit[index]},0n))
 const symbolKeys=[...new Set([...tiles,...state.tray].map(tile=>tile.symbol))]
 const symbolIndex=new Map<TileSymbol,number>(symbolKeys.map((symbol,i)=>[symbol,i]))
 const initial=symbolKeys.map(symbol=>state.tray.filter(tile=>tile.symbol===symbol).length)
 const indices=tiles.map(tile=>symbolIndex.get(tile.symbol)!)
 let visited=0
 const failed=new Set<string>()
 function search(mask:bigint,tray:number[],size:number):number[]|null {
  if(mask===0n) return size===0?[]:null
  if(++visited>budget) return null
  const key=mask.toString(36)+':'+tray.join('')
  if(failed.has(key)) return null
  const options:number[]=[]
  for(let i=0;i<count;i++) if((mask&bit[i])!==0n&&(mask&blockers[i])===0n) options.push(i)
  options.sort((a,b)=>tray[indices[b]]-tray[indices[a]] || tiles[b].layer-tiles[a].layer || a-b)
  const equivalentHeld=new Set<number>()
  for(const i of options) {
   const symbol=indices[i]
   if(state.held.some(item=>item.id===tiles[i].id)) {if(equivalentHeld.has(symbol))continue;equivalentHeld.add(symbol)}
   const nextSize=size+(tray[symbol]===2?-2:1)
   if(nextSize>=7) continue
   const nextTray=[...tray];nextTray[symbol]=(nextTray[symbol]+1)%3
   const result=search(mask^bit[i],nextTray,nextSize)
   if(result) return [i,...result]
   if(visited>budget) return null
  }
  failed.add(key)
  return null
 }
 const result=search(all,initial,state.tray.length)
 const moves=result?.map(index=>tiles[index].id)||[]
 return {moves,verified:!!result&&verifyWitnessSolution(state.board,moves,{...state,status:'playing'}),visited}
}
export function getHint(state:GameState):{id:string|null;verified:boolean} {
 const solution=solveCurrentState(state)
 if(solution.verified&&solution.moves.length) return {id:solution.moves[0],verified:true}
 const legal=getSelectableTiles(state.board).sort((a,b)=>state.tray.filter(item=>item.symbol===b.symbol).length-state.tray.filter(item=>item.symbol===a.symbol).length)
 return {id:legal[0]?.id||state.held[0]?.id||null,verified:false}
}
