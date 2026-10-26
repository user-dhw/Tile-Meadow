import { describe, expect, it } from 'vitest'
import { BOARD_HEIGHT, BOARD_WIDTH, TRAY_CAPACITY } from '../config/gameConfig'
import { getLevelConfig } from '../config/levels'
import { createGame, gameReducer } from '../engine/gameEngine'
import { generateLevel } from '../engine/levelGenerator'
import { createVerificationState, getBoardDifficultyMetrics, validateGeneratedLevel, verifyWitnessSolution } from '../engine/levelValidator'
import { getBlockingTiles, getSelectableTiles, isTileSelectable, removeTile } from '../engine/tileBlocking'
import { getTileRect, rectanglesOverlap } from '../engine/tileGeometry'
import { createRandom } from '../engine/random'
import { calculateMatchScore } from '../engine/scoring'
import { solveCurrentState } from '../engine/puzzleSolver'
import { insertIntoTray } from '../engine/trayManager'
import { SYMBOLS } from '../engine/types'
import type { GameState, Tile, TileSymbol } from '../engine/types'

function tile(id:string,symbol:TileSymbol='carrot',x=0,y=0,layer=0,order=0):Tile { return {id,symbol,x,y,layer,order,removed:false} }
function boardOf(symbols:TileSymbol[]):Tile[] { return symbols.map((symbol,i)=>tile(`b${i}`,symbol,(i%7)*1.01,Math.floor(i/7)*1.01,0,i)) }
function stateOf(symbols:TileSymbol[]):GameState { return createVerificationState(boardOf(symbols)) }
function trayOf(symbols:TileSymbol[]):Tile[] { return symbols.map((symbol,i)=>({...tile(`tray${i}`,symbol),removed:true})) }
function select(state:GameState,id:string):GameState {return gameReducer(state,{type:'SELECT_TILE',id})}
function counts(items:Tile[]) {return items.reduce<Record<string,number>>((all,t)=>({...all,[t.symbol]:(all[t.symbol]||0)+1}),{})}

describe('shared rectangle geometry and selection',()=>{
 it('allows a valid tile selection and inserts it into the tray',()=>{const s=stateOf(['carrot','carrot','carrot']);const next=select(s,'b0');expect(next.tray.map(t=>t.id)).toEqual(['b0']);expect(next.board[0].removed).toBe(true);expect(s.board[0].removed).toBe(false);expect(next.tray[0].removed).toBe(true)})
 it('rejects a covered tile',()=>{const s=createVerificationState([tile('a'),tile('b','corn',0,0,1)]);expect(select(s,'a')).toBe(s)})
 it('blocks any positive partial overlap but not edge contact',()=>{const lower=tile('a');expect(rectanglesOverlap(getTileRect(lower),getTileRect(tile('b','corn',.999,0,1)))).toBe(true);expect(rectanglesOverlap(getTileRect(lower),getTileRect(tile('b','corn',1,0,1)))).toBe(false)})
 it('requires all covering tiles to be removed',()=>{const lower=tile('a');let board=[lower,tile('b','corn',-.5,0,1),tile('c','corn',.5,0,1)];expect(getBlockingTiles(lower,board)).toHaveLength(2);board=removeTile(board,'b');expect(isTileSelectable(lower,board)).toBe(false);board=removeTile(board,'c');expect(isTileSelectable(lower,board)).toBe(true)})
 it('unlocks lower tiles and keeps their original coordinates',()=>{const s=createVerificationState([tile('a','carrot',1.3,2.2),tile('b','corn',1.8,2.2,1)]);const next=select(s,'b');expect(getSelectableTiles(next.board).map(t=>t.id)).toEqual(['a']);expect(next.board[0]).toEqual(s.board[0])})
 it('uses stacking order for overlapping tiles on the same layer',()=>{const a=tile('a');const b=tile('b','corn',.5,0,0,1);expect(isTileSelectable(a,[a,b])).toBe(false);expect(isTileSelectable(b,[a,b])).toBe(true)})
 it('removed covering tiles cannot invisibly block',()=>{const a=tile('a');const b={...tile('b','corn',0,0,1),removed:true};expect(isTileSelectable(a,[a,b])).toBe(true)})
 it('preserves overlap under uniform mobile scaling',()=>{const a=getTileRect(tile('a','carrot',1.2,2.4));const b=getTileRect(tile('b','corn',1.7,2.7,1));for(const scale of [.35,.75,2]){const scaled=(r:typeof a)=>({x:r.x*scale,y:r.y*scale,width:r.width*scale,height:r.height*scale});expect(rectanglesOverlap(scaled(a),scaled(b))).toBe(rectanglesOverlap(a,b))}})
})

