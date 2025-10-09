import { Shuffle, Type, Wrench, Smartphone, ShieldCheck, Terminal } from 'lucide-react'

export type ToolId =
  | 'json-merger'
  | 'string-tools'
  | 'json-formatter'
  | 'android-tools'
  | 'android-logcat'
  | 'android-logcat-webadb'

export const TOOLS = [
  { id: 'json-merger', name: 'JSON Merger', description: 'Ghep key tu Text1, map value tu Text2 (neu co)', icon: Shuffle, gradient: 'from-blue-500 via-purple-500 to-pink-500' },
  { id: 'string-tools', name: 'String Tools', description: 'Chuyen doi & xu ly chuoi thong dung', icon: Type, gradient: 'from-emerald-500 via-teal-500 to-cyan-500' },
  { id: 'json-formatter', name: 'JSON Formatter', description: 'Format (Pretty) hoac Minify JSON', icon: Wrench, gradient: 'from-orange-500 via-red-500 to-pink-500' },
  { id: 'android-tools', name: 'Android Tools', description: 'Keystore, AAB to APK, ADB commands & Android development tools', icon: Smartphone, gradient: 'from-green-500 via-lime-500 to-yellow-500' },
  { id: 'android-logcat', name: 'Android Logcat Filter', description: 'Chay adb logcat voi filter va hien thi ket qua trong bang', icon: Terminal, gradient: 'from-purple-500 via-pink-500 to-red-500' },
  { id: 'android-logcat-webadb', name: 'Android Logcat WebADB', description: 'Doc logcat truc tiep qua WebUSB/WebADB ngay tren trinh duyet', icon: Terminal, gradient: 'from-indigo-500 via-blue-500 to-cyan-500' },
  { id: 'open-ssl-tools', name: 'OpenSSL Tools', description: 'Tao RSA/EC key, CSR, self-signed, PFX<->PEM, thong tin X.509', icon: ShieldCheck, gradient: 'from-indigo-500 via-violet-500 to-fuchsia-500' },
] as const
