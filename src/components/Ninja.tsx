import type { Priority } from '@/domain/types'

export function Shuriken({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 1 19.6 12.4 31 16 19.6 19.6 16 31 12.4 19.6 1 16 12.4 12.4Z" fill="currentColor" />
      <circle cx="16" cy="16" r="3" fill="var(--color-surface)" />
    </svg>
  )
}

const RANKS: Record<Priority, { rank: string; className: string }> = {
  high: { rank: 'A', className: 'bg-accent2 text-surface' },
  medium: { rank: 'B', className: 'bg-accent text-surface' },
  low: { rank: 'C', className: 'bg-accent3 text-surface' },
}

/** Priorita zobrazená ako rank misie. */
export function RankBadge({ priority }: { priority: Priority }) {
  const { rank, className } = RANKS[priority]
  return (
    <span
      title={`Rank ${rank}`}
      className={`inline-flex size-5 shrink-0 items-center justify-center border-2 border-line font-display text-[11px] leading-none ${className}`}
    >
      {rank}
    </span>
  )
}
