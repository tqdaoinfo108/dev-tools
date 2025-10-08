
import { Shuffle, Type, Wrench, Smartphone, ShieldCheck, Terminal } from 'lucide-react'

export type ToolId = 'json-merger' | 'string-tools' | 'json-formatter' | 'android-tools' | 'android-logcat'

export const TOOLS = [
  { id: 'json-merger', name: 'JSON Merger', description: 'Giữ key từ Text1, áp dụng value từ Text2 (nếu có)', icon: Shuffle, gradient: 'from-blue-500 via-purple-500 to-pink-500' },
  { id: 'string-tools', name: 'String Tools', description: 'Chuyển đổi & xử lý chuỗi thường dùng', icon: Type, gradient: 'from-emerald-500 via-teal-500 to-cyan-500' },
  { id: 'json-formatter', name: 'JSON Formatter', description: 'Định dạng (Pretty) / Nén (Minify) JSON', icon: Wrench, gradient: 'from-orange-500 via-red-500 to-pink-500' },
  { id: 'android-tools', name: 'Android Tools', description: 'Keystore, AAB to APK, ADB commands & Android development tools', icon: Smartphone, gradient: 'from-green-500 via-lime-500 to-yellow-500' },
  { id: 'android-logcat', name: 'Android Logcat Filter', description: 'Chạy adb logcat với filter và hiển thị kết quả trong bảng', icon: Terminal, gradient: 'from-purple-500 via-pink-500 to-red-500' },
  { id: 'open-ssl-tools', name: 'OpenSSL Tools', description: 'Tạo RSA/EC key, CSR, self-signed, PFX↔PEM, X.509 info', icon: ShieldCheck, gradient: 'from-indigo-500 via-violet-500 to-fuchsia-500' },
] as const
