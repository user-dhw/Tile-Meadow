import { COMBO_BONUS, SCORE_PER_MATCH } from '../config/gameConfig'
export function calculateMatchScore(combo:number):number { return SCORE_PER_MATCH+Math.max(0,combo-1)*COMBO_BONUS }
