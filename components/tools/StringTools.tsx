
'use client'
import * as React from 'react'
import { Button } from '@/components/ui/Button'
import { TextareaWithLineNumbers } from '@/components/ui/TextareaWithLineNumbers'
import { Clipboard, ClipboardCheck, Wand2, GitBranch, Hash, Type, AlignLeft, AlignCenter, AlignRight, RotateCcw, RotateCw, Search, Replace, Calculator, Calendar, Clock, Globe, Mail, Phone, CreditCard, Eye, EyeOff } from 'lucide-react'

export const StringTools: React.FC = () => {
  const [input, setInput] = React.useState('')
  const [output, setOutput] = React.useState('')
  const [copied, setCopied] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const removeDiacritics = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}+/gu, '')
  const slugify = (s: string) =>
    removeDiacritics(s).toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-')
  
  const toGitBranch = (s: string) => {
    return removeDiacritics(s)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 150) // GitLab branch name limit
  }

  // Additional string functions
  const toTitleCase = (s: string) => {
    return s.replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    )
  }

  const toCamelCase = (s: string) => {
    return s.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase()
    }).replace(/\s+/g, '')
  }

  const toPascalCase = (s: string) => {
    return s.replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => {
      return word.toUpperCase()
    }).replace(/\s+/g, ' ')
  }

  const toSnakeCase = (s: string) => {
    return s.replace(/\W+/g, ' ')
      .split(/ |\B(?=[A-Z])/)
      .map(word => word.toLowerCase())
      .join('_')
  }

  const toKebabCase = (s: string) => {
    return s.replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase()
  }

  const reverse = (s: string) => {
    return s.split('').reverse().join('')
  }

  const wordCount = (s: string) => {
    return s.trim() === '' ? 0 : s.trim().split(/\s+/).length
  }

  const charCount = (s: string) => {
    return s.length
  }

  const removeEmptyLines = (s: string) => s.split(/\r?\n/).filter(line => line.trim().length > 0).join('\n')

  const sortLines = (s: string) => s.split(/\r?\n/).sort((a, b) => a.localeCompare(b)).join('\n')

  const reverseLines = (s: string) => s.split(/\r?\n/).reverse().join('\n')

  const removeDuplicates = (s: string) => Array.from(new Set(s.split(/\r?\n/))).join('\n')

  const base64Encode = (s: string) => {
    const encoder = new TextEncoder()
    const bytes = encoder.encode(s)
    let binary = ''
    bytes.forEach(byte => {
      binary += String.fromCharCode(byte)
    })
    return btoa(binary)
  }

  const base64Decode = (s: string) => {
    try {
      const binary = atob(s)
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
      const decoder = new TextDecoder()
      return decoder.decode(bytes)
    } catch {
      throw new Error('Invalid Base64 string')
    }
  }

  const urlEncode = (s: string) => encodeURIComponent(s)

  const urlDecode = (s: string) => {
    try {
      return decodeURIComponent(s)
    } catch {
      throw new Error('Invalid URL encoded string')
    }
  }

  const escapeHtml = (s: string) => {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }
    return s.replace(/[&<>"']/g, (m) => map[m])
  }

  const unescapeHtml = (s: string) => {
    const map: { [key: string]: string } = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'"
    }
    return s.replace(/&(amp|lt|gt|quot|#39);/g, (m) => map[m])
  }

  // Additional useful tools
  const extractEmails = (s: string) => {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
    return s.match(emailRegex)?.join('\n') || 'No emails found'
  }

  const extractUrls = (s: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    return s.match(urlRegex)?.join('\n') || 'No URLs found'
  }

  const extractPhones = (s: string) => {
    const phoneRegex = /(\+?[\d\s\-\(\)]{10,})/g
    return s.match(phoneRegex)?.join('\n') || 'No phone numbers found'
  }

  const extractNumbers = (s: string) => {
    const numberRegex = /-?\d+\.?\d*/g
    return s.match(numberRegex)?.join('\n') || 'No numbers found'
  }

  const generatePassword = (length: number = 12) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  const generateLoremIpsum = (words: number = 50) => {
    const lorem = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum'
    const wordsArray = lorem.split(' ')
    let result = ''
    for (let i = 0; i < words; i++) {
      result += wordsArray[i % wordsArray.length] + ' '
    }
    return result.trim()
  }

  const formatJson = (s: string) => {
    try {
      return JSON.stringify(JSON.parse(s), null, 2)
    } catch (error) {
      throw new Error('Invalid JSON')
    }
  }

  const minifyJson = (s: string) => {
    try {
      return JSON.stringify(JSON.parse(s))
    } catch {
      throw new Error('Invalid JSON')
    }
  }

  const formatXml = (s: string) => {
    const prettyPrint = (xml: string) => {
      const PADDING = '  '
      const reg = /(>)(<)(\/*)/g
      let formatted = ''
      let pad = 0
      xml = xml.replace(reg, '$1\n$2$3')
      const nodes = xml.split(/\n/)
      nodes.forEach((node) => {
        if (node.match(/.+<\/\w[^>]*>$/)) {
          formatted += `${PADDING.repeat(pad)}${node}\n`
        } else if (node.match(/^<\/\w/)) {
          pad = Math.max(pad - 1, 0)
          formatted += `${PADDING.repeat(pad)}${node}\n`
        } else if (node.match(/^<\w([^>]*[^/])?>.*$/)) {
          formatted += `${PADDING.repeat(pad)}${node}\n`
          pad += 1
        } else {
          formatted += `${PADDING.repeat(pad)}${node}\n`
        }
      })
      return formatted.trim()
    }

    const parser = new DOMParser()
    const doc = parser.parseFromString(s, 'application/xml')
    if (doc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Invalid XML')
    }
    const serializer = new XMLSerializer()
    const xmlString = serializer.serializeToString(doc)
    return prettyPrint(xmlString)
  }

  const generateQRCode = (s: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(s)}`
  }

  const generateHash = async (s: string, algorithm: 'md5' | 'sha1' | 'sha256' | 'sha512' = 'sha256') => {
    const algoMap: Record<string, string> = {
      md5: '',
      sha1: 'SHA-1',
      sha256: 'SHA-256',
      sha512: 'SHA-512'
    }

    const encoder = new TextEncoder()
    const data = encoder.encode(s)

    if (algorithm === 'md5') {
      // WebCrypto does not support MD5; provide simple fallback
      let hash = 0
      for (let i = 0; i < s.length; i++) {
        const char = s.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash |= 0
      }
      return Math.abs(hash).toString(16)
    }

    const subtleAlgo = algoMap[algorithm]
    if (!subtleAlgo || !(window.crypto && window.crypto.subtle)) {
      throw new Error('Trình duyệt không hỗ trợ thuật toán hash này')
    }

    const digest = await window.crypto.subtle.digest(subtleAlgo, data)
    const result = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
    return result
  }

  const generateRandomString = (length: number = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  const convertToBinary = (s: string) =>
    s
      .split('')
      .map((char) => char.charCodeAt(0).toString(2).padStart(8, '0'))
      .join(' ')

  const convertFromBinary = (s: string) => {
    const bits = s.trim().split(/\s+/).filter(Boolean)
    if (!bits.length) return ''
    const chars = bits.map((bin) => {
      if (!/^[01]+$/.test(bin)) {
        throw new Error(`Invalid binary chunk: ${bin}`)
      }
      return String.fromCharCode(parseInt(bin, 2))
    })
    return chars.join('')
  }

  const convertToHex = (s: string) =>
    s
      .split('')
      .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(' ')

  const convertFromHex = (s: string) => {
    const cleaned = s.replace(/\s+/g, '')
    if (cleaned.length === 0) return ''
    if (cleaned.length % 2 !== 0) {
      throw new Error('Hex string length must be even')
    }
    const chars: string[] = []
    for (let i = 0; i < cleaned.length; i += 2) {
      const byte = cleaned.slice(i, i + 2)
      if (!/^[0-9a-fA-F]{2}$/.test(byte)) {
        throw new Error(`Invalid hex chunk: ${byte}`)
      }
      chars.push(String.fromCharCode(parseInt(byte, 16)))
    }
    return chars.join('')
  }

  const runTool = React.useCallback((fn: () => string | Promise<string>) => {
    try {
      const result = fn()
      if (result && typeof (result as any).then === 'function') {
        ;(result as Promise<string>)
          .then((value) => {
            setError(null)
            setOutput(value)
          })
          .catch((err) => {
            const message = err instanceof Error ? err.message : String(err)
            setError(message)
          })
      } else {
        setError(null)
        setOutput(result as string)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    }
  }, [])

  const copy = async () => {
    await navigator.clipboard.writeText(output)
    setCopied(true); setTimeout(() => setCopied(false), 1000)
  }

  return (
    <div className="space-y-6">
      {/* Input/Output Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Input</label>
          <div style={{ height: '300px' }}>
            <TextareaWithLineNumbers 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              placeholder="Nhập văn bản..." 
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Output</label>
            <Button variant="ghost" size="sm" onClick={copy} aria-label="Copy">
              {copied ? <ClipboardCheck className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
            </Button>
          </div>
          {error && (
            <p className="text-xs text-red-500 dark:text-red-300">{error}</p>
          )}
          <div style={{ height: '300px' }}>
            <TextareaWithLineNumbers 
              readOnly 
              value={output} 
              onChange={() => {}} 
              placeholder="Kết quả sẽ hiện ở đây" 
            />
          </div>
        </div>
      </div>

      {/* String Tools Buttons */}
      <div className="space-y-4">
        {/* Basic Transformations */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Basic Transformations</h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runTool(() => input.toUpperCase())}><Type className="w-4 h-4 mr-1" /> UPPERCASE</Button>
            <Button onClick={() => runTool(() => input.toLowerCase())}><Type className="w-4 h-4 mr-1" /> lowercase</Button>
            <Button onClick={() => runTool(() => toTitleCase(input))}><Type className="w-4 h-4 mr-1" /> Title Case</Button>
            <Button onClick={() => runTool(() => input.replace(/\s+/g,' ').trim())}><AlignLeft className="w-4 h-4 mr-1" /> Trim spaces</Button>
            <Button onClick={() => runTool(() => removeDiacritics(input))}><Wand2 className="w-4 h-4 mr-1" /> Bỏ dấu</Button>
          </div>
        </div>

        {/* Case Conversions */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Case Conversions</h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runTool(() => toCamelCase(input))}><Type className="w-4 h-4 mr-1" /> camelCase</Button>
            <Button onClick={() => runTool(() => toPascalCase(input))}><Type className="w-4 h-4 mr-1" /> PascalCase</Button>
            <Button onClick={() => runTool(() => toSnakeCase(input))}><Type className="w-4 h-4 mr-1" /> snake_case</Button>
            <Button onClick={() => runTool(() => toKebabCase(input))}><Type className="w-4 h-4 mr-1" /> kebab-case</Button>
            <Button onClick={() => runTool(() => slugify(input))}><Wand2 className="w-4 h-4 mr-1" /> Slugify</Button>
            <Button onClick={() => runTool(() => toGitBranch(input))}><GitBranch className="w-4 h-4 mr-1" /> Git Branch</Button>
          </div>
        </div>

        {/* Text Manipulation */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Text Manipulation</h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runTool(() => reverse(input))}><RotateCcw className="w-4 h-4 mr-1" /> Reverse</Button>
            <Button onClick={() => runTool(() => removeEmptyLines(input))}><AlignLeft className="w-4 h-4 mr-1" /> Remove empty lines</Button>
            <Button onClick={() => runTool(() => sortLines(input))}><AlignCenter className="w-4 h-4 mr-1" /> Sort lines</Button>
            <Button onClick={() => runTool(() => reverseLines(input))}><RotateCw className="w-4 h-4 mr-1" /> Reverse lines</Button>
            <Button onClick={() => runTool(() => removeDuplicates(input))}><Hash className="w-4 h-4 mr-1" /> Remove duplicates</Button>
          </div>
        </div>

        {/* Encoding/Decoding */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Encoding/Decoding</h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runTool(() => base64Encode(input))}><Hash className="w-4 h-4 mr-1" /> Base64 Encode</Button>
            <Button onClick={() => runTool(() => base64Decode(input))}><Hash className="w-4 h-4 mr-1" /> Base64 Decode</Button>
            <Button onClick={() => runTool(() => urlEncode(input))}><Hash className="w-4 h-4 mr-1" /> URL Encode</Button>
            <Button onClick={() => runTool(() => urlDecode(input))}><Hash className="w-4 h-4 mr-1" /> URL Decode</Button>
            <Button onClick={() => runTool(() => escapeHtml(input))}><Type className="w-4 h-4 mr-1" /> Escape HTML</Button>
            <Button onClick={() => runTool(() => unescapeHtml(input))}><Type className="w-4 h-4 mr-1" /> Unescape HTML</Button>
          </div>
        </div>

        {/* Data Extraction */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Data Extraction</h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runTool(() => extractEmails(input))}><Mail className="w-4 h-4 mr-1" /> Extract Emails</Button>
            <Button onClick={() => runTool(() => extractUrls(input))}><Globe className="w-4 h-4 mr-1" /> Extract URLs</Button>
            <Button onClick={() => runTool(() => extractPhones(input))}><Phone className="w-4 h-4 mr-1" /> Extract Phones</Button>
            <Button onClick={() => runTool(() => extractNumbers(input))}><Calculator className="w-4 h-4 mr-1" /> Extract Numbers</Button>
          </div>
        </div>

        {/* Generators */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Generators</h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runTool(() => generatePassword(12))}><Eye className="w-4 h-4 mr-1" /> Generate Password</Button>
            <Button onClick={() => runTool(() => generateUUID())}><Hash className="w-4 h-4 mr-1" /> Generate UUID</Button>
            <Button onClick={() => runTool(() => generateRandomString(10))}><Type className="w-4 h-4 mr-1" /> Random String</Button>
            <Button onClick={() => runTool(() => generateLoremIpsum(50))}><Type className="w-4 h-4 mr-1" /> Lorem Ipsum</Button>
          </div>
        </div>

        {/* Format & Convert */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Format & Convert</h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runTool(() => formatJson(input))}><Type className="w-4 h-4 mr-1" /> Format JSON</Button>
            <Button onClick={() => runTool(() => minifyJson(input))}><Type className="w-4 h-4 mr-1" /> Minify JSON</Button>
            <Button onClick={() => runTool(() => formatXml(input))}><Type className="w-4 h-4 mr-1" /> Format XML</Button>
            <Button onClick={() => runTool(() => convertToBinary(input))}><Calculator className="w-4 h-4 mr-1" /> To Binary</Button>
            <Button onClick={() => runTool(() => convertFromBinary(input))}><Calculator className="w-4 h-4 mr-1" /> From Binary</Button>
            <Button onClick={() => runTool(() => convertToHex(input))}><Hash className="w-4 h-4 mr-1" /> To Hex</Button>
            <Button onClick={() => runTool(() => convertFromHex(input))}><Hash className="w-4 h-4 mr-1" /> From Hex</Button>
          </div>
        </div>

        {/* Hash & Security */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Hash & Security</h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runTool(() => generateHash(input, 'sha256'))}><Hash className="w-4 h-4 mr-1" /> SHA256 Hash</Button>
            <Button onClick={() => runTool(() => generateQRCode(input))}><Globe className="w-4 h-4 mr-1" /> Generate QR Code</Button>
          </div>
        </div>

        {/* Statistics */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Statistics</h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runTool(() => `Characters: ${charCount(input)}\nWords: ${wordCount(input)}`)}>
              <Hash className="w-4 h-4 mr-1" /> Show Stats
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
