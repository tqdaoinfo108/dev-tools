#!/usr/bin/env node

/**
 * Android Logcat Agent
 * --------------------
 * Chạy script này trên máy local đang cắm thiết bị Android.
 * Agent sẽ:
 * 1. Poll danh sách thiết bị từ `adb devices`
 * 2. Spawn `adb -s <serial> logcat -v time`
 * 3. Tìm các dòng chứa ad_impression / ad_platform
 * 4. Gửi log tới server qua Socket.IO (`/api/android-logcat/ws`)
 */

const { spawn, exec } = require('child_process')
const readline = require('readline')
const os = require('os')
const { io } = require('socket.io-client')
const http = require('http')
const https = require('https')

const DEFAULT_PATH = '/api/android-logcat/ws'
const rawServerUrl = process.env.LOGCAT_SERVER_URL || `http://localhost:3000${DEFAULT_PATH}`
const AGENT_ID = process.env.LOGCAT_AGENT_ID || os.hostname()
const AGENT_NAME = process.env.LOGCAT_AGENT_NAME || AGENT_ID
const DEVICE_POLL_INTERVAL_MS = Number(process.env.LOGCAT_DEVICE_POLL_MS || 5000)
const RECONNECT_MAX_DELAY_MS = Number(process.env.LOGCAT_RECONNECT_MAX_MS || 30_000)

const devices = new Map() // serial -> { serial, name, process, rl }
const pendingEvents = []
let socket = null
let socketPath = DEFAULT_PATH
let socketOrigin = 'http://localhost:3000'
let ensureRoutePromise = null

initialiseServerUrl()

function initialiseServerUrl() {
    try {
        const url = new URL(rawServerUrl)
        socketOrigin = `${url.protocol}//${url.host}`
        socketPath = normalisePath(url.pathname && url.pathname !== '/' ? url.pathname : DEFAULT_PATH)
    } catch (error) {
        log(`Invalid LOGCAT_SERVER_URL "${rawServerUrl}", fallback to ${socketOrigin}${socketPath}:`, error.message)
        socketOrigin = 'http://localhost:3000'
        socketPath = DEFAULT_PATH
    }
}

function normalisePath(pathname) {
    if (!pathname.startsWith('/')) {
        pathname = `/${pathname}`
    }
    return pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname
}

function log(...args) {
    console.log('[logcat-agent]', ...args)
}

async function ensureSocketRoute() {
    if (ensureRoutePromise) return ensureRoutePromise

    ensureRoutePromise = new Promise((resolve) => {
        try {
            const target = new URL(socketPath, socketOrigin)
            const client = target.protocol === 'https:' ? https : http
            const request = client.get(
                {
                    hostname: target.hostname,
                    port: target.port || (target.protocol === 'https:' ? 443 : 80),
                    path: target.pathname + target.search,
                    timeout: 3000
                },
                (res) => {
                    res.resume()
                    res.on('end', resolve)
                }
            )
            request.on('error', (err) => {
                log('Failed to initialise socket route:', err.message)
                resolve()
            })
            request.on('timeout', () => {
                request.destroy(new Error('Request timeout'))
                resolve()
            })
        } catch (error) {
            log('Failed to prepare socket route:', error.message)
            resolve()
        }
    })

    await ensureRoutePromise
}

function connectSocket() {
    if (socket) {
        try {
            socket.removeAllListeners()
            socket.disconnect()
        } catch {
            // ignore
        }
    }

    socket = io(socketOrigin, {
        path: socketPath,
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: RECONNECT_MAX_DELAY_MS
    })

    socket.on('connect', () => {
        log(`Socket connected (${socket.id})`)
        emitAgentHello()
        flushPendingEvents()
    })

    socket.on('disconnect', (reason) => {
        log(`Socket disconnected: ${reason}`)
    })

    socket.on('connect_error', (error) => {
        log('Socket connect error:', error.message)
    })

    socket.on('reconnect_attempt', (attempt) => {
        log(`Reconnecting... attempt ${attempt}`)
    })

    socket.on('agent:ack', (payload) => {
        log(`Server acknowledged agent ${payload?.agentId ?? ''}`)
    })

    socket.on('server:error', (payload) => {
        log('Server error:', payload?.message ?? 'unknown')
    })
}

function emitAgentHello() {
    if (!socket?.connected) return
    socket.emit('agent:hello', {
        agentId: AGENT_ID,
        agentName: AGENT_NAME,
        devices: getDevicePayload()
    })
}

function emitDeviceUpdate() {
    if (!socket?.connected) return
    socket.emit('agent:devices', {
        devices: getDevicePayload()
    })
}

function queueEvent(event) {
    if (socket?.connected) {
        socket.emit('agent:event', event)
    } else {
        pendingEvents.push(event)
    }
}

