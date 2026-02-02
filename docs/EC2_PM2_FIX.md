# EC2 PM2 실행 오류 해결 가이드

**작성일**: 2025-01-12  
**문제**: Next.js가 `ecosystem.config.js`를 디렉토리로 인식하는 오류

---

## 🔍 문제 원인

에러 메시지:
```
Error: ENOTDIR: not a directory, stat '/home/ec2-user/flonics_Dashboard/ecosystem.config.js/.env.production.local'
```

**원인**: PM2 실행 시 작업 디렉토리가 올바르게 설정되지 않아 Next.js가 잘못된 경로에서 실행됨

---

## ✅ 해결 방법

### 1. `server.js` 수정
- `process.chdir(rootDir)` 추가하여 명시적으로 작업 디렉토리 설정
- Next.js 실행 전 작업 디렉토리 확인 로직 추가

### 2. `ecosystem.config.js` 수정
- `cwd: path.resolve(__dirname)`로 절대 경로 명시

---

## 🚀 EC2에서 실행 방법

### 1. 파일 수정 확인
```bash
# 프로젝트 디렉토리로 이동
cd /home/ec2-user/flonics_Dashboard

# 파일 확인
cat server.js | grep -A 5 "rootDir"
cat ecosystem.config.js | grep -A 2 "cwd"
```

### 2. PM2 재시작
```bash
# PM2 중지
pm2 stop flonics-dashboard
pm2 delete flonics-dashboard

# PM2 재시작
pm2 start ecosystem.config.js

# 상태 확인
pm2 status
pm2 logs flonics-dashboard --lines 50
```

### 3. 로그 확인
```bash
# 에러 로그 확인
pm2 logs flonics-dashboard --err --lines 100

# 출력 로그 확인
pm2 logs flonics-dashboard --out --lines 100
```

---

## 📝 확인 사항

### 작업 디렉토리 확인
로그에서 다음 메시지가 올바른 경로를 표시하는지 확인:
```
[Server] cwd: /home/ec2-user/flonics_Dashboard
[Server] Working directory: /home/ec2-user/flonics_Dashboard
[Server] __dirname: /home/ec2-user/flonics_Dashboard
```

### 환경 변수 확인
```
[Server] Environment OK
[PM2] Environment variables status:
  DB_HOST: ✓ Loaded
  DB_USER: ✓ Loaded
  DB_PASSWORD: ✓ Loaded
  DB_NAME: ✓ Loaded
  JWT_SECRET: ✓ Loaded
```

---

## 🔧 추가 문제 해결

### 문제 1: 여전히 같은 오류 발생
```bash
# PM2 완전히 정리 후 재시작
pm2 kill
pm2 start ecosystem.config.js
```

### 문제 2: .env 파일 경로 문제
```bash
# .env 파일 위치 확인
ls -la /home/ec2-user/flonics_Dashboard/.env

# .env 파일 내용 확인 (민감 정보 제외)
cat /home/ec2-user/flonics_Dashboard/.env | grep -v "PASSWORD\|SECRET"
```

### 문제 3: 권한 문제
```bash
# 파일 권한 확인
ls -la /home/ec2-user/flonics_Dashboard/server.js
ls -la /home/ec2-user/flonics_Dashboard/ecosystem.config.js

# 필요시 권한 수정
chmod +x /home/ec2-user/flonics_Dashboard/server.js
```

---

## ✅ 성공 확인

다음과 같은 메시지가 나타나면 성공:
```
[Server] Environment OK
[Server] Working directory: /home/ec2-user/flonics_Dashboard
✓ Compiled successfully
```

---

**작성일**: 2025-01-12
