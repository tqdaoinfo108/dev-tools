// app/api/apk-analyzer/route.ts
import { NextRequest } from 'next/server'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

export const runtime = 'nodejs'
export const config = { api: { bodySizeLimit: '500mb' } }

async function exists(p: string) {
  try { await fs.access(p); return true } catch { return false }
}
async function isDir(p: string) {
  try { return (await fs.stat(p)).isDirectory() } catch { return false }
}

async function pickAaptInsideFolder(folder: string) {
  const exe = process.platform === 'win32' ? '.exe' : ''
  const cand1 = path.join(folder, `aapt2${exe}`)
  if (await exists(cand1)) return cand1
  const cand2 = path.join(folder, `aapt${exe}`)
  if (await exists(cand2)) return cand2
  return null
}

async function resolveAaptPath(form: FormData) {
  // 1) Client cung cấp
  const fromForm = (form.get('aaptPath') as string | null)?.trim()
  if (fromForm) {
    // Nếu là folder -> tự nối aapt2/aapt
    if (await isDir(fromForm)) {
      const picked = await pickAaptInsideFolder(fromForm)
      if (picked) return picked
    }
    return fromForm
  }

  // 2) Biến môi trường AAPT_PATH
  if (process.env.AAPT_PATH) {
    const p = process.env.AAPT_PATH!
    if (await isDir(p)) {
      const picked = await pickAaptInsideFolder(p)
      if (picked) return picked
    }
    return p
  }

  // 3) Dò trong SDK
  const SDK = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
  if (SDK) {
    const buildTools = path.join(SDK, 'build-tools')
    try {
      const versions = (await fs.readdir(buildTools, { withFileTypes: true }))
        .filter(d => d.isDirectory())
        .map(d => d.name)
        .sort()
        .reverse() // bản mới trước
      for (const v of versions) {
        const picked = await pickAaptInsideFolder(path.join(buildTools, v))
        if (picked) return picked
      }
    } catch { /* ignore */ }
  }

  // 4) PATH fallback
  return process.platform === 'win32' ? 'aapt.exe' : 'aapt'
}

function run(cmd: string, args: string[]) {
  return new Promise<{ code: number, stdout: string, stderr: string }>((resolve) => {
    let stdout = '', stderr = ''
    const ps = spawn(cmd, args)

    ps.on('error', (err: any) => {
      resolve({ code: 127, stdout: '', stderr: `${err?.message || err}` })
    })
    ps.stdout?.on('data', d => { stdout += d.toString() })
    ps.stderr?.on('data', d => { stderr += d.toString() })
    ps.on('close', code => resolve({ code: code ?? 0, stdout, stderr }))
  })
}

export async function POST(req: NextRequest) {
  let tmp = ''
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return new Response(JSON.stringify({ error: 'Missing file' }), { status: 400 })
    if (!file.name.toLowerCase().endsWith('.apk')) {
      return new Response(JSON.stringify({ error: 'File must be .apk' }), { status: 400 })
    }

    const aaptResolved = await resolveAaptPath(form)
    const aaptExists = await exists(aaptResolved)

    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'apk-anlz-'))
    const apkPath = path.join(tmp, file.name.replace(/[^\w.\-]/g, 'apk'))
    await fs.writeFile(apkPath, Buffer.from(await file.arrayBuffer()))

    const badging = await run(aaptResolved, ['dump', 'badging', apkPath])
    const perms   = await run(aaptResolved, ['dump', 'permissions', apkPath])
    const cfgs    = await run(aaptResolved, ['dump', 'configurations', apkPath])

    await fs.rm(tmp, { recursive: true, force: true })

    const anyNoExec = [badging, perms, cfgs].some(r => r.code === 127)
    if (anyNoExec || !aaptExists) {
      return new Response(JSON.stringify({
        error: 'Cannot execute aapt/aapt2',
        aaptResolved,
        aaptExists,
        hint: 'Hãy truyền FULL PATH tới aapt2.exe (hoặc aapt.exe) hoặc đặt AAPT_PATH/ANDROID_HOME.',
        results: { badging, permissions: perms, configurations: cfgs }
      }), { status: 500, headers: { 'Content-Type': 'application/json' }})
    }

    return new Response(JSON.stringify({
      ok: true,
      aaptResolved,
      aaptExists,
      badging,
      permissions: perms,
      configurations: cfgs,
    }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }})
  } catch (e: any) {
    if (tmp) await fs.rm(tmp, { recursive: true, force: true })
    return new Response(JSON.stringify({ error: e?.message || 'Analyze failed' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
}
