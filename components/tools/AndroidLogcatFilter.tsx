'use client'
import * as React from 'react'
import { Button } from '@/components/ui/Button'
import { LiteInput } from '../ui/LineInput'
import { Terminal, Play, Square, Download, Trash2, Filter, Clock, Smartphone } from 'lucide-react'

type LogEntry = {
    timestamp: string
    level: string
    tag: string
    message: string
    pid?: string
    tid?: string
}

type AdImpression = {
    deviceName: string
    adSource: string
    adFormat: string
    rawEvent: string
    timestamp: string
    currency?: string
    value?: number
    country?: string
    sessionId?: string
    eventTimestamp?: number
    level?: number
    modeGame?: string
    stage?: number
}

type LogcatFilter = {
    tag: string
    level: string
    package: string
    message: string
    pid: string
    tid: string
}

export const AndroidLogcatFilter: React.FC = () => {
    const [isRunning, setIsRunning] = React.useState(false)
    const [logs, setLogs] = React.useState<LogEntry[]>([])
    const [adImpressions, setAdImpressions] = React.useState<AdImpression[]>([])
    const [filter, setFilter] = React.useState<LogcatFilter>({
        tag: '',
        level: '',
        package: '',
        message: '',
        pid: '',
        tid: ''
    })
    const [maxLines, setMaxLines] = React.useState(1000)
    const [autoScroll, setAutoScroll] = React.useState(true)
    const [deviceId, setDeviceId] = React.useState('')
    const [availableDevices, setAvailableDevices] = React.useState<string[]>([])
    const [error, setError] = React.useState('')
    const [deviceNames, setDeviceNames] = React.useState<Record<string, string>>({})

    // Lấy danh sách thiết bị
    const fetchDevices = async () => {
        try {
            const response = await fetch('/api/android-logcat/devices')
            const data = await response.json()
            if (data.success) {
                setAvailableDevices(data.devices || [])
                // Tạo tên thiết bị mặc định
                const names: Record<string, string> = {}
                data.devices.forEach((device: string, index: number) => {
                    names[device] = `Device ${index + 1}`
                })
                setDeviceNames(names)
            }
        } catch (err) {
            console.error('Failed to fetch devices:', err)
        }
    }

    // Parse ad impression từ log message
    const parseAdImpression = (log: LogEntry): AdImpression | null => {
        try {
            // Tìm JSON trong message
            const jsonMatch = log.message.match(/\{.*\}/)
            if (!jsonMatch) return null

            const jsonStr = jsonMatch[0]
            const adData = JSON.parse(jsonStr)

            // Kiểm tra nếu có các field cần thiết cho ad impression
            if (adData.ad_platform || adData.ad_source || adData.ad_format) {
                const deviceName = deviceNames[deviceId] || `Device ${deviceId.slice(-4)}`
                
                return {
                    deviceName,
                    adSource: adData.ad_source || 'unknown',
                    adFormat: adData.ad_format || 'unknown',
                    rawEvent: log.message,
                    timestamp: log.timestamp,
                    currency: adData.currency,
                    value: adData.value,
                    country: adData.country,
                    sessionId: adData.session_id,
                    eventTimestamp: adData.event_timestamp,
                    level: adData.level,
                    modeGame: adData.mode_game,
                    stage: adData.stage
                }
            }
        } catch (error) {
            // Không phải JSON hợp lệ hoặc không phải ad impression
        }
        return null
    }

    // Bắt đầu logcat
    const startLogcat = () => {
        if (isRunning) return

        setIsRunning(true)
        setError('')
        setLogs([])
        setAdImpressions([])

        // Bắt đầu nhận logs qua Server-Sent Events
        startLogStreaming()
    }

    // Dừng logcat
    const stopLogcat = () => {
        if (!isRunning) return

        // Đóng EventSource
        if ((window as any).logcatEventSource) {
            (window as any).logcatEventSource.close()
            ;(window as any).logcatEventSource = null
        }
        
        setIsRunning(false)
    }

    // Nhận logs từ server
    const startLogStreaming = () => {
        const params = new URLSearchParams()
        if (deviceId) params.append('deviceId', deviceId)
        params.append('maxLines', maxLines.toString())
        
        const streamUrl = `/api/android-logcat/stream?${params.toString()}`
        const eventSource = new EventSource(streamUrl)
        
        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                
                // Kiểm tra nếu có lỗi
                if (data.error) {
                    setError(data.error)
                    setIsRunning(false)
                    return
                }
                
                const logEntry: LogEntry = data
                setLogs(prev => {
                    const newLogs = [...prev, logEntry]
                    // Giới hạn số dòng
                    if (newLogs.length > maxLines) {
                        return newLogs.slice(-maxLines)
                    }
                    return newLogs
                })

                // Kiểm tra nếu log có chứa ad impression data
                const adImpression = parseAdImpression(logEntry)
                if (adImpression) {
                    setAdImpressions(prevImpressions => {
                        const newImpressions = [...prevImpressions, adImpression]
                        return newImpressions.slice(-100) // Giới hạn 100 ad impressions
                    })
                }
            } catch (err) {
                console.error('Failed to parse log entry:', err)
            }
        }

        eventSource.onerror = (error) => {
            console.error('EventSource error:', error)
            setError('Connection lost. Please check your device connection.')
            eventSource.close()
            setIsRunning(false)
        }

        // Lưu reference để có thể đóng sau
        ;(window as any).logcatEventSource = eventSource
    }

    // Xóa logs
    const clearLogs = () => {
        setLogs([])
        setAdImpressions([])
    }

    // Xuất logs
    const exportLogs = () => {
        const logText = logs.map(log => 
            `${log.timestamp} ${log.level}/${log.tag}(${log.pid || '?'}): ${log.message}`
        ).join('\n')
        
        const blob = new Blob([logText], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `logcat-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`
        document.body.appendChild(a)
        a.click()
        URL.revokeObjectURL(url)
        a.remove()
    }

    // Lọc logs hiển thị
    const filteredLogs = React.useMemo(() => {
        return logs.filter(log => {
            if (filter.tag && !log.tag.toLowerCase().includes(filter.tag.toLowerCase())) return false
            if (filter.level && log.level !== filter.level) return false
            if (filter.message && !log.message.toLowerCase().includes(filter.message.toLowerCase())) return false
            if (filter.pid && log.pid !== filter.pid) return false
            if (filter.tid && log.tid !== filter.tid) return false
            return true
        })
    }, [logs, filter])

    // Auto scroll
    const logContainerRef = React.useRef<HTMLDivElement>(null)
    React.useEffect(() => {
        if (autoScroll && logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
        }
    }, [filteredLogs, autoScroll])

    // Load devices khi component mount
    React.useEffect(() => {
        fetchDevices()
    }, [])

    // Cleanup khi component unmount hoặc chuyển tab
    React.useEffect(() => {
        const handleBeforeUnload = () => {
            if ((window as any).logcatEventSource) {
                (window as any).logcatEventSource.close()
                ;(window as any).logcatEventSource = null
            }
        }

        const handleVisibilityChange = () => {
            if (document.hidden && (window as any).logcatEventSource) {
                (window as any).logcatEventSource.close()
                ;(window as any).logcatEventSource = null
                setIsRunning(false)
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            if ((window as any).logcatEventSource) {
                (window as any).logcatEventSource.close()
                ;(window as any).logcatEventSource = null
            }
        }
    }, [])

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'E': return 'text-red-600 dark:text-red-400'
            case 'W': return 'text-yellow-600 dark:text-yellow-400'
            case 'I': return 'text-blue-600 dark:text-blue-400'
            case 'D': return 'text-green-600 dark:text-green-400'
            case 'V': return 'text-gray-600 dark:text-gray-400'
            default: return 'text-gray-600 dark:text-gray-400'
        }
    }

    const getAdSourceColor = (source: string) => {
        switch (source.toLowerCase()) {
            case 'admob': return 'text-blue-600 dark:text-blue-400'
            case 'facebook': return 'text-indigo-600 dark:text-indigo-400'
            case 'unity': return 'text-purple-600 dark:text-purple-400'
            case 'ironsource': return 'text-orange-600 dark:text-orange-400'
            case 'applovin': return 'text-green-600 dark:text-green-400'
            default: return 'text-gray-600 dark:text-gray-400'
        }
    }

    const getAdFormatColor = (format: string) => {
        switch (format.toLowerCase()) {
            case 'banner': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
            case 'interstitial': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            case 'rewarded': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
            case 'native': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
        }
    }

    return (
        <div className="h-full flex flex-col min-h-0 space-y-4">
            {/* Header Controls */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    Android Logcat Filter
                </h3>

                {/* Device Selection */}
                <div className="grid md:grid-cols-2 gap-3 mb-4">
                    <div>
                        <label className="text-xs text-slate-600 dark:text-slate-300">Thiết bị</label>
                        <div className="flex gap-2">
                            <select
                                value={deviceId}
                                onChange={(e) => setDeviceId(e.target.value)}
                                className="mt-1 flex-1 h-9 rounded-md border border-slate-300 bg-white text-slate-900 text-sm px-2"
                            >
                                <option value="">Tự động chọn</option>
                                {availableDevices.map(device => (
                                    <option key={device} value={device}>{device}</option>
                                ))}
                            </select>
                            <Button onClick={fetchDevices} variant="secondary" size="sm">
                                <Smartphone className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-slate-600 dark:text-slate-300">Số dòng tối đa</label>
                        <LiteInput
                            type="number"
                            value={maxLines}
                            onChange={(e) => setMaxLines(Number(e.target.value))}
                            className="mt-1 h-9 px-3 rounded-md border border-slate-300 bg-white text-slate-900"
                        />
                    </div>
                </div>

                {/* Filter Controls */}
                <div className="grid md:grid-cols-3 gap-3 mb-4">
                    <div>
                        <label className="text-xs text-slate-600 dark:text-slate-300">Tag</label>
                        <LiteInput
                            value={filter.tag}
                            onChange={(e) => setFilter(prev => ({ ...prev, tag: e.target.value }))}
                            placeholder="Ví dụ: MyApp"
                            className="mt-1 h-9 px-3 rounded-md border border-slate-300 bg-white text-slate-900"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-600 dark:text-slate-300">Level</label>
                        <select
                            value={filter.level}
                            onChange={(e) => setFilter(prev => ({ ...prev, level: e.target.value }))}
                            className="mt-1 w-full h-9 rounded-md border border-slate-300 bg-white text-slate-900 text-sm px-2"
                        >
                            <option value="">Tất cả</option>
                            <option value="V">Verbose</option>
                            <option value="D">Debug</option>
                            <option value="I">Info</option>
                            <option value="W">Warning</option>
                            <option value="E">Error</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-600 dark:text-slate-300">Message</label>
                        <LiteInput
                            value={filter.message}
                            onChange={(e) => setFilter(prev => ({ ...prev, message: e.target.value }))}
                            placeholder="Tìm kiếm trong message"
                            className="mt-1 h-9 px-3 rounded-md border border-slate-300 bg-white text-slate-900"
                        />
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 items-center">
                    <Button 
                        onClick={isRunning ? stopLogcat : startLogcat}
                        disabled={!availableDevices.length && !deviceId}
                        className={isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                    >
                        {isRunning ? (
                            <>
                                <Square className="w-4 h-4 mr-2" />
                                Dừng
                            </>
                        ) : (
                            <>
                                <Play className="w-4 h-4 mr-2" />
                                Bắt đầu
                            </>
                        )}
                    </Button>
                    
                    <Button onClick={clearLogs} variant="secondary" disabled={!logs.length}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Xóa
                    </Button>
                    
                    <Button onClick={exportLogs} variant="secondary" disabled={!logs.length}>
                        <Download className="w-4 h-4 mr-2" />
                        Xuất
                    </Button>

                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={autoScroll}
                            onChange={(e) => setAutoScroll(e.target.checked)}
                            className="rounded"
                        />
                        Auto scroll
                    </label>

                    <span className="text-sm text-slate-600 dark:text-slate-300">
                        {filteredLogs.length} / {logs.length} logs
                    </span>
                </div>

                {error && (
                    <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded text-red-700 dark:text-red-300 text-sm">
                        {error}
                    </div>
                )}
            </div>

            {/* Ad Impressions Table */}
            {adImpressions.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                Ad Impressions ({adImpressions.length})
                            </h4>
                            <Button 
                                onClick={() => setAdImpressions([])} 
                                variant="secondary" 
                                size="sm"
                            >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Clear
                            </Button>
                        </div>
                    </div>
                    
                    <div className="overflow-auto max-h-64">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300">Device</th>
                                    <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300">Ad Source</th>
                                    <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300">Format</th>
                                    <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300">Value</th>
                                    <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300">Country</th>
                                    <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {adImpressions.map((impression, index) => (
                                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                                            {impression.deviceName}
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className={`font-medium ${getAdSourceColor(impression.adSource)}`}>
                                                {impression.adSource}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAdFormatColor(impression.adFormat)}`}>
                                                {impression.adFormat}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                                            {impression.value ? `${impression.value} ${impression.currency || ''}` : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                                            {impression.country || '-'}
                                        </td>
                                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400 text-xs">
                                            {new Date(impression.timestamp).toLocaleTimeString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Logs Display */}
            <div className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">Logs</h4>
                        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                            <span>V: Verbose</span>
                            <span>D: Debug</span>
                            <span>I: Info</span>
                            <span>W: Warning</span>
                            <span>E: Error</span>
                        </div>
                    </div>
                </div>
                
                <div 
                    ref={logContainerRef}
                    className="h-96 overflow-auto p-4 font-mono text-sm bg-slate-900 text-slate-100"
                >
                    {filteredLogs.length === 0 ? (
                        <div className="text-slate-500 text-center py-8">
                            {isRunning ? 'Đang chờ logs...' : 'Chưa có logs. Nhấn "Bắt đầu" để bắt đầu logcat.'}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredLogs.map((log, index) => (
                                <div key={index} className="flex items-start gap-2 py-1 hover:bg-slate-800/50 rounded">
                                    <span className="text-slate-500 text-xs flex-shrink-0 w-20">
                                        {log.timestamp}
                                    </span>
                                    <span className={`font-bold flex-shrink-0 w-4 ${getLevelColor(log.level)}`}>
                                        {log.level}
                                    </span>
                                    <span className="text-blue-400 flex-shrink-0 w-24 truncate">
                                        {log.tag}
                                    </span>
                                    <span className="text-slate-400 text-xs flex-shrink-0 w-12">
                                        {log.pid || '?'}
                                    </span>
                                    <span className="text-slate-100 flex-1 break-words">
                                        {log.message}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
