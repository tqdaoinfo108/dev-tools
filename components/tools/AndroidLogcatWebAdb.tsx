'use client'

import * as React from 'react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { Download, Trash2, Wifi, Smartphone, RefreshCw, Link2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import { Adb, AdbDaemonTransport, type AdbSocket } from '@yume-chan/adb'
import AdbWebCredentialStore from '@yume-chan/adb-credential-web'
import {
    AdbDaemonWebUsbDeviceManager,
    AdbDefaultInterfaceFilter,
    type AdbDaemonWebUsbDevice
} from '@yume-chan/adb-daemon-webusb'

type DeviceSummary = {
    serial: string
    name: string
    lastSeen: string
    agentName?: string
}

type LogEvent = {
    id: string
    timestamp: string
    threadTimestamp: string
    localTimestamp: string
    receivedAt: string
    device: string
    deviceName: string
    adSource: string
    adFormat: string
    rawLog: string
    metadata?: Record<string, unknown>
    isAd: boolean
}

const MAX_ENTRIES = 5000

type ConnectionState = 'disconnected' | 'connecting' | 'connected'

type StreamContext = {
    adb: Adb
    socket: AdbSocket | null
    cancel: (() => void) | null
}

type AdbStreamReader = ReturnType<AdbSocket['readable']['getReader']>

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
    return Boolean(value) && typeof value === 'object' && typeof (value as PromiseLike<T>).then === 'function'
}

async function resolvePackagePids(adb: Adb, packageName: string): Promise<string[]> {
    const socket = await adb.createSocket(`shell:pidof ${packageName}`)
    let reader: AdbStreamReader | null = null
    const decoder = new TextDecoder()
    let output = ''

    try {
        reader = socket.readable.getReader()
        while (true) {
            const { value, done } = await reader.read()
            if (done) break
            if (value && value.length) {
                output += decoder.decode(value, { stream: true })
            }
        }
        output += decoder.decode()
    } finally {
        if (reader) {
            try {
                await reader.cancel()
            } catch (cancelError) {
                console.warn('[AndroidLogcatWebAdb] resolvePackagePids cancel failed', cancelError)
            }
        }
        const closeResult = socket.close()
        if (isPromiseLike(closeResult)) {
            await closeResult.then(undefined, () => undefined)
        }
    }

    const candidates = output
        .trim()
        .split(/\s+/)
        .filter((chunk) => /^\d+$/.test(chunk))

    return candidates
}

