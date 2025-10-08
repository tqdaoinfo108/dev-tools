import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET() {
    try {
        // Chạy lệnh adb devices để lấy danh sách thiết bị
        const { stdout, stderr } = await execAsync('adb devices')
        
        if (stderr && !stderr.includes('daemon started')) {
            return NextResponse.json({ 
                success: false, 
                error: `ADB error: ${stderr}` 
            })
        }

        // Parse output để lấy danh sách thiết bị
        const lines = stdout.split('\n').filter(line => 
            line.trim() && 
            !line.includes('List of devices') && 
            !line.includes('daemon started')
        )
        
        const devices = lines.map(line => {
            const parts = line.trim().split('\t')
            return parts[0] // Device ID
        }).filter(id => id && id !== 'device')

        return NextResponse.json({ 
            success: true, 
            devices 
        })
    } catch (error: any) {
        return NextResponse.json({ 
            success: false, 
            error: `Failed to get devices: ${error.message}` 
        })
    }
}
