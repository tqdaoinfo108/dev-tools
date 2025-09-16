'use client'
import * as React from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { Button } from '@/components/ui/Button'
import { TextareaWithLineNumbers } from '@/components/ui/TextareaWithLineNumbers'
import { Clipboard, ClipboardCheck } from 'lucide-react'
import yaml from 'js-yaml'
import dynamic from 'next/dynamic'

// react-json-view cần dynamic import để tránh SSR error
const ReactJson = dynamic(() => import('react-json-view'), { ssr: false })

/* ---------- Utils ---------- */
function tryParse(raw: string) {
  try {
    return [JSON.parse(raw), null] as [any, null]
  } catch (e: any) {
    return [null, e.message] as [null, string]
  }
}

/* ---------- Component ---------- */
export default function JsonFormatter() {
  const [raw, setRaw] = React.useState('{\n  "hello": "world"\n}')
  const [result, setResult] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  /* ---------- Actions ---------- */
  const format = (space = 2) => {
    const [obj, err] = tryParse(raw)
    if (err) return setError(err)
    setResult(JSON.stringify(obj, null, space))
    setError(null)
  }
  const minify = () => {
    const [obj, err] = tryParse(raw)
    if (err) return setError(err)
    setResult(JSON.stringify(obj))
    setError(null)
  }
  const sortKeys = () => {
    const [obj, err] = tryParse(raw)
    if (err) return setError(err)
    const sorted = sortObject(obj)
    setResult(JSON.stringify(sorted, null, 2))
    setError(null)
  }
  const toYaml = () => {
    const [obj, err] = tryParse(raw)
    if (err) return setError(err)
    setResult(yaml.dump(obj))
    setError(null)
  }
  const fromYaml = () => {
    try {
      const obj = yaml.load(raw)
      setResult(JSON.stringify(obj, null, 2))
      setError(null)
    } catch (e: any) {
      setError(e.message)
    }
  }
  const validate = () => {
    const [, err] = tryParse(raw)
    if (err) setError(err)
    else setError(null)
  }
  const copy = async () => {
    await navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }

  return (
    <div className="p-4 flex flex-col h-full">
      <h1 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
        JSON Tools
      </h1>

      <Tabs.Root defaultValue="format" className="flex-1 flex flex-col min-h-0">
        <Tabs.List className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
          <Tabs.Trigger value="format" className="tab-btn">Format/Minify</Tabs.Trigger>
          <Tabs.Trigger value="sort" className="tab-btn">Sort Keys</Tabs.Trigger>
          <Tabs.Trigger value="yaml" className="tab-btn">YAML</Tabs.Trigger>
          <Tabs.Trigger value="tree" className="tab-btn">Tree Viewer</Tabs.Trigger>
          <Tabs.Trigger value="validate" className="tab-btn">Validate</Tabs.Trigger>
        </Tabs.List>

        {/* Format / Minify */}
        <Tabs.Content value="format" className="flex-1 mt-4">
          <TwoPane
            raw={raw}
            setRaw={setRaw}
            result={result}
            setResult={setResult}
            error={error}
            actions={
              <>
                <Button onClick={() => format(2)}>Pretty (2)</Button>
                <Button onClick={() => format(4)}>Pretty (4)</Button>
                <Button onClick={minify} variant="secondary">Minify</Button>
              </>
            }
            copy={copy}
            copied={copied}
          />
        </Tabs.Content>

        {/* Sort */}
        <Tabs.Content value="sort" className="flex-1 mt-4">
          <TwoPane
            raw={raw}
            setRaw={setRaw}
            result={result}
            setResult={setResult}
            error={error}
            actions={<Button onClick={sortKeys}>Sort Keys</Button>}
            copy={copy}
            copied={copied}
          />
        </Tabs.Content>

        {/* YAML */}
        <Tabs.Content value="yaml" className="flex-1 mt-4">
          <TwoPane
            raw={raw}
            setRaw={setRaw}
            result={result}
            setResult={setResult}
            error={error}
            actions={
              <>
                <Button onClick={toYaml}>JSON → YAML</Button>
                <Button onClick={fromYaml} variant="secondary">YAML → JSON</Button>
              </>
            }
            copy={copy}
            copied={copied}
          />
        </Tabs.Content>

        {/* Tree */}
        <Tabs.Content value="tree" className="flex-1 mt-4 grid lg:grid-cols-2 gap-6">
          <div className="flex flex-col min-h-0">
            <label className="text-sm font-medium mb-2">Input</label>
            <TextareaWithLineNumbers
              value={raw}
              onChange={e => setRaw(e.target.value)}
              className="flex-1 h-full"
            />
          </div>
          <div className="flex flex-col min-h-0">
            <label className="text-sm font-medium mb-2">Tree</label>
            <div className="flex-1 overflow-auto rounded-lg bg-slate-50 dark:bg-slate-900 p-2">
              {(() => {
                const [obj, err] = tryParse(raw)
                if (err) return <div className="text-red-600">{err}</div>
                return <ReactJson src={obj} collapsed={2} theme="rjv-default" />
              })()}
            </div>
          </div>
        </Tabs.Content>

        {/* Validate */}
        <Tabs.Content value="validate" className="flex-1 mt-4">
          <div className="space-y-3">
            <TextareaWithLineNumbers
              value={raw}
              onChange={e => setRaw(e.target.value)}
              className="h-60"
            />
            <Button onClick={validate}>Validate</Button>
            {error ? (
              <div className="text-red-600 dark:text-red-400 text-sm">❌ {error}</div>
            ) : (
              <div className="text-green-600 dark:text-green-400 text-sm">✅ JSON hợp lệ</div>
            )}
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}

/* ---------- Helper Components ---------- */
function TwoPane({ raw, setRaw, result, setResult, error, actions, copy, copied }:
  { raw: string, setRaw: (s: string)=>void, result: string, setResult: (s: string)=>void,
    error: string|null, actions: React.ReactNode, copy: ()=>void, copied: boolean }) {
  return (
    <div className="grid lg:grid-cols-2 gap-6 h-[calc(100vh-200px)] min-h-0">
      <div className="flex flex-col min-h-0">
        <label className="text-sm font-medium mb-2">Input</label>
        <TextareaWithLineNumbers value={raw} onChange={e=>setRaw(e.target.value)} className="flex-1 h-full" />
        <div className="flex flex-wrap gap-2 mt-2">{actions}</div>
        {error && <div className="text-sm text-red-600 dark:text-red-400 mt-2">Lỗi: {error}</div>}
      </div>

      <div className="flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Output</label>
          <Button variant="ghost" size="sm" onClick={copy}>
            {copied ? <ClipboardCheck className="w-4 h-4"/> : <Clipboard className="w-4 h-4"/>}
          </Button>
        </div>
        <TextareaWithLineNumbers readOnly value={result} onChange={()=>{}} className="flex-1 h-full" />
      </div>
    </div>
  )
}

/* ---------- Helpers ---------- */
function sortObject(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortObject)
  if (obj && typeof obj === 'object') {
    return Object.keys(obj).sort().reduce((res, key) => {
      res[key] = sortObject(obj[key])
      return res
    }, {} as any)
  }
  return obj
}