export const AndroidLogcatWebAdb: React.FC = () => {
    const [connectionState, setConnectionState] = React.useState<ConnectionState>('disconnected')
    const [devices, setDevices] = React.useState<DeviceSummary[]>([])
    const [logs, setLogs] = React.useState<LogEvent[]>([])
    const [selectedDevice, setSelectedDevice] = React.useState<string>('all')
    const [error, setError] = React.useState<string | null>(null)
    const [busy, setBusy] = React.useState<boolean>(false)
    const [supported, setSupported] = React.useState<boolean>(true)
    const [packageFilter, setPackageFilter] = React.useState<string>('')
    const [packageFilterError, setPackageFilterError] = React.useState<string | null>(null)
    const [activePackageInfo, setActivePackageInfo] = React.useState<{ packageName: string; pids: string[] } | null>(
        null
    )

    const rawLogContainerRef = React.useRef<HTMLDivElement>(null)
    const eventCounterRef = React.useRef(0)
    const streamContextRef = React.useRef<StreamContext | null>(null)
    const abortControllerRef = React.useRef<AbortController | null>(null)
    const streamTaskRef = React.useRef<Promise<void> | null>(null)
    const deviceHandleRef = React.useRef<AdbDaemonWebUsbDevice | null>(null)
    const packageFilterRef = React.useRef<string>('')

    const filteredLogs = React.useMemo(() => {
        if (selectedDevice === 'all') return logs
        return logs.filter((event) => event.device === selectedDevice)
    }, [logs, selectedDevice])

    const adEvents = React.useMemo(() => filteredLogs.filter((event) => event.isAd), [filteredLogs])
    const deviceStats = React.useMemo(() => {
        return logs.reduce<Record<string, { logs: number; ads: number }>>((acc, event) => {
            const stats = acc[event.device] || { logs: 0, ads: 0 }
            stats.logs += 1
            if (event.isAd) stats.ads += 1
            acc[event.device] = stats
            return acc
        }, {})
    }, [logs])

    const totalLogCount = logs.length
    const totalAdCount = React.useMemo(() => logs.reduce((acc, event) => acc + (event.isAd ? 1 : 0), 0), [logs])

    const summaryCountLabel = `${adEvents.length} ad impressions`
    const summaryEmptyMessage =
        selectedDevice === 'all'
            ? 'Chua co ad impression nao. Tuong tac voi ung dung de sinh log.'
            : 'Chua co ad impression cho thiet bi nay.'
    const rawEmptyMessage =
        connectionState === 'connected'
            ? 'Chua co logcat nao tu thiet bi. Thu chuyen man khac hoac kich hoat quang cao.'
            : 'Chua ket noi thiet bi. Bam "Ket noi thiet bi" de bat dau doc log.'

    React.useEffect(() => {
        if (!AdbDaemonWebUsbDeviceManager.BROWSER) {
            setSupported(false)
            setError('Trinh duyet khong ho tro WebUSB. Vui long dung Chrome hoac Edge tren desktop.')
        }
    }, [])

    React.useEffect(() => {
        packageFilterRef.current = packageFilter
    }, [packageFilter])

    React.useEffect(() => {
        if (!rawLogContainerRef.current) return
        rawLogContainerRef.current.scrollTop = rawLogContainerRef.current.scrollHeight
    }, [filteredLogs])

    const teardownStream = React.useCallback(async () => {
        const controller = abortControllerRef.current
        if (controller) {
            controller.abort()
            abortControllerRef.current = null
        }

        const context = streamContextRef.current
        if (context?.cancel) {
            try {
                context.cancel()
            } catch (cancelError) {
                console.warn('[AndroidLogcatWebAdb] Cancel stream failed', cancelError)
            }
        }
    }, [])

    const handleDisconnect = React.useCallback(
        async (options?: { preserveDevices?: boolean; preserveHandle?: boolean }) => {
            await teardownStream()

            const task = streamTaskRef.current
            if (task) {
                try {
                    await task
                } catch (waitError) {
                    console.warn('[AndroidLogcatWebAdb] Stream task error during disconnect', waitError)
                }
                streamTaskRef.current = null
            }

            streamContextRef.current = null
            setConnectionState('disconnected')
            if (!options?.preserveDevices) {
                setDevices([])
                setSelectedDevice('all')
            }
            setError(null)
            setPackageFilterError(null)
            setActivePackageInfo(null)
            if (!options?.preserveHandle) {
                deviceHandleRef.current = null
            }
        },
        [teardownStream]
    )

    React.useEffect(() => {
        return () => {
            void handleDisconnect()
        }
    }, [handleDisconnect])

    const startLogcatStream = React.useCallback(
        async (adb: Adb, serial: string, name: string, abortSignal: AbortSignal, packageName: string) => {
            const context: StreamContext = { adb, socket: null, cancel: null }
            streamContextRef.current = context

            let reader: AdbStreamReader | null = null
            let resolvedPids: string[] = []
            let command = 'shell:logcat -v threadtime'
            let shouldClientFilter = false
            const trimmedPackage = packageName.trim()

            try {
                if (trimmedPackage) {
                    try {
                        resolvedPids = await resolvePackagePids(adb, trimmedPackage)
                        if (resolvedPids.length) {
                            command = `shell:logcat -v threadtime --pid=${resolvedPids.join(',')}`
                            setPackageFilterError(null)
                            setActivePackageInfo({ packageName: trimmedPackage, pids: resolvedPids })
                        } else {
                            shouldClientFilter = true
                            setPackageFilterError(
                                `Khong tim thay PID cho package "${trimmedPackage}". Se loc bang ten goi.`
                            )
                            setActivePackageInfo(null)
                        }
                    } catch (pidError) {
                        console.error('[AndroidLogcatWebAdb] Resolve package PID failed', pidError)
                        shouldClientFilter = true
                        setPackageFilterError('Khong doc duoc PID tu thiet bi. Se loc bang ten goi.')
                        setActivePackageInfo(null)
                    }
                } else {
                    setPackageFilterError(null)
                    setActivePackageInfo(null)
                }

                const socket = await adb.createSocket(command)
                context.socket = socket

                reader = socket.readable.getReader()
                const decoder = new TextDecoder()
                let buffer = ''
                const packageNeedle = trimmedPackage ? trimmedPackage.toLowerCase() : null

                const cancel = () => {
                    if (reader) {
                        void reader.cancel().catch(() => undefined)
                    }
                    const closeResult = socket.close()
                    if (isPromiseLike(closeResult)) {
                        void closeResult.then(undefined, () => undefined)
                    }
                }
                context.cancel = cancel

                abortSignal.addEventListener('abort', cancel, { once: true })

                setConnectionState('connected')
                setError(null)

                while (!abortSignal.aborted) {
                    const { value, done } = await reader.read()
                    if (done) break
                    if (!value || value.length === 0) continue

                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split(/\r?\n/)
                    buffer = lines.pop() ?? ''

                    for (const rawLine of lines) {
                        const line = rawLine.trim()
                        if (!line) continue
                        if (trimmedPackage && shouldClientFilter && packageNeedle) {
                            if (!line.toLowerCase().includes(packageNeedle)) {
                                continue
                            }
                        }

                        const event = buildLogEvent(line, serial, name, eventCounterRef.current++)
                        setLogs((prev) => {
                            const next = [...prev, event]
                            if (next.length > MAX_ENTRIES) {
                                return next.slice(-MAX_ENTRIES)
                            }
                            return next
                        })
                        setDevices((prev) => {
                            if (!prev.length) {
                                return [
                                    { serial, name, lastSeen: event.receivedAt, agentName: 'WebADB' }
                                ]
                            }
                            return prev.map((device) =>
                                device.serial === serial ? { ...device, lastSeen: event.receivedAt } : device
                            )
                        })
                    }
                }
            } catch (streamError) {
                if (!abortSignal.aborted) {
                    console.error('[AndroidLogcatWebAdb] Stream failed', streamError)
                    setError('Khong doc duoc logcat. Thu rut ra cam lai cap roi ket noi lai.')
                    setConnectionState('disconnected')
                }
            } finally {
                if (reader) {
                    try {
                        await reader.cancel()
                    } catch (cancelError) {
                        console.warn('[AndroidLogcatWebAdb] Reader cancel failed', cancelError)
                    }
                }
                if (context.socket) {
                    try {
                        await context.socket.close()
                    } catch (closeError) {
                        console.warn('[AndroidLogcatWebAdb] Socket close failed', closeError)
                    }
                }
                try {
                    await context.adb.close()
                } catch (adbError) {
                    console.warn('[AndroidLogcatWebAdb] ADB close failed', adbError)
                }
                if (context.cancel) {
                    abortSignal.removeEventListener('abort', context.cancel)
                }
                if (!abortSignal.aborted) {
                    setConnectionState('disconnected')
                }
                streamContextRef.current = null
            }
        },
        []
    )

    const connectToDevice = React.useCallback(
        async (device: AdbDaemonWebUsbDevice, options?: { resetLogs?: boolean }) => {
            const serial = device.serial || device.raw.serialNumber || 'unknown'
            const name = device.name || device.raw.productName || serial
            const connection = await device.connect()
            const credentialStore = new AdbWebCredentialStore('dev-tools-webadb')

            const transport = await AdbDaemonTransport.authenticate({
                serial,
                connection,
                credentialStore
            })

            const adb = new Adb(transport)

            const controller = new AbortController()
            abortControllerRef.current = controller
            deviceHandleRef.current = device

            if (options?.resetLogs ?? true) {
                setLogs([])
                setSelectedDevice('all')
                eventCounterRef.current = 0
            }

            const nowIso = new Date().toISOString()
            setDevices([{ serial, name, lastSeen: nowIso, agentName: 'WebADB' }])
            setSelectedDevice(serial)

            const trimmedFilter = packageFilterRef.current.trim()
            const task = startLogcatStream(adb, serial, name, controller.signal, trimmedFilter)
            streamTaskRef.current = task
            void task.catch((streamError) => {
                if (streamError) {
                    console.error('[AndroidLogcatWebAdb] Stream task error', streamError)
                }
            })
        },
        [startLogcatStream]
    )

    const restartStream = React.useCallback(async () => {
        const device = deviceHandleRef.current
        if (!device) {
            setPackageFilterError('Khong tim thay thong tin thiet bi. Bam "Ket noi thiet bi" de ket noi lai.')
            return false
        }

        setBusy(true)
        setError(null)

        try {
            await handleDisconnect({ preserveDevices: true, preserveHandle: true })

            setLogs([])
            setSelectedDevice('all')
            eventCounterRef.current = 0
            setConnectionState('connecting')

            await connectToDevice(device, { resetLogs: false })
            return true
        } catch (restartError) {
            console.error('[AndroidLogcatWebAdb] Restart stream failed', restartError)
            setError(
                restartError instanceof Error && restartError.message
                    ? restartError.message
                    : 'Khong the ket noi lai thiet bi. Thu ngat ket noi va ket noi lai.'
            )
            setConnectionState('disconnected')
            setDevices([])
            setSelectedDevice('all')
            deviceHandleRef.current = null
            return false
        } finally {
            setBusy(false)
        }
    }, [connectToDevice, handleDisconnect])
    const handleConnect = React.useCallback(async () => {
        if (busy || connectionState === 'connecting') {
            return
        }
        if (!supported) {
            return
        }
        if (connectionState === 'connected') {
            await handleDisconnect()
            return
        }

        const manager = AdbDaemonWebUsbDeviceManager.BROWSER
        if (!manager) {
            setSupported(false)
            setError('Trinh duyet khong ho tro WebUSB. Vui long dung Chrome hoac Edge tren desktop.')
            return
        }

        setBusy(true)
        setError(null)
        setConnectionState('connecting')
        setLogs([])
        setSelectedDevice('all')
        eventCounterRef.current = 0

        try {
            const device = await manager.requestDevice({ filters: [AdbDefaultInterfaceFilter] })
            if (!device) {
                setConnectionState('disconnected')
                return
            }

            await connectToDevice(device, { resetLogs: false })
        } catch (connectError) {
            console.error('[AndroidLogcatWebAdb] Connect failed', connectError)
            setError(
                connectError instanceof Error && connectError.message
                    ? connectError.message
                    : 'Khong the ket noi thiet bi. Kiem tra lai che do USB debugging va thu lai.'
            )
            setConnectionState('disconnected')
        } finally {
            setBusy(false)
        }
    }, [busy, connectionState, connectToDevice, handleDisconnect, supported])

    const handleRefresh = React.useCallback(async () => {
        if (connectionState === 'connected') {
            await restartStream()
            return
        }

        const manager = AdbDaemonWebUsbDeviceManager.BROWSER
        if (!manager) {
            setError('Trinh duyet khong ho tro WebUSB.')
            return
        }

        try {
            const authorised = await manager.getDevices({ filters: [AdbDefaultInterfaceFilter] })
            if (!authorised.length) {
                setDevices([])
                setError('Chua co thiet bi nao duoc cap quyen WebUSB.')
                return
            }

            setDevices(
                authorised.map((device) => ({
                    serial: device.serial || device.raw.serialNumber || 'unknown',
                    name: device.name || device.raw.productName || 'Thiet bi Android',
                    lastSeen: new Date().toISOString(),
                    agentName: 'WebADB'
                }))
            )
            setError(null)
        } catch (refreshError) {
            console.error('[AndroidLogcatWebAdb] Refresh devices failed', refreshError)
            setError('Khong the doc danh sach thiet bi. Hay thu lai.')
        }
    }, [connectionState, restartStream])

    const handleApplyPackageFilter = React.useCallback(async () => {
        const trimmed = packageFilter.trim()
        setPackageFilter(trimmed)
        packageFilterRef.current = trimmed

        if (connectionState !== 'connected') {
            if (trimmed) {
                setPackageFilterError('Ket noi thiet bi truoc khi loc package.')
            } else {
                setPackageFilterError(null)
            }
            return
        }

        setPackageFilterError(null)
        await restartStream()
    }, [connectionState, packageFilter, restartStream])

    const handleClearPackageFilter = React.useCallback(async () => {
        if (!packageFilterRef.current) {
            setPackageFilter('')
            setPackageFilterError(null)
            setActivePackageInfo(null)
            return
        }
        packageFilterRef.current = ''
        setPackageFilter('')
        setPackageFilterError(null)
        setActivePackageInfo(null)
        if (connectionState === 'connected') {
            await restartStream()
        }
    }, [connectionState, restartStream])

    const handleExport = React.useCallback(() => {
        if (!adEvents.length) return

        try {
            const rows = adEvents.map((event, index) => ({
                '#': index + 1,
                Timestamp: formatIsoAsLocal(event.receivedAt),
                ThreadTime: event.threadTimestamp,
                DeviceSerial: event.device,
                DeviceName: event.deviceName,
                AdSource: event.adSource,
                AdFormat: event.adFormat,
                RawLog: event.rawLog
            }))

            const worksheet = XLSX.utils.json_to_sheet(rows)
            const workbook = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Ad Impressions')
            const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })

            const blob = new Blob([arrayBuffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            })
            const href = URL.createObjectURL(blob)
            const anchor = document.createElement('a')
            anchor.href = href
            anchor.download = `ad-impressions-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`
            document.body.appendChild(anchor)
            anchor.click()
            anchor.remove()
            URL.revokeObjectURL(href)
        } catch (exportError) {
            console.error('[AndroidLogcatWebAdb] Export failed', exportError)
            setError('Khong the export XLSX. Vui long thu lai.')
        }
    }, [adEvents])

    const handleClear = React.useCallback(() => {
        setLogs([])
        setSelectedDevice('all')
    }, [])

    const currentStatus = React.useMemo(() => {
        switch (connectionState) {
            case 'connected':
                return { label: 'Da ket noi', className: 'bg-emerald-500' }
            case 'connecting':
                return { label: 'Dang ket noi', className: 'bg-amber-500 animate-pulse' }
            default:
                return { label: 'Da ngat', className: 'bg-red-500' }
        }
    }, [connectionState])
    return (
        <div className="h-full">
            <div className="grid h-full gap-4 lg:grid-cols-[320px,1fr]">
                <div className="flex flex-col gap-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                        <Wifi className="h-4 w-4" />
                                        Theo doi log Android (WebADB)
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Ket noi qua WebUSB de doc logcat va theo doi log quang cao.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs uppercase text-slate-600 dark:text-slate-300">
                                    <span className={clsx('h-2 w-2 rounded-full', currentStatus.className)} />
                                    {currentStatus.label}
                                    <span className="ml-3 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                                        {totalLogCount} logs - {totalAdCount} ads
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    size="sm"
                                    onClick={handleConnect}
                                    disabled={busy || !supported}
                                    className="whitespace-nowrap"
                                >
                                    <Link2 className="mr-2 h-4 w-4" />
                                    {connectionState === 'connected' ? 'Ngat ket noi' : 'Ket noi thiet bi'}
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleRefresh}
                                    disabled={busy}
                                    className="whitespace-nowrap"
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Lam moi
                                </Button>
                                <Button size="sm" variant="outline" onClick={handleExport} disabled={!adEvents.length}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Export quang cao
                                </Button>
                                <Button size="sm" variant="ghost" onClick={handleClear} disabled={!logs.length}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Xoa log
                                </Button>
                                <span className="ml-auto text-sm text-slate-600 dark:text-slate-300">
                                    {filteredLogs.length} dang hien - {logs.length} tong - gioi han {MAX_ENTRIES}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/40">
                                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                                    Loc theo package ID
                                </label>
                                <input
                                    type="text"
                                    value={packageFilter}
                                    onChange={(event) => setPackageFilter(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault()
                                            void handleApplyPackageFilter()
                                        }
                                    }}
                                    placeholder="vd: com.example.app"
                                    className="h-8 min-w-[220px] rounded border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-500/30"
                                />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleApplyPackageFilter}
                                    disabled={busy || connectionState === 'connecting'}
                                >
                                    Ap dung
                                </Button>
                                {packageFilter && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={handleClearPackageFilter}
                                        disabled={busy || connectionState === 'connecting'}
                                    >
                                        Xoa
                                    </Button>
                                )}
                                {activePackageInfo && (
                                    <>
                                        <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                                            Goi: {activePackageInfo.packageName}
                                        </span>
                                        <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                                            PID: {activePackageInfo.pids.join(', ')}
                                        </span>
                                    </>
                                )}
                            </div>
                            {packageFilterError && (
                                <div className="rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-200">
                                    {packageFilterError}
                                </div>
                            )}

                            {error && (
                                <div className="rounded-lg border border-red-500/40 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-200">
                                    {error}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                <Smartphone className="h-4 w-4" />
                                Thiet bi ket noi
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400">{devices.length}</span>
                        </div>
                        <div className="mt-3 space-y-2">
                            <button
                                type="button"
                                onClick={() => setSelectedDevice('all')}
                                className={clsx(
                                    'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition',
                                    selectedDevice === 'all'
                                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500/80 dark:bg-blue-900/40 dark:text-blue-100'
                                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:bg-blue-900/30 dark:hover:text-blue-200'
                                )}
                            >
                                <span className="font-medium">Tat ca thiet bi</span>
                                <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                                    {totalLogCount} logs - {totalAdCount} ads
                                </span>
                            </button>
                            {devices.length === 0 ? (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Chua co thiet bi nao duoc ket noi. Hay bat USB debugging, dung cap USB va bam "Ket noi thiet bi".
                                </p>
                            ) : (
                                devices.map((device) => {
                                    const stats = deviceStats[device.serial] || { logs: 0, ads: 0 }
                                    return (
                                        <button
                                            type="button"
                                            key={device.serial}
                                            onClick={() => setSelectedDevice(device.serial)}
                                            className={clsx(
                                                'w-full rounded-lg border px-3 py-2 text-left text-xs transition',
                                                selectedDevice === device.serial
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500/80 dark:bg-blue-900/40 dark:text-blue-100'
                                                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-blue-900/30 dark:hover:text-blue-200'
                                            )}
                                        >
                                            <div className="font-medium">{device.name || device.serial}</div>
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400">{device.serial}</div>
                                            {device.agentName && (
                                                <div className="text-[11px] text-slate-400 dark:text-slate-500">Nguon: {device.agentName}</div>
                                            )}
                                            <div className="text-[11px] text-slate-400 dark:text-slate-500">
                                                Lan cuoi: {formatTime(device.lastSeen)}
                                            </div>
                                            <div className="mt-1 inline-flex items-center gap-2 text-[10px] font-semibold">
                                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                                                    {stats.logs} logs
                                                </span>
                                                <span className="rounded-full bg-blue-200 px-2 py-0.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                                                    {stats.ads} ads
                                                </span>
                                            </div>
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex h-full flex-col gap-4">
                    <div className="min-h-[220px] rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            <span>Tong hop ad impression - {selectedDevice === 'all' ? 'Tat ca thiet bi' : selectedDevice}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">{summaryCountLabel}</span>
                        </div>
                        <div className="max-h-[40vh] overflow-auto">
                            {adEvents.length === 0 ? (
                                <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                    <Wifi className="h-8 w-8" />
                                    <span>{summaryEmptyMessage}</span>
                                </div>
                            ) : (
                                <table className="min-w-full table-fixed text-left text-sm">
                                    <thead className="sticky top-0 bg-slate-100 text-xs font-medium uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        <tr>
                                            <th className="w-48 px-4 py-2">Thiet bi</th>
                                            <th className="w-32 px-4 py-2">Nguon quang cao</th>
                                            <th className="w-32 px-4 py-2">Dinh dang</th>
                                            <th className="w-40 px-4 py-2">Thoi diem nhan</th>
                                            <th className="w-32 px-4 py-2">Thoi gian thread</th>
                                            <th className="px-4 py-2">Log goc</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {adEvents.map((event) => (
                                            <tr key={event.id} className="bg-white dark:bg-slate-900">
                                                <td className="px-4 py-3 align-top">
                                                    <div className="font-medium text-slate-800 dark:text-slate-100">
                                                        {event.deviceName || event.device}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">{event.device}</div>
                                                </td>
                                                <td className="px-4 py-3 align-top">
                                                    <span
                                                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${sourceBadgeClass(
                                                            event.adSource
                                                        )}`}
                                                    >
                                                        {formatLabel(event.adSource)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 align-top">
                                                    <span
                                                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${formatBadgeClass(
                                                            event.adFormat
                                                        )}`}
                                                    >
                                                        {formatLabel(event.adFormat)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 align-top text-xs text-slate-500 dark:text-slate-400">
                                                    {formatReceivedTimestamp(event)}
                                                </td>
                                                <td className="px-4 py-3 align-top text-xs text-slate-500 dark:text-slate-400">
                                                    {event.threadTimestamp}
                                                </td>
                                                <td className="px-4 py-3 align-top">
                                                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-300">
                                                        {event.rawLog}
                                                    </pre>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-sm dark:border-slate-700">
                        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-100">
                            <span>Dong log truc tiep - {selectedDevice === 'all' ? 'Tat ca thiet bi' : selectedDevice}</span>
                            <span className="text-xs text-slate-400">Tu cuon</span>
                        </div>
                        <div ref={rawLogContainerRef} className="h-full max-h-[70vh] overflow-auto p-4">
                            {filteredLogs.length === 0 ? (
                                <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-slate-400">
                                    <Wifi className="h-8 w-8" />
                                    <span>{rawEmptyMessage}</span>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredLogs.map((event) => (
                                        <div
                                            key={`${event.id}-raw`}
                                            className="rounded border border-slate-800/60 bg-slate-900/60 p-3 text-slate-100"
                                        >
                                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                                                <span>{formatReceivedTimestamp(event)}</span>
                                                <span className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
                                                    {event.threadTimestamp}
                                                </span>
                                                <span className="font-mono text-slate-500">{event.device}</span>
                                                {event.isAd && (
                                                    <span className="rounded-full bg-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                                                        ad
                                                    </span>
                                                )}
                                            </div>
                                            <pre className="whitespace-pre-wrap break-words font-mono text-xs">{event.rawLog}</pre>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
function buildLogEvent(line: string, serial: string, deviceName: string, index: number): LogEvent {
    const parsed = parseLogLine(line)

    return {
        id: `${serial}-${index}-${parsed.timestamp}`,
        timestamp: parsed.timestamp,
        threadTimestamp: parsed.threadTimestamp,
        localTimestamp: parsed.localTimestamp,
        receivedAt: new Date().toISOString(),
        device: serial,
        deviceName,
        adSource: parsed.adSource ?? 'unknown',
        adFormat: parsed.adFormat ?? 'unknown',
        rawLog: line,
        metadata: parsed.metadata,
        isAd: parsed.containsAd
    }
}

function parseLogLine(line: string): {
    timestamp: string
    threadTimestamp: string
    localTimestamp: string
    metadata?: Record<string, unknown>
    adSource?: string | null
    adFormat?: string | null
    containsAd: boolean
} {
    const match = line.match(
        /^(\d{2})-(\d{2})\s+(\d{2}:\d{2}:\d{2}\.\d{3})\s+\d+\s+\d+\s+[VDIWEF]\s+[^:]+:\s*(.*)$/
    )

    const now = new Date()
    let timestamp = now.toISOString()
    let threadTimestamp = formatIsoAsThreadTime(timestamp)
    let localTimestamp = formatIsoAsLocal(timestamp)

    if (match) {
        const month = Number.parseInt(match[1], 10)
        const day = Number.parseInt(match[2], 10)
        const time = match[3]
        timestamp = toIsoFromThreadTime(now, month, day, time)
        threadTimestamp = `${match[1]}-${match[2]} ${time}`
        localTimestamp = formatIsoAsLocal(timestamp)
    }

    const metadata = extractJsonPayload(line) ?? undefined
    const containsAdFlag =
        metadata && Object.keys(metadata).some((key) => /ad_(?:impression|platform|source|format)/i.test(key))
    const containsAd = Boolean(containsAdFlag || /ad_impression|ad_platform|ad_source/iu.test(line))

    const adSource =
        inferFromMetadata(metadata, ['ad_source', 'ad_platform', 'network', 'source']) ||
        extractFromLine(line, /(ad_(?:source|platform))['"=:\s]+([\w./-]+)/i)

    const adFormat =
        inferFromMetadata(metadata, ['ad_format', 'format', 'placement', 'ad_type']) ||
        extractFromLine(line, /(ad_format|format)['"=:\s]+([\w./-]+)/i)

    return {
        timestamp,
        threadTimestamp,
        localTimestamp,
        metadata,
        adSource,
        adFormat,
        containsAd
    }
}

function extractJsonPayload(line: string): Record<string, unknown> | null {
    const jsonMatch = line.match(/\{.*?\}/)
    if (!jsonMatch) {
        return null
    }

    try {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed && typeof parsed === 'object') {
            return parsed as Record<string, unknown>
        }
    } catch (error) {
        console.warn('[AndroidLogcatWebAdb] JSON parse failed', error)
    }

    return null
}

function inferFromMetadata(metadata: Record<string, unknown> | undefined, keys: string[]) {
    if (!metadata) {
        return null
    }

    const lowered = Object.entries(metadata).reduce<Record<string, unknown>>((acc, [key, value]) => {
        acc[key.toLowerCase()] = value
        return acc
    }, {})

    for (const key of keys) {
        if (lowered[key] !== undefined && lowered[key] !== null) {
            return String(lowered[key])
        }
    }

    return null
}

function extractFromLine(line: string, regex: RegExp): string | null {
    const match = line.match(regex)
    if (match && match[2]) {
        return match[2]
    }
    return null
}

function toIsoFromThreadTime(now: Date, month: number, day: number, time: string) {
    const year = now.getFullYear()
    const paddedMonth = String(month).padStart(2, '0')
    const paddedDay = String(day).padStart(2, '0')
    const candidate = new Date(`${year}-${paddedMonth}-${paddedDay}T${time}`)

    if (Number.isNaN(candidate.getTime())) {
        return now.toISOString()
    }

    if (candidate.getTime() - now.getTime() > 1000 * 60 * 60 * 24 * 180) {
        candidate.setFullYear(year - 1)
    }

    return candidate.toISOString()
}

function formatLabel(value: string) {
    return value
        .replace(/[_-]+/g, ' ')
        .split(' ')
        .map((chunk) => (chunk ? chunk[0].toUpperCase() + chunk.slice(1) : chunk))
        .join(' ')
}

function formatTime(iso: string) {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleTimeString([], { hour12: false })
}

function formatIsoAsThreadTime(iso: string) {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return '-'
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0')
    return `${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`
}

function formatIsoAsLocal(iso: string) {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleString([], { hour12: false })
}

function formatReceivedTimestamp(event: LogEvent) {
    return formatIsoAsLocal(event.receivedAt)
}
function sourceBadgeClass(source: string) {
    switch (source.toLowerCase()) {
        case 'admob':
            return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
        case 'facebook':
            return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200'
        case 'unity':
            return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200'
        case 'ironsource':
            return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200'
        case 'applovin':
            return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200'
        default:
            return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
    }
}

function formatBadgeClass(format: string) {
    switch (format.toLowerCase()) {
        case 'banner':
            return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
        case 'interstitial':
            return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200'
        case 'rewarded':
            return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200'
        case 'native':
            return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200'
        default:
            return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
    }
}

