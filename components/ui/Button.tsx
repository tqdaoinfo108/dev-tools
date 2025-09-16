
'use client'
import * as React from 'react'
import { clsx } from 'clsx'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
}

export const Button: React.FC<ButtonProps> = ({ className, children, variant='primary', size='md', ...props }) => (
  <button
    className={clsx(
      'inline-flex items-center justify-center rounded-xl font-medium transition-colors',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-400',
      variant === 'primary' && 'bg-indigo-600 hover:bg-indigo-700 text-white',
      variant === 'secondary' && 'bg-slate-200 hover:bg-slate-300 text-slate-900',
      variant === 'ghost' && 'bg-transparent hover:bg-slate-200/60 text-slate-700',
      size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4',
      className,
    )}
    {...props}
  >
    {children}
  </button>
)
