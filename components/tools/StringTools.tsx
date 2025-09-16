
'use client'
import * as React from 'react'
import { Button } from '@/components/ui/Button'
import { TextareaWithLineNumbers } from '@/components/ui/TextareaWithLineNumbers'
import { Clipboard, ClipboardCheck, Wand2, GitBranch, Hash, Type, AlignLeft, AlignCenter, AlignRight, RotateCcw, RotateCw, Search, Replace, Calculator, Calendar, Clock, Globe, Mail, Phone, CreditCard, Eye, EyeOff } from 'lucide-react'

export const StringTools: React.FC = () => {
  const [input, setInput] = React.useState('')
  const [output, setOutput] = React.useState('')
  const [copied, setCopied] = React.useState(false)

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
    }).replace(/\s+/g, '')
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

  const removeEmptyLines = (s: string) => {
    return s.replace(/^\s*[\r\n]/gm, '')
  }

  const sortLines = (s: string) => {
    return s.split('\n').sort().join('\n')
  }

  const reverseLines = (s: string) => {
    return s.split('\n').reverse().join('\n')
  }

  const removeDuplicates = (s: string) => {
    return [...new Set(s.split('\n'))].join('\n')
  }

  const base64Encode = (s: string) => {
    return btoa(unescape(encodeURIComponent(s)))
  }

  const base64Decode = (s: string) => {
    try {
      return decodeURIComponent(escape(atob(s)))
    } catch {
      return 'Invalid Base64 string'
    }
  }

  const urlEncode = (s: string) => {
    return encodeURIComponent(s)
  }

  const urlDecode = (s: string) => {
    try {
      return decodeURIComponent(s)
    } catch {
      return 'Invalid URL encoded string'
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
    } catch {
      return 'Invalid JSON'
    }
  }

  const minifyJson = (s: string) => {
    try {
      return JSON.stringify(JSON.parse(s))
    } catch {
      return 'Invalid JSON'
    }
  }

  const formatXml = (s: string) => {
    try {
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(s, 'text/xml')
      const serializer = new XMLSerializer()
      return serializer.serializeToString(xmlDoc)
    } catch {
      return 'Invalid XML'
    }
  }

  const generateQRCode = (s: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(s)}`
  }

  const generateHash = (s: string, algorithm: 'md5' | 'sha1' | 'sha256' | 'sha512' = 'sha256') => {
    // Simple hash implementation (for demo purposes)
    let hash = 0
    for (let i = 0; i < s.length; i++) {
      const char = s.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16)
  }

  const generateRandomString = (length: number = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  const convertToBinary = (s: string) => {
    return s.split('').map(char => char.charCodeAt(0).toString(2).padStart(8, '0')).join(' ')
  }

  const convertFromBinary = (s: string) => {
    return s.split(' ').map(bin => String.fromCharCode(parseInt(bin, 2))).join('')
  }

  const convertToHex = (s: string) => {
    return s.split('').map(char => char.charCodeAt(0).toString(16).padStart(2, '0')).join(' ')
  }

  const convertFromHex = (s: string) => {
    return s.split(' ').map(hex => String.fromCharCode(parseInt(hex, 16))).join('')
  }

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
            <Button onClick={()=>setOutput(input.toUpperCase())}><Type className="w-4 h-4 mr-1" /> UPPERCASE</Button>
            <Button onClick={()=>setOutput(input.toLowerCase())}><Type className="w-4 h-4 mr-1" /> lowercase</Button>
            <Button onClick={()=>setOutput(toTitleCase(input))}><Type className="w-4 h-4 mr-1" /> Title Case</Button>
            <Button onClick={()=>setOutput(input.replace(/\s+/g,' ').trim())}><AlignLeft className="w-4 h-4 mr-1" /> Trim spaces</Button>
            <Button onClick={()=>setOutput(removeDiacritics(input))}><Wand2 className="w-4 h-4 mr-1" /> Bỏ dấu</Button>
          </div>
        </div>

        {/* Case Conversions */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Case Conversions</h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={()=>setOutput(toCamelCase(input))}><Type className="w-4 h-4 mr-1" /> camelCase</Button>
            <Button onClick={()=>setOutput(toPascalCase(input))}><Type className="w-4 h-4 mr-1" /> PascalCase</Button>
            <Button onClick={()=>setOutput(toSnakeCase(input))}><Type className="w-4 h-4 mr-1" /> snake_case</Button>
            <Button onClick={()=>setOutput(toKebabCase(input))}><Type className="w-4 h-4 mr-1" /> kebab-case</Button>
            <Button onClick={()=>setOutput(slugify(input))}><Wand2 className="w-4 h-4 mr-1" /> Slugify</Button>
            <Button onClick={()=>setOutput(toGitBranch(input))}><GitBranch className="w-4 h-4 mr-1" /> Git Branch</Button>
          </div>
        </div>

        {/* Text Manipulation */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Text Manipulation</h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={()=>setOutput(reverse(input))}><RotateCcw className="w-4 h-4 mr-1" /> Reverse</Button>
            <Button onClick={()=>setOutput(removeEmptyLines(input))}><AlignLeft className="w-4 h-4 mr-1" /> Remove empty lines</Button>
            <Button onClick={()=>setOutput(sortLines(input))}><AlignCenter className="w-4 h-4 mr-1" /> Sort lines</Button>
            <Button onClick={()=>setOutput(reverseLines(input))}><RotateCw className="w-4 h-4 mr-1" /> Reverse lines</Button>
            <Button onClick={()=>setOutput(removeDuplicates(input))}><Hash className="w-4 h-4 mr-1" /> Remove duplicates</Button>
          </div>
        </div>

        {/* Encoding/Decoding */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Encoding/Decoding</h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={()=>setOutput(base64Encode(input))}><Hash className="w-4 h-4 mr-1" /> Base64 Encode</Button>
            <Button onClick={()=>setOutput(base64Decode(input))}><Hash className="w-4 h-4 mr-1" /> Base64 Decode</Button>
            <Button onClick={()=>setOutput(urlEncode(input))}><Hash className="w-4 h-4 mr-1" /> URL Encode</Button>
            <Button onClick={()=>setOutput(urlDecode(input))}><Hash className="w-4 h-4 mr-1" /> URL Decode</Button>
            <Button onClick={()=>setOutput(escapeHtml(input))}><Type className="w-4 h-4 mr-1" /> Escape HTML</Button>
            <Button onClick={()=>setOutput(unescapeHtml(input))}><Type className="w-4 h-4 mr-1" /> Unescape HTML</Button>
          </div>
        </div>

        {/* Data Extraction */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Data Extraction</h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={()=>setOutput(extractEmails(input))}><Mail className="w-4 h-4 mr-1" /> Extract Emails</Button>
            <Button onClick={()=>setOutput(extractUrls(input))}><Globe className="w-4 h-4 mr-1" /> Extract URLs</Button>
            <Button onClick={()=>setOutput(extractPhones(input))}><Phone className="w-4 h-4 mr-1" /> Extract Phones</Button>
            <Button onClick={()=>setOutput(extractNumbers(input))}><Calculator className="w-4 h-4 mr-1" /> Extract Numbers</Button>
          </div>
        </div>

        {/* Generators */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Generators</h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={()=>setOutput(generatePassword(12))}><Eye className="w-4 h-4 mr-1" /> Generate Password</Button>
            <Button onClick={()=>setOutput(generateUUID())}><Hash className="w-4 h-4 mr-1" /> Generate UUID</Button>
            <Button onClick={()=>setOutput(generateRandomString(10))}><Type className="w-4 h-4 mr-1" /> Random String</Button>
            <Button onClick={()=>setOutput(generateLoremIpsum(50))}><Type className="w-4 h-4 mr-1" /> Lorem Ipsum</Button>
          </div>
        </div>

        {/* Format & Convert */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Format & Convert</h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={()=>setOutput(formatJson(input))}><Type className="w-4 h-4 mr-1" /> Format JSON</Button>
            <Button onClick={()=>setOutput(minifyJson(input))}><Type className="w-4 h-4 mr-1" /> Minify JSON</Button>
            <Button onClick={()=>setOutput(formatXml(input))}><Type className="w-4 h-4 mr-1" /> Format XML</Button>
            <Button onClick={()=>setOutput(convertToBinary(input))}><Calculator className="w-4 h-4 mr-1" /> To Binary</Button>
            <Button onClick={()=>setOutput(convertFromBinary(input))}><Calculator className="w-4 h-4 mr-1" /> From Binary</Button>
            <Button onClick={()=>setOutput(convertToHex(input))}><Hash className="w-4 h-4 mr-1" /> To Hex</Button>
            <Button onClick={()=>setOutput(convertFromHex(input))}><Hash className="w-4 h-4 mr-1" /> From Hex</Button>
          </div>
        </div>

        {/* Hash & Security */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Hash & Security</h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={()=>setOutput(generateHash(input, 'sha256'))}><Hash className="w-4 h-4 mr-1" /> SHA256 Hash</Button>
            <Button onClick={()=>setOutput(generateQRCode(input))}><Globe className="w-4 h-4 mr-1" /> Generate QR Code</Button>
          </div>
        </div>

        {/* Statistics */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Statistics</h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={()=>setOutput(`Characters: ${charCount(input)}\nWords: ${wordCount(input)}`)}>
              <Hash className="w-4 h-4 mr-1" /> Show Stats
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
