import { NextResponse } from 'next/server'
import { androidLogcatManager } from '@/lib/server/androidLogcatManager'

export async function GET() {
    const { devices, error } = androidLogcatManager.getDevices()
    const agentCount = new Set(
        devices.map((device) => device.agentId).filter((agentId): agentId is string => Boolean(agentId))
    ).size

    return NextResponse.json({
        success: !error,
        error: error ?? undefined,
        isServerEnvironment: true,
        devices: devices.map((device) => device.serial),
        summaries: devices,
        agentCount
    })
}
