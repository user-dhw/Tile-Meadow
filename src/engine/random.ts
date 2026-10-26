export function hashSeed(seed: string): number {
 let value = 2166136261
 for (let i=0;i<seed.length;i++) { value ^= seed.charCodeAt(i); value = Math.imul(value,16777619) }
 return value >>> 0
}
export interface SeededRandom { ():number; state:()=>number }
export function createRandom(seed: string|number): SeededRandom {
 let state = typeof seed === 'number' ? seed>>>0 : hashSeed(seed)
 const next = (()=>{ state=(state+0x6d2b79f5)>>>0; let n=state; n=Math.imul(n^(n>>>15),n|1); n^=n+Math.imul(n^(n>>>7),n|61); return ((n^(n>>>14))>>>0)/4294967296 }) as SeededRandom
 next.state = ()=>state
 return next
}
export function shuffled<T>(items: readonly T[], random: ()=>number): T[] {
 const result=[...items]
 for(let i=result.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [result[i],result[j]]=[result[j],result[i]] }
 return result
}
