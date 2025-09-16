'use client'

import * as React from 'react'
import { Button } from '@/components/ui/Button'
import { TextareaWithLineNumbers } from '@/components/ui/TextareaWithLineNumbers'
import { Download, Key, FilePlus, ShieldCheck, RefreshCw, LockKeyhole, Info } from 'lucide-react'
import { LiteInput } from '../ui/LineInput'
import * as Tabs from '@radix-ui/react-tabs'

/* ---------- Utils ---------- */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  URL.revokeObjectURL(url); a.remove()
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-slate-600 dark:text-slate-300">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  )
}

/* ---------- Page ---------- */
export default function OpenSSLPage() {
  return (
    <div className="p-4 flex flex-col h-full">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
        OpenSSL Tool
      </h1>

      <Tabs.Root defaultValue="genkey" className="flex-1 flex flex-col min-h-0">
        <Tabs.List className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
          <Tabs.Trigger value="genkey" className="tab-btn"><Key className="w-4 h-4" /> Generate Key</Tabs.Trigger>
          <Tabs.Trigger value="csr" className="tab-btn"><FilePlus className="w-4 h-4" /> CSR</Tabs.Trigger>
          <Tabs.Trigger value="selfsign" className="tab-btn"><ShieldCheck className="w-4 h-4" /> Self-signed</Tabs.Trigger>
          <Tabs.Trigger value="pfx2pem" className="tab-btn"><RefreshCw className="w-4 h-4" /> PFX → PEM</Tabs.Trigger>
          <Tabs.Trigger value="pem2pfx" className="tab-btn"><LockKeyhole className="w-4 h-4" /> PEM → PFX</Tabs.Trigger>
          <Tabs.Trigger value="x509" className="tab-btn"><Info className="w-4 h-4" /> X.509 Info</Tabs.Trigger>
        </Tabs.List>

        <div className="flex-1 overflow-y-auto mt-4">
          <Tabs.Content value="genkey"><GenKey /></Tabs.Content>
          <Tabs.Content value="csr"><CSR /></Tabs.Content>
          <Tabs.Content value="selfsign"><SelfSign /></Tabs.Content>
          <Tabs.Content value="pfx2pem"><PfxToPem /></Tabs.Content>
          <Tabs.Content value="pem2pfx"><PemToPfx /></Tabs.Content>
          <Tabs.Content value="x509"><X509Info /></Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  )
}

