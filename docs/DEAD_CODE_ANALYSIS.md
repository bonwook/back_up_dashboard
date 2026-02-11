# 찌꺼기 코드 분석 보고서 (Dead Code / Unmapped)

전체 repo를 분석하여 **사용되지 않거나 어디에도 매핑되지 않은** 코드·파일·API를 정리한 목록입니다.  
목적: 레포 정리(찌꺼기 제거).

---

## ✅ 정리 완료 요약 (Cleanup Completed)

아래 항목들이 **삭제** 또는 **수정**되었습니다.

### 삭제된 파일 (6개)
| 파일 | 비고 |
|------|------|
| `components/virtualized-table.tsx` | 사용처 없음 |
| `components/ui/sonner.tsx` | 사용처 없음 |
| `lib/utils/commentColorHelpers.ts` | 사용처 없음 |
| `app/admin/progress/page.tsx.new` | 백업/임시 파일 |
| `proxy.ts` | 미들웨어에서 미사용 |
| `app/admin/billing/page.tsx` | redirect만 하던 페이지 |

### 삭제된 API 라우트 (5개)
| 경로 | 파일 |
|------|------|
| `GET/POST /api/billing` | `app/api/billing/route.ts` |
| `GET /api/storage/list` | `app/api/storage/list/route.ts` |
| `GET /api/task_assignments` | `app/api/task_assignments/route.ts` |
| `GET /api/tasks/all-with-subtasks` | `app/api/tasks/all-with-subtasks/route.ts` |
| `GET /api/staff` | `app/api/staff/route.ts` |

### 수정된 코드 (1곳)
| 위치 | 변경 내용 |
|------|-----------|
| `app/admin/progress/hooks/useTaskManagement.ts` | `fetch("/api/admin/tasks", ...)` → `fetch("/api/tasks/all", ...)` (존재하지 않던 API 호출 수정) |

### 삭제된 줄 수 (git diff --stat 기준)
| 구분 | 줄 수 |
|------|--------|
| **삭제된 줄** | **2,917줄** |
| 수정으로 추가된 줄 | 1줄 |
| **순 감소** | **2,916줄** |

| 파일 | 삭제된 줄 |
|------|-----------|
| `app/admin/progress/page.tsx.new` | 2,188 |
| `app/api/tasks/all-with-subtasks/route.ts` | 166 |
| `app/api/task_assignments/route.ts` | 118 |
| `app/api/billing/route.ts` | 84 |
| `components/virtualized-table.tsx` | 136 |
| `lib/utils/commentColorHelpers.ts` | 62 |
| `proxy.ts` | 50 |
| `app/api/staff/route.ts` | 35 |
| `app/api/storage/list/route.ts` | 39 |
| `components/ui/sonner.tsx` | 25 |
| `app/admin/billing/page.tsx` | 13 |

---

## 1. 사용처 없는 파일 (삭제 검토 가능) — ✅ 해당 항목 삭제 완료

### 1.1 컴포넌트 — ✅ 삭제 완료
| 파일 | 설명 |
|------|------|
| ~~`components/virtualized-table.tsx`~~ | ✅ 삭제됨. |
| ~~`components/ui/sonner.tsx`~~ | ✅ 삭제됨. |

### 1.2 라이브러리/유틸 — ✅ 삭제 완료
| 파일 | 설명 |
|------|------|
| ~~`lib/utils/commentColorHelpers.ts`~~ | ✅ 삭제됨. |

### 1.3 백업/임시 파일 — ✅ 삭제 완료
| 파일 | 설명 |
|------|------|
| ~~`app/admin/progress/page.tsx.new`~~ | ✅ 삭제됨. |

### 1.4 미들웨어/프록시 — ✅ 삭제 완료
| 파일 | 설명 |
|------|------|
| ~~`proxy.ts`~~ | ✅ 삭제됨. |

---

## 2. 호출처 없는 API 라우트 (Dead API) — ✅ 해당 라우트 삭제 완료

| API 경로 | 파일 | 비고 |
|----------|------|------|
| ~~`GET/POST /api/billing`~~ | ~~`app/api/billing/route.ts`~~ | ✅ 삭제됨. |
| ~~`GET /api/storage/list`~~ | ~~`app/api/storage/list/route.ts`~~ | ✅ 삭제됨. |
| ~~`GET /api/task_assignments`~~ | ~~`app/api/task_assignments/route.ts`~~ | ✅ 삭제됨. |
| ~~`GET /api/tasks/all-with-subtasks`~~ | ~~`app/api/tasks/all-with-subtasks/route.ts`~~ | ✅ 삭제됨. |
| ~~`GET /api/staff`~~ | ~~`app/api/staff/route.ts`~~ | ✅ 삭제됨. |

