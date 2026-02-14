# S3 Updates 연동 기능 테스트 보고서

업데이트된 코드(s3_updates 테이블 연동, admin/cases 목록·상세, presigned URL, 담당자 지정)에 대한  
**기능 테스트**, **경계값 분석**, **린터**, **화이트박스 테스트** 결과를 정리한 문서입니다.

---

## 1. 린터 및 타입 검사

| 항목 | 명령 | 결과 |
|------|------|------|
| TypeScript | `npm run tsc` | ✅ 통과 (--noEmit) |
| IDE Lint | ReadLints (수정된 파일) | ✅ 에러 없음 |

수정된 파일:  
`app/api/s3-updates/*`, `app/admin/cases/page.tsx`, `app/admin/cases/s3-update/[id]/page.tsx`,  
`app/api/storage/assign/route.ts`, `app/admin/analytics/hooks/useTaskAssignment.ts`, `lib/utils/s3Updates.ts`

---

## 2. 기능 테스트 시나리오

### 2.1 API: GET /api/s3-updates

| # | 시나리오 | 전제 조건 | 기대 결과 |
|---|----------|-----------|-----------|
| F1 | 정상 목록 조회 | admin/staff 로그인, Cookie auth-token | 200, `s3Updates` 배열 (id, file_name, bucket_name, file_size, upload_time, created_at, task_id, s3_key) |
| F2 | 비인증 | Cookie 없음 | 401 Unauthorized |
| F3 | 잘못된 토큰 | 만료/변조 토큰 | 401 Invalid token |
| F4 | client 역할 | role=client | 403 Forbidden |
| F5 | 빈 목록 | s3_updates 행 0건 | 200, `s3Updates: []` |

### 2.2 API: GET /api/s3-updates/[id]

| # | 시나리오 | 전제 조건 | 기대 결과 |
|---|----------|-----------|-----------|
| F6 | 정상 단건 조회 | admin/staff, 유효한 id | 200, `s3Update` 객체, `s3_key` 포함 |
| F7 | 존재하지 않는 id | id=99999 등 | 404 Not found |
| F8 | client 역할 | role=client | 403 Forbidden |

### 2.3 API: GET /api/s3-updates/[id]/presigned-url

| # | 시나리오 | 전제 조건 | 기대 결과 |
|---|----------|-----------|-----------|
| F9 | 정상 URL 발급 | admin/staff, 유효한 id, S3 객체 존재 | 200, `url`, `expiresIn: 1200`, `fileName` |
| F10 | 존재하지 않는 id | id=99999 | 404 Not found |
| F11 | S3에 객체 없음 | id는 있으나 해당 key가 S3에 없음 | 500 또는 404 (S3 NoSuchKey 등) |

### 2.4 API: POST /api/storage/assign (s3_update_id 연동)

| # | 시나리오 | 전제 조건 | 기대 결과 |
|---|----------|-----------|-----------|
| F12 | s3_update_id 포함 개별 할당 | title, assignedTo, fileKeys, s3_update_id | 200, task 생성, (task_id 컬럼 있으면) s3_updates.task_id 갱신 |
| F13 | s3_update_id 없이 할당 | 기존처럼 s3_update_id 없음 | 200, task만 생성, s3_updates 미수정 |
| F14 | task_id 컬럼 없음 | s3_updates에 task_id 없음 | 200, task는 생성, UPDATE 실패는 try/catch로 무시 |

### 2.5 UI: /admin/cases (Worklist)

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| F15 | 진행 탭 로드 | task_assignments + s3_updates(전체) 목록 표시, S3 행은 "S3 미할당" 뱃지 |
| F16 | S3 행 클릭 | /admin/cases/s3-update/[id] 이동 |
| F17 | 검색어 입력 | file_name, s3_key, bucket_name 포함 검색 시 해당 S3 행만 필터 |
| F18 | 요청/담당 필터 | "요청" 또는 "담당" 선택 시 S3 미할당 행은 목록에서 제외 (표시 안 함) |

### 2.6 UI: /admin/cases/s3-update/[id]

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| F19 | 상세 로드 | file_name, bucket_name, s3_key, file_size, upload_time 표시 |
| F20 | "업무 추가 (담당자 지정)" 클릭 | /admin/analytics?from=worklist&s3_update_id=[id] 이동 |
| F21 | "다운로드 (20분 유효 링크)" 클릭 | presigned URL 요청 후 새 탭에서 다운로드 링크 열림 |

### 2.7 UI: /admin/analytics (s3_update_id 쿼리)

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| F22 | s3_update_id 쿼리 있음 | 해당 s3_update 조회 후 제목·파일 키 미리 채움 |
| F23 | 담당자 선택 후 업무 등록 | POST /api/storage/assign에 s3_update_id 포함, 성공 시 task 생성 |

---

## 3. 경계값 분석

### 3.1 toS3Key (S3 객체 키 생성)

| 구분 | 입력 경계 | 기대 동작 |
|------|-----------|-----------|
| file_name | 빈 문자열 `""` | `""` 또는 `"prefix/"` (prefix만 있으면) |
| file_name | null/undefined | `""`로 취급 (row.file_name ?? "") |
| bucket_name | null, undefined | prefix 없음 → file_name만 반환 |
| bucket_name | 빈 문자열 `""` | trim 후 빈 문자열 → file_name만 반환 |
| bucket_name | 공백만 `"   "` | trim 후 빈 문자열 → file_name만 반환 |
| bucket_name | 앞뒤 공백 `"  p  "` | `"p/file_name"` (trim 적용) |
| 일반 | file_name만 | `"file_name"` |
| 일반 | prefix + file_name | `"prefix/file_name"` |

