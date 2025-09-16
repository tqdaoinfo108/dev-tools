'use client'

import './globals.css'
import React from 'react'
import { Sidebar } from '@/components/Sidebar'
import * as Dialog from '@radix-ui/react-dialog'
import { HeaderBar } from '@/components/HeaderBar'
import { TOOLS } from '@/lib/tools'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import { useEffect, useMemo, useState } from 'react'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}


function AppShell({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (typeof document === 'undefined' ? 'light' : (document.documentElement.dataset.theme as any) || 'light'))
  const pathname = usePathname()
  const current = useMemo(()=> TOOLS.find(t => `/tools/${t.id}` === pathname) ?? TOOLS[0], [pathname])

  useEffect(()=>{
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        const input = document.querySelector<HTMLInputElement>("input[aria-label='Tìm tool']")
        input?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.dataset.theme = next
      return next
    })
  }

  return (
    <div className={clsx('h-screen flex bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100')}>
      {/* Sidebar trái compact */}
      <aside className="w-72 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
        <div className="p-3 border-b border-slate-200 dark:border-slate-700">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Dev Tools</h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">Dashboard</p>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <Sidebar />
        </div>
      </aside>

      {/* Main content area - full width và height */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900 h-screen">       
        {/* Content area - full width và height */}
        <div className="flex-1 w-full h-full-auto p-4">
          <div className="w-full h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