---

## 3. 잘못된 API 경로 (버그 가능성) — ✅ 수정 완료

| 위치 | 내용 | 처리 |
|------|------|------|
| `app/admin/progress/hooks/useTaskManagement.ts` | `fetch("/api/admin/tasks", ...)` | ✅ `fetch("/api/tasks/all", ...)` 로 수정 완료. |

---

## 4. 네비게이션에 없는 페이지 (직접 URL로만 접근 가능)

사이드바/네비에 링크가 없어, 북마크나 직접 URL로만 접근 가능한 페이지. 기능은 살아 있으나 “숨겨진” 라우트.

| 경로 | 비고 |
|------|------|
| `/admin/upload` | Admin 사이드바에는 “Upload” → `/admin/file-upload` 만 있음. `/admin/upload` 는 링크 없음. |
| `/admin/upload-client` | 동일. 링크 없음. |
| ~~`/admin/billing`~~ | ✅ 페이지 삭제됨 (redirect만 하던 페이지). |

---

## 5. 사용되지 않는 UI 컴포넌트 (shadcn 등)

`components/ui/` 아래에서 **다른 파일에서 import 되지 않은** 컴포넌트.  
(나중에 쓰일 수 있으므로 “삭제 후보”로만 표시.)

- `aspect-ratio.tsx`
- `carousel.tsx`
- `collapsible.tsx`
- `command.tsx`
- `context-menu.tsx`
- `drawer.tsx`
- `hover-card.tsx`
- `input-otp.tsx`
- `item.tsx`
- `kbd.tsx`
- `menubar.tsx`
- `navigation-menu.tsx`
- `resizable.tsx` (문자열 "resizable"은 인라인 스타일/데이터 속성으로만 사용, **컴포넌트 import 아님**)
- `slider.tsx`
- ~~`sonner.tsx`~~ (삭제 완료)

---

## 6. 기타 참고

- **lib/auth.ts**  
  `./auth/index` re-export만 함. `@/lib/auth` 로 많이 쓰이므로 유지.  
- **lib/database/**  
  `lib/db/mysql.ts`, `lib/db/auth.ts`, `lib/auth/index.ts` 등에서 사용. 사용 중.  
- **lib/archive/**  
  `app/api/storage/extract/route.ts` 에서 사용. 사용 중.  
- **API 사용 중인 것들**  
  ` /api/tasks/*`, `/api/storage/*` (list 제외), `/api/auth/*`, `/api/reports`, `/api/holidays`, `/api/analytics/dashboard`, `/api/excel/parse`, `/api/profiles` 등은 프론트에서 호출됨.

---

## 7. 정리 우선순위 제안

1. **버그 수정**  
   - `app/admin/progress/hooks/useTaskManagement.ts` 의 `/api/admin/tasks` → 실제 사용 중인 API(예: `/api/tasks/all`)로 변경.

2. **삭제 검토 (찌꺼기)**  
   - `components/virtualized-table.tsx`  
   - `components/ui/sonner.tsx`  
   - `lib/utils/commentColorHelpers.ts`  
   - `app/admin/progress/page.tsx.new`  
   - `proxy.ts` (미들웨어로 쓰이지 않는 경우)

3. **API 정리**  
   - `/api/billing`, `/api/storage/list`, `/api/task_assignments`, `/api/tasks/all-with-subtasks`, `/api/staff`  
   - 팀에서 “앞으로도 안 쓸 것”이면 라우트 삭제; “나중에 쓸 것”이면 유지 후 문서화.

4. **페이지 정리**  
   - `/admin/upload`, `/admin/upload-client`, `/admin/billing`  
   - 의도된 “숨김” 라우트인지, 아니면 제거/통합할 대상인지 결정 후 링크 추가 또는 제거.

5. **UI 컴포넌트**  
   - 사용 계획이 없으면 5번 목록부터 순차 제거해도 됨.

---

이 문서는 분석 시점 기준입니다. 실제 삭제 전에 빌드·테스트로 영향 범위를 한 번 더 확인하는 것을 권장합니다.