실제 검증: `node scripts/test-s3-updates-logic.mjs` → 11개 케이스 통과.

### 3.2 API 경계값

| 대상 | 경계 | 기대 |
|------|------|------|
| GET /api/s3-updates/[id] | id = 0, 음수, 매우 큰 수 | 0/음수: 404 또는 조회됨(DB 따라 다름), 큰 수: 404 또는 조회됨 |
| GET /api/s3-updates/[id] | id = 문자열 "abc" | DB가 INT면 0으로 변환되거나 조회 실패 → 404 |
| presigned-url | S3 key가 빈 문자열 | getSignedDownloadUrl("") → S3 에러 가능 |
| assign s3_update_id | s3_update_id = 숫자(문자열 "1") | UPDATE 시 id로 사용, MySQL INT 호환 |

### 3.3 DB 스키마 경계 (task_id 없음)

| 상황 | 동작 |
|------|------|
| s3_updates에 task_id 컬럼 없음 | SELECT에서 task_id 제외, WHERE task_id IS NULL 제거 → 전체 목록 반환 |
| assign 시 UPDATE task_id | try/catch로 실패 무시 → 200 유지 |

---

## 4. 화이트박스 테스트 (코드 경로/분기)

### 4.1 GET /api/s3-updates (route.ts)

| 분기 | 조건 | 검증 방법 |
|------|------|-----------|
| 1 | !token | Cookie 제거 후 요청 → 401 |
| 2 | !decoded | 잘못된 토큰 → 401 |
| 3 | role === "client" | client 계정 → 403 |
| 4 | rows 정상 | admin/staff, DB에 행 있음 → 200, list 길이 > 0 |
| 5 | rows 빈 배열 | DB에 행 없음 → 200, s3Updates.length === 0 |
| 6 | map 내 toS3Key | bucket_name 유/무에 따라 s3_key 형식 확인 (경계값 스크립트로 보조) |
| 7 | catch | DB 예외 등 → 500, error 메시지 |

### 4.2 GET /api/s3-updates/[id] (route.ts)

| 분기 | 조건 | 검증 방법 |
|------|------|-----------|
| 1 | !token / !decoded / client | F2, F3, F8와 동일 |
| 2 | !row | 존재하지 않는 id → 404 |
| 3 | row 있음 | s3Update.s3_key === toS3Key(row) 동작 확인 |

### 4.3 GET /api/s3-updates/[id]/presigned-url (route.ts)

| 분기 | 조건 | 검증 방법 |
|------|------|-----------|
| 1 | 인증/역할 | 위와 동일 |
| 2 | !row | 404 |
| 3 | getSignedDownloadUrl 성공 | 200, url 존재, expiresIn === 1200 |
| 4 | getSignedDownloadUrl 실패 (NoSuchKey 등) | catch → 500 |

### 4.4 POST /api/storage/assign (s3_update_id)

| 분기 | 조건 | 검증 방법 |
|------|------|-----------|
| 1 | s3UpdateId 없음 | body에 s3_update_id 없음 → UPDATE 블록 미실행 |
| 2 | s3UpdateId 문자열 있음 | body에 s3_update_id: "1" → try 내 UPDATE 실행 |
| 3 | UPDATE 성공 (task_id 컬럼 있음) | s3_updates.task_id 갱신됨 (DB 확인) |
| 4 | UPDATE 실패 (task_id 컬럼 없음) | catch에서 무시 → 200 유지 |

### 4.5 toS3Key (lib/utils/s3Updates.ts)

| 분기 | 조건 | 검증 방법 |
|------|------|-----------|
| 1 | prefix 빈 문자열 (null/undefined/""/공백) | return name만 (경계값 스크립트) |
| 2 | prefix 존재 | return `${prefix}/${name}` (경계값 스크립트) |

실제 실행: `node scripts/test-s3-updates-logic.mjs` → 11 tests passed.

---

## 5. 테스트 실행 요약

| 유형 | 실행 방법 | 결과 |
|------|-----------|------|
| 린터/타입 | `npm run tsc` | ✅ 통과 |
| toS3Key 경계값/화이트박스 | `node scripts/test-s3-updates-logic.mjs` | ✅ 11 passed |
| API/UI 기능 테스트 | 수동 (브라우저 + API 클라이언트) | 위 시나리오(F1~F23) 기준으로 수행 권장 |

---

## 6. 수동 기능 테스트 체크리스트 (실행 시 사용)

- [ ] F1–F5: GET /api/s3-updates (토큰/역할/빈 목록)
- [ ] F6–F8: GET /api/s3-updates/[id]
- [ ] F9–F11: GET /api/s3-updates/[id]/presigned-url
- [ ] F12–F14: POST /api/storage/assign (s3_update_id 유/무, task_id 컬럼 유/무)
- [ ] F15–F18: /admin/cases 목록·필터·클릭
- [ ] F19–F21: /admin/cases/s3-update/[id] 상세·담당자 지정·다운로드
- [ ] F22–F23: /admin/analytics s3_update_id 쿼리·업무 등록

위 항목을 실행해 보시고, 실패한 케이스가 있으면 시나리오 번호와 결과를 알려주시면 됩니다.
