'use client'

import * as React from 'react'
import clsx from 'clsx'
import { io, type Socket } from 'socket.io-client'
import { Button } from '@/components/ui/Button'
import { Download, Trash2, Wifi, Smartphone, RefreshCw } from 'lucide-react'
import * as XLSX from 'xlsx'

type DeviceSummary = {
    serial: string
    name: string
    lastSeen: string
    agentId?: string
    agentName?: string
}

type ServerLogEvent = {
    id?: string
    timestamp?: string
    device?: string
    device_name?: string
    ad_source?: string
    ad_format?: string
    raw_log?: string
    metadata?: Record<string, unknown>
    agentId?: string
    agentName?: string
    isAd?: boolean
}

type LogEvent = {
    id: string
    timestamp: string
    device: string
    deviceName: string
    adSource: string
    adFormat: string
    rawLog: string
    metadata?: Record<string, unknown>
    agentId?: string
    agentName?: string
    isAd: boolean
}

const MAX_ENTRIES = 5000
const SOCKET_PATH = '/api/android-logcat/ws'

export const AndroidLogcatFilter: React.FC = () => {
    const [connectionState, setConnectionState] = React.useState<'connecting' | 'connected' | 'disconnected'>(
        'connecting'
    )
    const [devices, setDevices] = React.useState<DeviceSummary[]>([])
    const [logs, setLogs] = React.useState<LogEvent[]>([])
    const [selectedDevice, setSelectedDevice] = React.useState<string>('all')
    const [error, setError] = React.useState<string | null>(null)

    const rawLogContainerRef = React.useRef<HTMLDivElement>(null)
    const socketRef = React.useRef<Socket | null>(null)
    const initSocketRef = React.useRef<Promise<void> | null>(null)
    const selectedDeviceRef = React.useRef<string>('all')
    const seenIdsRef = React.useRef<Set<string>>(new Set())

    const filteredLogs = React.useMemo(() => {
        if (selectedDevice === 'all') return logs
        return logs.filter((event) => event.device === selectedDevice)
    }, [logs, selectedDevice])

    const adEvents = React.useMemo(() => filteredLogs.filter((event) => event.isAd), [filteredLogs])

    const lastEventTime = filteredLogs.length ? filteredLogs[filteredLogs.length - 1].timestamp : null

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
            ? 'Chưa có ad impression nào. Thực hiện hành động quảng cáo trên thiết bị.'
            : 'Chưa có ad impression cho thiết bị này.'
    const rawEmptyMessage = 'Chưa có logcat nào. Hãy tương tác với ứng dụng để sinh log.'

    React.useEffect(() => {
        if (!rawLogContainerRef.current) return
        rawLogContainerRef.current.scrollTop = rawLogContainerRef.current.scrollHeight
    }, [filteredLogs])

    React.useEffect(() => {
        selectedDeviceRef.current = selectedDevice
    }, [selectedDevice])

    React.useEffect(() => {
        let active = true

        const ensureSocketReady = async () => {
            if (!initSocketRef.current) {
                initSocketRef.current = fetch(SOCKET_PATH, { method: 'GET' })
                    .catch((err) => {
                        console.error('[AndroidLogcat] Failed to prepare socket route', err)
                    })
                    .then(() => undefined)
            }
            await initSocketRef.current
        }

        const connect = async () => {
            if (!active) return

            setConnectionState('connecting')
            await ensureSocketReady()
            if (!active) return

            const socket = io({
                path: SOCKET_PATH,
                transports: ['websocket'],
                reconnection: true,
                reconnectionAttempts: Infinity
            })

            socketRef.current = socket

            socket.on('connect', () => {
                if (!active) return
                setConnectionState('connected')
                setError(null)
            })

            socket.on('disconnect', () => {
                if (!active) return
                setConnectionState('disconnected')
            })

            socket.on('connect_error', (err) => {
                console.error('[AndroidLogcat] Socket connect error', err)
                setError('Không thể kết nối tới Socket.IO. Kiểm tra server và thử lại.')
                setConnectionState('disconnected')
            })

            socket.on('init', (payload: { devices?: DeviceSummary[]; events?: ServerLogEvent[] }) => {
                const initialEvents = (payload.events ?? []).map(normaliseServerEvent)
                seenIdsRef.current = new Set(initialEvents.map((event) => event.id))
                setLogs(initialEvents.slice(-MAX_ENTRIES))

                const incomingDevices = payload.devices ?? []
                setDevices(incomingDevices)
                if (
                    selectedDeviceRef.current !== 'all' &&
                    !incomingDevices.some((device) => device.serial === selectedDeviceRef.current)
                ) {
                    setSelectedDevice('all')
                }
            })

            socket.on('devices', (payload: DeviceSummary[]) => {
                const incoming = payload ?? []
                setDevices(incoming)
                if (
                    selectedDeviceRef.current !== 'all' &&
                    !incoming.some((device) => device.serial === selectedDeviceRef.current)
                ) {
                    setSelectedDevice('all')
                }
            })

            socket.on('ad_event', (payload: ServerLogEvent) => {
                const event = normaliseServerEvent(payload)
                if (seenIdsRef.current.has(event.id)) return
                seenIdsRef.current.add(event.id)
                setLogs((prev) => {
                    const next = [...prev, event]
                    if (next.length > MAX_ENTRIES) {
                        return next.slice(-MAX_ENTRIES)
                    }
                    return next
                })
            })

            socket.on('server:error', (payload: { message: string }) => {
                setError(payload?.message || 'Đã xảy ra lỗi không xác định.')
            })
        }

        void connect()

        return () => {
            active = false
            socketRef.current?.disconnect()
            socketRef.current = null
        }
    }, [])

    const handleExport = React.useCallback(() => {
        if (!adEvents.length) return

        try {
            const rows = adEvents.map((event, index) => ({
                '#': index + 1,
                Timestamp: new Date(event.timestamp).toLocaleString(),
                DeviceSerial: event.device,
                DeviceName: event.deviceName,
                AdSource: event.adSource,
                AdFormat: event.adFormat,
                Agent: event.agentName || event.agentId || '',
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
            console.error('[AndroidLogcat] Export failed', exportError)
            setError('Không thể export XLSX. Vui lòng thử lại.')
        }
    }, [adEvents])

    const handleClear = React.useCallback(() => {
        seenIdsRef.current.clear()
        setLogs([])
        setSelectedDevice('all')
    }, [])

    const currentStatus = React.useMemo(() => {
        switch (connectionState) {
            case 'connected':
                return { label: 'Connected', className: 'bg-emerald-500' }
            case 'connecting':
                return { label: 'Connecting', className: 'bg-amber-500 animate-pulse' }
            default:
                return { label: 'Disconnected', className: 'bg-red-500' }
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
                                        Android Ad Impression Monitor
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Luồng logcat realtime, tự đánh dấu dòng chứa ad_impression / ad_platform.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs uppercase text-slate-600 dark:text-slate-300">
                                    <span className={`h-2 w-2 rounded-full ${currentStatus.className}`} />
                                    {currentStatus.label}
                                    {lastEventTime && (
                                        <span className="ml-3 flex items-center gap-1 text-[11px] normal-case text-slate-500 dark:text-slate-400">
                                            <RefreshCw className="h-3 w-3" />
                                            Cập nhật: {formatTime(lastEventTime)}
                                        </span>
                                    )}
                                    <span className="ml-3 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                                        {totalLogCount} logs · {totalAdCount} ads
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button onClick={handleExport} variant="secondary" disabled={!adEvents.length}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Export XLSX
                                </Button>
                                <Button onClick={handleClear} variant="secondary" disabled={!logs.length}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Clear Log
                                </Button>
                                <span className="ml-auto text-sm text-slate-600 dark:text-slate-300">
                                    {filteredLogs.length} shown · {logs.length} total · limit {MAX_ENTRIES}
                                </span>
                            </div>
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
                                Connected Devices
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
                                <span className="font-medium">All devices</span>
                                <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                                    {totalLogCount} logs · {totalAdCount} ads
                                </span>
                            </button>
                            {devices.length === 0 ? (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Chưa có agent nào kết nối. Khởi chạy script `pnpm android-agent` trên máy cắm thiết bị Android.
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
                                                <div className="text-[11px] text-slate-400 dark:text-slate-500">
                                                    Agent: {device.agentName}
                                                </div>
                                            )}
                                            <div className="text-[11px] text-slate-400 dark:text-slate-500">
                                                Last seen: {formatTime(device.lastSeen)}
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
                            <span>Ad Impression Summary — {selectedDevice === 'all' ? 'All devices' : selectedDevice}</span>
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
                                            <th className="w-48 px-4 py-2">Device</th>
                                            <th className="w-32 px-4 py-2">Ad Source</th>
                                            <th className="w-32 px-4 py-2">Format</th>
                                            <th className="w-32 px-4 py-2">Timestamp</th>
                                            <th className="px-4 py-2">Raw Event</th>
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
                                                    {event.agentName && (
                                                        <div className="text-[11px] text-slate-400 dark:text-slate-500">
                                                            Agent: {event.agentName}
                                                        </div>
                                                    )}
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
                                                    {formatTime(event.timestamp)}
                                                </td>
                                                <td className="px-4 py-3 align-top">
                                                    <pre className="whitespace-pre-wrap break-words font-mono text-xs text-slate-700 dark:text-slate-200">
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
                            <span>Raw Log Stream — {selectedDevice === 'all' ? 'All devices' : selectedDevice}</span>
                            <span className="text-xs text-slate-400">Auto scroll</span>
                        </div>
                        <div ref={rawLogContainerRef} className="h-full max-h-[45vh] overflow-auto p-4">
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
                                                <span>{formatTime(event.timestamp)}</span>
                                                <span className="font-mono text-slate-500">{event.device}</span>
                                                {event.isAd && (
                                                    <span className="rounded-full bg-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                                                        ad
                                                    </span>
                                                )}
                                            </div>
                                            <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                                                {event.rawLog}
                                            </pre>
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

function normaliseServerEvent(event: ServerLogEvent): LogEvent {
    const timestamp = event.timestamp || new Date().toISOString()
    const device = event.device || 'unknown'
    const id = event.id || `${device}-${timestamp}`
    const deviceName = event.device_name || device
    const adSource = event.ad_source || 'unknown'
    const adFormat = event.ad_format || 'unknown'
    const rawLog = event.raw_log || ''

    return {
        id,
        timestamp,
        device,
        deviceName,
        adSource,
        adFormat,
        rawLog,
        metadata: event.metadata,
        agentId: event.agentId,
        agentName: event.agentName,
        isAd: Boolean(event.isAd)
    }
}
