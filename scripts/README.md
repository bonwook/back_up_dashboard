# Database Scripts

이 폴더에는 Flonics Dashboard의 데이터베이스 스키마와 관련 스크립트가 포함되어 있습니다.

## 파일 설명

### 필수 파일

- **`schema.sql`** - 전체 데이터베이스 스키마 (통합 버전)
  - 모든 테이블 정의 포함
  - 새로운 데이터베이스 설정 시 이 파일만 실행하면 됩니다

- **`test_data.sql`** - 테스트 계정 데이터
  - 개발 환경에서 사용할 테스트 계정 삽입

## 사용 방법

### 1. 새로운 데이터베이스 설정

```bash
# 1. 데이터베이스 생성
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS flonics_dashboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. 스키마 적용
mysql -u root -p flonics_dashboard < scripts/schema.sql

# 3. (선택사항) 테스트 데이터 삽입
mysql -u root -p flonics_dashboard < scripts/test_data.sql
```

### 2. 기존 데이터베이스 확인

현재 스키마가 최신 버전인지 확인:

```sql
-- task_assignments 테이블의 컬럼 확인
SHOW COLUMNS FROM task_assignments;

-- 필수 컬럼 체크:
-- - assignment_type (ENUM)
-- - comment (LONGTEXT)
-- - comment_file_keys (JSON)
-- - due_date (DATE)
-- - is_multi_assign (BOOLEAN)

-- task_subtasks 테이블의 컬럼 확인
SHOW COLUMNS FROM task_subtasks;

-- 필수 컬럼 체크:
-- - subtitle (VARCHAR)
-- - comment (LONGTEXT)
-- - comment_file_keys (JSON)
```

## 테이블 구조

### Core Tables
1. **profiles** - 사용자 관리
2. **cases** - DICOM 데이터 관리
3. **reports** - 분석 리포트
4. **user_files** - 파일 추적
5. **billing** - 청구 관리
6. **audit_log** - 활동 로그

### Task Management Tables
7. **task_assignments** - 메인 작업
8. **task_subtasks** - 서브 작업 (다중 할당)
9. **task_status_history** - 상태 변경 이력

## 주의사항

- 프로덕션 환경에서는 `test_data.sql`을 실행하지 마세요
- 스키마 변경 전에 항상 백업을 생성하세요
- Foreign Key 제약 조건으로 인해 테이블 삭제 순서에 주의하세요
