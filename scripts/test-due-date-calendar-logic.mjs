/**
 * 마감일 달력 화이트박스 테스트
 * progress 페이지의 dueDatePatchId, canEditDueDate, API 오류 메시지 추출 로직 검증
 * 실행: node scripts/test-due-date-calendar-logic.mjs
 */

const tests = []
let passed = 0
let failed = 0

function assert(condition, name, detail = "") {
  tests.push({ name, ok: !!condition, detail })
  if (condition) passed++
  else failed++
}

// --- 페이지와 동일한 로직 (복사) ---
function getDueDatePatchId(currentTask, workTaskId) {
  return currentTask.is_subtask && currentTask.task_id ? currentTask.task_id : workTaskId
}

function getCanEditDueDate(tasks, dueDatePatchId) {
  const taskToUpdate = tasks.find((t) => t.id === dueDatePatchId)
  return taskToUpdate?.status !== "completed"
}

function getErrorMessage(errBody) {
  return typeof errBody?.error === "string" ? errBody.error : "마감일 업데이트 실패"
}

// --- 테스트 데이터 ---
const mainTask = {
  id: "main-1",
  task_id: undefined,
  is_subtask: false,
  status: "in_progress",
  due_date: "2025-02-10",
}
const subtask = {
  id: "sub-1",
  task_id: "main-1",
  is_subtask: true,
  status: "pending",
  due_date: "2025-02-10",
}
const completedMain = { ...mainTask, id: "main-2", status: "completed" }
const tasksList = [mainTask, subtask, completedMain, { id: "main-1", status: "in_progress" }]

// --- 1. dueDatePatchId: 메인 태스크 ---
const patchIdMain = getDueDatePatchId(mainTask, "main-1")
assert(patchIdMain === "main-1", "dueDatePatchId: 메인 태스크일 때 workTaskId 사용", `got ${patchIdMain}`)

// --- 2. dueDatePatchId: 서브태스크 ---
const patchIdSub = getDueDatePatchId(subtask, "sub-1")
assert(patchIdSub === "main-1", "dueDatePatchId: 서브태스크일 때 부모 task_id 사용", `got ${patchIdSub}`)

// --- 3. dueDatePatchId: 서브태스크인데 task_id 없음 (레거시) ---
const subtaskNoParent = { ...subtask, task_id: undefined }
const patchIdSubNoParent = getDueDatePatchId(subtaskNoParent, "sub-1")
assert(patchIdSubNoParent === "sub-1", "dueDatePatchId: 서브태스크에 task_id 없으면 workTaskId", `got ${patchIdSubNoParent}`)

// --- 4. canEditDueDate: 완료 아닐 때 ---
const canEdit = getCanEditDueDate(tasksList, "main-1")
assert(canEdit === true, "canEditDueDate: status !== completed 이면 true", `got ${canEdit}`)

// --- 5. canEditDueDate: 완료일 때 ---
const canEditCompleted = getCanEditDueDate(tasksList, "main-2")
assert(canEditCompleted === false, "canEditDueDate: status === completed 이면 false", `got ${canEditCompleted}`)

// --- 6. canEditDueDate: 부모가 완료인 서브태스크 (목록에 부모 있음) ---
const tasksWithCompletedParent = [
  { id: "main-1", status: "completed" },
  { id: "sub-1", task_id: "main-1", is_subtask: true, status: "pending" },
]
const canEditSubWithCompletedParent = getCanEditDueDate(tasksWithCompletedParent, "main-1")
assert(canEditSubWithCompletedParent === false, "canEditDueDate: PATCH 대상(부모)이 completed면 false", `got ${canEditSubWithCompletedParent}`)

// --- 7. canEditDueDate: PATCH 대상이 목록에 없으면 (undefined?.status !== 'completed' === true) ---
const canEditUnknown = getCanEditDueDate(tasksList, "unknown-id")
assert(canEditUnknown === true, "canEditDueDate: taskToUpdate 없으면 편집 허용(API에서 검증)", `got ${canEditUnknown}`)

// --- 8. API 오류 메시지 추출: 문자열이면 그대로 ---
assert(getErrorMessage({ error: "완료된 작업은 마감일을 변경할 수 없습니다" }) === "완료된 작업은 마감일을 변경할 수 없습니다", "errorMessage: errBody.error 문자열 반환")
assert(getErrorMessage({ error: "마감일은 업무를 준 사람(요청자) 또는 관리자만 수정할 수 있습니다" }) === "마감일은 업무를 준 사람(요청자) 또는 관리자만 수정할 수 있습니다", "errorMessage: 403 메시지 반환")

// --- 9. API 오류 메시지: 없거나 비정상이면 기본값 ---
assert(getErrorMessage({}) === "마감일 업데이트 실패", "errorMessage: error 없으면 기본값")
assert(getErrorMessage({ error: null }) === "마감일 업데이트 실패", "errorMessage: error null이면 기본값")

// --- 10. 날짜 포맷 (yyyy-MM-dd) 검증 (실제 format은 date-fns 사용, 여기서는 형식만) ---
const yyyyMmDd = /^\d{4}-\d{2}-\d{2}$/
assert(yyyyMmDd.test("2025-02-03"), "dueDateValue 형식: yyyy-MM-dd 유효")
assert(!yyyyMmDd.test("03/02/2025"), "dueDateValue 형식: 다른 형식 아님")

// --- 결과 출력 ---
console.log("\n=== 마감일 달력 화이트박스 테스트 ===\n")
tests.forEach((t) => {
  console.log(t.ok ? "  ✓" : "  ✗", t.name, t.detail ? `(${t.detail})` : "")
})
console.log("\n총계:", passed + failed, "| 통과:", passed, "| 실패:", failed)
process.exit(failed > 0 ? 1 : 0)
