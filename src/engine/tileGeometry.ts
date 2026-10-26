import { TILE_SIZE } from '../config/gameConfig'
import type { Tile } from './types'
export { BOARD_WIDTH, BOARD_HEIGHT, TILE_SIZE } from '../config/gameConfig'
export interface Rect { x:number; y:number; width:number; height:number }
export function getTileRect(tile: Pick<Tile,'x'|'y'>): Rect { return {x:tile.x,y:tile.y,width:TILE_SIZE,height:TILE_SIZE} }
export function rectanglesOverlap(a:Rect,b:Rect):boolean { return a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y }
export function isAbove(a:Tile,b:Tile):boolean { return a.layer>b.layer || (a.layer===b.layer && a.order>b.order) }
