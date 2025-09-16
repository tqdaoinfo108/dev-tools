// app/api/aab-to-apk/route.ts
import { NextRequest } from 'next/server'
import { createReadStream, promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'

export const runtime = 'nodejs'
export const config = { api: { bodySizeLimit: '500mb' } }

async function exists(p: string) { try { await fs.access(p); return true } catch { return false } }
async function isDir(p: string) { try { return (await fs.stat(p)).isDirectory() } catch { return false } }

async function findBundletoolInFolder(dir: string) {
    const files = await fs.readdir(dir).catch(() => [])
    const hit = files.find(f => /^bundletool(-all)?-.*\.jar$/i.test(f))
    return hit ? path.join(dir, hit) : null
}
const stripQuotes = (s?: string | null) => s?.replace(/^["']|["']$/g, '') ?? ''

async function resolveBundletoolPath(form: FormData) {
    const fromForm = stripQuotes(form.get('bundletoolPath') as string | null)
    if (fromForm) {
        if (await isDir(fromForm)) {
            const picked = await findBundletoolInFolder(fromForm)
            if (picked) return picked
        }
        return fromForm
    }
    const fromEnv = stripQuotes(process.env.BUNDLETOOL_JAR)
    if (fromEnv) {
        if (await isDir(fromEnv)) {
            const picked = await findBundletoolInFolder(fromEnv)
            if (picked) return picked
        }
        return fromEnv
    }
    const binDir = path.join(process.cwd(), 'bin')
    const picked = await findBundletoolInFolder(binDir)
    if (picked) return picked
    return path.join(binDir, 'bundletool-all-1.15.6.jar')
}

function run(cmd: string, args: string[], opts?: { cwd?: string }) {
    return new Promise<void>((resolve, reject) => {
        const ps = spawn(cmd, args, { cwd: opts?.cwd, stdio: 'inherit' })
        ps.on('error', reject)
        ps.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)))
    })
}

type DeviceSpec = {
    supportedAbis?: string[]
    supportedLocales?: string[]
    screenDensity?: number
    sdkVersion?: number
    deviceFeatures?: string[]
}

async function resolveDeviceSpec(form: FormData, tmpDir: string): Promise<{ path?: string, json?: DeviceSpec, reason?: string }> {
    // 1) Nếu upload file deviceSpec
    const dsFile = form.get('deviceSpec') as File | null
    if (dsFile) {
        const buf = Buffer.from(await dsFile.arrayBuffer())
        const p = path.join(tmpDir, 'device.json')
        await fs.writeFile(p, buf)
        return { path: p }
    }

    // 2) Nếu gửi deviceSpecJson (string JSON)
    const dsJsonStr = (form.get('deviceSpecJson') as string | null)?.trim()
    if (dsJsonStr) {
        try {
            const obj = JSON.parse(dsJsonStr) as DeviceSpec
            const p = path.join(tmpDir, 'device.json')
            await fs.writeFile(p, JSON.stringify(obj))
            return { path: p, json: obj }
        } catch {
            return { reason: 'deviceSpecJson không phải JSON hợp lệ' }
        }
    }

    // 3) Tự lắp từ các field rời: abi, locales, density, sdk
    const abiStr = (form.get('abi') as string | null)?.trim() // vd: "arm64-v8a,armeabi-v7a"
    const localesStr = (form.get('locales') as string | null)?.trim() // "en,vi"
    const density = Number((form.get('density') as string | null) ?? '')
    const sdk = Number((form.get('sdk') as string | null) ?? '')
    const spec: DeviceSpec = {}

    if (abiStr) spec.supportedAbis = abiStr.split(',').map(s => s.trim()).filter(Boolean)
    if (localesStr) spec.supportedLocales = localesStr.split(',').map(s => s.trim()).filter(Boolean)
    if (!Number.isNaN(density) && density > 0) spec.screenDensity = density
    if (!Number.isNaN(sdk) && sdk > 0) spec.sdkVersion = sdk

    if (Object.keys(spec).length === 0) {
        return { reason: 'Thiếu device spec (hãy truyền deviceSpec file / deviceSpecJson hoặc ít nhất abi/density/sdk/locales)' }
    }

    const p = path.join(tmpDir, 'device.json')
    await fs.writeFile(p, JSON.stringify(spec))
    return { path: p, json: spec }
}

