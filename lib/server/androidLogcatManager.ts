import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import type { Socket } from 'socket.io'

export type DeviceSummary = {
    serial: string
    name: string
    agentId: string
    agentName: string
    lastSeen: string
}

export type LogEventPayload = {
    id: string
    timestamp: string
    device: string
    device_name: string
    raw_log: string
    metadata?: Record<string, unknown>
    ad_source?: string
    ad_format?: string
    agentId: string
    agentName: string
    isAd: boolean
}

type ClientRole = 'watcher' | 'agent'

type ClientContext = {
    socket: Socket
    role: ClientRole
    agentId?: string
    agentName?: string
    devices: Map<string, DeviceSummary>
    lastSeen: number
}

type AgentDevicePayload = {
    serial: string
    name?: string
}

type AgentHelloPayload = {
    agentId?: string
    agentName?: string
    devices?: AgentDevicePayload[]
}

type AgentEventPayloadIncoming = {
    id?: string
    timestamp?: string
    device?: string
    serial?: string
    device_name?: string
    deviceName?: string
    ad_source?: string
    adSource?: string
    ad_format?: string
    adFormat?: string
    raw_log?: string
    rawLog?: string
    metadata?: Record<string, unknown>
    contains_ad?: boolean
    containsAd?: boolean
}

type AgentDevicesPayload = {
    devices: AgentDevicePayload[]
}

const MAX_EVENTS = 5000

class AndroidLogcatManager extends EventEmitter {
    private sockets = new Map<string, ClientContext>()
    private watchers = new Set<ClientContext>()
    private agents = new Set<ClientContext>()
    private deviceIndex = new Map<string, DeviceSummary>()
    private events: LogEventPayload[] = []
    private eventSeq = 0

    public registerSocket(socket: Socket) {
        const context: ClientContext = {
            socket,
            role: 'watcher',
            devices: new Map(),
            lastSeen: Date.now()
        }

        this.sockets.set(socket.id, context)
        this.watchers.add(context)
        this.sendInit(context)

        socket.on('agent:hello', (payload: AgentHelloPayload) => {
            this.promoteToAgent(context, payload || {})
        })

        socket.on('agent:devices', (payload: AgentDevicesPayload) => {
            if (context.role !== 'agent') return
            this.updateAgentDevices(context, payload?.devices || [])
        })

        socket.on('agent:event', (payload: AgentEventPayloadIncoming | AgentEventPayloadIncoming[]) => {
            if (context.role !== 'agent') return
            this.handleAgentEvent(context, payload)
        })

        socket.on('disconnect', (reason) => {
            console.info(
                `[LogcatManager] socket disconnect (role=${context.role}, agent=${context.agentId ?? 'n/a'}) reason=${
                    reason ?? 'unknown'
                }`
            )
            this.handleDisconnect(context)
        })

        socket.on('error', (error) => {
            console.warn(
                `[LogcatManager] socket error (role=${context.role}, agent=${context.agentId ?? 'n/a'})`,
                error
            )
            this.handleDisconnect(context)
        })
    }

    public getDevices() {
        return {
            devices: this.getDeviceSummaries(),
            error: this.agents.size === 0 ? 'Không có agent nào đang kết nối. Chạy local agent để thu thập log.' : null
        }
    }

    private handleDisconnect(context: ClientContext) {
        this.sockets.delete(context.socket.id)
        if (context.role === 'agent') {
            this.agents.delete(context)
            this.removeAgentDevices(context)
            this.broadcastDevices()
        } else {
            this.watchers.delete(context)
        }
    }

    private sendInit(context: ClientContext) {
        context.socket.emit('init', {
            devices: this.getDeviceSummaries(),
            events: this.events.slice(-MAX_EVENTS)
        })
    }

    private promoteToAgent(context: ClientContext, payload: AgentHelloPayload) {
        context.role = 'agent'
        context.agentId = payload.agentId || randomUUID()
        context.agentName = payload.agentName || context.agentId
        context.devices.clear()

        this.watchers.delete(context)
        this.agents.add(context)

        if (Array.isArray(payload.devices)) {
            this.updateAgentDevices(context, payload.devices)
        }

        context.socket.emit('agent:ack', {
            agentId: context.agentId,
            agentName: context.agentName
        })

        this.broadcastDevices()
    }

    private updateAgentDevices(context: ClientContext, devices: AgentDevicePayload[]) {
        if (!context.agentId || !context.agentName) {
            return
        }

        const now = new Date()
        const incomingSerials = new Set<string>()

        for (const device of devices) {
            if (!device.serial) continue
            incomingSerials.add(device.serial)

            const summary: DeviceSummary = {
                serial: device.serial,
                name: device.name || device.serial,
                agentId: context.agentId,
                agentName: context.agentName,
                lastSeen: now.toISOString()
            }

            context.devices.set(device.serial, summary)
            this.deviceIndex.set(this.deviceKey(context.agentId, device.serial), summary)
        }

        for (const serial of Array.from(context.devices.keys())) {
            if (!incomingSerials.has(serial)) {
                context.devices.delete(serial)
                this.deviceIndex.delete(this.deviceKey(context.agentId, serial))
            }
        }

        this.broadcastDevices()
    }