describe('atomic seven slot resolution',()=>{
 it('groups identical symbols adjacent to one another',()=>{const result=insertIntoTray(trayOf(['carrot','corn','carrot']),tile('a','corn'));expect(result?.tray.map(t=>t.symbol)).toEqual(['carrot','corn','corn','carrot'])})
 it('automatically removes exactly three matching tiles',()=>{let s=stateOf(['carrot','carrot','carrot','corn','corn','corn']);s=select(select(select(s,'b0'),'b1'),'b2');expect(s.tray).toHaveLength(0);expect(s.matches).toBe(1);expect(s.score).toBe(100);expect(s.status).toBe('playing')})
 it('resolves a triple on seventh insertion before checking failure',()=>{const s={...stateOf(['carrot','corn','corn']),tray:trayOf(['carrot','carrot','corn','corn','apple','apple'])};const next=select(s,'b0');expect(next.tray).toHaveLength(4);expect(next.status).toBe('playing');expect(next.matches).toBe(1)})
 it('loses with seven unmatched tiles and prevents all further selections',()=>{const s={...stateOf(['leaf','flower']),tray:trayOf(['carrot','corn','apple','milk','acorn','pumpkin'])};const lost=select(s,'b0');expect(lost.status).toBe('lost');expect(lost.tray).toHaveLength(7);expect(select(lost,'b1')).toBe(lost)})
 it('rejects an eighth tile even in malformed playing state',()=>{const s={...stateOf(['carrot']),tray:trayOf(['carrot','corn','apple','milk','acorn','pumpkin','leaf'])};expect(select(s,'b0')).toBe(s);expect(insertIntoTray(s.tray,tile('extra'))).toBeNull()})
 it('only wins after board, tray and holding area are empty',()=>{let s=stateOf(['carrot','carrot','carrot']);s=select(select(select(s,'b0'),'b1'),'b2');expect(s.status).toBe('won');expect(s.score).toBe(600);const held={...stateOf(['carrot','carrot','carrot']),held:trayOf(['corn','corn','corn'])};const n=select(select(select(held,'b0'),'b1'),'b2');expect(n.status).toBe('playing')})
 it('rejects rapid duplicate input without adding history or score',()=>{const s=select(stateOf(['carrot','carrot','carrot']),'b0');expect(select(s,'b0')).toBe(s);expect(s.tray).toHaveLength(1);expect(s.history).toHaveLength(1)})
})

