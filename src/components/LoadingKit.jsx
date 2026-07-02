/**
 * NexaPOS Loading Kit
 *
 * Seven distinct loading primitives — each matched to a specific UI context.
 * Warm-gold shimmer wave (#c29633 at 14%) instead of standard gray-on-gray,
 * referencing KES coin warmth.
 */

import React from 'react'

/* ─── shared shimmer bar ─────────────────────────────────────────────────── */

export function ShimmerLine({ className = '' }) {
  return (
    <div
      className={`shimmer-bar rounded ${className}`}
      aria-hidden="true"
    />
  )
}

/* ─── 1. Stat card skeleton — dashboard KPIs ─────────────────────────────── */

export function SkeletonStatCard() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden relative" aria-hidden="true">
      <div className="flex items-start justify-between mb-3">
        <div className="shimmer-bar rounded h-3 w-24" />
        <div className="shimmer-bar rounded-lg h-9 w-9" />
      </div>
      <div className="shimmer-bar rounded h-7 w-32 mb-2" />
      <div className="shimmer-bar rounded h-3 w-16" />
      <div className="skeleton-card-sweep" />
    </div>
  )
}

/* ─── 2. Table skeleton — sales, inventory, admin tables ─────────────────── */

const ROW_WIDTHS = [
  ['w-28', 'w-20', 'w-16', 'w-24', 'w-12'],
  ['w-24', 'w-28', 'w-20', 'w-16', 'w-20'],
  ['w-32', 'w-16', 'w-24', 'w-20', 'w-16'],
  ['w-20', 'w-24', 'w-16', 'w-28', 'w-24'],
  ['w-28', 'w-20', 'w-28', 'w-16', 'w-20'],
  ['w-16', 'w-32', 'w-20', 'w-24', 'w-16'],
]

export function SkeletonTable({ rows = 7, cols = 5 }) {
  return (
    <div className="w-full overflow-hidden" aria-hidden="true" aria-label="Loading table data">
      {/* header */}
      <div className="flex gap-4 px-5 py-3 border-b border-slate-100">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="shimmer-bar rounded h-3" style={{ width: `${50 + (i * 23) % 60}px` }} />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => {
        const widths = ROW_WIDTHS[rowIndex % ROW_WIDTHS.length]
        return (
          <div
            key={rowIndex}
            className="flex gap-4 items-center px-5 py-[14px] border-b border-slate-50"
            style={{ animationDelay: `${rowIndex * 60}ms` }}
          >
            {Array.from({ length: cols }).map((_, colIndex) => (
              <div
                key={colIndex}
                className={`shimmer-bar rounded h-3 ${widths[colIndex % widths.length]}`}
                style={{ animationDelay: `${rowIndex * 60 + colIndex * 20}ms` }}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

/* ─── 3. Product grid skeleton — POS terminal product tiles ──────────────── */

export function SkeletonProductGrid({ count = 16 }) {
  return (
    <div
      className="grid gap-2 p-2"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
      aria-hidden="true"
      aria-label="Loading products"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl overflow-hidden bg-white border border-slate-100 shadow-sm"
          style={{
            animation: `product-tile-wave 1.4s ease-in-out infinite`,
            animationDelay: `${(i % 8) * 80}ms`,
          }}
        >
          <div className="shimmer-bar h-16 rounded-none" />
          <div className="p-2 space-y-1.5">
            <div className="shimmer-bar rounded h-2.5 w-full" />
            <div className="shimmer-bar rounded h-2.5 w-3/5" />
            <div className="shimmer-bar rounded h-3 w-2/5 mt-1" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── 4. List skeleton — M-Pesa logs, simple lists ──────────────────────── */

export function SkeletonList({ rows = 8 }) {
  return (
    <div className="divide-y divide-slate-100" aria-hidden="true" aria-label="Loading list">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          {/* icon placeholder */}
          <div
            className="shimmer-bar rounded-full flex-none"
            style={{ width: 32, height: 32, animationDelay: `${i * 50}ms` }}
          />
          <div className="flex-1 space-y-1.5">
            <div
              className="shimmer-bar rounded h-3"
              style={{ width: `${50 + (i * 37) % 35}%`, animationDelay: `${i * 50 + 30}ms` }}
            />
            <div
              className="shimmer-bar rounded h-2.5"
              style={{ width: `${30 + (i * 19) % 25}%`, animationDelay: `${i * 50 + 60}ms` }}
            />
          </div>
          <div
            className="shimmer-bar rounded h-4 flex-none"
            style={{ width: 48, animationDelay: `${i * 50 + 80}ms` }}
          />
        </div>
      ))}
    </div>
  )
}

/* ─── 5. Form skeleton — admin sections ──────────────────────────────────── */

export function SkeletonForm({ fields = 4 }) {
  return (
    <div className="p-4 space-y-4" aria-hidden="true" aria-label="Loading form">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5" style={{ animationDelay: `${i * 70}ms` }}>
            <div
              className="shimmer-bar rounded h-2.5"
              style={{ width: `${45 + (i * 31) % 30}%`, animationDelay: `${i * 70}ms` }}
            />
            <div
              className="shimmer-bar rounded-lg h-9 w-full"
              style={{ animationDelay: `${i * 70 + 40}ms` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <div className="shimmer-bar rounded-lg h-9 w-24" />
        <div className="shimmer-bar rounded-lg h-9 w-16" />
      </div>
    </div>
  )
}

/* ─── 6. Dot loader — inline button loading state ────────────────────────── */

export function DotLoader({ color = 'white', size = 4 }) {
  const sizeClass = `w-${size} h-${size}`
  const style = (delay) => ({
    backgroundColor: color === 'white' ? 'white' : color === 'dark' ? '#0f172a' : '#10b981',
    animationDelay: delay,
    borderRadius: '50%',
    display: 'inline-block',
  })
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, '0.15s', '0.3s'].map((delay, i) => (
        <span
          key={i}
          className={`${sizeClass} dot-bounce`}
          style={style(delay)}
        />
      ))}
    </span>
  )
}

/* ─── 7. Page loader — full-screen orbital ring ──────────────────────────── */

export function PageLoader({ message = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5" role="status" aria-label={message}>
      <div className="relative w-12 h-12">
        {/* outer orbit ring */}
        <div className="absolute inset-0 rounded-full border-2 border-slate-200" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-500 orbital-ring" />
        {/* inner pulsing dot */}
        <div className="absolute inset-[14px] rounded-full bg-emerald-500 opacity-80 pulse-dot" />
      </div>
      <span className="text-sm font-medium text-slate-500 tracking-wide">{message}</span>
    </div>
  )
}

/* ─── 8. Inline spinner — small actions ──────────────────────────────────── */

export function Spinner({ size = 'sm', color = 'emerald' }) {
  const sizes = { sm: 'w-4 h-4 border-2', md: 'w-6 h-6 border-2', lg: 'w-8 h-8 border-[3px]' }
  const colors = {
    emerald: 'border-emerald-200 border-t-emerald-600',
    white: 'border-white/30 border-t-white',
    slate: 'border-slate-200 border-t-slate-700',
  }
  return (
    <div
      className={`rounded-full ${sizes[size]} ${colors[color]} orbital-ring flex-none`}
      role="status"
      aria-label="Loading"
    />
  )
}

/* ─── 9. Section loader — used inside panels while content loads ─────────── */
export function SectionLoader({ message = 'Loading…' }) {
  return (
    <div className="flex items-center gap-3 px-5 py-6 text-sm text-slate-500" role="status">
      <Spinner size="sm" color="emerald" />
      <span className="font-medium">{message}</span>
    </div>
  )
}
