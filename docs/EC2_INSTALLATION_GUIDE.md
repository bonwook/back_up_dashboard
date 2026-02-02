# EC2 설치 가이드

**작성일**: 2025-01-12  
**목적**: EC2에서 깨끗한 의존성 설치 및 경고 최소화

---

## 📋 설치 전 확인사항

### 1. Node.js 버전 확인
```bash
node --version
# 권장: v20.x 이상
```

### 2. npm 버전 확인
```bash
npm --version
# 권장: v10.x 이상
```

### 3. 기존 node_modules 정리 (선택사항)
```bash
# 기존 설치 제거
rm -rf node_modules package-lock.json
```

---

## 🚀 설치 방법

### 방법 1: 표준 설치 (권장)
```bash
npm install
```

### 방법 2: Legacy Peer Deps 사용 (의존성 충돌 시)
```bash
npm install --legacy-peer-deps
```

### 방법 3: Production 모드 (프로덕션 배포 시)
```bash
npm ci --production
```

---

## ⚠️ 예상되는 경고

### 정상적인 경고 (무시 가능)
다음 경고들은 **간접 의존성**이므로 직접 제거할 수 없습니다:

```
npm warn deprecated glob@7.2.3
npm warn deprecated lodash.isequal@4.5.0
npm warn deprecated inflight@1.0.6
```

**이유**: `exceljs` 패키지의 내부 의존성입니다.  
**영향**: 기능에 영향 없음 (안전하게 무시 가능)

### 해결된 경고
다음 경고들은 이미 해결되었습니다:
- ✅ `fstream@1.0.12` - 제거됨
- ✅ `rimraf@2.7.1` - 제거됨

---

## 🔧 Next.js 경고 해결

### Lockfile 경고
```
⚠ Warning: Next.js inferred your workspace root, but it may not be correct.
```

**해결 방법**:
1. `next.config.mjs`에 `experimental.turbopack.root` 설정이 이미 추가됨
2. 상위 디렉토리의 `pnpm-lock.yaml` 제거 (선택사항)
   ```bash
   # 상위 디렉토리로 이동
   cd ..
   # pnpm-lock.yaml 확인 및 제거 (필요시)
   ls -la pnpm-lock.yaml
   ```

---

## 📦 설치 후 확인

### 1. 의존성 확인
```bash
npm list --depth=0
```

### 2. 빌드 테스트
```bash
npm run build
```

### 3. 개발 서버 실행
```bash
npm run dev
```

---

## 🐛 문제 해결

### 문제 1: 의존성 충돌
```bash
# 해결 방법
npm install --legacy-peer-deps
```

### 문제 2: 빌드 실패
```bash
# node_modules 재설치
rm -rf node_modules package-lock.json
npm install
```

### 문제 3: 메모리 부족
```bash
# Node.js 메모리 제한 증가
export NODE_OPTIONS="--max-old-space-size=4096"
npm install
```

---

## ✅ 설치 완료 확인

### 성공적인 설치 확인
```bash
# 1. 패키지 수 확인
npm list --depth=0 | wc -l

# 2. 빌드 테스트
npm run build

# 3. 경고 확인 (최소화됨)
npm install 2>&1 | grep -i "deprecated" | wc -l
# 예상: 3개 이하 (간접 의존성만)
```

---

## 📝 요약

### 완료된 작업
- ✅ `fstream` 제거
- ✅ `unzipper` 최신 버전으로 업데이트
- ✅ `next.config.mjs` 설정 개선
- ✅ 직접 의존성 경고 2개 제거

### 남아있는 경고
- ⚠️ 간접 의존성 경고 3개 (기능에 영향 없음)
  - `glob@7.2.3` (exceljs)
  - `lodash.isequal@4.5.0` (exceljs)
  - `inflight@1.0.6` (glob)

### 권장 사항
- 프로덕션 배포 시 `npm ci` 사용
- 정기적인 의존성 업데이트 (`npm outdated` 확인)
- 보안 취약점 스캔 (`npm audit`)

---

**작성일**: 2025-01-12
