import type { LevelConfig } from '../engine/types'
const progression = [
 [12,1,4,1],[24,2,5,2],[36,3,6,2],[48,3,7,3],[60,4,8,3],
 [60,4,8,3],[66,5,9,3],[72,5,9,3],[78,5,10,3],[90,6,10,3],
]
export function getLevelConfig(level: number): LevelConfig {
 const safe = Number.isFinite(level) ? Math.min(100000, Math.max(1, Math.floor(level))) : 1
 const [tileCount,layers,symbolCount,interleaving] = progression[Math.min(safe,10)-1]
 return {level:safe,tileCount: safe>10?90:tileCount,layers:safe>10?Math.min(8,6+Math.floor((safe-10)/3)):layers,symbolCount:safe>10?12:symbolCount,interleaving}
}
