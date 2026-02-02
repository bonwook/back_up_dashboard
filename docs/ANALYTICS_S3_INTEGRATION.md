# Analytics 탭의 S3 연동 구조

## 1. 파일 목록 조회 (`/api/storage/files`)

**위치**: `app/api/storage/files/route.ts`

```typescript
// DB의 user_files 테이블에서 사용자별 파일 조회
SELECT id, file_name, file_path, s3_key, s3_bucket,
       file_size, content_type, file_type, uploaded_at
FROM user_files
WHERE user_id = ? AND file_type = ?
ORDER BY uploaded_at DESC
```

**Analytics 페이지에서 호출**:
```typescript
// app/client/analytics/page.tsx:66
const response = await fetch(`/api/storage/files?fileType=${fileTypeParam}`)
```

## 2. 파일 미리보기 (`/api/storage/preview`)

**위치**: `app/api/storage/preview/route.ts`

**S3에서 파일 다운로드**:
```typescript
// S3에서 파일 다운로드
const command = new GetObjectCommand({
  Bucket: BUCKET_NAME,
  Key: key,
})
const response = await s3Client.send(command)
const uint8Array = await response.Body.transformToByteArray()
```

**Excel 파일 처리**:
- ExcelJS로 파싱하여 첫 10행 데이터 추출
- 헤더와 데이터 반환

**DICOM 파일 처리**:
- DICM 태그 확인
- 메타데이터 추출

## 3. 서명된 URL 생성 (`/api/storage/signed-url`)

**위치**: `app/api/storage/signed-url/route.ts`

```typescript
// S3 서명된 URL 생성 (PDF 미리보기용)
const signedUrl = await getSignedDownloadUrl(key, expiresIn)
```

**Analytics 페이지에서 사용**:
```typescript
// app/client/analytics/page.tsx:128
const response = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(file.key)}`)
```

## 4. 파일 업로드 (`/api/storage/upload`)

**위치**: `app/api/storage/upload/route.ts`

**S3 업로드 및 DB 저장**:
```typescript
// 1. S3에 업로드
const s3Path = await uploadToS3(buffer, s3Key, contentType)

// 2. DB에 파일 정보 저장
INSERT INTO user_files (
  id, user_id, file_name, file_path, s3_key, s3_bucket,
  file_size, content_type, file_type, uploaded_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
```

## 데이터 흐름

1. **업로드**: Upload 탭 → `/api/storage/upload` → S3 업로드 + DB 저장
2. **목록 조회**: Analytics 탭 → `/api/storage/files` → DB에서 파일 목록 조회
3. **미리보기**: Analytics 탭 → `/api/storage/preview` → S3에서 파일 다운로드 → 파싱/표시
4. **PDF 다운로드**: Analytics 탭 → `/api/storage/signed-url` → S3 서명된 URL 생성

