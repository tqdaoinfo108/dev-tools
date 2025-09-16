
'use client'
import * as React from 'react'
import { Github, Moon, SunMedium, Menu } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Button } from '@/components/ui/Button'

export const HeaderBar: React.FC<{
  title: string
  description?: string
  gradient?: string
  onToggleTheme: () => void
  theme: 'light' | 'dark'
  onOpenMobileNav: () => void
  Icon?: React.ComponentType<any>
}> = ({ title, description, gradient='from-indigo-600 via-purple-600 to-pink-600', onToggleTheme, theme, onOpenMobileNav, Icon }) => {
  return (
    <div className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl border-b border-white/20 dark:border-slate-800 p-4 md:p-6">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <div className="md:hidden">
          <Button variant="ghost" onClick={onOpenMobileNav} aria-label="Open menu">
            <Menu className="w-5 h-5" />
          </Button>
        </div>
        <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-xl`}>
          {Icon ? <Icon className="w-6 h-6 md:w-7 md:h-7 text-white" /> : null}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent truncate">{title}</h1>
          {description ? <p className="text-gray-600 dark:text-slate-300 mt-1 md:text-lg font-medium truncate">{description}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <Button variant="ghost" onClick={onToggleTheme} aria-label="Toggle theme">
                  {theme === 'dark' ? <SunMedium className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content side="bottom" className="px-2 py-1 rounded bg-black text-white text-xs">Toggle theme</Tooltip.Content>
            </Tooltip.Root>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <a className="inline-flex" href="https://github.com/" target="_blank" rel="noreferrer" aria-label="GitHub">
                  <Button variant="ghost"><Github className="w-5 h-5" /></Button>
                </a>
              </Tooltip.Trigger>
              <Tooltip.Content side="bottom" className="px-2 py-1 rounded bg-black text-white text-xs">GitHub</Tooltip.Content>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
      </div>
    </div>
  )
}