export async function POST(req: NextRequest) {
    let tmpDir = ''
    try {
        const form = await req.formData()
        const file = form.get('file') as File | null
        const mode = ((form.get('mode') as string) || 'universal').toLowerCase() // 'universal' | 'device'
        if (!file) return new Response(JSON.stringify({ error: 'Missing file' }), { status: 400 })
        if (!file.name.toLowerCase().endsWith('.aab')) {
            return new Response(JSON.stringify({ error: 'File must be .aab' }), { status: 400 })
        }

        // bundletool jar
        const bundletoolPath = await resolveBundletoolPath(form)
        if (!(await exists(bundletoolPath))) {
            return new Response(JSON.stringify({
                error: 'Bundletool JAR not found',
                bundletoolPath,
                hint: 'Truyền FormData "bundletoolPath" (file .jar hoặc folder chứa jar) hoặc set ENV BUNDLETOOL_JAR.'
            }), { status: 500, headers: { 'Content-Type': 'application/json' } })
        }

        // chuẩn bị temp
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aab2apk-'))
        const aabPath = path.join(tmpDir, file.name.replace(/[^\w.\-]/g, 'aab'))
        const apksPath = path.join(tmpDir, `out-${crypto.randomBytes(4).toString('hex')}.apks`)
        const workDir = path.join(tmpDir, 'work')
        await fs.mkdir(workDir)
        await fs.writeFile(aabPath, Buffer.from(await file.arrayBuffer()))

        if (mode === 'universal') {
            // UNIVERSAL => TO, nhưng nặng
            await run('java', ['-jar', bundletoolPath, 'build-apks', '--bundle', aabPath, '--output', apksPath, '--mode', 'universal'])
            // extract .apks -> jar xf
            await run('jar', ['xf', apksPath], { cwd: workDir })
            // lấy universal.apk
            let apkFile = 'universal.apk'
            const files = await fs.readdir(workDir)
            if (!files.includes(apkFile)) {
                const firstApk = files.find(f => f.toLowerCase().endsWith('.apk'))
                if (!firstApk) throw new Error('No APK found in .apks')
                apkFile = firstApk
            }
            const buf = await fs.readFile(path.join(workDir, apkFile))
            await fs.rm(tmpDir, { recursive: true, force: true })

            return new Response(new Uint8Array(buf), {
                status: 200,
                headers: {
                    'Content-Type': 'application/vnd.android.package-archive',
                    'Content-Disposition': `attachment; filename="${apkFile}"`,
                    'Cache-Control': 'no-store',
                },
            })
        }

        // mode === 'device' -> build splits + extract cho thiết bị
        const spec = await resolveDeviceSpec(form, tmpDir)
        if (!spec.path) {
            return new Response(JSON.stringify({ error: spec.reason || 'Missing device spec' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        }

        // 1) build-apks (default splits, KHÔNG universal)
        await run('java', ['-jar', bundletoolPath, 'build-apks', '--bundle', aabPath, '--output', apksPath])

        // 2) extract-apks theo device spec
        const extractDir = path.join(tmpDir, 'extracted')
        await fs.mkdir(extractDir)
        await run('java', ['-jar', bundletoolPath, 'extract-apks', '--apks', apksPath, '--output-dir', extractDir, '--device-spec', spec.path])

        // 3) nếu chỉ có 1 APK -> trả thẳng; nếu nhiều -> ZIP bằng jar
        const outFiles = (await fs.readdir(extractDir)).filter(f => f.toLowerCase().endsWith('.apk'))
        if (outFiles.length === 0) throw new Error('No APK extracted for given device-spec')

        if (outFiles.length === 1) {
            const single = outFiles[0]
            const buf = await fs.readFile(path.join(extractDir, single))
            await fs.rm(tmpDir, { recursive: true, force: true })

            return new Response(new Uint8Array(buf), {
                status: 200,
                headers: {
                    'Content-Type': 'application/vnd.android.package-archive',
                    'Content-Disposition': `attachment; filename="${single}"`,
                    'Cache-Control': 'no-store',
                    'X-AAB2APK-Mode': 'device-single'
                },
            })
        }


        // Nhiều split -> nén lại
        const zipName = `device-apks-${crypto.randomBytes(3).toString('hex')}.zip`
        const zipPath = path.join(tmpDir, zipName)
        await run('jar', ['cf', zipPath, '.'], { cwd: extractDir })
        const zipBuf = await fs.readFile(zipPath)
        await fs.rm(tmpDir, { recursive: true, force: true })

        const stream = createReadStream(zipPath)
        return new Response(stream as any, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="archive.zip"`,
            },
        })
    } catch (err: any) {
        if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true })
        return new Response(JSON.stringify({
            error: err?.message || 'Convert failed',
            hint: err?.message?.includes('Unable to access jarfile')
                ? 'bundletoolPath trỏ sai file .jar hoặc không có quyền truy cập.'
                : undefined
        }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
}
