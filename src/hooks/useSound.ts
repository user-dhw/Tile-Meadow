import { useCallback, useEffect, useRef } from 'react'

type SoundKind = 'select' | 'match' | 'combo' | 'power' | 'win' | 'lose'
type SafariWindow = Window & { webkitAudioContext?: typeof AudioContext }
const melodies: Record<SoundKind, number[]> = {
  select: [520], match: [523, 659, 784], combo: [659, 784, 1047],
  power: [392, 587, 784], win: [523, 659, 784, 1047, 1319], lose: [392, 330, 262],
}

/** The context is created lazily inside play(), after a pointer or key interaction. */
export function useSound(enabled: boolean, volume: number) {
  const contextRef = useRef<AudioContext | null>(null)
  useEffect(() => () => { void contextRef.current?.close().catch(() => undefined) }, [])
  const play = useCallback((kind: SoundKind) => {
    if (!enabled || volume <= 0) return
    try {
      const AudioContextClass = window.AudioContext ?? (window as SafariWindow).webkitAudioContext
      if (!AudioContextClass) return
      const ctx = contextRef.current ?? new AudioContextClass()
      contextRef.current = ctx
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
      const now = ctx.currentTime
      melodies[kind].forEach((frequency, index) => {
        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()
        const start = now + index * 0.075
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequency, start)
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.985, start + 0.16)
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(Math.min(1, Math.max(0, volume)) * 0.13, start + 0.009)
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2)
        oscillator.connect(gain)
        gain.connect(ctx.destination)
        oscillator.start(start)
        oscillator.stop(start + 0.22)
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
      })
    } catch { /* Audio support and autoplay policies must never interrupt a move. */ }
  }, [enabled, volume])
  return { play }
}
