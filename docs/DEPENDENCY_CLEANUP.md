# 의존성 정리 보고서

**작성일**: 2025-01-12  
**목적**: Deprecated 패키지 경고 제거 및 의존성 최적화

---

## ✅ 완료된 작업

### 1. Deprecated 패키지 제거

#### 제거된 직접 의존성
- ✅ **`fstream@1.0.12`** 제거
  - 이유: deprecated 패키지
  - 영향: `unzipper`가 사용하지만 최신 버전에서는 불필요

#### 업데이트된 패키지
- ✅ **`unzipper@0.10.14` → `^0.12.3`**
  - 최신 버전으로 업데이트
  - `fstream` 의존성 제거됨

### 2. Next.js 설정 개선

#### `next.config.mjs` 업데이트
- ✅ **`turbopack.root` 설정 추가**
  - Lockfile 경고 해결
  - `experimental.turbopack.root` 설정 추가

- ✅ **`serverExternalPackages` 정리**
  - `fstream` 제거 (더 이상 필요 없음)
  - `rimraf`, `unzipper` 유지

---

## ⚠️ 남아있는 Deprecated 패키지

다음 패키지들은 **간접 의존성**이므로 직접 제거할 수 없습니다:

### 1. `glob@7.2.3` (deprecated)
- **원인**: `exceljs@4.4.0`의 `archiver` 의존성
- **위치**: `exceljs → archiver@5.3.2 → archiver-utils → glob@7.2.3`
- **해결 방법**: 
  - `exceljs` 최신 버전 확인 (현재 4.4.0)
  - 최신 버전에서도 여전히 사용될 수 있음
  - `exceljs`는 핵심 기능이므로 업데이트 시 주의 필요

### 2. `inflight@1.0.6` (deprecated)
- **원인**: `glob@7.2.3`의 의존성
- **위치**: `glob@7.2.3 → inflight@1.0.6`
- **해결 방법**: `glob@7.2.3`이 제거되면 자동으로 해결됨

### 3. `lodash.isequal@4.5.0` (deprecated)
- **원인**: `exceljs@4.4.0`의 `fast-csv` 의존성
- **위치**: `exceljs → fast-csv → @fast-csv/format → lodash.isequal@4.5.0`
- **해결 방법**: 
  - `exceljs` 최신 버전 확인
  - 또는 `lodash.isequal`을 최신 버전으로 override (권장하지 않음)

### 4. `rimraf@2.7.1` (deprecated)
- **원인**: 이전에 `fstream`의 의존성이었음
- **상태**: `fstream` 제거로 더 이상 나타나지 않음 ✅

---

## 📊 개선 결과

### Before
```
npm warn deprecated inflight@1.0.6
npm warn deprecated rimraf@2.7.1
npm warn deprecated lodash.isequal@4.5.0
npm warn deprecated glob@7.2.3
npm warn deprecated fstream@1.0.12
```

### After
```
npm warn deprecated glob@7.2.3 (간접 의존성)
npm warn deprecated lodash.isequal@4.5.0 (간접 의존성)
npm warn deprecated inflight@1.0.6 (간접 의존성)
```

**개선**: 직접 의존성 경고 **2개 제거** (fstream, rimraf@2.7.1)

---

## 🔧 추가 권장 사항

### 1. ExcelJS 업데이트 검토 (선택사항)
```bash
npm install exceljs@latest
```
- ⚠️ Breaking changes 가능성 있음
- 테스트 필요

### 2. Package Overrides 사용 (고급)
`package.json`에 다음을 추가하여 간접 의존성 강제 업데이트:
```json
{
  "overrides": {
    "glob": "^10.0.0",
    "lodash.isequal": "^5.0.0"
  }
}
```
- ⚠️ 호환성 문제 가능성 있음
- 충분한 테스트 필요

### 3. Lockfile 정리
```bash
# package-lock.json 재생성
rm package-lock.json
npm install
```

---

## ✅ Next.js Lockfile 경고 해결

### Before
```
⚠ Warning: Next.js inferred your workspace root, but it may not be correct.
We detected multiple lockfiles and selected the directory of 
C:\Users\hojin\Desktop\pnpm-lock.yaml as the root directory.
```

### After
- ✅ `next.config.mjs`에 `turbopack.root` 설정 추가
- ✅ 경고 해결됨

---

## 결론

- ✅ **직접 의존성 경고 2개 제거** (fstream, rimraf@2.7.1)
- ✅ **Next.js lockfile 경고 해결**
- ⚠️ **간접 의존성 경고 3개 남음** (glob, inflight, lodash.isequal)
  - `exceljs` 업데이트로 해결 가능하나, Breaking changes 위험

**현재 상태**: 프로덕션 사용 가능 (간접 의존성 경고는 기능에 영향 없음)

---

**작업 완료일**: 2025-01-12
