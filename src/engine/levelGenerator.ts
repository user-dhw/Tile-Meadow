import { getLevelConfig } from '../config/levels'
import { SYMBOLS } from './types'
import type { GeneratedLevel, LevelConfig, Tile, TileSymbol } from './types'
import { createRandom, shuffled } from './random'
import { getSelectableTiles, removeTile } from './tileBlocking'
import { validateGeneratedLevel } from './levelValidator'

export function generateLayeredLayout(config:LevelConfig,random:()=>number):Tile[] {
 if(config.level===1) return Array.from({length:12},(_,i)=>({id:`t${i}`,symbol:'carrot',x:1.42+(i%4)*1.06,y:1.9+Math.floor(i/4)*1.06,layer:0,order:i,removed:false}))
 const template=Math.floor(random()*4)
 const angle=random()*Math.PI*2
 const cells=Array.from({length:36},(_,i)=>({col:i%6,row:Math.floor(i/6),noise:random()*.7}))
 function rank(c:typeof cells[number]):number {
  const x=c.col-2.5,y=c.row-2.5
  if(template===0) return Math.abs(x)+Math.abs(y)+c.noise
  if(template===1) return Math.max(Math.abs(x),Math.abs(y))+.2*Math.sin(x*2+y)+c.noise
  if(template===2) return Math.min(Math.abs(x),Math.abs(y))+.2*(x*x+y*y)+c.noise
  return Math.min((x-1.4)**2+y*y,(x+1.4)**2+y*y)+c.noise
 }
 const ranked=[...cells].sort((a,b)=>rank(a)-rank(b))
 const board:Tile[]=[]
 for(let layer=0;layer<config.layers;layer++) {
  const count=Math.floor(config.tileCount/config.layers)+(layer<config.tileCount%config.layers?1:0)
  const offsetX=.18+(layer%2)*.35+Math.sin(angle+layer)*.035
  const offsetY=.18+(layer%2)*.35+Math.cos(angle+layer)*.035
  const selected=layer%2===0?ranked:ranked.map(c=>({...c,col:5-c.col}))
  for(const cell of selected.slice(0,count)) board.push({id:`t${board.length}`,symbol:'carrot',x:offsetX+cell.col*1.05,y:offsetY+cell.row*1.05,layer,order:board.length,removed:false})
 }
 return board
}
export function generateRemovalSequence(board:readonly Tile[],random:()=>number):string[] {
 let remaining=[...board]
 const sequence:string[]=[]
 for(let i=0;i<board.length;i++) {
  const available=getSelectableTiles(remaining)
  if(!available.length) throw new Error('Invalid layered layout')
  const tile=available[Math.floor(random()*available.length)]
  sequence.push(tile.id)
  remaining=removeTile(remaining,tile.id)
 }
 return sequence
}
export function assignTileSymbols(board:readonly Tile[],sequence:readonly string[],config:LevelConfig,random:()=>number):Tile[] {
 const palette=shuffled(SYMBOLS,random).slice(0,config.symbolCount)
 const symbols:TileSymbol[]=[]
 const groups=board.length/3
 let group=0
 while(group<groups) {
  const active=Math.min(config.interleaving,groups-group)
  const chunk=config.level===1?[palette[group%palette.length]]:shuffled(palette,random).slice(0,active)
  const copies=chunk.map(symbol=>({symbol,left:3}))
  // Interleave complete triples within a bounded window: at most six live tray tiles.
  let occupancy=0
  const counts=new Map<TileSymbol,number>()
  while(copies.some(item=>item.left>0)) {
   const options=copies.filter(item=>item.left>0 && (occupancy<6 || counts.get(item.symbol)===2))
   const choice=options[Math.floor(random()*options.length)]
   symbols.push(choice.symbol);choice.left--
   const count=(counts.get(choice.symbol)||0)+1
   counts.set(choice.symbol,count===3?0:count)
   occupancy+=count===3?-2:1
  }
  group+=active
 }
 const lookup=new Map(sequence.map((id,i)=>[id,symbols[i]]))
 return board.map(tile=>({...tile,symbol:lookup.get(tile.id)!}))
}
export function generateLevel(level:number,seed:string):GeneratedLevel {
 const config=getLevelConfig(level)
 for(let attempt=0;attempt<3;attempt++) {
  const random=createRandom(attempt===0?seed:`${seed}:retry:${attempt}`)
  const layout=generateLayeredLayout(config,random)
  const witness=generateRemovalSequence(layout,random)
  const board=assignTileSymbols(layout,witness,config,random)
  const generated={board,witness,seed,config,rngState:random.state()}
  if(validateGeneratedLevel(generated)) return generated
 }
 // Bounded deterministic fallback uses consecutive triples on a legal topological order.
 const random=createRandom(`${seed}:fallback`)
 const layout=generateLayeredLayout(config,random)
 const witness=generateRemovalSequence(layout,random)
 const board=assignTileSymbols(layout,witness,{...config,interleaving:1},random)
 const generated={board,witness,seed,config,rngState:random.state()}
 if(!validateGeneratedLevel(generated)) throw new Error('Level validation failed')
 return generated
}
