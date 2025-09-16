// app/api/openssl/route.ts
import { NextRequest } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'

export const runtime = 'nodejs'
export const config = { api: { bodySizeLimit: '100mb' } }

function getOpenSSLBin(form?: FormData) {
    const fromForm = (form?.get('opensslPath') as string | null)?.trim()
    if (fromForm) return fromForm
    if (process.env.OPENSSL_BIN) return process.env.OPENSSL_BIN
    return process.platform === 'win32' ? 'openssl.exe' : 'openssl'
}

function run(bin: string, args: string[], opts?: { cwd?: string; stdin?: string }) {
    return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
        const ps = spawn(bin, args, { cwd: opts?.cwd, shell: process.platform === 'win32' })
        let stdout = '', stderr = ''
        if (opts?.stdin) ps.stdin.write(opts.stdin)
        if (opts?.stdin) ps.stdin.end()
        ps.stdout.on('data', (d) => { stdout += d.toString() })
        ps.stderr.on('data', (d) => { stderr += d.toString() })
        ps.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
    })
}

async function tmp() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'openssl-tool-'))
    return {
        dir,
        file: (name: string) => path.join(dir, name),
        cleanup: () => fs.rm(dir, { recursive: true, force: true }).catch(() => { }),
    }
}

export async function POST(req: NextRequest) {
    const form = await req.formData()
    const action = (form.get('action') as string | null)?.toLowerCase()
    const openssl = getOpenSSLBin(form)

    const t = await tmp()
    try {
        if (!action) {
            return json({ error: 'Missing action' }, 400)
        }

        // ===== GEN KEY =====
        if (action === 'genkey') {
            const kind = ((form.get('type') as string) || 'rsa').toLowerCase() // 'rsa' | 'ec'
            if (kind === 'rsa') {
                const bits = Number((form.get('bits') as string) || '2048')
                const outKey = t.file('key.pem')
                const r = await run(openssl, ['genpkey', '-algorithm', 'RSA', '-pkeyopt', `rsa_keygen_bits:${bits}`, '-out', outKey])
                if (r.code !== 0) return json({ error: r.stderr || 'OpenSSL genpkey failed' }, 500)
                const buf = await fs.readFile(outKey)
                return file(buf, 'application/x-pem-file', `rsa-${bits}-key.pem`)
            } else {
                // EC: P-256, P-384, P-521
                const curve = (form.get('curve') as string) || 'P-256'
                const curveMap: Record<string, string> = { 'P-256': 'prime256v1', 'P-384': 'secp384r1', 'P-521': 'secp521r1' }
                const opensslCurve = curveMap[curve] || 'prime256v1'
                const outKey = t.file('key.pem')
                const r = await run(openssl, [
                    'genpkey', '-algorithm', 'EC',
                    '-pkeyopt', `ec_paramgen_curve:${opensslCurve}`,
                    '-pkeyopt', 'ec_param_enc:named_curve',
                    '-out', outKey
                ])
                if (r.code !== 0) return json({ error: r.stderr || 'OpenSSL genpkey EC failed' }, 500)
                const buf = await fs.readFile(outKey)
                return file(buf, 'application/x-pem-file', `ec-${curve}-key.pem`)
            }
        }

        // helper: save uploaded text/file to temp
        async function takePemOrFile(keyField: string, textField?: string) {
            const f = form.get(keyField) as File | null
            if (f && f.size > 0) {
                const p = t.file(`${keyField}.pem`)
                await fs.writeFile(p, Buffer.from(await f.arrayBuffer()))
                return p
            }
            if (textField) {
                const txt = (form.get(textField) as string | null) ?? ''
                if (txt.trim()) {
                    const p = t.file(`${keyField}.pem`)
                    await fs.writeFile(p, Buffer.from(txt))
                    return p
                }
            }
            return ''
        }

        function subjFromForm() {
            const C = (form.get('C') as string | null) || ''
            const ST = (form.get('ST') as string | null) || ''
            const L = (form.get('L') as string | null) || ''
            const O = (form.get('O') as string | null) || ''
            const OU = (form.get('OU') as string | null) || ''
            const CN = (form.get('CN') as string | null) || ''
            // Only include non-empty
            const parts = [
                C && `C=${escapeSlash(C)}`,
                ST && `ST=${escapeSlash(ST)}`,
                L && `L=${escapeSlash(L)}`,
                O && `O=${escapeSlash(O)}`,
                OU && `OU=${escapeSlash(OU)}`,
                CN && `CN=${escapeSlash(CN)}`
            ].filter(Boolean)
            return '/' + parts.join('/')
        }
        function escapeSlash(s: string) {
            return s.replace(/\//g, '\\/')
        }

        function buildCnfWithSANs(sansCsv: string) {
            const alt = sansCsv.split(',').map(s => s.trim()).filter(Boolean)
            const altLines = alt.map((v, i) => `DNS.${i + 1} = ${v}`).join('\n')
            return `
[req]
distinguished_name = dn
prompt = no
req_extensions = v3_req

[dn]
# subject filled by -subj

[v3_req]
subjectAltName = @alt_names

[alt_names]
${altLines}
`.trim()
        }

        // ===== CSR =====
        if (action === 'csr') {
            const keyPath = await takePemOrFile('key', 'keyText')
            if (!keyPath) return json({ error: 'Missing key PEM' }, 400)
            const subj = subjFromForm()
            const sans = ((form.get('sans') as string) || '').trim()
            const outCsr = t.file('req.csr')

            if (sans) {
                const cnf = buildCnfWithSANs(sans)
                const cnfPath = t.file('openssl.cnf')
                await fs.writeFile(cnfPath, cnf)
                const r = await run(openssl, ['req', '-new', '-key', keyPath, '-out', outCsr, '-subj', subj, '-sha256', '-reqexts', 'v3_req', '-config', cnfPath])
                if (r.code !== 0) return json({ error: r.stderr || 'OpenSSL req failed' }, 500)
            } else {
                const r = await run(openssl, ['req', '-new', '-key', keyPath, '-out', outCsr, '-subj', subj, '-sha256'])
                if (r.code !== 0) return json({ error: r.stderr || 'OpenSSL req failed' }, 500)
            }

            const buf = await fs.readFile(outCsr)
            return file(buf, 'application/pkcs10', 'request.csr')
        }

        // ===== SELF-SIGNED CERT =====
        if (action === 'selfsign') {
            const keyPath = await takePemOrFile('key', 'keyText')
            if (!keyPath) return json({ error: 'Missing key PEM' }, 400)
            const days = Number((form.get('days') as string) || '365')
            const subj = subjFromForm()
            const sans = ((form.get('sans') as string) || '').trim()
            const outCrt = t.file('cert.pem')

            if (sans) {
                const cnf = buildCnfWithSANs(sans)
                const cnfPath = t.file('openssl.cnf')
                await fs.writeFile(cnfPath, cnf)
                const r = await run(openssl, ['req', '-x509', '-new', '-key', keyPath, '-days', String(days), '-out', outCrt, '-subj', subj, '-sha256', '-extensions', 'v3_req', '-config', cnfPath])
                if (r.code !== 0) return json({ error: r.stderr || 'OpenSSL selfsign failed' }, 500)
            } else {
                const r = await run(openssl, ['req', '-x509', '-new', '-key', keyPath, '-days', String(days), '-out', outCrt, '-subj', subj, '-sha256'])
                if (r.code !== 0) return json({ error: r.stderr || 'OpenSSL selfsign failed' }, 500)
            }

            const buf = await fs.readFile(outCrt)
            return file(buf, 'application/x-pem-file', 'selfsigned.pem')
        }

        // ===== PFX -> PEM (zip) =====
        if (action === 'pfx-to-pem') {
            const pfx = form.get('pfx') as File | null
            const pass = (form.get('password') as string | null) ?? ''
            if (!pfx) return json({ error: 'Missing .p12/.pfx file' }, 400)
            const pfxPath = t.file('in.p12')
            await fs.writeFile(pfxPath, Buffer.from(await pfx.arrayBuffer()))
            const keyPem = t.file('key.pem')
            const certPem = t.file('cert.pem')
            const chainPem = t.file('chain.pem')

            // key
            let r = await run(openssl, ['pkcs12', '-in', pfxPath, '-nodes', '-nocerts', '-out', keyPem, '-passin', `pass:${pass}`])
            if (r.code !== 0) return json({ error: r.stderr || 'pkcs12 key extract failed' }, 500)
            // leaf cert
            r = await run(openssl, ['pkcs12', '-in', pfxPath, '-clcerts', '-nokeys', '-out', certPem, '-passin', `pass:${pass}`])
            if (r.code !== 0) return json({ error: r.stderr || 'pkcs12 cert extract failed' }, 500)
            // chain
            r = await run(openssl, ['pkcs12', '-in', pfxPath, '-cacerts', '-nokeys', '-chain', '-out', chainPem, '-passin', `pass:${pass}`])
            // chain may be empty; ignore r.code

            // zip all
            const zipName = 'pem-bundle.zip'
            const zipPath = t.file(zipName)
            // simple zip via JS (no native zip): concatenate — but better: use a basic store
            // For simplicity we return concatenated PEMs if zip is overkill:
            const bundle = Buffer.concat([
                Buffer.from('-----BEGIN PRIVATE KEY-----\n'), await fs.readFile(keyPem),
            ])
            // Thay vì “hacky”, trả .zip bằng “jar cf” nếu có Java; nếu không, trả .tar
            const java = process.platform === 'win32' ? 'jar.exe' : 'jar'
            const jr = await run(java, ['cf', zipPath, path.basename(keyPem), path.basename(certPem), path.basename(chainPem)], { cwd: t.dir })
            let buf: Buffer
            if (jr.code === 0) {
                buf = await fs.readFile(zipPath)
                return file(buf, 'application/zip', zipName)
            } else {
                // fallback: gộp vào 1 PEM (key + cert + chain)
                const fused = Buffer.concat([
                    await fs.readFile(keyPem),
                    Buffer.from('\n'),
                    await fs.readFile(certPem).catch(() => Buffer.from('')),
                    Buffer.from('\n'),
                    await fs.readFile(chainPem).catch(() => Buffer.from('')),
                ])
                return file(fused, 'application/x-pem-file', 'bundle.pem')
            }
        }

        // ===== PEM -> PFX =====
        if (action === 'pem-to-pfx') {
            const key = await takePemOrFile('key', 'keyText')
            const cert = await takePemOrFile('cert', 'certText')
            if (!key || !cert) return json({ error: 'Missing key or cert PEM' }, 400)
            const chain = await takePemOrFile('chain', 'chainText')
            const pass = (form.get('password') as string | null) ?? ''
            const alias = (form.get('alias') as string | null) || 'mykey'
            const outP12 = t.file('out.p12')
            const args = ['pkcs12', '-export', '-inkey', key, '-in', cert, '-name', alias, '-out', outP12, '-passout', `pass:${pass}`]
            if (chain) args.push('-certfile', chain)
            const r = await run(openssl, args)
            if (r.code !== 0) return json({ error: r.stderr || 'pkcs12 export failed' }, 500)
            const buf = await fs.readFile(outP12)
            return file(buf, 'application/x-pkcs12', 'bundle.p12')
        }

        // ===== X509 INFO =====
        if (action === 'x509-info') {
            const cert = await takePemOrFile('cert', 'certText')
            if (!cert) return json({ error: 'Missing cert' }, 400)
            // text
            const text = await run(openssl, ['x509', '-in', cert, '-noout', '-text'])
            // subject
            const subject = await run(openssl, ['x509', '-in', cert, '-noout', '-subject', '-nameopt', 'RFC2253'])
            // issuer
            const issuer = await run(openssl, ['x509', '-in', cert, '-noout', '-issuer', '-nameopt', 'RFC2253'])
            // dates
            const dates = await run(openssl, ['x509', '-in', cert, '-noout', '-dates'])
            // sha1/sha256 fp
            const sha1 = await run(openssl, ['x509', '-in', cert, '-noout', '-fingerprint', '-sha1'])
            const sha256 = await run(openssl, ['x509', '-in', cert, '-noout', '-fingerprint', '-sha256'])
            return json({
                ok: text.code === 0,
                openssl,
                subject: subject.stdout.trim(),
                issuer: issuer.stdout.trim(),
                dates: dates.stdout.trim(),
                sha1: sha1.stdout.trim(),
                sha256: sha256.stdout.trim(),
                text: text.stdout || text.stderr
            })
        }

        return json({ error: `Unknown action: ${action}` }, 400)
    } catch (e: any) {
        return json({ error: e?.message || 'OpenSSL error', hint: e?.message?.includes('ENOENT') ? 'Thiếu openssl trong PATH, set OPENSSL_BIN hoặc chỉ định opensslPath.' : undefined }, 500)
    } finally {
        await t.cleanup()
    }
}

function file(buf: Buffer, type: string, name: string) {
    return new Response(new Uint8Array(buf), {
        status: 200,
        headers: {
            'Content-Type': type,
            'Content-Disposition': `attachment; filename="${name}"`,
            'Cache-Control': 'no-store',
        },
    })

}
function json(obj: any, status = 200) {
    return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
}
