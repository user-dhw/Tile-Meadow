import type { ReactNode } from 'react'

const paths: Record<string, ReactNode> = {
  leaf: <><path d="M20 4C9 2 2 7 4 15c2 8 17 6 16-11Z"/><path d="m3 21 12-12m-6 8-1-6m5 2 5-1"/></>,
  volume: <><path d="m11 5-6 5H2v4h3l6 5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></>,
  'volume-off': <><path d="m11 5-6 5H2v4h3l6 5Z"/><path d="m16 9 5 6m0-6-5 6"/></>,
  settings: <><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 3 3-1 2 3 3-1 1-3 3-1 1-3-2-2 1-3-3-2-3 1-2-2Z"/><circle cx="11" cy="11" r="3"/></>,
  'arrow-left': <path d="m10 5-7 7 7 7M3 12h18"/>,
  'arrow-right': <path d="m14 5 7 7-7 7M21 12H3"/>,
  'chevron-right': <path d="m9 5 7 7-7 7"/>,
  play: <path d="m7 3 14 9-14 9Z"/>,
  pause: <><path d="M6 4h3v16H6Zm9 0h3v16h-3Z"/></>,
  refresh: <><path d="M20 9a8 8 0 1 0 0 6M20 3v6h-6"/></>,
  shuffle: <><path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3-2 4-4m4-5c1-2 2-3 4-3h3m-4-4 4 4-4 4"/></>,
  undo: <><path d="M8 5 3 10l5 5M3 10h11a6 6 0 0 1 0 12"/></>,
  hold: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 10h5l2 4h4l2-4h5M12 2v7m-3-3 3 3 3-3"/></>,
  hint: <><path d="M8 16c0-3-4-4-3-8a7 7 0 0 1 14 0c1 4-3 5-3 8M8 16h8m-7 4h6m-5 3h4M12 1V0M2 3 0 1m22 2 2-2"/></>,
  check: <path d="m4 12 5 5L20 6"/>,
  close: <path d="m5 5 14 14M19 5 5 19"/>,
  trophy: <><path d="M7 3h10v6a5 5 0 0 1-10 0ZM7 5H3v3c0 4 4 5 5 5m9-8h4v3c0 4-4 5-5 5m-4 1v6m-5 1h10"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 2v6m8-6v6M8 14h2m4 0h2m-8 4h2"/></>,
  infinity: <path d="M12 12c-3-5-6-7-9-4-5 5 1 12 6 7L15 9c5-5 11 2 6 7-3 3-6 1-9-4Z"/>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9 9c0-4 7-4 6 0 0 2-3 2-3 5m0 3h.01"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-6 5-6 13 0 18 6-5 6-13 0-18Z"/></>,
  home: <><path d="m2 11 10-8 10 8M5 9v12h14V9M10 21v-7h4v7"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>,
}

export default function Icon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  return <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name] ?? paths.leaf}</svg>
}
