'use client'
import * as React from 'react'
import { Button } from '@/components/ui/Button'
import { TextareaWithLineNumbers } from '@/components/ui/TextareaWithLineNumbers'
import { Clipboard, ClipboardCheck, Wand2, GitBranch } from 'lucide-react'

export const PageJsonMerger: React.FC = () => {
  const [text1, setText1] = React.useState(`{
  "a": 1,
  "b": {"x": 1}
}`)
  const [text2, setText2] = React.useState(`{
  "b": {"x": 2, "y": 3},
  "c": 9
}`)
  const [out, setOut] = React.useState('')
  const [error, setError] = React.useState('')
  const [stats, setStats] = React.useState('')
  const [copied, setCopied] = React.useState(false)

  const safeParse = (name: string, text: string) => {
    try {
      return [JSON.parse(text), null]
    } catch (e: any) {
      return [null, `Lỗi parse ${name}: ` + e.message]
    }
  }

  const pretty = (text: string) => {
    const [obj, err] = safeParse("JSON", text)
    if (err) return [null, err]
    return [JSON.stringify(obj, null, 2), null]
  }

  const merge = (t1: any, t2: any) => {
    const out: any = {}
    for (const k of Object.keys(t1)) {
      out[k] = Object.prototype.hasOwnProperty.call(t2, k) ? t2[k] : t1[k]
    }
    return out
  }

  const download = (filename: string, text: string) => {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    URL.revokeObjectURL(url)
    a.remove()
  }

  const handleMerge = () => {
    console.log('Merge button clicked')
    setError('')
    const [t1, e1] = safeParse("Text1", text1)
    const [t2, e2] = safeParse("Text2", text2)
    if (e1 || e2) {
      setError((e1 || "") + (e1 && e2 ? "\n" : "") + (e2 || ""))
      return
    }
    const result = merge(t1, t2)
    const outStr = JSON.stringify(result, null, 2)
    setOut(outStr)
    const s = `Text1: ${Object.keys(t1).length} keys · Text2: ${Object.keys(t2).length} keys · Result: ${Object.keys(result).length} keys`
    setStats(s)
    download("merged_text.json", outStr)
  }

  const handleFormat = () => {
    console.log('Format button clicked')
    setError('')
    let [p1, e1] = pretty(text1)
    let [p2, e2] = pretty(text2)
    if (e1 || e2) {
      setError((e1 || "") + (e1 && e2 ? "\n" : "") + (e2 || ""))
      return
    }
    setText1(p1)
    setText2(p2)
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          JSON Merger — Giữ key từ Text1, áp dụng value từ Text2 (nếu có)
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Quy tắc: Với mỗi <em>key</em> trong Text1, nếu Text2 có cùng key thì dùng <strong>value của Text2</strong>.
          Nếu không có thì giữ nguyên <strong>value của Text1</strong>. Không thêm key mới từ Text2.
        </p>
      </div>
  
      {/* Main content */}
      <div className="grid lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Col 1 */}
        <div className="flex flex-col min-h-0 overflow-hidden">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
            Text1 (JSON đầy đủ)
          </label>
          <TextareaWithLineNumbers
            className="flex-1 w-full resize-none overflow-auto custom-scrollbar"
            value={text1}
            onChange={(e) => setText1(e.target.value)}
            placeholder="Dán JSON Text1 vào đây..."
          />
        </div>
  
        {/* Col 2 */}
        <div className="flex flex-col min-h-0 overflow-hidden">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
            Text2 (JSON đã dịch)
          </label>
          <TextareaWithLineNumbers
            className="flex-1 w-full resize-none overflow-auto custom-scrollbar"
            value={text2}
            onChange={(e) => setText2(e.target.value)}
            placeholder="Dán JSON Text2 vào đây..."
          />
        </div>
  
        {/* Col 3 */}
        <div className="flex flex-col min-h-0 overflow-hidden">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
            Kết quả (xem trước)
          </label>
          <TextareaWithLineNumbers
            className="flex-1 w-full resize-none overflow-auto custom-scrollbar"
            readOnly
            value={out}
            onChange={() => {}}
            placeholder="Kết quả sau khi merge sẽ hiện ở đây..."
          />
        </div>
      </div>
  
      {/* Controls & info */}
      <div className="mt-4 space-y-3">
        <div className="flex gap-3 justify-center">
          <Button onClick={handleMerge} className="px-6 py-2">Merge & tải file</Button>
          <Button onClick={handleFormat} variant="secondary" className="px-6 py-2">Định dạng (pretty) 2 JSON</Button>
        </div>
  
        <div className="text-center">
          {stats && <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">{stats}</div>}
          {error && <div className="text-sm text-red-600 dark:text-red-400 font-medium whitespace-pre-wrap">{error}</div>}
        </div>
      </div>
    </div>
  )
  

}