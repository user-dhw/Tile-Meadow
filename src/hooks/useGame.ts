import { useCallback, useEffect, useState } from 'react'
import { createGame, gameReducer } from '../engine/gameEngine'
import type { GameAction, GameMode } from '../engine/types'
import { dailyDate, dailySeed, defaultSave, loadSave, recordWin, saveGame } from '../utils/storage'
import type { SaveData, Settings } from '../utils/storage'
function randomSeed() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}` }
/** A loss remains recoverable; an explicit restart ends an endless streak. */
export function reduceSavedGame(previous:SaveData,action:GameAction):SaveData {
 if(!previous.game) return previous
 const game=gameReducer(previous.game,action)
 if(game===previous.game) return previous
 let progress=previous.progress
 if(game.status==='won' && previous.game.status!=='won') progress=recordWin(progress,game)
 if(action.type==='RESTART_LEVEL' && previous.game.mode==='endless') progress={...progress,endlessStreak:0,endlessScore:0}
 return {...previous,game,progress:{...progress,bestScore:Math.max(progress.bestScore,game.score)}}
}
export function useGame(active:boolean) {
 const [data,setData]=useState(loadSave)
 const [saved,setSaved]=useState(true)
 useEffect(()=>{setSaved(saveGame(data))},[data])
 const dispatch=useCallback((action:GameAction)=>setData(previous=>reduceSavedGame(previous,action)),[])
 useEffect(()=>{if(!active || data.game?.status!=='playing') return; const id=window.setInterval(()=>dispatch({type:'TICK',deltaMs:1000}),1000); return ()=>clearInterval(id)},[active,data.game?.status,dispatch])
 const start=useCallback((mode:GameMode,level=1,fresh=true)=>setData(p=>({...p,game:createGame(mode==='daily'?5:level,mode==='daily'?dailySeed():fresh?randomSeed():p.game?.seed||randomSeed(),mode),progress:mode==='endless'&&(level===1||p.game?.mode==='endless'&&p.game.status!=='won')?{...p.progress,endlessStreak:0,endlessScore:0}:p.progress})),[])
 const settings=useCallback((patch:Partial<Settings>)=>setData(p=>({...p,settings:{...p.settings,...patch}})),[])
 const reset=useCallback(()=>setData(p=>({...defaultSave(),settings:p.settings})),[])
 return {data,saved,dispatch,start,settings,reset,today:dailyDate()}
}
