import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url)
        const deviceId = url.searchParams.get('deviceId') || ''
        
        // Tạo lệnh adb logcat
        let command = 'adb'
        if (deviceId) {
            command += ` -s ${deviceId}`
        }
        command += ' logcat -d -v time'

        console.log('Running command:', command)
        
        // Chạy lệnh và lấy output
        const { stdout, stderr } = await execAsync(command)
        
        if (stderr) {
            console.error('ADB stderr:', stderr)
        }

        // Parse logs
        const logs = stdout.split('\n').filter(line => line.trim()).map(line => {
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
                
                return {
                    timestamp: new Date().toISOString(),
                    level: 'I',
                    tag: 'Unknown',
                    message: line,
                    pid: '?',
                    tid: '?'
                }
            } catch (error) {
                console.error('Error parsing line:', line, error)
                return null
            }
        }).filter(log => log !== null)

        return NextResponse.json({ 
            success: true, 
            logs,
            command 
        })
    } catch (error: any) {
        return NextResponse.json({ 
            success: false, 
            error: `Failed to get logs: ${error.message}` 
        })
    }
}
