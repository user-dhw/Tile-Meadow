import { TRAY_CAPACITY } from '../config/gameConfig'
import type { Tile } from './types'
export function insertIntoTray(tray:readonly Tile[],tile:Tile): {tray:Tile[];matched:Tile[]}|null {
 if(tray.length>=TRAY_CAPACITY || tray.some(item=>item.id===tile.id)) return null
 const result=[...tray]
 const last=result.map(item=>item.symbol).lastIndexOf(tile.symbol)
 result.splice(last<0?result.length:last+1,0,tile)
 const matches=result.filter(item=>item.symbol===tile.symbol)
 if(matches.length>=3) { const matched=matches.slice(0,3); const ids=new Set(matched.map(item=>item.id)); return {tray:result.filter(item=>!ids.has(item.id)),matched} }
 return {tray:result,matched:[]}
}
