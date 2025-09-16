'use client'
import * as React from 'react'
import { clsx } from 'clsx'

export const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <div
    className={clsx(
      // full width + height
      'w-full h-full',
      // nền trong suốt nhẹ, shadow, border
      'bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm shadow-lg border border-white/20 dark:border-slate-800',
      // radius mảnh hơn
      'rounded-xl',
      // overflow hidden để ngăn tràn
      'overflow-hidden',
      className
    )}
    style={{ height: '100%', minHeight: '100%', maxHeight: '100%' }}
  >
    {children}
  </div>
)