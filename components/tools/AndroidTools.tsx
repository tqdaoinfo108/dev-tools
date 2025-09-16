'use client'
import * as React from 'react'
import { Button } from '@/components/ui/Button'
import { TextareaWithLineNumbers } from '@/components/ui/TextareaWithLineNumbers'
import {
    Clipboard, ClipboardCheck, Smartphone, Key, Package, FileText,
    Hash, Settings, Wrench, Download, X
} from 'lucide-react'
import { LiteInput } from '../ui/LineInput'

type AaptRun = { code: number; stdout: string; stderr: string }
type ApkAnalysis = {
    ok: boolean
    tool?: string
    aaptResolved?: string
    aaptExists?: boolean
    badging: AaptRun
    permissions: AaptRun
    configurations: AaptRun
}

type ApkSummary = {
    label?: string
    package?: string
    versionName?: string
    versionCode?: string
    sdkVersion?: string
    targetSdkVersion?: string
    launchableActivity?: string
    abis: string[]
    densities: string[]
    locales: string[]
    permissions: string[]
}

export const AndroidTools: React.FC = () => {
    const [input, setInput] = React.useState('')
    const [output, setOutput] = React.useState('')
    const [copied, setCopied] = React.useState(false)

    // -------- Keystore form --------
    const [form, setForm] = React.useState({
        keystoreName: 'my-release-key.keystore',
        alias: 'my-key-alias',
        storepass: '',
        keypass: '',
        keysize: 2048,
        validity: 10000,
        cn: 'My App',
        ou: 'Engineering',
        o: 'My Company',
        l: 'Hanoi',
        st: 'HN',
        c: 'VN',
    })
    const onChange = (k: keyof typeof form, v: string | number) => setForm((s) => ({ ...s, [k]: v }))
    const [busy, setBusy] = React.useState(false)
    const [serverMsg, setServerMsg] = React.useState<string>('')

    const downloadBlob = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = filename
        document.body.appendChild(a); a.click()
        URL.revokeObjectURL(url); a.remove()
    }

    const generateJKS = async () => {
        setBusy(true); setServerMsg('')
        try {
            const res = await fetch('/api/keystore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            if (!res.ok) {
                const j = await res.json().catch(() => ({}))
                throw new Error(j.error || `HTTP ${res.status}`)
            }
            const blob = await res.blob()
            downloadBlob(blob, form.keystoreName || 'my-release-key.keystore')
            setServerMsg('Đã tạo & tải .jks')
        } catch (e: any) {
            setServerMsg(`Lỗi: ${e.message}`)
        } finally { setBusy(false) }
    }
    // --- AAB→APK: device options ---
    const [aabMode, setAabMode] = React.useState<'universal' | 'device'>('device')
    const [bundletoolPath, setBundletoolPath] = React.useState(process.env.BUNDLETOOL_JAR)
    const [aabFile, setAabFile] = React.useState<File | null>(null)
    const [aabBusy, setAabBusy] = React.useState(false)
    const [aabMsg, setAabMsg] = React.useState('')
  
    const abiOptions = ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64']
    const densityOptions: Array<{ label: string; value: number }> = [
        { label: 'ldpi (120)', value: 120 },
        { label: 'mdpi (160)', value: 160 },
        { label: 'tvdpi (213)', value: 213 },
        { label: 'hdpi (240)', value: 240 },
        { label: 'xhdpi (320)', value: 320 },
        { label: 'xxhdpi (480)', value: 480 },
        { label: 'xxxhdpi (640)', value: 640 },
    ]
    const sdkOptions = Array.from({ length: 35 - 21 + 1 }, (_, i) => 21 + i) // 21..35

    const localeOptions = ['en', 'vi', 'zh', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'ru', 'ar', 'hi', 'id', 'th', 'ms']

    const [abiSel, setAbiSel] = React.useState<string[]>(['arm64-v8a'])
    const [densitySel, setDensitySel] = React.useState<number | ''>('')
    const [sdkSel, setSdkSel] = React.useState<number | ''>('')
    const [localesSel, setLocalesSel] = React.useState<string[]>(['en'])

    function handleMultiSelect(
        e: React.ChangeEvent<HTMLSelectElement>,
        setter: (v: string[]) => void
    ) {
        const arr = Array.from(e.target.selectedOptions).map(o => o.value)
        setter(arr)
    }
    const handleAabToApk = async () => {
        if (!aabFile) { setAabMsg('Chọn file .aab'); return }
        setAabBusy(true); setAabMsg('')
        try {
            const fd = new FormData()
            fd.append('file', aabFile)
            if (bundletoolPath) fd.append('bundletoolPath', bundletoolPath)

            if (aabMode === 'device') {
                fd.append('mode', 'device')
                if (abiSel.length) fd.append('abi', abiSel.join(','))
                if (densitySel) fd.append('density', String(densitySel))
                if (sdkSel) fd.append('sdk', String(sdkSel))
                if (localesSel.length) fd.append('locales', localesSel.join(','))
            } else {
                fd.append('mode', 'universal') // to hơn
            }

            const res = await fetch('/api/aab-to-apk', { method: 'POST', body: fd })
            if (!res.ok) {
                const j = await res.json().catch(() => ({}))
                throw new Error(j.error || `HTTP ${res.status}`)
            }

            // Có thể trả về 1 APK hoặc 1 ZIP (nhiều split) — cứ tải về theo filename server gửi
            const blob = await res.blob()
            const cd = res.headers.get('Content-Disposition') || ''
            const fname = /filename="([^"]+)"/.exec(cd)?.[1] || aabFile.name.replace(/\.aab$/i, aabMode === 'device' ? '-device.zip' : '.apk')
            downloadBlob(blob, fname)
            setAabMsg(`Đã chuyển & tải ${fname}`)
        } catch (e: any) {
            setAabMsg(`Lỗi: ${e.message}`)
        } finally {
            setAabBusy(false)
        }
    }
    // -------- NEW: APK Analyzer (+ popup) --------
    const [apkFile, setApkFile] = React.useState<File | null>(null)
    const [apkBusy, setApkBusy] = React.useState(false)
    const [apkMsg, setApkMsg] = React.useState('')
    const [analysisOpen, setAnalysisOpen] = React.useState(false)
    const [analysis, setAnalysis] = React.useState<ApkAnalysis | null>(null)
    const [summary, setSummary] = React.useState<ApkSummary | null>(null)

    const handleAnalyzeApk = async () => {
        if (!apkFile) { setApkMsg('Chọn file .apk'); return }
        setApkBusy(true); setApkMsg('')
        try {
            const fd = new FormData()
            fd.append('file', apkFile)
            // ⚠️ Đường dẫn aapt2.exe thực tế của bạn:
            fd.append('aaptPath', 'C:\\Users\\daotq\\AppData\\Local\\Android\\Sdk\\build-tools\\36.0.0\\aapt2.exe')
            const res = await fetch('/api/apk-analyzer', { method: 'POST', body: fd })
            const data: ApkAnalysis | { error: string } = await res.json()
            if (!res.ok || 'error' in data) {
                throw new Error('error' in data ? data.error : `HTTP ${res.status}`)
            }

            const toolName = (data.tool || data.aaptResolved || 'aapt').toString()
            const text =
                `# APK Analyzer
Tool: ${toolName}
== badging (code ${data.badging.code}) ==
${data.badging.stdout || data.badging.stderr}

== permissions (code ${data.permissions.code}) ==
${data.permissions.stdout || data.permissions.stderr}

== configurations (code ${data.configurations.code}) ==
${data.configurations.stdout || data.configurations.stderr}
`
            setOutput(text)
            setAnalysis(data)
            const s = parseAaptSummary(data.badging.stdout || '', (data.permissions.stdout || data.badging.stdout || ''))
            setSummary(s)
            setAnalysisOpen(true)
            setApkMsg('Phân tích xong.')
        } catch (e: any) {
            setApkMsg(`Lỗi: ${e.message}`)
        } finally { setApkBusy(false) }
    }

    function parseAaptSummary(badging: string, permDump: string): ApkSummary {
        const get = (re: RegExp) => (badging.match(re)?.[1] ?? undefined)
        const pickAll = (src: string, re: RegExp) => Array.from(src.matchAll(re)).map(m => m[1])

        const pkgLine = badging.split('\n').find(l => l.startsWith('package:')) || ''
        const packageName = pkgLine.match(/name='([^']+)'/)?.[1]
        const versionCode = pkgLine.match(/versionCode='([^']+)'/)?.[1]
        const versionName = pkgLine.match(/versionName='([^']+)'/)?.[1]

        const label =
            get(/application-label:'([^']+)'/) ||
            get(/application-label-[^:]+:'([^']+)'/)

        const sdkVersion = get(/sdkVersion:'([^']+)'/)
        const targetSdkVersion = get(/targetSdkVersion:'([^']+)'/)

        const launchableActivity =
            badging.match(/launchable-activity:\s+name='([^']+)'/)?.[1]

        const abis = pickAll(badging, /native-code:\s*'([^']+)'/g)
        const densities = pickAll(badging, /densities:\s*'([^']+)'/g)
        const locales = pickAll(badging, /locales:\s*'([^']+)'/g)

        // permissions from both outputs
        const p1 = pickAll(badging, /uses-permission(?:-sdk23)?:\s*name='([^']+)'/g)
        const p2 = pickAll(permDump, /uses-permission(?:-sdk23)?:\s*name='([^']+)'/g)
        const perms = Array.from(new Set([...p1, ...p2])).sort()

        return {
            label, package: packageName, versionName, versionCode,
            sdkVersion, targetSdkVersion, launchableActivity,
            abis, densities, locales, permissions: perms,
        }
    }

    const renderReportText = (s: ApkSummary | null, a: ApkAnalysis | null) => {
        const lines: string[] = []
        if (s) {
            lines.push(
                `APK Summary`,
                `App Label       : ${s.label ?? '-'}`,
                `Package         : ${s.package ?? '-'}`,
                `Version         : ${s.versionName ?? '-'} (${s.versionCode ?? '-'})`,
                `Min/Target SDK  : ${s.sdkVersion ?? '-'} / ${s.targetSdkVersion ?? '-'}`,
                `Launch Activity : ${s.launchableActivity ?? '-'}`,
                `ABIs            : ${s.abis.join(', ') || '-'}`,
                `Densities       : ${s.densities.join(', ') || '-'}`,
                `Locales         : ${s.locales.join(', ') || '-'}`,
                `Permissions (${s.permissions.length})`,
                ...s.permissions.map(p => `  - ${p}`),
                ``
            )
        }
        if (a) {
            const toolName = (a.tool || a.aaptResolved || 'aapt').toString()
            lines.push(
                `=== RAW OUTPUT (tool: ${toolName}) ===`,
                `-- badging (code ${a.badging.code}) --`,
                a.badging.stdout || a.badging.stderr || '(empty)',
                `-- permissions (code ${a.permissions.code}) --`,
                a.permissions.stdout || a.permissions.stderr || '(empty)',
                `-- configurations (code ${a.configurations.code}) --`,
                a.configurations.stdout || a.configurations.stderr || '(empty)'
            )
        }
        return lines.join('\n')
    }

    const copy = async () => {
        await navigator.clipboard.writeText(output)
        setCopied(true); setTimeout(() => setCopied(false), 1000)
    }

    // -------- các tool text cũ (tùy dùng) --------
    const generateKeystoreHelp = () => {
        const { keystoreName, alias, validity } = form
        const command = `keytool -genkeypair -v -keystore ${keystoreName} -alias ${alias} -keyalg RSA -keysize ${form.keysize} -validity ${validity}`
        setOutput(`# Generate Android Keystore\n${command}\n...`)
    }
    const convertAabToApk = () => { setOutput(`# Convert AAB to APK ...`) }
    const generateGradleCommands = () => { setOutput(`# Android Gradle Build Commands ...`) }
    const generateProGuardRules = () => { setOutput(`# ProGuard Rules for Android ...`) }
    const generateAdbCommands = () => { setOutput(`# ADB (Android Debug Bridge) Commands ...`) }
    const generateManifestTemplate = () => { setOutput(`<?xml version="1.0" ...`) }
    const generateBuildGradleTemplate = () => { setOutput(`// app/build.gradle ...`) }
    const generateApkAnalyzerCommands = () => { setOutput(`# APK Analyzer Commands ...`) }

    return (
        <div className="h-full flex flex-col min-h-0 space-y-6">

            {/* Tạo .jks */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">Tạo keystore (.jks) & tải về</h3>

                <div className="grid md:grid-cols-2 gap-3">
                    {/* các LiteInput nền sáng */}
                    <div>
                        <label className="text-xs text-slate-600 dark:text-slate-300">Keystore file name</label>
                        <LiteInput value={form.keystoreName} onChange={e => onChange('keystoreName', e.target.value)}
                            className="w-full mt-1 h-9 px-3 rounded-md border border-slate-300 bg-white text-slate-900 placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-600 dark:text-slate-300">Alias</label>
                        <LiteInput value={form.alias} onChange={e => onChange('alias', e.target.value)}
                            className="w-full mt-1 h-9 px-3 rounded-md border border-slate-300 bg-white text-slate-900 placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-600 dark:text-slate-300">Store Password</label>
                        <LiteInput type="password" value={form.storepass} onChange={e => onChange('storepass', e.target.value)}
                            className="w-full mt-1 h-9 px-3 rounded-md border border-slate-300 bg-white text-slate-900 placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-600 dark:text-slate-300">Key Password (optional)</label>
                        <LiteInput type="password" value={form.keypass} onChange={e => onChange('keypass', e.target.value)}
                            className="w-full mt-1 h-9 px-3 rounded-md border border-slate-300 bg-white text-slate-900 placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-600 dark:text-slate-300">Key size</label>
                        <LiteInput type="number" value={form.keysize} onChange={e => onChange('keysize', Number(e.target.value))}
                            className="w-full mt-1 h-9 px-3 rounded-md border border-slate-300 bg-white text-slate-900 placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-600 dark:text-slate-300">Validity (days)</label>
                        <LiteInput type="number" value={form.validity} onChange={e => onChange('validity', Number(e.target.value))}
                            className="w-full mt-1 h-9 px-3 rounded-md border border-slate-300 bg-white text-slate-900 placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-600 dark:text-slate-300">CN (Common Name)</label>
                        <LiteInput value={form.cn} onChange={e => onChange('cn', e.target.value)}
                            className="w-full mt-1 h-9 px-3 rounded-md border border-slate-300 bg-white text-slate-900 placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-600 dark:text-slate-300">OU (Org Unit)</label>
                        <LiteInput value={form.ou} onChange={e => onChange('ou', e.target.value)}
                            className="w-full mt-1 h-9 px-3 rounded-md border border-slate-300 bg-white text-slate-900 placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-600 dark:text-slate-300">O (Organization)</label>
                        <LiteInput value={form.o} onChange={e => onChange('o', e.target.value)}
                            className="w-full mt-1 h-9 px-3 rounded-md border border-slate-300 bg-white text-slate-900 placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-600 dark:text-slate-300">L (City)</label>
                        <LiteInput value={form.l} onChange={e => onChange('l', e.target.value)}
                            className="w-full mt-1 h-9 px-3 rounded-md border border-slate-300 bg-white text-slate-900 placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-600 dark:text-slate-300">ST (State)</label>
                        <LiteInput value={form.st} onChange={e => onChange('st', e.target.value)}
                            className="w-full mt-1 h-9 px-3 rounded-md border border-slate-300 bg-white text-slate-900 placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-600 dark:text-slate-300">C (Country code)</label>
                        <LiteInput value={form.c} onChange={e => onChange('c', e.target.value)}
                            className="w-full mt-1 h-9 px-3 rounded-md border border-slate-300 bg-white text-slate-900 placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                    <Button onClick={generateJKS} disabled={busy}>
                        <Download className="w-4 h-4 mr-2" />
                        {busy ? 'Đang tạo...' : 'Tạo & Tải .jks'}
                    </Button>
                    {serverMsg && <span className="text-xs text-slate-600 dark:text-slate-300">{serverMsg}</span>}
                </div>
            </div>

            {/* AAB -> APK */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">AAB ➜ APK (bundletool)</h3>

                {/* Mode + bundletool jar path */}
                <div className="grid md:grid-cols-3 gap-3 mb-3">
                    <div className="flex items-center gap-3">
                        <label className="text-xs text-slate-600 dark:text-slate-300">Chế độ</label>
                        <div className="flex items-center gap-2">
                            <label className="text-xs flex items-center gap-1">
                                <input type="radio" name="aabMode" checked={aabMode === 'device'} onChange={() => setAabMode('device')} />
                                <span>Device (nhỏ)</span>
                            </label>
                            <label className="text-xs flex items-center gap-1">
                                <input type="radio" name="aabMode" checked={aabMode === 'universal'} onChange={() => setAabMode('universal')} />
                                <span>Universal (to)</span>
                            </label>
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs text-slate-600 dark:text-slate-300">bundletool-all-*.jar (đường dẫn đầy đủ)</label>
                        <LiteInput
                            value={bundletoolPath}
                            onChange={(e) => setBundletoolPath(e.target.value)}
                            placeholder="C:\tools\bundletool\bundletool-all-1.18.1.jar"
                            className="w-full mt-1 h-9 px-3 rounded-md border border-slate-300 bg-white text-slate-900 placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                    </div>
                </div>

                {/* Only show filters when device mode */}
                {aabMode === 'device' && (
                    <div className="grid lg:grid-cols-4 gap-3 mb-3">
                        {/* ABI (multi) */}
                        <div>
                            <label className="text-xs text-slate-600 dark:text-slate-300">ABI</label>
                            <select
                                multiple
                                value={abiSel}
                                onChange={(e) => handleMultiSelect(e, setAbiSel)}
                                className="mt-1 w-full min-h-[120px] rounded-md border border-slate-300 bg-white text-slate-900 text-sm p-2 subtle-scrollbar"
                            >
                                {abiOptions.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                            <div className="text-[11px] text-slate-500 mt-1">Chọn 1 hoặc nhiều (Ctrl/Cmd + click)</div>
                        </div>

                        {/* Density (single) */}
                        <div>
                            <label className="text-xs text-slate-600 dark:text-slate-300">Density</label>
                            <select
                                value={densitySel === '' ? '' : String(densitySel)}
                                onChange={(e) => setDensitySel(e.target.value ? Number(e.target.value) : '')}
                                className="mt-1 w-full h-9 rounded-md border border-slate-300 bg-white text-slate-900 text-sm px-2"
                            >
                                <option value="">(Auto)</option>
                                {densityOptions.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                            </select>
                        </div>

                        {/* SDK (single) */}
                        <div>
                            <label className="text-xs text-slate-600 dark:text-slate-300">SDK</label>
                            <select
                                value={sdkSel === '' ? '' : String(sdkSel)}
                                onChange={(e) => setSdkSel(e.target.value ? Number(e.target.value) : '')}
                                className="mt-1 w-full h-9 rounded-md border border-slate-300 bg-white text-slate-900 text-sm px-2"
                            >
                                <option value="">(Auto)</option>
                                {sdkOptions.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                            <div className="text-[11px] text-slate-500 mt-1">Ví dụ Android 13 = 33</div>
                        </div>

                        {/* Locales (multi) */}
                        <div>
                            <label className="text-xs text-slate-600 dark:text-slate-300">Locales</label>
                            <select
                                multiple
                                value={localesSel}
                                onChange={(e) => handleMultiSelect(e, setLocalesSel)}
                                className="mt-1 w-full min-h-[120px] rounded-md border border-slate-300 bg-white text-slate-900 text-sm p-2 subtle-scrollbar"
                            >
                                {localeOptions.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <input
                        type="file"
                        accept=".aab"
                        onChange={(e) => setAabFile(e.target.files?.[0] ?? null)}
                        className="file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:text-slate-700"
                    />
                    <Button onClick={handleAabToApk} disabled={aabBusy || !aabFile}>
                        <Package className="w-4 h-4 mr-2" />
                        {aabBusy ? 'Đang chuyển...' : (aabMode === 'device' ? 'Xuất APK/ZIP theo thiết bị' : 'Chuyển & tải Universal APK')}
                    </Button>
                    {aabMsg && <span className="text-xs text-slate-600 dark:text-slate-300">{aabMsg}</span>}
                </div>
            </div>

            {/* APK Analyzer */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">APK Analyzer (aapt)</h3>
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <input
                        type="file"
                        accept=".apk"
                        onChange={(e) => setApkFile(e.target.files?.[0] ?? null)}
                        className="file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:text-slate-700"
                    />
                    <Button onClick={handleAnalyzeApk} variant="secondary" disabled={apkBusy || !apkFile}>
                        <Wrench className="w-4 h-4 mr-2" />
                        {apkBusy ? 'Đang phân tích...' : 'Phân tích APK'}
                    </Button>
                    {apkMsg && <span className="text-xs text-slate-600 dark:text-slate-300">{apkMsg}</span>}
                </div>
            </div>

            {/* ===================== MODAL REPORT ===================== */}
            {analysisOpen && (
                <div
                    className="fixed inset-0 z-50"
                    aria-modal="true"
                    role="dialog"
                    onKeyDown={(e) => e.key === 'Escape' && setAnalysisOpen(false)}
                >
                    <div className="absolute inset-0 bg-black/40" onClick={() => setAnalysisOpen(false)} />
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                        <div className="w-full max-w-5xl rounded-xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
                                <div className="font-semibold text-slate-900 dark:text-slate-100">
                                    APK Report {summary?.label ? `– ${summary.label}` : ''} {summary?.package ? `(${summary.package})` : ''}
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setAnalysisOpen(false)} aria-label="Close">
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>

                            <div className="px-5 py-4 space-y-4 max-h-[75vh] overflow-auto custom-scrollbar">
                                {/* Summary */}
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                        <div className="text-sm">
                                            <div><span className="font-medium">App label:</span> {summary?.label ?? '-'}</div>
                                            <div><span className="font-medium">Package:</span> {summary?.package ?? '-'}</div>
                                            <div><span className="font-medium">Version:</span> {summary?.versionName ?? '-'} ({summary?.versionCode ?? '-'})</div>
                                            <div><span className="font-medium">Min/Target SDK:</span> {summary?.sdkVersion ?? '-'} / {summary?.targetSdkVersion ?? '-'}</div>
                                            <div><span className="font-medium">Launchable activity:</span> {summary?.launchableActivity ?? '-'}</div>
                                            <div><span className="font-medium">ABIs:</span> {summary?.abis?.join(', ') || '-'}</div>
                                            <div><span className="font-medium">Densities:</span> {summary?.densities?.join(', ') || '-'}</div>
                                            <div><span className="font-medium">Locales:</span> {summary?.locales?.join(', ') || '-'}</div>
                                            <div><span className="font-medium">Permissions:</span> {summary?.permissions?.length ?? 0}</div>
                                        </div>
                                    </div>

                                    {/* Permissions list */}
                                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                        <div className="font-medium mb-2">Permissions ({summary?.permissions?.length ?? 0})</div>
                                        <div className="max-h-56 overflow-auto subtle-scrollbar text-sm">
                                            {summary?.permissions && summary.permissions.length > 0 ? (
                                                <ul className="list-disc pl-5 space-y-1">
                                                    {summary.permissions.map((p) => <li key={p} className="break-all">{p}</li>)}
                                                </ul>
                                            ) : <div className="text-slate-500">—</div>}
                                        </div>
                                    </div>
                                </div>

                                {/* Raw outputs */}
                                <details className="rounded-lg border border-slate-200 dark:border-slate-700">
                                    <summary className="cursor-pointer px-4 py-2 font-medium">Raw: badging</summary>
                                    <pre className="px-4 py-3 overflow-auto custom-scrollbar text-xs whitespace-pre-wrap">
                                        {(analysis?.badging.stdout || analysis?.badging.stderr || '(empty)').trim()}
                                    </pre>
                                </details>

                                <details className="rounded-lg border border-slate-200 dark:border-slate-700">
                                    <summary className="cursor-pointer px-4 py-2 font-medium">Raw: permissions</summary>
                                    <pre className="px-4 py-3 overflow-auto custom-scrollbar text-xs whitespace-pre-wrap">
                                        {(analysis?.permissions.stdout || analysis?.permissions.stderr || '(empty)').trim()}
                                    </pre>
                                </details>

                                <details className="rounded-lg border border-slate-200 dark:border-slate-700">
                                    <summary className="cursor-pointer px-4 py-2 font-medium">Raw: configurations</summary>
                                    <pre className="px-4 py-3 overflow-auto custom-scrollbar text-xs whitespace-pre-wrap">
                                        {(analysis?.configurations.stdout || analysis?.configurations.stderr || '(empty)').trim()}
                                    </pre>
                                </details>
                            </div>

                            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2 justify-end">
                                <Button
                                    variant="secondary"
                                    onClick={async () => {
                                        await navigator.clipboard.writeText(renderReportText(summary, analysis))
                                    }}
                                >
                                    <Clipboard className="w-4 h-4 mr-2" /> Copy report
                                </Button>
                                <Button
                                    onClick={() => {
                                        const txt = renderReportText(summary, analysis)
                                        const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' })
                                        downloadBlob(blob, `${summary?.package || 'apk'}-report.txt`)
                                    }}
                                >
                                    <FileText className="w-4 h-4 mr-2" /> Download .txt
                                </Button>
                                <Button variant="ghost" onClick={() => setAnalysisOpen(false)}>Đóng</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* =================== /MODAL REPORT ==================== */}
        </div>
    )
}