    private removeAgentDevices(context: ClientContext) {
        if (!context.agentId) return
        for (const serial of context.devices.keys()) {
            this.deviceIndex.delete(this.deviceKey(context.agentId, serial))
        }
        context.devices.clear()
    }

    private handleAgentEvent(
        context: ClientContext,
        payload: AgentEventPayloadIncoming | AgentEventPayloadIncoming[] | undefined
    ) {
        if (!payload) return

        const events = Array.isArray(payload) ? payload : [payload]
        for (const incoming of events) {
            const event = this.normaliseEvent(context, incoming)
            if (!event) continue

            this.events.push(event)
            if (this.events.length > MAX_EVENTS) {
                this.events.splice(0, this.events.length - MAX_EVENTS)
            }

            this.touchDevice(context, event.device, event.device_name)
            this.broadcastToWatchers('ad_event', event)
        }
    }

    private touchDevice(context: ClientContext, serial: string, name: string) {
        if (!context.agentId || !context.agentName || !serial) return

        const summary: DeviceSummary = {
            serial,
            name: name || serial,
            agentId: context.agentId,
            agentName: context.agentName,
            lastSeen: new Date().toISOString()
        }

        context.devices.set(serial, summary)
        this.deviceIndex.set(this.deviceKey(context.agentId, serial), summary)
        this.broadcastDevices()
    }

    private normaliseEvent(context: ClientContext, payload: AgentEventPayloadIncoming): LogEventPayload | null {
        if (!context.agentId || !context.agentName) {
            return null
        }

        const rawLog = payload.raw_log || payload.rawLog
        if (!rawLog) {
            return null
        }

        const timestamp =
            payload.timestamp && !Number.isNaN(Date.parse(payload.timestamp))
                ? payload.timestamp
                : new Date().toISOString()

        const serial = payload.device || payload.serial || 'unknown'
        const deviceName =
            payload.device_name || payload.deviceName || context.devices.get(serial)?.name || serial

        const metadata =
            payload.metadata ||
            this.extractJsonPayload(rawLog) ||
            undefined

        const containsAdFlag = payload.contains_ad ?? payload.containsAd
        const containsAd =
            containsAdFlag !== undefined
                ? Boolean(containsAdFlag)
                : Boolean(
                      (metadata && (metadata['ad_impression'] || metadata['ad_platform'])) ||
                          /ad_impression|ad_platform/i.test(rawLog)
                  )

        const adSource =
            this.inferFromMetadata(metadata, ['ad_source', 'ad_platform', 'network', 'source']) ||
            this.extractFromLine(rawLog, /(ad_(?:source|platform))['"=:\s]+([\w./-]+)/i) ||
            undefined

        const adFormat =
            this.inferFromMetadata(metadata, ['ad_format', 'format', 'placement', 'ad_type']) ||
            this.extractFromLine(rawLog, /(ad_format|format)['"=:\s]+([\w./-]+)/i) ||
            undefined

        return {
            id: payload.id || `${context.agentId}-${serial}-${Date.now()}-${this.eventSeq++}`,
            timestamp,
            device: serial,
            device_name: deviceName,
            raw_log: rawLog,
            metadata: metadata && Object.keys(metadata).length ? metadata : undefined,
            ad_source: adSource,
            ad_format: adFormat,
            agentId: context.agentId,
            agentName: context.agentName,
            isAd: containsAd
        }
    }

    private extractJsonPayload(line: string): Record<string, unknown> | null {
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
            console.warn('[LogcatManager] JSON parse failed', error)
        }

        return null
    }

    private inferFromMetadata(metadata: Record<string, unknown> | undefined, keys: string[]) {
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

    private extractFromLine(line: string, regex: RegExp): string | null {
        const match = line.match(regex)
        if (match && match[2]) {
            return match[2]
        }
        return null
    }

    private broadcastDevices() {
        const payload = this.getDeviceSummaries()
        for (const watcher of this.watchers) {
            watcher.socket.emit('devices', payload)
        }
    }

    private broadcastToWatchers(event: string, payload: unknown) {
        for (const watcher of this.watchers) {
            watcher.socket.emit(event, payload)
        }
    }

    private getDeviceSummaries(): DeviceSummary[] {
        return Array.from(this.deviceIndex.values()).sort((a, b) => {
            const agentCompare = a.agentName.localeCompare(b.agentName)
            if (agentCompare !== 0) return agentCompare
            return a.serial.localeCompare(b.serial)
        })
    }

    private deviceKey(agentId: string, serial: string) {
        return `${agentId}::${serial}`
    }
}

const globalInstance = globalThis as typeof globalThis & {
    __androidLogcatManager?: AndroidLogcatManager
}

if (!globalInstance.__androidLogcatManager) {
    globalInstance.__androidLogcatManager = new AndroidLogcatManager()
}

export const androidLogcatManager = globalInstance.__androidLogcatManager

export type { DeviceSummary as AndroidDeviceSummary, LogEventPayload as AndroidLogEvent }
