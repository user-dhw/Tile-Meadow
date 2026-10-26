import type { Tile } from './types'
import { getTileRect, isAbove, rectanglesOverlap } from './tileGeometry'
export function getBlockingTiles(tile:Tile,board:readonly Tile[]):Tile[] { return tile.removed?[]:board.filter(other=>!other.removed && other.id!==tile.id && isAbove(other,tile) && rectanglesOverlap(getTileRect(tile),getTileRect(other))) }
export function isTileSelectable(tile:Tile,board:readonly Tile[]):boolean { return !tile.removed && board.some(other=>other.id===tile.id && !other.removed) && getBlockingTiles(tile,board).length===0 }
export function getSelectableTiles(board:readonly Tile[]):Tile[] { return board.filter(tile=>isTileSelectable(tile,board)) }
export const getAvailableMoves=getSelectableTiles
export function removeTile(board:readonly Tile[],tileId:string):Tile[] { return board.map(tile=>tile.id===tileId?{...tile,removed:true}:tile) }
