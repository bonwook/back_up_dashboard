# Nginx 설치 및 연동 가이드 (AWS Linux)

**대상**: Amazon Linux 2 / Amazon Linux 2023  
**목적**: 80 포트로 접속 시 PM2로 동작 중인 앱(3000 포트)으로 프록시

---

## 1. Nginx 설치

### Amazon Linux 2
```bash
sudo yum install -y nginx
```

### Amazon Linux 2023
```bash
sudo dnf install -y nginx
```

### 설치 확인
```bash
nginx -v
# 예: nginx version: nginx/1.x.x
```

---

## 2. 설정 파일 적용

**이 레포에 설정 파일이 있습니다.** 서버에서 복사해서 쓰면 됩니다.

```bash
cd /path/to/flonics_Dashboard   # 레포 루트
sudo cp nginx/flonics-dashboard.conf /etc/nginx/conf.d/
```

직접 편집하려면:
```bash
sudo nano /etc/nginx/conf.d/flonics-dashboard.conf
```
설정 내용은 레포의 `nginx/flonics-dashboard.conf` 와 동일합니다 (80 → 127.0.0.1:3000 프록시).

---

## 3. 기본 서버 블록 비활성화 (충돌 방지)

기본 설정이 80 포트를 쓰고 있으면 충돌할 수 있으므로, 필요 시만 수정합니다.

```bash
# 기본 설정 확인 (listen 80 이 있는지)
sudo cat /etc/nginx/nginx.conf
```

`/etc/nginx/nginx.conf` 안에 `server { listen 80; ... }` 블록이 **그대로** 있고,  
`/etc/nginx/conf.d/*.conf` 도 읽히는 구조라면 **나중에 로드되는 conf.d 쪽이 우선**될 수 있습니다.  
그래도 80이 다른 곳에서 선점되어 있으면, 기본 설정에서 해당 `server` 블록을 주석 처리합니다.

```bash
sudo nano /etc/nginx/nginx.conf
# server { listen 80; ... } 부분을 # 으로 막거나, 해당 server 블록 전체 주석 처리
```

---

## 4. 설정 검사 및 Nginx 적용

```bash
# 문법 검사 (반드시 실행)
sudo nginx -t
```

`syntax is ok` / `test is successful` 이 나오면:

```bash
# Nginx (재)시작
sudo systemctl start nginx

# 부팅 시 자동 시작
sudo systemctl enable nginx

# 이미 떠 있는 경우 설정만 다시 로드
sudo systemctl reload nginx
```

---

## 5. 방화벽 / 보안 그룹

### EC2 보안 그룹 (인바운드)
- **80** (HTTP): `0.0.0.0/0` 또는 접속 허용할 IP  
- **3000은 열지 않음** (Nginx만 80으로 받고 내부에서 3000 사용)

### 서버 로컬 방화벽 (firewalld 사용 시)
```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload
```

---

## 6. 동작 확인

1. **앱이 3000에서 떠 있는지**
   ```bash
   pm2 list
   # flonics-dashboard 가 online 이어야 함
   ```
   없으면:
   ```bash
   cd /path/to/flonics_Dashboard
   pm2 start ecosystem.config.js
   ```

2. **로컬에서 Nginx → 3000 확인**
   ```bash
   curl -I http://127.0.0.1
   # HTTP/1.1 200 등이 나오면 Nginx가 3000으로 잘 넘김
   ```

3. **브라우저**
   - `http://<EC2 공인 IP 또는 EIP>` 로 접속

---

## 7. 자주 쓰는 명령어

| 용도 | 명령어 |
|------|--------|
| 상태 확인 | `sudo systemctl status nginx` |
| 재시작 | `sudo systemctl restart nginx` |
| 설정만 리로드 | `sudo systemctl reload nginx` |
| 중지 | `sudo systemctl stop nginx` |
| 설정 문법 검사 | `sudo nginx -t` |
| 에러 로그 | `sudo tail -f /var/log/nginx/error.log` |

---

## 8. 트러블슈팅

### "Address already in use" (80 포트 사용 중)
```bash
sudo ss -tlnp | grep :80
# 어떤 프로세스가 80을 쓰는지 확인 후, 해당 서비스 중지하거나 Nginx만 80 사용하도록 정리
```

### 502 Bad Gateway
- PM2로 앱이 3000에서 떠 있는지 확인: `pm2 list`, `curl http://127.0.0.1:3000`
- `proxy_pass http://127.0.0.1:3000;` 주소/포트가 맞는지 확인

### 설정 수정 후 적용이 안 될 때
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 요약 순서

1. `sudo yum install -y nginx` (또는 AL2023이면 `sudo dnf install -y nginx`)
2. 레포의 설정 복사: `sudo cp nginx/flonics-dashboard.conf /etc/nginx/conf.d/`
3. `sudo nginx -t` → `sudo systemctl start nginx` (또는 `reload`) → `sudo systemctl enable nginx`
4. EC2 보안 그룹에서 80 인바운드 허용
5. `http://<EIP>` 로 접속 테스트
