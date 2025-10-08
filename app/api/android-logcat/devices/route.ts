import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET() {
    try {
        // Kiểm tra xem có phải đang chạy trên server không
        const isServer = typeof window === 'undefined'
        
        // Chạy lệnh adb devices để lấy danh sách thiết bị
        const { stdout, stderr } = await execAsync('adb devices')
        
        if (stderr && !stderr.includes('daemon started')) {
            return NextResponse.json({ 
                success: false, 
                error: `ADB error: ${stderr}`,
                isServerEnvironment: isServer
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

        // Nếu không có thiết bị và đang chạy trên server
        if (devices.length === 0 && isServer) {
            return NextResponse.json({ 
                success: false, 
                error: 'Không tìm thấy thiết bị Android. Tool này chỉ hoạt động trên máy local với thiết bị kết nối USB.',
                isServerEnvironment: true,
                devices: []
            })
        }

        return NextResponse.json({ 
            success: true, 
            devices,
            isServerEnvironment: isServer
        })
    } catch (error: any) {
        // Kiểm tra nếu lỗi là do không tìm thấy adb command
        if (error.message.includes('adb') || error.message.includes('not found')) {
            return NextResponse.json({ 
                success: false, 
                error: 'ADB không được cài đặt hoặc không có trong PATH. Tool này chỉ hoạt động trên máy local.',
                isServerEnvironment: true
            })
        }
        
        return NextResponse.json({ 
            success: false, 
            error: `Failed to get devices: ${error.message}`,
            isServerEnvironment: typeof window === 'undefined'
        })
    }
}
