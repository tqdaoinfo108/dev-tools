'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'

type LiteInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  noWheel?: boolean
}

export function LiteInput({ noWheel, type, onWheel, className, ...props }: LiteInputProps) {
  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    if (noWheel && type === 'number') {
      e.preventDefault()
      e.currentTarget.blur() // chặn scroll đổi value
    }
    onWheel?.(e)
  }

  return (
    <input
      {...props}
      type={type}
      onWheel={handleWheel}
      className={cn(
        "w-full h-9 px-3 rounded-md border border-slate-300 bg-white text-slate-900 placeholder-slate-500",
        "outline-none focus:ring-2 focus:ring-indigo-400",
        "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className
      )}
    />
  )
}
