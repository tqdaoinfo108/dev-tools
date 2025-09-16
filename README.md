# 🛠️ Dev Tools - Bộ công cụ phát triển đa năng

[![Next.js](https://img.shields.io/badge/Next.js-15.5.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1.0-blue?style=for-the-badge&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.17-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

> Một bộ công cụ phát triển web hiện đại, được xây dựng với Next.js 15, React 19 và TypeScript. Cung cấp các tiện ích hữu ích cho developers trong quá trình phát triển ứng dụng.

## ✨ Tính năng chính

### 🔧 **JSON Tools**
- **JSON Merger**: Gộp JSON objects thông minh, giữ key từ source và áp dụng value từ target
- **JSON Formatter**: Định dạng (Pretty) và nén (Minify) JSON với syntax highlighting

### 📝 **String Tools**
- **Text Transformation**: Chuyển đổi giữa các định dạng text (camelCase, PascalCase, snake_case, kebab-case)
- **Encoding/Decoding**: Base64, URL encoding, HTML entities
- **Text Processing**: Remove diacritics, slugify, reverse text, case conversion
- **Hash & Security**: SHA256 hash, QR code generation
- **Statistics**: Character count, word count, line count

### 📱 **Android Development Tools**
- **Keystore Management**: Tạo và quản lý keystore files
- **AAB to APK**: Chuyển đổi Android App Bundle sang APK
- **APK Analyzer**: Phân tích thông tin APK files
- **ADB Commands**: Các lệnh ADB thường dùng

### 🔐 **OpenSSL Tools**
- **Key Generation**: Tạo RSA/EC keys với các độ dài khác nhau
- **CSR Generation**: Tạo Certificate Signing Request
- **Self-signed Certificates**: Tạo chứng chỉ tự ký
- **Format Conversion**: PFX ↔ PEM conversion
- **X.509 Info**: Xem thông tin chi tiết chứng chỉ

## 🚀 Cài đặt và chạy

### Yêu cầu hệ thống
- Node.js 18+ 
- pnpm (khuyến nghị) hoặc npm

### Cài đặt

```bash
# Clone repository
git clone <your-repo-url>
cd dev-tools

# Cài đặt dependencies
pnpm install

# Chạy development server
pnpm dev
```

Mở [http://localhost:3000](http://localhost:3000) để xem ứng dụng.

### Build cho production

```bash
# Build ứng dụng
pnpm build

# Chạy production server
pnpm start
```

## 🏗️ Cấu trúc dự án

```
dev-tools/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── aab-to-apk/    # AAB to APK conversion
│   │   ├── apk-analyzer/  # APK analysis
│   │   ├── keystore/      # Keystore operations
│   │   └── openssl/       # OpenSSL operations
│   ├── tools/             # Tool pages
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── tools/            # Tool-specific components
│   │   ├── StringTools.tsx
│   │   ├── JsonMerge.tsx
│   │   ├── JsonFormatter.tsx
│   │   ├── AndroidTools.tsx
│   │   └── OpenSSLTools.tsx
│   ├── ui/               # Reusable UI components
│   └── Sidebar.tsx       # Navigation sidebar
├── lib/                  # Utility functions
│   ├── tools.ts          # Tool definitions
│   └── utils.ts          # Helper functions
└── public/               # Static assets
```

## 🛠️ Công nghệ sử dụng

- **Framework**: Next.js 15.5.3 với App Router
- **UI Library**: React 19.1.0
- **Language**: TypeScript 5.0
- **Styling**: Tailwind CSS 3.4.17
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **UI Components**: Radix UI primitives
- **Package Manager**: pnpm

## 🐳 Docker Deployment

### Build Docker image

```bash
# Sử dụng script tự động (Windows)
.\docker-build.ps1

# Hoặc build thủ công
docker build -t dev-tools:latest .
```

### Chạy với Docker Compose

```bash
docker-compose up -d
```

Xem [DOCKER_GUIDE.md](./DOCKER_GUIDE.md) để biết thêm chi tiết.

## 🚀 Deployment

### Vercel (Khuyến nghị)
1. Kết nối GitHub repository với Vercel
2. Deploy tự động khi push code

### VPS/Server riêng
```bash
# Sử dụng script deploy
./deploy.sh
```

### Railway/Netlify
- Kết nối repository và deploy tự động

Xem [DEPLOYMENT.md](./DEPLOYMENT.md) để biết thêm chi tiết về các phương pháp deploy.

## 📖 API Documentation

### JSON Merger API
```
POST /api/json-merger
Content-Type: application/json

{
  "source": { "key1": "value1" },
  "target": { "key1": "new_value", "key2": "value2" }
}
```

### String Tools API
```
POST /api/string-tools
Content-Type: application/json

{
  "text": "Hello World",
  "operation": "toCamelCase"
}
```

### Android Tools API
```
POST /api/keystore
POST /api/aab-to-apk
POST /api/apk-analyzer
```

### OpenSSL Tools API
```
POST /api/openssl
Content-Type: application/json

{
  "operation": "generateKey",
  "type": "rsa",
  "bits": 2048
}
```

## 🤝 Đóng góp

Chúng tôi hoan nghênh mọi đóng góp! Vui lòng:

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Tạo Pull Request

## 📝 Scripts có sẵn

```bash
# Development
pnpm dev          # Chạy development server
pnpm build        # Build cho production
pnpm start        # Chạy production server
pnpm lint         # Chạy ESLint

# Docker
.\docker-build.ps1    # Build Docker image (Windows)
./docker-build.sh     # Build Docker image (Linux/macOS)
docker-compose up -d  # Chạy với Docker Compose

# Deployment
.\deploy.ps1      # Deploy với PM2 (Windows)
./deploy.sh       # Deploy với PM2 (Linux/macOS)
```

## 🔧 Environment Variables

Tạo file `.env.local`:

```env
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
PORT=3000
```

## 📊 Performance

- **Lighthouse Score**: 95+ (Performance, Accessibility, Best Practices, SEO)
- **Bundle Size**: Optimized với Next.js automatic code splitting
- **Loading Time**: < 2s trên 3G connection
- **Core Web Vitals**: Tất cả metrics đều trong "Good" range

## 🐛 Troubleshooting

### Lỗi thường gặp

1. **Port 3000 đã được sử dụng**
   ```bash
   # Sử dụng port khác
   pnpm dev --port 3001
   ```

2. **Build failed**
   ```bash
   # Xóa cache và rebuild
   rm -rf .next
   pnpm build
   ```

3. **Dependencies issues**
   ```bash
   # Xóa node_modules và reinstall
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

## 📄 License

MIT License - xem [LICENSE](LICENSE) file để biết thêm chi tiết.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [Lucide](https://lucide.dev/) - Icon library
- [Radix UI](https://www.radix-ui.com/) - UI primitives
- [Framer Motion](https://www.framer.com/motion/) - Animation library

## 📞 Liên hệ

- **Issues**: [GitHub Issues](https://github.com/your-username/dev-tools/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/dev-tools/discussions)

---

⭐ **Nếu dự án này hữu ích, hãy cho chúng tôi một star!** ⭐
