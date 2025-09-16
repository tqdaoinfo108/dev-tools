'use client'
import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search } from 'lucide-react'
import { clsx } from 'clsx'
import { useVirtualizer } from '@tanstack/react-virtual'
import { TOOLS } from '@/lib/tools'

/** Item đã memo để tránh re-render không cần thiết */
const ToolItem = React.memo(function ToolItem({
  tool,
  href,
  isActive,
}: {
  tool: (typeof TOOLS)[number]
  href: string
  isActive: boolean
}) {
  const Icon = tool.icon
  return (
    <Link prefetch={false} href={href} className="block group">
      <div
        className={clsx(
          'w-full text-left p-2 rounded-lg transition-colors',
          isActive
            ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-indigo-500 text-indigo-700 dark:text-indigo-300'
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
        )}
      >
        <div className="flex items-center gap-2">
          <div
            className={clsx(
              'w-6 h-6 rounded flex items-center justify-center flex-shrink-0',
              isActive
                ? 'bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-400'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
            )}
          >
            <Icon className="w-3 h-3" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{tool.name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 leading-tight line-clamp-2">
              {tool.description}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
})

export const Sidebar: React.FC = () => {
  const pathname = usePathname()

  // Preprocess: thêm nameLC/descLC 1 lần, không toLowerCase lặp lại khi filter
  const toolsIndexed = React.useMemo(
    () =>
      TOOLS.map((t) => ({
        ...t,
        nameLC: t.name.toLowerCase(),
        descLC: t.description.toLowerCase(),
      })),
    []
  )

  const [query, setQuery] = React.useState('')
  const deferredQuery = React.useDeferredValue(query)
  const q = deferredQuery.trim().toLowerCase()

  const filtered = React.useMemo(() => {
    if (!q) return toolsIndexed
    return toolsIndexed.filter(
      (t) => t.nameLC.includes(q) || t.descLC.includes(q)
    )
  }, [q, toolsIndexed])

  // Scroll container (div thường, nhẹ nhàng)
  const parentRef = React.useRef<HTMLDivElement | null>(null)

  // Chiều cao item ước lượng cố định → tránh measureElement
  const ROW_H = 64 // px (khớp padding/line-clamp ở ToolItem)
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_H,
    overscan: 8,
    // Khóa ổn định theo id để tránh remount thừa
    getItemKey: (idx) => filtered[idx].id,
  })

  const virtualItems = rowVirtualizer.getVirtualItems()

  return (
    <div className="w-full bg-white dark:bg-slate-800 flex flex-col h-full min-h-0">
      {/* Search */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-700">
        <div className="mb-3 relative">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-7 pr-2 h-8 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 outline-none focus:ring-1 focus:ring-indigo-400"
            placeholder="Tìm tool..."
            aria-label="Tìm tool"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 p-2 min-h-0 flex flex-col">
        <h2 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 px-2">
          Tools
        </h2>

        {/* Scroll container thuần (mượt hơn ScrollArea trong case dài) */}
        <div
          ref={parentRef}
          className="flex-1 min-h-0 overflow-auto rounded-md"
          style={{ willChange: 'transform' }} // hint GPU
        >
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualItems.map((vi) => {
              const tool = filtered[vi.index]
              const href = `/tools/${tool.id}`
              const isActive = pathname === href
              return (
                <div
                  key={vi.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vi.start}px)`,
                    padding: '0 8px 4px',
                    height: vi.size, // cố định theo estimateSize
                  }}
                >
                  <ToolItem tool={tool} href={href} isActive={isActive} />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
