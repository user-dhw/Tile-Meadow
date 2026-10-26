import { describe, expect, it } from 'vitest'
import { getLevelConfig } from '../config/levels'
import { createGame } from '../engine/gameEngine'
import { validateGeneratedLevel } from '../engine/levelValidator'
import { generateLevel } from '../engine/levelGenerator'
import { reduceSavedGame } from '../hooks/useGame'
import { defaultSave, isValidGame } from '../utils/storage'
import type { SaveData } from '../utils/storage'
import type { Tile, TileSymbol } from '../engine/types'
function endlessFixture():SaveData {
 const symbols:TileSymbol[]=['carrot','corn','apple','leaf','flower','milk','pumpkin']
 const board:Tile[]=symbols.flatMap((symbol,g)=>Array.from({length:3},(_,copy)=>({id:`${symbol}-${copy}`,symbol,x:(g*3+copy)%7,y:Math.floor((g*3+copy)/7),layer:0,order:g*3+copy,removed:false})))
 const initial=defaultSave()
 return {...initial,game:{...createGame(4,'session','endless'),board,witness:board.map(t=>t.id)},progress:{...initial.progress,endlessStreak:4,endlessScore:2800,bestStreak:4}}
}
function select(save:SaveData,...ids:string[]) {return ids.reduce((current,id)=>reduceSavedGame(current,{type:'SELECT_TILE',id}),save)}
function lose(save:SaveData) {return select(save,'carrot-0','corn-0','apple-0','leaf-0','flower-0','milk-0','pumpkin-0')}
function finish(save:SaveData) {
 // The supplied fixture has no blockers; complete one symbol at a time.
 let current=save
 for(const symbol of ['carrot','corn','apple','leaf','flower','milk','pumpkin']) {
  for(const tile of current.game!.held.filter(t=>t.symbol===symbol)) current=reduceSavedGame(current,{type:'RETURN_HELD_TILE',id:tile.id})
  for(const tile of current.game!.board.filter(t=>!t.removed&&t.symbol===symbol)) current=select(current,tile.id)
 }
 return current
}
describe('recoverable endless progression',()=>{
 it('keeps accumulated wins and score through loss and undo recovery',()=>{
  let save=lose(endlessFixture())
  expect(save.game!.status).toBe('lost')
  expect(save.progress.endlessStreak).toBe(4)
  expect(save.progress.endlessScore).toBe(2800)
  save=reduceSavedGame(save,{type:'UNDO_MOVE'})
  // Clear two singleton symbols using the holding area so the six-slot state is playable.
  save=reduceSavedGame(save,{type:'REMOVE_THREE'})
  save=finish(save)
  expect(save.game!.status).toBe('won')
  expect(save.progress.endlessStreak).toBe(5)
  expect(save.progress.endlessScore).toBe(2800+save.game!.score)
  expect(save.progress.totalWins).toBe(1)
 })
 it('retains the streak through a loss recovered directly into holding',()=>{
  let save=reduceSavedGame(lose(endlessFixture()),{type:'REMOVE_THREE'})
  expect(save.game!.status).toBe('playing')
  save=finish(save)
  expect(save.game!.status).toBe('won')
  expect(save.progress.endlessStreak).toBe(5)
  expect(save.progress.bestStreak).toBe(5)
 })
 it('an explicit restart closes a failed endless run while preserving achievements',()=>{
  const before=lose(endlessFixture())
  const save=reduceSavedGame(before,{type:'RESTART_LEVEL'})
  expect(save.game!.status).toBe('playing')
  expect(save.progress.endlessStreak).toBe(0)
  expect(save.progress.endlessScore).toBe(0)
  expect(save.progress.bestStreak).toBe(4)
  expect(save.progress.bestScore).toBe(before.progress.bestScore)
 })
 it('ordinary invalid or tick actions cannot record a win twice',()=>{
  let save=finish(endlessFixture())
  expect(save.game!.status).toBe('won')
  const won=save
  save=reduceSavedGame(save,{type:'TICK',deltaMs:1000})
  save=reduceSavedGame(save,{type:'SELECT_TILE',id:'carrot-0'})
  expect(save).toBe(won)
  expect(save.progress.totalWins).toBe(1)
 })
 it('resumed wins accumulate into the next endless round',()=>{
  let save=finish(endlessFixture())
  const score=save.progress.endlessScore
  save=reduceSavedGame(save,{type:'NEXT_LEVEL',seed:'next-round'})
  expect(save.game!.level).toBe(5)
  expect(save.progress.endlessStreak).toBe(5)
  expect(save.progress.endlessScore).toBe(score)
 })
})
describe('difficulty bounds and generation budgets',()=>{
 it('normalizes invalid levels without crashing the public generator',()=>{
  for(const level of [NaN,Infinity,-Infinity,-1,0]) {expect(getLevelConfig(level).level).toBe(1);expect(createGame(level,'safe').level).toBe(1)}
  expect(getLevelConfig(1.9).level).toBe(1)
  expect(getLevelConfig(Number.MAX_VALUE).level).toBe(100000)
 })
 it('advanced and maximum levels remain bounded and persistable',()=>{
  for(const level of [11,12,13,14,17,18,25,100,100000]){
   const generated=generateLevel(level,'advanced-bounds')
   expect(generated.board).toHaveLength(90)
   expect(validateGeneratedLevel(generated)).toBe(true)
   expect(generated.config.layers).toBeLessThanOrEqual(8)
   expect(isValidGame(createGame(level,'advanced-bounds'))).toBe(true)
  }
 })
})