describe('power ups, scoring and recovery',()=>{
 it('undo restores an ordinary selection exactly',()=>{const initial=stateOf(['carrot','carrot','carrot']);const next=gameReducer(select(initial,'b0'),{type:'UNDO_MOVE'});expect(next.board).toEqual(initial.board);expect(next.tray).toEqual(initial.tray);expect(next.moves).toBe(0);expect(next.powers.undo).toBe(initial.powers.undo-1)})
 it('undo restores matched tray tiles, board and score',()=>{let s=stateOf(['carrot','carrot','carrot','corn','corn','corn']);s=select(select(s,'b0'),'b1');const before=s;const matched=select(s,'b2');expect(matched.score).toBe(100);const next=gameReducer(matched,{type:'UNDO_MOVE'});expect(next.tray).toEqual(before.tray);expect(next.board).toEqual(before.board);expect(next.score).toBe(before.score);expect(next.matches).toBe(0)})
 it('consecutive undos never refund charges',()=>{let s=stateOf(['carrot','carrot','carrot']);s=select(select(s,'b0'),'b1');s=gameReducer(s,{type:'UNDO_MOVE'});s=gameReducer(s,{type:'UNDO_MOVE'});expect(s.powers.undo).toBe(1);expect(s.powerUpsUsed).toBe(2);expect(gameReducer(s,{type:'UNDO_MOVE'})).toBe(s)})
 it('can undo a losing selection',()=>{const s={...stateOf(['leaf','flower']),tray:trayOf(['carrot','corn','apple','milk','acorn','pumpkin'])};const next=gameReducer(select(s,'b0'),{type:'UNDO_MOVE'});expect(next.status).toBe('playing');expect(next.tray).toHaveLength(6)})
 it('holds up to three tiles without deleting them or refunding power',()=>{const s={...stateOf(['carrot','corn']),tray:trayOf(['carrot','corn','milk','apple'])};const n=gameReducer(s,{type:'REMOVE_THREE'});expect(n.held).toHaveLength(3);expect(n.tray).toHaveLength(1);expect(n.held.map(t=>t.id)).toEqual(s.tray.slice(0,3).map(t=>t.id));expect(n.powers.hold).toBe(0);expect(gameReducer(n,{type:'REMOVE_THREE'})).toBe(n)})
 it('holding recovers a full losing tray',()=>{const lost={...stateOf(['carrot']),status:'lost' as const,tray:trayOf(['carrot','corn','apple','milk','acorn','pumpkin','leaf'])};expect(gameReducer(lost,{type:'REMOVE_THREE'}).status).toBe('playing')})
 it('returns held tiles through normal matching and victory rules',()=>{let s={...stateOf([]),held:trayOf(['carrot','carrot','carrot'])};for(const id of s.held.map(t=>t.id))s=gameReducer(s,{type:'RETURN_HELD_TILE',id});expect(s.status).toBe('won');expect(s.held).toHaveLength(0);expect(s.tray).toHaveLength(0);expect(s.score).toBe(600)})
 it('held return on seventh insertion resolves the triple',()=>{const s={...stateOf(['corn']),tray:trayOf(['carrot','carrot','corn','corn','apple','apple']),held:[{...tile('held','carrot'),removed:true}]};const n=gameReducer(s,{type:'RETURN_HELD_TILE',id:'held'});expect(n.status).toBe('playing');expect(n.tray).toHaveLength(4)})
 it('shuffle preserves geometry, tray, held and all remaining symbol counts',()=>{const initial=createGame(4,'shuffle-me');let s=initial;for(const id of initial.witness.slice(0,2))s=select(s,id);const n=gameReducer(s,{type:'SHUFFLE_TILES'});expect(n.feedback).toBe('shuffled');expect(counts(n.board.filter(t=>!t.removed))).toEqual(counts(s.board.filter(t=>!t.removed)));expect(n.board.map(({id,x,y,layer,order})=>({id,x,y,layer,order}))).toEqual(s.board.map(({id,x,y,layer,order})=>({id,x,y,layer,order})));expect(n.tray).toEqual(s.tray);expect(n.held).toEqual(s.held);expect(n.powers.shuffle).toBe(s.powers.shuffle-1);expect(verifyWitnessSolution(n.board,n.witness,n)).toBe(true)})
 it('shuffle with held tiles retains a verified winning continuation',()=>{let s=createGame(3,'held-shuffle');for(const id of s.witness.slice(0,2))s=select(s,id);s=gameReducer(s,{type:'REMOVE_THREE'});const n=gameReducer(s,{type:'SHUFFLE_TILES'});expect(n.feedback).toBe('shuffled');expect(n.held).toEqual(s.held);expect(verifyWitnessSolution(n.board,n.witness,n)).toBe(true)})
 it('unsafe or unchanged shuffle consumes no charge',()=>{const s=stateOf(['carrot','carrot','carrot']);const n=gameReducer(s,{type:'SHUFFLE_TILES'});expect(n.feedback).toBe('shuffleUnavailable');expect(n.powers.shuffle).toBe(s.powers.shuffle)})
 it('hint selects a legal tile with verified initial continuation',()=>{const s=createGame(5,'hint-seed');const n=gameReducer(s,{type:'USE_HINT'});const hinted=n.board.find(t=>t.id===n.hintId)!;expect(isTileSelectable(hinted,n.board)).toBe(true);expect(n.hintSource).toBe('verified');expect(n.powers.hint).toBe(s.powers.hint-1)})
 it('bounded solver never falsely certifies a dead state',()=>{const s={...stateOf(['leaf','flower']),tray:trayOf(['carrot','corn','apple','milk','acorn','pumpkin'])};const result=solveCurrentState(s,20);expect(result.verified).toBe(false);const hinted=gameReducer(s,{type:'USE_HINT'});expect(hinted.hintSource).toBe('legal')})
 it('scoring has transparent match and combo bonuses',()=>{expect(calculateMatchScore(1)).toBe(100);expect(calculateMatchScore(2)).toBe(120);expect(calculateMatchScore(3)).toBe(140)})
 it('tick is bounded and stops at completion',()=>{const s=stateOf(['carrot']);expect(gameReducer(s,{type:'TICK',deltaMs:100000}).elapsedMs).toBe(5000);expect(gameReducer({...s,status:'won'},{type:'TICK',deltaMs:1000}).elapsedMs).toBe(0)})
})

