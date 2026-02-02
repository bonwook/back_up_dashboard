# Flonics 4D Flow MRI Dashboard Architecture

## 프로젝트 구조

```
flonics-dashboard/
├── app/
│   ├── api/                    # 🔧 API Routes (라우팅 진입점)
│   │   ├── auth/              # 인증 관련 API
│   │   ├── tasks/              # 작업 관리 API
│   │   ├── storage/            # 파일 스토리지 API
│   │   ├── reports/            # 리포트 API
│   │   ├── analytics/         # 분석 API
│   │   ├── billing/            # 빌링 API
│   │   ├── profiles/           # 프로필 API
│   │   └── excel/              # 엑셀 파싱 API
│   │
│   ├── admin/                  # 🎨 Admin Pages (라우팅 진입점)
│   ├── client/                 # 🎨 Client Pages (라우팅 진입점)
│   └── auth/                   # 🎨 Auth Pages (라우팅 진입점)
│
├── lib/
│   ├── services/               # 🔧 외부 서비스 연동
│   │   └── aws/
│   │       └── s3.ts          # AWS S3 파일 관리
│   │
│   ├── database/               # 🔧 데이터베이스 관련
│   │   ├── mysql.ts           # MySQL 연결 풀
│   │   ├── auth.ts            # 인증 DB 쿼리
│   │   ├── client.ts          # 클라이언트 사이드 DB 클라이언트
│   │   └── server.ts          # 서버 사이드 DB 클라이언트
│   │
│   ├── auth/                   # 🔧 인증 관련 로직
│   │   └── index.ts           # 인증 유틸리티 (getCurrentUser, requireAuth 등)
│   │
│   ├── types/                  # 📦 타입 정의
│   │   └── index.ts           # TypeScript 타입 정의
│   │
│   └── utils/                  # 🔧 유틸리티 함수
│       ├── index.ts           # 공통 유틸리티 (cn 함수 등)
│       └── fetch.ts           # 인증된 fetch 래퍼
│
├── components/                 # 🎨 UI 컴포넌트
│   ├── ui/                    # 기본 UI 컴포넌트 (shadcn/ui)
│   └── *.tsx                  # 기능별 컴포넌트
│
├── hooks/                      # 🔧 상태 관리 및 흐름 제어
│   ├── use-mobile.ts
│   └── use-toast.ts
│
├── scripts/                    # 🗄️ 데이터베이스 스크립트
└── proxy.ts                    # 🔧 미들웨어
```

## Backend (백엔드)

### 1. API Routes (`app/api/`)
- REST API 엔드포인트
- 비즈니스 로직 처리
- 데이터베이스 CRUD 작업

### 2. Database Layer (`lib/database/`)
- MySQL 연결 풀 관리 (`mysql.ts`)
- 데이터베이스 쿼리 함수
- 클라이언트/서버 사이드 DB 클라이언트
- 인증 관련 DB 쿼리 (`auth.ts`)

### 3. Services (`lib/services/aws/`)
- AWS S3 파일 관리
- 파일 업로드/다운로드
- Presigned URL 생성

### 4. Auth (`lib/auth/`)
- JWT 토큰 생성/검증
- 비밀번호 해싱
- 현재 사용자 조회
- 권한 검증

### 4. Middleware (`proxy.ts`)
- 인증 확인
- 권한 검증 (admin/staff/client)
- 라우트 보호

## Frontend (프론트엔드)

### 1. Pages (`app/admin/`, `app/client/`, `app/auth/`)
- React Server Components
- UI 렌더링
- API 호출

### 2. Components (`components/`)
- 재사용 가능한 UI 컴포넌트
- 클라이언트 컴포넌트 ('use client')

## Database Setup (데이터베이스 설정)

### SQL 파일 실행 순서:

1. **AWS RDS Console 접속** 또는 **MySQL Workbench 사용**

2. **실행:**
```bash
# 1. 스키마 생성
mysql -h [YOUR_ENDPOINT] -P 3306 -u [USER] -p [DB_NAME] < scripts/001_mysql_schema.sql

# 2. 테스트 계정 생성 (선택)
mysql -h [YOUR_ENDPOINT] -P 3306 -u [USER] -p [DB_NAME] < scripts/002_mysql_test_accounts.sql
```

## Environment Variables

```.env
# Database (Aurora MySQL)
DB_HOST=your-aurora-endpoint.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=your-password
DB_NAME=flonics

# JWT Authentication
JWT_SECRET=your-secret-key-here-minimum-32-characters

# AWS S3 (File Storage)
AWS_REGION=ap-northeast-2
# IAM 역할을 사용하는 경우 아래 두 줄을 주석 처리하여 비활성화
# AWS_ACCESS_KEY_ID=your-access-key
# AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET_NAME=flonics-dicom-files
