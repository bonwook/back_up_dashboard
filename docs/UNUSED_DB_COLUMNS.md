# 사용하지 않는 DB 컬럼 목록

이 문서는 현재 코드베이스에서 사용되지 않는 데이터베이스 컬럼들을 정리합니다.

## profiles 테이블

### memo
- **타입**: TEXT
- **설명**: User notes/memo
- **상태**: 사용 안 함 (메모 기능 제거됨)
- **제거 가능**: ✅

## cases 테이블

> ⚠️ **참고**: cases 테이블은 `scripts/017_remove_cases_table.sql`에 의해 제거되었습니다. 하지만 스키마 정의에는 여전히 존재할 수 있습니다.

### s3_path
- **타입**: TEXT
- **설명**: Legacy field, use file_id instead
- **상태**: 사용 안 함 (file_id로 대체됨)
- **제거 가능**: ✅

### notes
- **타입**: TEXT
- **설명**: Additional notes
- **상태**: 사용 안 함
- **제거 가능**: ✅

## reports 테이블

> ⚠️ **참고**: reports 테이블은 cases 테이블과 병합되었고, 이후 cases 테이블이 제거되었습니다.

### report_file_url
- **타입**: TEXT
- **설명**: Legacy field, use file_id instead
- **상태**: 사용 안 함 (file_id로 대체됨)
- **제거 가능**: ✅

## task_assignments 테이블

### download_token
- **타입**: VARCHAR(255)
- **설명**: Token for downloading files (valid for 1 week)
- **상태**: 사용 안 함
- **설명**: 초기 설계에서 사용하려고 했지만, 실제로는 AWS S3 presigned URL 방식을 사용하게 되어 사용되지 않음. presigned URL은 서버에서 동적으로 생성되며 `expiresIn` 파라미터로 만료 시간을 설정함 (예: 604800초 = 7일). 따라서 DB에 토큰을 저장할 필요가 없음.
- **제거 가능**: ✅

### due_date
- **타입**: DATE
- **설명**: Due date for the task
- **상태**: 사용 안 함 (스크립트로 추가되었지만 실제 사용되지 않음)
- **제거 가능**: ✅

## billing 테이블

### notes
- **타입**: TEXT
- **설명**: Additional notes
- **상태**: 사용 안 함 (admin에서도 메모 기능 사용하지 않음)
- **제거 가능**: ✅

## 정리 요약

### 제거 가능한 컬럼
1. `profiles.memo` - 메모 기능 제거로 인해 사용 안 함
2. `cases.s3_path` - Legacy field
3. `cases.notes` - 사용 안 함
4. `reports.report_file_url` - Legacy field
5. `task_assignments.download_token` - 사용 안 함
6. `task_assignments.due_date` - 사용 안 함

### 주의사항
- `cases` 테이블과 `reports` 테이블은 이미 제거되었을 수 있습니다.
- 실제 데이터베이스 상태를 확인한 후 컬럼 제거를 진행하세요.
- 제거 전에 데이터 백업을 권장합니다.
