// app/api/keystore/route.ts
import { NextRequest } from 'next/server'
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

type Body = {
    keystoreName: string
    alias: string
    storepass: string
    keypass?: string
    keysize?: number
    validity?: number
    cn?: string
    ou?: string
    o?: string
    l?: string
    st?: string
    c?: string
}

export async function POST(req: NextRequest) {
    let tmpDir = ''
    try {
        const body = (await req.json()) as Body

        // Validate tối thiểu
        const keystoreName = (body.keystoreName || 'my-release-key.keystore').replace(/[^\w.\-]/g, '')
        const alias = (body.alias || 'my-key-alias').replace(/[^\w.\-]/g, '')
        const storepass = body.storepass || crypto.randomBytes(12).toString('hex')
        const keypass = body.keypass || storepass
        const keysize = Number(body.keysize || 2048)
        const validity = Number(body.validity || 10000)

        // Distinguished Name
        const cn = body.cn || 'My App'
        const ou = body.ou || 'Engineering'
        const o = body.o || 'My Company'
        const l = body.l || 'Hanoi'
        const st = body.st || 'HN'
        const c = body.c || 'VN'
        const dname = `CN=${cn}, OU=${ou}, O=${o}, L=${l}, ST=${st}, C=${c}`

        // Thư mục tạm + tên file
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jks-'))
        const ksPath = path.join(tmpDir, keystoreName)

        // keytool yêu cầu JDK có sẵn trên server
        const args = [
            '-genkeypair',
            '-storetype', 'JKS',
            '-keystore', ksPath,
            '-alias', alias,
            '-keyalg', 'RSA',
            '-keysize', String(keysize),
            '-validity', String(validity),
            '-dname', dname,
            '-storepass', storepass,
            '-keypass', keypass,
            '-noprompt',
        ]

        // Chạy keytool
        await new Promise<void>((resolve, reject) => {
            const ps = spawn('keytool', args, { stdio: 'inherit' })
            ps.on('error', reject)
            ps.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`keytool exited ${code}`))))
        })

        // Đọc file và trả về để tải
        const buf = await fs.readFile(ksPath)
        const headers = new Headers({
            'Content-Type': 'application/x-java-keystore',
            'Content-Disposition': `attachment; filename="${keystoreName}"`,
            'X-Alias': alias,
            // Không trả pass về header nếu bạn không muốn; ở đây **KHÔNG** embed secret
        })
        // Dọn dẹp
        await fs.rm(tmpDir, { recursive: true, force: true })

        return new Response(new Uint8Array(buf), {
            status: 200,
            headers,
        })

    } catch (err: any) {
        if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true })
        return new Response(JSON.stringify({ error: err?.message || 'Failed to generate keystore' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }
}

export async function GET() {
    return new Response('keystore api ok', { status: 200 })
}