function flushPendingEvents() {
    while (socket?.connected && pendingEvents.length > 0) {
        const event = pendingEvents.shift()
        socket.emit('agent:event', event)
    }
}

function getDevicePayload() {
    return Array.from(devices.values()).map((device) => ({
        serial: device.serial,
        name: device.name
    }))
}

async function synchronizeDevices() {
    let serials = []
    try {
        serials = await listAdbDevices()
    } catch (error) {
        log('Failed to list devices:', error.message)
        return
    }

    const serialSet = new Set(serials)
    let changed = false

    for (const serial of serials) {
        if (!devices.has(serial)) {
            changed = true
            const name = await resolveDeviceName(serial)
            startLogcat(serial, name)
        }
    }

    for (const serial of Array.from(devices.keys())) {
        if (!serialSet.has(serial)) {
            changed = true
            stopLogcat(serial)
        }
    }

    if (changed) {
        emitDeviceUpdate()
    }
}

function listAdbDevices() {
    return new Promise((resolve, reject) => {
        exec('adb devices', (error, stdout, stderr) => {
            if (error) {
                reject(error)
                return
            }

            if (stderr && !stderr.toLowerCase().includes('daemon')) {
                log('adb devices stderr:', stderr.trim())
            }

            const serials = stdout
                .split('\n')
                .map((line) => line.trim())
                .filter(
                    (line) =>
                        line &&
                        !line.toLowerCase().startsWith('list of devices') &&
                        !line.toLowerCase().includes('daemon')
                )
                .map((line) => line.split('\t'))
                .filter((parts) => parts.length === 2 && parts[1] === 'device')
                .map(([serial]) => serial)

            resolve(serials)
        })
    })
}

function resolveDeviceName(serial) {
    const execShell = (prop) =>
        new Promise((resolve) => {
            exec(`adb -s ${serial} shell getprop ${prop}`, (error, stdout) => {
                if (error) {
                    resolve('')
                } else {
                    resolve((stdout || '').trim())
                }
            })
        })

    return Promise.all([
        execShell('ro.product.manufacturer'),
        execShell('ro.product.model')
    ]).then(([manufacturer, model]) => {
        if (manufacturer && model) return `${manufacturer} ${model}`
        if (model) return model
        if (manufacturer) return `${manufacturer} ${serial}`
        return serial
    })
}

function startLogcat(serial, name) {
    log(`Starting logcat for ${serial} (${name})`)
    const child = spawn('adb', ['-s', serial, 'logcat', '-v', 'time'], {
        stdio: ['ignore', 'pipe', 'pipe']
    })

    const rl = readline.createInterface({ input: child.stdout })

    const deviceEntry = {
        serial,
        name,
        process: child,
        rl
    }

    devices.set(serial, deviceEntry)

    rl.on('line', (line) => handleLogLine(serial, name, line))

    child.stderr.on('data', (chunk) => {
        log(`logcat stderr [${serial}]:`, chunk.toString().trim())
    })

    child.on('exit', (code, signal) => {
        log(`logcat process for ${serial} exited (code=${code} signal=${signal})`)
        rl.close()
        if (devices.has(serial)) {
            setTimeout(() => {
                if (devices.has(serial)) {
                    startLogcat(serial, name)
                }
            }, 1000)
        }
    })
}

function stopLogcat(serial) {
    const entry = devices.get(serial)
    if (!entry) return

    log(`Stopping logcat for ${serial}`)
    devices.delete(serial)

    try {
        entry.rl.close()
    } catch {
        // ignore
    }

    try {
        if (entry.process && !entry.process.killed) {
            entry.process.kill('SIGTERM')
        }
    } catch {
        // ignore
    }
}

function handleLogLine(serial, deviceName, line) {
    if (!line) return
    const containsAd = /ad_impression|ad_platform/i.test(line)
    const metadata = extractJson(line)

    queueEvent({
        timestamp: new Date().toISOString(),
        device: serial,
        device_name: deviceName,
        raw_log: line,
        metadata: metadata || undefined,
        contains_ad: containsAd
    })
}

function extractJson(line) {
    const match = line.match(/\{.*?\}/)
    if (!match) return null
    try {
        return JSON.parse(match[0])
    } catch {
        return null
    }
}

function shutdown() {
    log('Shutting down agent...')
    if (socket) {
        try {
            socket.disconnect()
        } catch {
            // ignore
        }
    }
    for (const serial of Array.from(devices.keys())) {
        stopLogcat(serial)
    }
    process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

;(async () => {
    await ensureSocketRoute()
    connectSocket()
    synchronizeDevices()
    const poller = setInterval(synchronizeDevices, DEVICE_POLL_INTERVAL_MS)
    poller.unref?.()
})()
