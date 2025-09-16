'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'

interface TextareaWithLineNumbersProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  className?: string
  placeholder?: string
  readOnly?: boolean
}

export const TextareaWithLineNumbers: React.FC<TextareaWithLineNumbersProps> = ({
  value,
  onChange,
  className,
  placeholder,
  readOnly = false,
  ...props
}) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const gutterRef = React.useRef<HTMLDivElement>(null)

  // Tính số dòng
  const totalLines = React.useMemo(() => {
    return value ? value.split('\n').length : 1
  }, [value])

  // Sync scroll
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.currentTarget.scrollTop
    }
  }

  return (
    <div
      className={cn(
        'relative flex w-full h-full min-h-0 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden',
        className
      )}
    >
      {/* Gutter số dòng */}
      <div
        ref={gutterRef}
        className="flex-shrink-0 w-12 bg-slate-50 dark:bg-slate-800 text-right px-2 py-2 font-mono text-xs text-slate-400 dark:text-slate-500 overflow-y-auto"
      >
        {Array.from({ length: totalLines }).map((_, i) => (
          <div key={i} className="leading-5 h-5">
            {i + 1}
          </div>
        ))}
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onScroll={handleScroll}
        readOnly={readOnly}
        placeholder={placeholder}
        className="flex-1 p-2 font-mono text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none resize-none overflow-auto custom-scrollbar"
        style={{
          lineHeight: '20px',
          whiteSpace: 'pre',
        }}
        {...props}
      />
    </div>
  )
}
