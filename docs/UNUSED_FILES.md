# 불필요한 파일 목록

이 문서는 프로젝트에서 사용되지 않는 불필요한 파일들을 정리합니다.

## 제거 가능한 파일

### 1. 테스트 파일
- **`app/test-upload/page.tsx`**
  - **이유**: 테스트용 업로드 페이지, 실제 프로덕션에서 사용되지 않음
  - **상태**: `/test-upload` 라우트로 접근 가능하지만 실제 기능과 중복
  - **제거 가능**: ✅

### 2. 백업 파일
- **`lib/utils/fetch.ts.bak`**
  - **이유**: 백업 파일, 원본 파일(`fetch.ts`)이 존재함
  - **상태**: 사용 안 함
  - **제거 가능**: ✅

### 3. 중복 CSS 파일
- **`styles/globals.css`**
  - **이유**: `app/globals.css`와 중복, 실제로는 `app/globals.css`만 사용됨
  - **상태**: 사용 안 함
  - **제거 가능**: ✅

### 4. 빌드 캐시 파일
- **`tsconfig.tsbuildinfo`**
  - **이유**: TypeScript 빌드 캐시 파일, `.gitignore`에 포함되어 있음
  - **상태**: 자동 생성되는 파일
  - **제거 가능**: ✅ (재생성됨)

### 5. 오래된 문서 파일
- **`REFACTORING_PLAN.md`**
  - **이유**: `REFACTORING_SUMMARY.md`가 더 최신이고 완전한 정보를 포함
  - **상태**: 중복 문서
  - **제거 가능**: ⚠️ (참고용으로 유지 가능)

- **`ARCHITECTURE.md`**
  - **이유**: 오래된 구조 설명, 새로운 구조와 맞지 않음
  - **상태**: 업데이트 필요하거나 제거 가능
  - **제거 가능**: ⚠️ (업데이트하거나 제거)

### 6. 사용되지 않는 이미지 파일
- **`public/placeholder-logo.png`**
- **`public/placeholder-logo.svg`**
- **`public/placeholder-user.jpg`**
- **`public/placeholder.jpg`**
- **`public/placeholder.svg`**
  - **이유**: 코드에서 사용되지 않음 (검색 결과 없음)
  - **상태**: 사용 안 함
  - **제거 가능**: ✅

## 유지하는 파일

### 실제 사용 중인 파일
- **`public/LOGO.png`** - 실제 로고로 사용 중일 수 있음
- **`public/icon-*.png`** - 아이콘 파일들
- **`public/icon.svg`** - 아이콘 파일
- **`public/apple-icon.png`** - Apple 아이콘

## 제거 완료 상태

### ✅ 제거 완료된 파일
1. ✅ `app/test-upload/page.tsx` - 제거 완료
2. ✅ `lib/utils/fetch.ts.bak` - 제거 완료
3. ✅ `styles/globals.css` 및 `styles/` 디렉토리 - 제거 완료
4. ✅ `tsconfig.tsbuildinfo` - 제거 완료
5. ✅ `public/placeholder-*.{png,svg,jpg}` - 제거 완료 (5개 파일)
6. ✅ `REFACTORING_PLAN.md` - 제거 완료

### 📝 업데이트된 파일
- ✅ `ARCHITECTURE.md` - 새로운 구조 반영하여 업데이트 완료

## 제거 후 검증

### 빌드 테스트 ✅
- 총 33개 라우트 정상 컴파일
- 모든 기능 정상 작동

### 제거 영향
- ❌ `/test-upload` 라우트 제거됨 (의도된 제거)
- ✅ 다른 모든 기능 정상 작동
