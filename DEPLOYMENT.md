# Hướng dẫn Deploy Dev Tools

## Tổng quan
Ứng dụng này là một Next.js app với các công cụ dev. Có nhiều cách để deploy lên server.

## 1. Deploy lên Vercel (Khuyến nghị - Dễ nhất)

### Bước 1: Chuẩn bị
```bash
# Build ứng dụng để test
pnpm build
```

### Bước 2: Deploy
1. Đăng ký tài khoản tại [vercel.com](https://vercel.com)
2. Kết nối GitHub repository
3. Import project
4. Vercel sẽ tự động detect Next.js và deploy

### Bước 3: Cấu hình (nếu cần)
- Environment variables: Settings > Environment Variables
- Custom domain: Settings > Domains

## 2. Deploy lên VPS/Server riêng

### Yêu cầu hệ thống
- Node.js 18+ 
- pnpm hoặc npm
- Nginx (reverse proxy)
- PM2 (process manager)

### Bước 1: Chuẩn bị server
```bash
# Cài đặt Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Cài đặt pnpm
npm install -g pnpm

# Cài đặt PM2
npm install -g pm2

# Cài đặt Nginx
sudo apt update
sudo apt install nginx
```

### Bước 2: Upload code
```bash
# Clone repository
git clone <your-repo-url>
cd dev-tools

# Cài đặt dependencies
pnpm install

# Build ứng dụng
pnpm build
```

### Bước 3: Cấu hình PM2
Tạo file `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'dev-tools',
    script: 'npm',
    args: 'start',
    cwd: '/path/to/your/app',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

### Bước 4: Cấu hình Nginx
Tạo file `/etc/nginx/sites-available/dev-tools`:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Bước 5: Khởi động
```bash
# Khởi động PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Kích hoạt Nginx site
sudo ln -s /etc/nginx/sites-available/dev-tools /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```


## 3. Deploy lên Railway

### Bước 1: Chuẩn bị
1. Đăng ký tại [railway.app](https://railway.app)
2. Kết nối GitHub repository

### Bước 2: Cấu hình
- Railway sẽ tự động detect Next.js
- Thêm environment variables nếu cần
- Deploy tự động khi push code

## 5. Deploy lên Netlify

### Bước 1: Cấu hình build
Tạo file `netlify.toml`:
```toml
[build]
  command = "pnpm build"
  publish = ".next"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Bước 2: Deploy
1. Đăng ký tại [netlify.com](https://netlify.com)
2. Kết nối repository
3. Cấu hình build settings
4. Deploy

## Environment Variables

Tạo file `.env.local` cho production:
```env
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Monitoring và Logs

### Với PM2
```bash
# Xem logs
pm2 logs dev-tools

# Monitor
pm2 monit

# Restart
pm2 restart dev-tools
```


## Troubleshooting

### Lỗi thường gặp:
1. **Port đã được sử dụng**: Thay đổi PORT trong environment
2. **Memory limit**: Tăng memory cho PM2
3. **Build failed**: Kiểm tra dependencies và Node.js version
4. **Static files không load**: Kiểm tra Nginx config

### Debug commands:
```bash
# Kiểm tra process
ps aux | grep node

# Kiểm tra port
netstat -tlnp | grep :3000

# Kiểm tra logs
tail -f /var/log/nginx/error.log
```

## Khuyến nghị

1. **Cho development**: Vercel hoặc Railway
2. **Cho production**: VPS với PM2 + Nginx
4. **Cho CI/CD**: GitHub Actions + Vercel/Railway

Chọn phương pháp phù hợp với nhu cầu và budget của bạn!
