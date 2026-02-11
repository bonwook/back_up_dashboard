# admin/reports – REDCap 벤치마킹 CSV 명세

## 1. 참조 자료

- **REDCap 매뉴얼 (문피디 Quickstart)**  
  [직접 만들고 바로 활용하는 임상연구 자료관리 REDCap 매뉴얼](https://moonpd.ai/ebook/ch014556/Dp3iVYPwhmBGqYNJLUrkkR2jGa6xyK)  
  *(링크는 로그인 후 본문 열람 가능)*

- **매뉴얼 목차(챕터)**  
  아래 기능들이 REDCap 표준 개념이므로, 벤치마킹 시 이에 대응하는 property를 두는 것을 권장한다.

| 챕터 | 주제 | 벤치마킹 시 반영할 개념 |
|------|------|-------------------------|
| 01 | eCRF 편집기(Online Designer) | 폼/필드 메타데이터, 배치 |
| 02 | 계산식 설정(Calculations and Functions) | 계산 필드, 수식 |
| 03 | 브랜칭 로직(Branching Logic) | 조건부 표시/건너뛰기 |
| 04 | 추적 관찰 연구(Longitudinal Project) | 이벤트, 방문 |
| 05 | 반복형 CRF(Repeating Instruments and Events) | 반복 도구/인스턴스 |
| 06 | 필드 임베딩(Field Embedding) | 서브폼/임베딩 |
| 07 | CRF 디스플레이 로직(Form Display Logic) | 폼 표시 조건 |
| 08 | CSV 템플릿으로 eCRF 구축(Data Dictionary) | **Data Dictionary CSV 컬럼 전체** |
| 09 | 스냅샷(Snapshot) | 버전/스냅샷 식별자 |
| 10 | 연구대상자 일정 관리(Scheduling Module) | 일정, 방문일 |
| 11 | 오류 데이터 검출(Data Quality) | 검증 규칙, 오류 플래그 |
| 12 | 데이터 내보내기(Data Exports) | **내보내기 CSV 컬럼(레코드 단위)** |

---

## 2. 요구 동작 요약

- **admin/reports**에서 REDCap 스타일을 벤치마킹한 결과를 **CSV 파일**로 제공한다.
- **UI**에서 **남성 / 여성** 선택 시, 그 조건이 적용된 결과만 **취합**되어 최종 CSV에 포함된다.
- 즉, “성별 필터 선택 → (선택에 맞는 데이터만) 결과 취합 → CSV 저장” 흐름을 지원한다.

---

## 3. CSV 종류 및 용도

REDCap 벤치마킹을 위해 다음 두 종류의 CSV를 정의한다.

| 구분 | 용도 | 성별 필터 적용 |
|------|------|----------------|
| **A. Data Dictionary CSV** | eCRF 구조 정의(필드 목록, 타입, 라벨 등) | 적용 안 함(메타데이터) |
| **B. 데이터 내보내기 CSV** | 실제 레코드(연구대상자/케이스 단위 데이터) | **적용함(남/여 선택)** |

---

## 4. A. Data Dictionary CSV – 넣어야 할 property(컬럼) 전부

REDCap Data Dictionary 및 매뉴얼 08장(CSV 템플릿으로 eCRF 구축)을 벤치마킹할 때 사용할 컬럼 목록이다.  
*표준 REDCap Data Dictionary 컬럼명을 기준으로 하되, 우리 시스템에서 채울 수 있는 것만 포함해도 된다.*

| # | Property (컬럼명) | 설명 | 필수 | 비고 |
|---|-------------------|------|------|------|
| 1 | `variable_name` | 필드(변수) 고유 이름 | ✅ | 영문, 숫자, 언더스코어 |
| 2 | `form_name` | 소속 폼(CRF) 이름 | ✅ | |
| 3 | `section_header` | 섹션 제목(그룹 라벨) | | 01 eCRF 편집기 |
| 4 | `field_type` | 필드 타입 | ✅ | text, notes, dropdown, radio, checkbox, yesno, truefalse, file, calc, descriptive, date, datetime, number 등 |
| 5 | `field_label` | 화면에 보이는 라벨(한글 가능) | ✅ | |
| 6 | `choices` | 라디오/드롭다운/체크박스 선택지 | | `1, Male \| 2, Female` 형태 |
| 7 | `field_note` | 필드 설명/도움말 | | |
| 8 | `text_validation_type` | 텍스트 검증 타입 | | email, integer, number, date_ymd, phone 등 |
| 9 | `text_validation_min` | 최소값(숫자/날짜 등) | | 02 계산식·검증 |
| 10 | `text_validation_max` | 최대값 | | |
| 11 | `identifier` | 식별자 여부 (1/0) | | |
| 12 | `branching_logic` | 브랜칭 로직 수식 | | 03 브랜칭 로직 |
| 13 | `required_field` | 필수 입력 여부 (Y/empty) | | |
| 14 | `custom_alignment` | 정렬 (L/R/C 등) | | |
| 15 | `question_number` | 질문 번호 | | |
| 16 | `matrix_group_name` | 매트릭스 그룹명 | | |
| 17 | `matrix_ranking` | 매트릭스 순위 (1/0) | | |
| 18 | `field_units` | 단위(예: kg, cm) | | |
| 19 | `calculation` | 계산식(Calc 필드) | | 02 계산식 |
| 20 | `form_display_logic` | 폼 표시 조건 | | 07 CRF 디스플레이 로직 |
| 21 | `editing_role` | 편집 권한(역할) | | |

**참고:**  
- 실제 구현 시 위 표를 그대로 CSV 헤더로 쓰고, 우리 프로젝트의 폼/필드 정의를 한 행씩 채우면 REDCap Data Dictionary 스타일 CSV가 된다.  
- 챕터 08 “CSV 템플릿으로 eCRF 구축”에 대응한다.

---

## 5. B. 데이터 내보내기 CSV – 넣어야 할 property(컬럼) 전부

매뉴얼 12장 “데이터 내보내기”를 벤치마킹하는 **레코드 단위** CSV이다.  
**성별(남/여) 필터**는 이 CSV를 만들 때 적용한다(선택한 성별에 해당하는 레코드만 포함).

### 5.1 시스템 예약 컬럼(REDCap 표준 호환)

| # | Property (컬럼명) | 설명 | 필수 | 성별 필터 |
|---|-------------------|------|------|-----------|
| 1 | `record_id` | 레코드(대상자/케이스) 고유 ID | ✅ | - |
| 2 | `redcap_event_name` | 이벤트(방문) 이름 | | 04 Longitudinal |
| 3 | `redcap_repeat_instrument` | 반복 도구(폼) 이름 | | 05 반복형 CRF |
| 4 | `redcap_repeat_instance` | 반복 인스턴스 번호 | | 05 |
| 5 | `redcap_snapshot` | 스냅샷 식별(있을 경우) | | 09 스냅샷 |

### 5.2 인구통계/스크리닝 필드(성별 필터 적용 대상)

| # | Property (컬럼명) | 설명 | 값 예시 | 성별 필터 |
|---|-------------------|------|---------|-----------|
| 6 | `sex` 또는 `gender` | 성별 | `1`=남성, `2`=여성 (또는 Male/Female) | **UI에서 남/여 선택 시 이 컬럼으로 필터** |
| 7 | `birth_year` / `birth_date` | 출생년도 또는 생년월일 | | |
| 8 | `age` | 나이(또는 계산된 값) | | |
| 9 | `screening_date` | 스크리닝/등록일 | | 10 일정 |

### 5.3 우리 시스템 대응 필드(예시)

| # | Property (컬럼명) | 설명 | DB/소스 |
|---|-------------------|------|----------|
| 10 | `case_number` | 케이스 번호 | cases.case_number |
| 11 | `patient_name` | 환자명 | task_assignments.title / cases.patient_name |
| 12 | `study_date` | 검사/연구 일자 | cases.study_date |
| 13 | `data_type` | 데이터 유형 | cases.data_type |
| 14 | `status` | 케이스/작업 상태 | task_assignments.status 등 |
| 15 | `assigned_to_name` | 담당자명 | profiles.full_name |
| 16 | `completed_at` | 완료 일시 | task_assignments.completed_at |
| 17 | `report_created_at` | 리포트 생성 일시 | reports.created_at |
| 18 | `staff_comments` | 담당자 코멘트 | reports.staff_comments |
| 19 | `client_comments` | 고객용 코멘트 | reports.client_comments |

### 5.4 기타 REDCap 벤치마킹용(선택)

| # | Property (컬럼명) | 설명 | 챕터 |
|---|-------------------|------|------|
| 20 | `visit_date` | 방문일 | 10 일정 |
| 21 | `data_quality_flag` | 데이터 품질 오류 플래그 | 11 Data Quality |
| 22 | `form_name` | 해당 레코드가 속한 폼명 | 01, 07 |

**성별 필터 적용 규칙**

- UI에서 **“남성”** 선택 → `sex`(또는 `gender`)가 남성 코드(예: `1` 또는 `Male`)인 행만 포함해 CSV 생성.
- **“여성”** 선택 → 여성 코드인 행만 포함.
- **“전체”** 선택 시 → 필터 없이 전부 포함.

---

## 6. UI 요구사항(요약)

- **위치:** `admin/reports`
- **동작:**
  1. 성별 선택: **전체 / 남성 / 여성** (라디오 또는 드롭다운).
  2. “결과 취합” 또는 “CSV 내보내기” 버튼 클릭 시, 선택한 성별 조건을 적용한 **데이터 내보내기 CSV(B)** 생성.
  3. (선택) Data Dictionary CSV(A)도 별도 버튼으로 다운로드 가능하게 할 수 있음.
- **저장:** 생성된 CSV를 파일로 다운로드(또는 서버에 저장 후 링크 제공)하여 “맨 마지막에 결과를 취합해서 CSV에 저장”하도록 한다.

---

## 7. 정리

- **REDCap 매뉴얼 링크**의 목차(01~12)에 맞춰, **Data Dictionary용 property(§4)** 와 **데이터 내보내기용 property(§5)** 를 위와 같이 정의했다.
- **성별(남/여)** 는 데이터 내보내기 CSV의 `sex`(또는 `gender`) 컬럼으로 표현하고, UI에서 선택한 값으로 필터링한 뒤 취합 결과만 CSV로 저장하면 된다.
- 구현 시 §4는 “구조 내보내기”, §5는 “데이터 내보내기(성별 필터 적용)”로 나누어 API/프론트를 만들면 된다.
