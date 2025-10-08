import { NextRequest } from 'next/server'
import { spawn } from 'child_process'

// Store active logcat processes (shared with start route)
const activeProcesses = new Map<string, any>()

export async function GET(request: NextRequest) {
    const encoder = new TextEncoder()
    
    const stream = new ReadableStream({
        start(controller) {
            // Lấy params từ query
            const url = new URL(request.url)
            const deviceId = url.searchParams.get('deviceId') || ''
            const maxLines = parseInt(url.searchParams.get('maxLines') || '1000')
            
            // Tạo lệnh adb logcat
            const args = []
            if (deviceId) {
                args.push('-s', deviceId)
            }
            args.push('logcat', '-d', '-v', 'time')

            console.log('Starting logcat stream with command:', `adb ${args.join(' ')}`)

            // Chạy adb logcat process
            const logcatProcess = spawn('adb', args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true
            })

            // Buffer để lưu logs và giới hạn số dòng
            const logBuffer: string[] = []
            const maxLogLines = maxLines

            // Xử lý output từ logcat
            logcatProcess.stdout.on('data', (data) => {
                console.log('Received data from logcat:', data.toString().substring(0, 100))
                const lines = data.toString().split('\n')
                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            // Parse log line
                            const logEntry = parseLogLine(line)
                            if (logEntry) {
                                console.log('Sending log entry:', logEntry)
                                
                                // Thêm vào buffer
                                logBuffer.push(JSON.stringify(logEntry))
                                
                                // Giới hạn số dòng
                                if (logBuffer.length > maxLogLines) {
                                    logBuffer.shift() // Xóa dòng cũ nhất
                                }
                                
                                // Kiểm tra controller còn mở không trước khi gửi
                                try {
                                    const data = `data: ${JSON.stringify(logEntry)}\n\n`
                                    controller.enqueue(encoder.encode(data))
                                } catch (error) {
                                    console.log('Controller closed, stopping logcat process')
                                    logcatProcess.kill('SIGTERM')
                                    return
                                }
                            }
                        } catch (error) {
                            console.error('Error parsing log line:', error)
                        }
                    }
                }
            })

            logcatProcess.stderr.on('data', (data) => {
                console.error('Logcat stderr:', data.toString())
            })

            logcatProcess.on('error', (error) => {
                console.error('Logcat process error:', error)
                const errorData = `data: ${JSON.stringify({ error: error.message })}\n\n`
                controller.enqueue(encoder.encode(errorData))
            })

            // Gửi test log nếu không có logs sau 5 giây
            const testLogTimeout = setTimeout(() => {
                if (logBuffer.length === 0) {
                    console.log('No logs received, sending test log')
                    const testLog = {
                        timestamp: new Date().toISOString(),
                        level: 'I',
                        tag: 'TestTag',
                        message: 'No logs available. Try generating some activity on your device.',
                        pid: '0',
                        tid: '0'
                    }
                    const data = `data: ${JSON.stringify(testLog)}\n\n`
                    controller.enqueue(encoder.encode(data))
                }
            }, 5000)

            logcatProcess.on('exit', (code) => {
                console.log(`Logcat process exited with code ${code}`)
                clearTimeout(testLogTimeout)
                controller.close()
            })

            // Cleanup khi stream bị đóng
            request.signal.addEventListener('abort', () => {
                logcatProcess.kill('SIGTERM')
                controller.close()
            })
        }
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    })
}

// Parse log line từ adb logcat
function parseLogLine(line: string) {
    try {
        // Format: 10-08 10:58:45.493 I/TestApp (32620): Test log message 1
        const match = line.match(/^(\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+([VDIWE])\/([^(]+)\s+\((\d+)\):\s*(.*)$/)
        
        if (match) {
            const [, timestamp, level, tag, pid, message] = match
            return {
                timestamp: new Date().toISOString().slice(0, 10) + ' ' + timestamp,
                level,
                tag: tag.trim(),
                message: message.trim(),
                pid,
                tid: pid
            }
        }
        
        // Fallback cho format khác
        return {
            timestamp: new Date().toISOString(),
            level: 'I',
            tag: 'Unknown',
            message: line,
            pid: '?',
            tid: '?'
        }
    } catch (error) {
        console.error('Error parsing log line:', error)
        return null
    }
}
