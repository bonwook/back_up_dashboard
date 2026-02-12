# Nginx 설정 (레포에 포함)

이 폴더에는 **Nginx 설정 파일**만 있습니다.  
Nginx 프로그램 자체는 서버 OS에서 설치해야 합니다 (레포에서 설치 불가).

## 서버에서 할 일

1. **Nginx 설치** (한 번만, AWS Linux)
   ```bash
   # Amazon Linux 2
   sudo yum install -y nginx
   # Amazon Linux 2023
   sudo dnf install -y nginx
   ```

2. **이 레포의 설정을 Nginx가 읽는 위치로 복사**
   ```bash
   cd /path/to/flonics_Dashboard
   sudo cp nginx/flonics-dashboard.conf /etc/nginx/conf.d/
   ```

3. **적용**
   ```bash
   sudo nginx -t
   sudo systemctl start nginx   # 최초 1회
   sudo systemctl enable nginx # 부팅 시 자동 시작
   sudo systemctl reload nginx # 설정 변경 후
   ```

자세한 단계·트러블슈팅은 [docs/NGINX_SETUP_GUIDE.md](../docs/NGINX_SETUP_GUIDE.md) 참고.
