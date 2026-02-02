# SQL 스크립트 분석 보고서

## 📋 스크립트 목록

프로젝트의 `scripts/` 디렉토리에 총 **20개의 SQL 파일**이 있습니다.

### 스크립트 분류

#### 1. 초기 설정 스크립트
- **`001_create_tables.sql`** - 기본 테이블 생성
- **`002_insert_test_accounts.sql`** - 테스트 계정 생성

#### 2. 스키마 변경 스크립트
- **`004_add_file_foreign_keys.sql`** - 파일 외래키 추가
- **`005_add_excel_pdf_file_types.sql`** - Excel/PDF 파일 타입 추가
- **`007_create_task_assignments.sql`** - 작업 할당 테이블 생성
- **`008_add_awaiting_completion_status.sql`** - 상태 추가
- **`010_add_shared_with_to_tasks.sql`** - 공유 기능 추가
- **`011_add_report_html_column.sql`** - 리포트 HTML 컬럼 추가
- **`012_merge_reports_into_cases.sql`** - 리포트 병합
- **`013_normalize_database.sql`** - 데이터베이스 정규화
- **`014_migrate_completed_tasks_to_cases.sql`** - 완료된 작업 마이그레이션
- **`016_add_report_fields_to_task_assignments.sql`** - 리포트 필드 추가
- **`017_remove_cases_table.sql`** - cases 테이블 제거
- **`018_create_task_status_history.sql`** - 작업 상태 이력 테이블 생성
- **`019_add_due_date_to_task_assignments.sql`** - 마감일 추가
- **`020_remove_unused_columns.sql`** - 사용되지 않는 컬럼 제거

#### 3. 최적화 스크립트
- **`006_optimize_database.sql`** - 데이터베이스 최적화

#### 4. 데이터 정리 스크립트
- **`015_cleanup_all_data_except_profiles.sql`** - 프로필 제외 모든 데이터 정리

#### 5. 유틸리티 스크립트
- **`003_useful_queries.sql`** - 유용한 쿼리 모음

---

## 🔍 스크립트 분석

### ✅ 안전한 스크립트

대부분의 스크립트는 안전하게 작성되어 있습니다:

1. **트랜잭션 사용**
   - 일부 스크립트에서 트랜잭션 사용
   - 롤백 가능

2. **조건부 실행**
   - 컬럼/테이블 존재 여부 확인 후 실행
   - 예: `020_remove_unused_columns.sql`

3. **백업 권장**
   - `README.md`에서 백업 권장 사항 명시

### ⚠️ 주의 사항

1. **데이터 삭제 스크립트**
   - **`015_cleanup_all_data_except_profiles.sql`**
   - 모든 데이터를 삭제하므로 **주의 필요**
   - 프로덕션 환경에서 실행 전 백업 필수

2. **테스트 계정 스크립트**
   - **`002_insert_test_accounts.sql`**
   - 하드코딩된 비밀번호 해시 포함
   - 프로덕션 환경에서는 제거 권장

3. **스크립트 실행 순서**
   - 일부 스크립트는 순서대로 실행해야 함
   - `README.md` 참조

---

## 📊 스크립트 사용 현황

### 현재 사용 중인 스크립트
- ✅ `001_create_tables.sql` - 초기 설정
- ✅ `020_remove_unused_columns.sql` - 최근 사용

### 레거시 스크립트 (참고용)
- ⚠️ `002_insert_test_accounts.sql` - 테스트 환경 전용
- ⚠️ `015_cleanup_all_data_except_profiles.sql` - 개발 환경 전용

---

## 🔒 보안 검토

### ✅ 안전한 부분

1. **SQL Injection 위험 없음**
   - 모든 스크립트는 정적 SQL
   - 사용자 입력 없음

2. **권한 확인**
   - 스크립트 실행은 수동
   - 데이터베이스 권한 필요

### ⚠️ 주의 사항

1. **하드코딩된 비밀번호**
   - `002_insert_test_accounts.sql`에 테스트 계정 비밀번호 해시 포함
   - 프로덕션 환경에서는 제거 권장

2. **데이터 삭제 스크립트**
   - `015_cleanup_all_data_except_profiles.sql`는 모든 데이터 삭제
   - 실행 전 백업 필수

---

## 📝 권장 사항

### 1. 스크립트 정리
- 사용되지 않는 스크립트는 `archive/` 디렉토리로 이동
- 현재 사용 중인 스크립트만 `scripts/`에 유지

### 2. 문서화 개선
- 각 스크립트에 목적과 실행 조건 명시
- 롤백 방법 문서화

### 3. 버전 관리
- 스크립트 변경 이력 관리
- 마이그레이션 버전 번호 부여

---

## 결론

대부분의 SQL 스크립트는 안전하게 작성되어 있으며, 보안 위험이 낮습니다. 다만 데이터 삭제 스크립트와 테스트 계정 스크립트는 프로덕션 환경에서 주의가 필요합니다.
