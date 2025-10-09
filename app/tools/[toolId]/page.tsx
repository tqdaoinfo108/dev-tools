'use client'
import * as React from 'react'
import { Card } from '@/components/ui/Card'
import { StringTools } from '@/components/tools/StringTools'
import { PageJsonMerger } from '@/components/tools/JsonMerge'
import { AndroidTools } from '@/components/tools/AndroidTools'
import { AndroidLogcatFilter } from '@/components/tools/AndroidLogcatFilter'
import { AndroidLogcatWebAdb } from '@/components/tools/AndroidLogcatWebAdb'
import { notFound } from 'next/navigation'
import OpenSSLPage from '@/components/tools/OpenSSLTools'
import JsonFormatter from '@/components/tools/JsonFormatter'

const TOOL_COMPONENTS = {
  'string-tools': StringTools,
  'json-formatter': JsonFormatter,
  'json-merger': PageJsonMerger,
  'android-tools': AndroidTools,
  'android-logcat': AndroidLogcatFilter,
  'android-logcat-webadb': AndroidLogcatWebAdb,
  'open-ssl-tools' : OpenSSLPage
} as const

export default function ToolPage({ params }: { params: Promise<{ toolId: string }> }) {
  const { toolId } = React.use(params)
  const Component = TOOL_COMPONENTS[toolId as keyof typeof TOOL_COMPONENTS]

  if (!Component) {
    notFound()
  }

  return (
    <Card className="p-4 md:p-6">
      <Component />
    </Card>
  )
}
