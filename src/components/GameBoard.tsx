import type { CSSProperties } from 'react'
import { memo, useMemo } from 'react'
import type { GameState, Tile as GameTile } from '../engine/types'
import { isTileSelectable } from '../engine/tileBlocking'
import Symbol from './Symbol'
import Icon from './Icon'
import type { Translate, TranslationKey } from '../i18n'
export type PickTile = (tile:GameTile,rect:DOMRect)=>void
export const GameBoard=memo(function GameBoard({game,t,onPick}:{game:GameState,t:Translate,onPick:PickTile}) {
 const tiles=useMemo(()=>game.board.filter(tile=>!tile.removed).sort((a,b)=>a.layer-b.layer||a.order-b.order),[game.board])
 return <div className="board-landscape"><div className="lawn-ring"/><div className="lawn-details" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/></div><div className="game-board" aria-label={t('level',{n:game.level})}>
  {tiles.map(tile=>{const selectable=isTileSelectable(tile,game.board);return <button key={tile.id} type="button" data-tile-id={tile.id} data-symbol={tile.symbol} data-selectable={selectable} className={`tile ${selectable?'tile--open':'tile--blocked'} ${game.hintId===tile.id?'tile--hint':''}`} style={{left:`${tile.x/7*100}%`,top:`${tile.y/7*100}%`,width:`${100/7}%`,height:`${100/7}%`,zIndex:tile.layer*1000+tile.order}} disabled={!selectable||game.status!=='playing'} aria-label={`${t(tile.symbol as TranslationKey)}, ${t(selectable?'selectable':'covered')}`} onClick={event=>onPick(tile,event.currentTarget.getBoundingClientRect())}><Symbol name={tile.symbol}/>{game.hintId===tile.id&&<span className="hint-spark"><Icon name="hint" size={14}/></span>}</button>})}
 </div></div>
})
export function CollectionTray({game,t,onReturn}:{game:GameState,t:Translate,onReturn:(id:string)=>void}) {
 return <section className={`collection-wrap ${game.tray.length>=5?'collection-wrap--warning':''}`} aria-label={t('collection')}><div className="collection-label"><span><Icon name="leaf" size={15}/>{t('collection')}</span><span><b>{game.tray.length}</b> / 7</span></div><div className="collection-tray">{Array.from({length:7},(_,i)=><div className="tray-slot" data-slot={i} key={i} aria-label={game.tray[i]?t(game.tray[i].symbol as TranslationKey):t('emptySlot',{n:i+1})}>{game.tray[i]&&<div className="tray-tile" key={game.tray[i].id}><Symbol name={game.tray[i].symbol}/></div>}</div>)}</div><div className="match-particles" key={`${game.moves}-${game.matches}`} aria-hidden="true">{game.feedback==='match'&&Array.from({length:8},(_,i)=><i key={i} style={{'--i':i} as CSSProperties}/>)}</div><p className="tray-instruction">{t(game.tray.length>=5?'trayWarning':'trayHint')}</p>{game.held.length>0&&<div className="holding-area"><div><span>{t('holding')}</span><small>{t('holdingHelp')}</small></div><div className="held-tiles">{game.held.map(tile=><button key={tile.id} className={`held-tile ${game.hintId===tile.id?'held-tile--hint':''}`}  disabled={game.status!=='playing'} aria-label={`${t('returned')} ${t(tile.symbol as TranslationKey)}`} onClick={()=>onReturn(tile.id)}><Symbol name={tile.symbol}/><Icon name="arrow-right" size={12}/></button>)}</div></div>}</section>
}
