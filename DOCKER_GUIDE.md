# 🐳 Hướng dẫn Build Docker Image

## 📋 Yêu cầu hệ thống

### Windows:
- Windows 10/11 (64-bit)
- WSL 2 enabled
- Docker Desktop for Windows

### Linux/macOS:
- Docker Engine hoặc Docker Desktop

## 🔧 Cài đặt Docker Desktop (Windows)

1. **Tải Docker Desktop:**
   - Truy cập: https://www.docker.com/products/docker-desktop/
   - Tải phiên bản cho Windows
   - Chạy file installer

2. **Cấu hình WSL 2:**
   ```powershell
   # Mở PowerShell as Administrator
   wsl --install
   ```

3. **Khởi động Docker Desktop** và đợi cho đến khi Docker icon hiển thị "Running"

4. **Kiểm tra cài đặt:**
   ```powershell
   docker --version
   docker run hello-world
   ```

## 🚀 Build Docker Image

### Phương pháp 1: Sử dụng script tự động (Khuyến nghị)

#### Windows:
```powershell
# Chạy script build
.\docker-build.ps1

# Hoặc với tên image tùy chỉnh
.\docker-build.ps1 "my-dev-tools" "v1.0"
```

#### Linux/macOS:
```bash
# Cấp quyền thực thi
chmod +x docker-build.sh

# Chạy script build
./docker-build.sh

# Hoặc với tên image tùy chỉnh
./docker-build.sh "my-dev-tools" "v1.0"
```

### Phương pháp 2: Build thủ công

```bash
# Build image
docker build -t dev-tools:latest .

# Xem danh sách images
docker images

# Chạy container
docker run -d -p 3000:3000 --name dev-tools-container dev-tools:latest
```

## 📊 Quản lý Docker Images

### Xem danh sách images:
```bash
docker images
```

### Xóa image:
```bash
docker rmi dev-tools:latest
```

### Xóa tất cả images không sử dụng:
```bash
docker image prune -a
```

## 🏃‍♂️ Chạy Container

### Chạy container:
```bash
docker run -d -p 3000:3000 --name dev-tools-container dev-tools:latest
```

### Xem logs:
```bash
docker logs dev-tools-container
```

### Dừng container:
```bash
docker stop dev-tools-container
```

### Xóa container:
```bash
docker rm dev-tools-container
```

### Xem trạng thái container:
```bash
docker ps -a
```

## 🔧 Sử dụng Docker Compose

### Chạy với Docker Compose:
```bash
# Build và chạy
docker-compose up -d

# Xem logs
docker-compose logs -f

# Dừng
docker-compose down
```

## 🌐 Truy cập ứng dụng

Sau khi container chạy thành công:
- **URL:** http://localhost:3000
- **Container name:** dev-tools-container

## 🐛 Troubleshooting

### Lỗi thường gặp:

1. **"Docker is not running"**
   - Khởi động Docker Desktop
   - Đợi cho đến khi Docker icon hiển thị "Running"

2. **"Port 3000 is already in use"**
   ```bash
   # Sử dụng port khác
   docker run -d -p 3001:3000 --name dev-tools-container dev-tools:latest
   ```

3. **"Container name already exists"**
   ```bash
   # Xóa container cũ
   docker rm dev-tools-container
   ```

4. **Build failed**
   - Kiểm tra Dockerfile syntax
   - Đảm bảo tất cả files cần thiết đã có
   - Kiểm tra .dockerignore

### Debug commands:
```bash
# Xem chi tiết build process
docker build --no-cache -t dev-tools:latest .

# Chạy container với interactive mode
docker run -it dev-tools:latest /bin/sh

# Xem logs chi tiết
docker logs -f dev-tools-container
```

## 📈 Tối ưu hóa

### Multi-stage build:
Dockerfile đã được tối ưu với multi-stage build để:
- Giảm kích thước image cuối cùng
- Tách biệt build environment và runtime environment
- Sử dụng standalone output của Next.js

### Image size optimization:
- Sử dụng Alpine Linux base image
- Chỉ copy files cần thiết
- Sử dụng .dockerignore để loại bỏ files không cần thiết

## 🚀 Deploy Production

### Push image lên registry:
```bash
# Tag image
docker tag dev-tools:latest your-registry/dev-tools:latest

# Push image
docker push your-registry/dev-tools:latest
```

### Chạy trên production server:
```bash
# Pull image
docker pull your-registry/dev-tools:latest

# Chạy với environment variables
docker run -d -p 3000:3000 \
  -e NODE_ENV=production \
  -e NEXT_PUBLIC_APP_URL=https://yourdomain.com \
  --name dev-tools-prod \
  your-registry/dev-tools:latest
```

## 💡 Tips

1. **Sử dụng .dockerignore** để giảm build context
2. **Cache dependencies** bằng cách copy package.json trước
3. **Sử dụng multi-stage build** để tối ưu kích thước
4. **Chạy container với non-root user** để tăng bảo mật
5. **Sử dụng health checks** để monitor container health

Chúc bạn build Docker image thành công! 🎉