describe('deterministic verified procedural generation',()=>{
 it('seeded RNG is deterministic and resumable',()=>{const a=createRandom('seed');const b=createRandom('seed');for(let i=0;i<10;i++)expect(a()).toBe(b());const resumed=createRandom(a.state());expect(resumed()).toBe(a())})
 it('the same seed/settings reproduce geometry, symbols and solution',()=>{expect(generateLevel(5,'replay')).toEqual(generateLevel(5,'replay'));expect(generateLevel(5,'different').board).not.toEqual(generateLevel(5,'replay').board)})
 it('tutorial contains twelve tiles, four symbols and one layer',()=>{const s=createGame(1,'tutorial');expect(s.board).toHaveLength(12);expect(new Set(s.board.map(t=>t.symbol)).size).toBe(4);expect(new Set(s.board.map(t=>t.layer)).size).toBe(1)})
 it('levels scale smoothly and remain divisible by three',()=>{for(let level=1;level<=30;level++){const c=getLevelConfig(level);expect(c.tileCount%3).toBe(0);expect(c.tileCount).toBeLessThanOrEqual(90);expect(c.layers).toBeLessThanOrEqual(8);if(level>1)expect(c.tileCount-getLevelConfig(level-1).tileCount).toBeLessThanOrEqual(12)}})
 it('level progression only follows victory; restart replays exact seed',()=>{let s=createGame(2,'level-two');expect(gameReducer(s,{type:'NEXT_LEVEL',seed:'next'})).toBe(s);s={...s,status:'won'};const n=gameReducer(s,{type:'NEXT_LEVEL',seed:'next'});expect(n.level).toBe(3);expect(n.seed).toBe('next');expect(gameReducer(n,{type:'RESTART_LEVEL'})).toEqual(createGame(3,'next'))})
 it('reports meaningful actual overlap and selectable metrics',()=>{const s=createGame(3,'metrics');const m=getBoardDifficultyMetrics(s.board);expect(m.layers).toBe(3);expect(m.blockingEdges).toBeGreaterThan(0);expect(m.selectable).toBeGreaterThan(0);expect(m.selectable).toBeLessThan(m.tileCount)})
 it('rejects malformed layouts and broken certificates',()=>{const generated=generateLevel(2,'bad');expect(validateGeneratedLevel({...generated,witness:generated.witness.slice(1)})).toBe(false);expect(validateGeneratedLevel({...generated,board:generated.board.map((t,i)=>i===0?{...t,x:-1}:t)})).toBe(false)})
 for(const level of [1,2,3,4,5,6,7,8,9,10,12,18]) {
  it(`validates and replays 12 distinct seeds for level ${level}`,()=>{
   for(let seed=0;seed<12;seed++) {
    const generated=generateLevel(level,`regression:${seed}`)
    expect(validateGeneratedLevel(generated)).toBe(true)
    expect(generated.board.length%3).toBe(0)
    for(const t of generated.board){expect(SYMBOLS).toContain(t.symbol);expect(t.x).toBeGreaterThanOrEqual(0);expect(t.x+1).toBeLessThanOrEqual(BOARD_WIDTH);expect(t.y+1).toBeLessThanOrEqual(BOARD_HEIGHT)}
    expect(Object.values(counts(generated.board)).every(n=>n%3===0)).toBe(true)
    let s=createGame(level,`regression:${seed}`)
    for(const id of generated.witness){const t=s.board.find(item=>item.id===id)!;expect(isTileSelectable(t,s.board)).toBe(true);s=select(s,id);expect(s.tray.length).toBeLessThanOrEqual(TRAY_CAPACITY);expect(s.status).not.toBe('lost')}
    expect(s.status).toBe('won');expect(s.tray).toHaveLength(0);expect(s.held).toHaveLength(0)
   }
  })
 }
})