/* ---------- Generate Key ---------- */
function GenKey() {
  const [type, setType] = React.useState<'rsa' | 'ec'>('rsa')
  const [bits, setBits] = React.useState(2048)
  const [curve, setCurve] = React.useState<'P-256' | 'P-384' | 'P-521'>('P-256')
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState('')

  const submit = async () => {
    setBusy(true); setMsg('')
    try {
      const fd = new FormData()
      fd.append('action', 'genkey')
      fd.append('type', type)
      if (type === 'rsa') fd.append('bits', String(bits))
      else fd.append('curve', curve)
      const res = await fetch('/api/openssl', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      downloadBlob(blob, type === 'rsa' ? `rsa-${bits}-key.pem` : `ec-${curve}-key.pem`)
      setMsg('Đã tạo key.')
    } catch (e: any) { setMsg(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-3 gap-3">
        <Field label="Type">
          <select value={type} onChange={e => setType(e.target.value as any)} className="w-full h-9 rounded-md border px-2">
            <option value="rsa">RSA</option>
            <option value="ec">EC (P-256/P-384/P-521)</option>
          </select>
        </Field>
        {type === 'rsa' ? (
          <Field label="RSA bits">
            <select value={bits} onChange={e => setBits(Number(e.target.value))} className="w-full h-9 rounded-md border px-2">
              <option value={2048}>2048</option>
              <option value={3072}>3072</option>
              <option value={4096}>4096</option>
            </select>
          </Field>
        ) : (
          <Field label="EC curve">
            <select value={curve} onChange={e => setCurve(e.target.value as any)} className="w-full h-9 rounded-md border px-2">
              <option value="P-256">P-256</option>
              <option value="P-384">P-384</option>
              <option value="P-521">P-521</option>
            </select>
          </Field>
        )}
        <div className="flex items-end">
          <Button onClick={submit} disabled={busy}><Download className="w-4 h-4 mr-2" /> Tạo & tải key</Button>
        </div>
      </div>
      {msg && <div className="text-xs text-slate-600 dark:text-slate-300">{msg}</div>}
    </div>
  )
}

/* ---------- CSR ---------- */
function CSR() {
  const [keyFile, setKeyFile] = React.useState<File | null>(null)
  const [keyText, setKeyText] = React.useState('')
  const [C, setC] = React.useState('VN')
  const [ST, setST] = React.useState('HN')
  const [L, setL] = React.useState('Hanoi')
  const [O, setO] = React.useState('My Company')
  const [OU, setOU] = React.useState('Engineering')
  const [CN, setCN] = React.useState('example.com')
  const [sans, setSans] = React.useState('example.com,www.example.com')
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState('')

  const submit = async () => {
    setBusy(true); setMsg('')
    try {
      const fd = new FormData()
      fd.append('action', 'csr')
      if (keyFile) fd.append('key', keyFile)
      else if (keyText.trim()) fd.append('keyText', keyText)
      fd.append('C', C); fd.append('ST', ST); fd.append('L', L)
      fd.append('O', O); fd.append('OU', OU); fd.append('CN', CN)
      if (sans.trim()) fd.append('sans', sans)
      const res = await fetch('/api/openssl', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      downloadBlob(await res.blob(), 'request.csr')
      setMsg('Đã tạo CSR.')
    } catch (e: any) { setMsg(e.message) } finally { setBusy(false) }
  }

  return (
    <section className="space-y-3">
      <div className="grid lg:grid-cols-3 gap-3">
        <div className="space-y-2">
          <Field label="Private Key (upload hoặc dán PEM)">
            <input type="file" accept=".pem,.key" onChange={e => setKeyFile(e.target.files?.[0] ?? null)} className="file-input" />
          </Field>
          <TextareaWithLineNumbers
            value={keyText}
            onChange={e => setKeyText(e.target.value)}
            placeholder="-----BEGIN PRIVATE KEY----- ..."
            className="h-40"
          />
        </div>
        <div className="space-y-2">
          <Field label="C"><LiteInput value={C} onChange={e => setC(e.target.value)} /></Field>
          <Field label="ST"><LiteInput value={ST} onChange={e => setST(e.target.value)} /></Field>
          <Field label="L"><LiteInput value={L} onChange={e => setL(e.target.value)} /></Field>
          <Field label="O"><LiteInput value={O} onChange={e => setO(e.target.value)} /></Field>
          <Field label="OU"><LiteInput value={OU} onChange={e => setOU(e.target.value)} /></Field>
          <Field label="CN"><LiteInput value={CN} onChange={e => setCN(e.target.value)} /></Field>
        </div>
        <div className="space-y-2">
          <Field label="SANs (CSV)">
            <LiteInput value={sans} onChange={e => setSans(e.target.value)} />
          </Field>
          <div className="pt-6">
            <Button onClick={submit} disabled={busy}><Download className="w-4 h-4 mr-2" /> Tạo & tải CSR</Button>
          </div>
          {msg && <div className="text-xs text-slate-600 dark:text-slate-300">{msg}</div>}
        </div>
      </div>
    </section>
  )
}

/* ---------- Self-signed Certificate ---------- */
function SelfSign() {
  const [keyFile, setKeyFile] = React.useState<File | null>(null)
  const [keyText, setKeyText] = React.useState('')
  const [days, setDays] = React.useState(365)
  const [C, setC] = React.useState('VN')
  const [ST, setST] = React.useState('HN')
  const [L, setL] = React.useState('Hanoi')
  const [O, setO] = React.useState('My Company')
  const [OU, setOU] = React.useState('Engineering')
  const [CN, setCN] = React.useState('example.com')
  const [sans, setSans] = React.useState('example.com')
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState('')

  const submit = async () => {
    setBusy(true); setMsg('')
    try {
      const fd = new FormData()
      fd.append('action', 'selfsign')
      if (keyFile) fd.append('key', keyFile); else if (keyText.trim()) fd.append('keyText', keyText)
      fd.append('days', String(days))
      fd.append('C', C); fd.append('ST', ST); fd.append('L', L); fd.append('O', O); fd.append('OU', OU); fd.append('CN', CN)
      if (sans.trim()) fd.append('sans', sans)
      const res = await fetch('/api/openssl', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      downloadBlob(await res.blob(), 'selfsigned.pem')
      setMsg('Đã tạo self-signed cert.')
    } catch (e: any) { setMsg(e.message) } finally { setBusy(false) }
  }

  return (
    <section className="space-y-3">
      <div className="grid lg:grid-cols-3 gap-3">
        <div className="space-y-2">
          <Field label="Private Key">
            <input type="file" accept=".pem,.key" onChange={e => setKeyFile(e.target.files?.[0] ?? null)} className="file-input" />
          </Field>
          <TextareaWithLineNumbers
            value={keyText}
            onChange={e => setKeyText(e.target.value)}
            placeholder="Dán PEM key (tùy chọn)"
            className="h-40"
          />
          <Field label="Days"><LiteInput type="number" value={days} onChange={e => setDays(Number(e.target.value))} /></Field>
        </div>
        <div className="space-y-2">
          <Field label="C"><LiteInput value={C} onChange={e => setC(e.target.value)} /></Field>
          <Field label="ST"><LiteInput value={ST} onChange={e => setST(e.target.value)} /></Field>
          <Field label="L"><LiteInput value={L} onChange={e => setL(e.target.value)} /></Field>
          <Field label="O"><LiteInput value={O} onChange={e => setO(e.target.value)} /></Field>
          <Field label="OU"><LiteInput value={OU} onChange={e => setOU(e.target.value)} /></Field>
          <Field label="CN"><LiteInput value={CN} onChange={e => setCN(e.target.value)} /></Field>
        </div>
        <div className="space-y-2">
          <Field label="SANs (CSV)"><LiteInput value={sans} onChange={e => setSans(e.target.value)} /></Field>
          <div className="pt-6">
            <Button onClick={submit} disabled={busy}><Download className="w-4 h-4 mr-2" /> Tạo & tải cert</Button>
          </div>
          {msg && <div className="text-xs text-slate-600 dark:text-slate-300">{msg}</div>}
        </div>
      </div>
    </section>
  )
}

/* ---------- PFX → PEM ---------- */
function PfxToPem() {
  const [file, setFile] = React.useState<File | null>(null)
  const [password, setPassword] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState('')

  const submit = async () => {
    if (!file) { setMsg('Chọn file .p12/.pfx'); return }
    setBusy(true); setMsg('')
    try {
      const fd = new FormData()
      fd.append('action', 'pfx-to-pem')
      fd.append('pfx', file)
      fd.append('password', password)
      const res = await fetch('/api/openssl', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') || ''
      const name = /filename="([^"]+)"/.exec(cd)?.[1] || 'pem-bundle.zip'
      downloadBlob(blob, name)
      setMsg('Đã trích PEM.')
    } catch (e: any) { setMsg(e.message) } finally { setBusy(false) }
  }

  return (
    <section className="space-y-3">
      <div className="grid md:grid-cols-3 gap-3">
        <Field label="PFX/P12 file"><input type="file" accept=".p12,.pfx" onChange={e => setFile(e.target.files?.[0] ?? null)} className="file-input" /></Field>
        <Field label="Password"><LiteInput type="password" value={password} onChange={e => setPassword(e.target.value)} /></Field>
        <div className="flex items-end"><Button onClick={submit} disabled={busy}>Convert</Button></div>
      </div>
      {msg && <div className="text-xs text-slate-600 dark:text-slate-300">{msg}</div>}
    </section>
  )
}

/* ---------- PEM → PFX ---------- */
function PemToPfx() {
  const [key, setKey] = React.useState<File | null>(null)
  const [cert, setCert] = React.useState<File | null>(null)
  const [chain, setChain] = React.useState<File | null>(null)
  const [alias, setAlias] = React.useState('mykey')
  const [password, setPassword] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState('')

  const submit = async () => {
    if (!key || !cert) { setMsg('Chọn key & cert'); return }
    setBusy(true); setMsg('')
    try {
      const fd = new FormData()
      fd.append('action', 'pem-to-pfx')
      fd.append('key', key); fd.append('cert', cert)
      if (chain) fd.append('chain', chain)
      fd.append('alias', alias); fd.append('password', password)
      const res = await fetch('/api/openssl', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      downloadBlob(await res.blob(), 'bundle.p12')
      setMsg('Đã tạo PFX.')
    } catch (e: any) { setMsg(e.message) } finally { setBusy(false) }
  }

  return (
    <section className="space-y-3">
      <div className="grid md:grid-cols-3 gap-3">
        <Field label="key.pem"><input type="file" accept=".pem,.key" onChange={e => setKey(e.target.files?.[0] ?? null)} className="file-input" /></Field>
        <Field label="cert.pem"><input type="file" accept=".pem,.crt,.cer" onChange={e => setCert(e.target.files?.[0] ?? null)} className="file-input" /></Field>
        <Field label="chain.pem (tùy chọn)"><input type="file" accept=".pem,.crt,.cer" onChange={e => setChain(e.target.files?.[0] ?? null)} className="file-input" /></Field>
        <Field label="Alias"><LiteInput value={alias} onChange={e => setAlias(e.target.value)} /></Field>
        <Field label="Password"><LiteInput type="password" value={password} onChange={e => setPassword(e.target.value)} /></Field>
        <div className="flex items-end"><Button onClick={submit} disabled={busy}>Convert</Button></div>
      </div>
      {msg && <div className="text-xs text-slate-600 dark:text-slate-300">{msg}</div>}
    </section>
  )
}

/* ---------- X509 Info ---------- */
function X509Info() {
  const [file, setFile] = React.useState<File | null>(null)
  const [text, setText] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [info, setInfo] = React.useState('')

  const submit = async () => {
    setBusy(true); setInfo('')
    try {
      const fd = new FormData()
      fd.append('action', 'x509-info')
      if (file) fd.append('cert', file)
      else if (text.trim()) fd.append('certText', text)
      const res = await fetch('/api/openssl', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setInfo(await res.text())
    } catch (e: any) { setInfo(e.message) } finally { setBusy(false) }
  }

  return (
    <section className="space-y-3">
      <Field label="Certificate file (PEM/CRT)"><input type="file" accept=".pem,.crt,.cer" onChange={e => setFile(e.target.files?.[0] ?? null)} className="file-input" /></Field>
      <TextareaWithLineNumbers value={text} onChange={e => setText(e.target.value)} placeholder="Dán cert PEM..." className="h-40" />
      <Button onClick={submit} disabled={busy}>Phân tích</Button>
      {info && <pre className="bg-slate-100 dark:bg-slate-900 p-3 text-xs overflow-x-auto rounded-lg whitespace-pre-wrap">{info}</pre>}
    </section>
  )
}
