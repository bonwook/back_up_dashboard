/**
 * 태스크 날짜 계산 헬퍼 함수
 * - 완료된 태스크: completed_at
 * - 미완료 태스크: due_date가 있으면 due_date, 없으면 created_at
 */

/**
 * SQL에서 사용할 task_datetime 계산 표현식 (메인 태스크용)
 * 완료된 태스크는 완료일, 미완료는 마감일 또는 시작일
 * @param alias 테이블 alias (예: 'ta')
 */
export const TASK_DATETIME_SQL = (alias: string) => `
  CASE 
    WHEN ${alias}.status = 'completed' AND ${alias}.completed_at IS NOT NULL THEN ${alias}.completed_at
    ELSE COALESCE(${alias}.due_date, ${alias}.created_at)
  END
`.trim()

/**
 * 서브태스크용 task_datetime 계산 표현식
 * 서브태스크는 자신의 status와 completed_at을 사용
 * 마감일은 메인 태스크의 due_date 사용
 * @param subtaskAlias 서브태스크 테이블 alias (예: 'ts')
 * @param mainTaskAlias 메인 태스크 테이블 alias (예: 'ta')
 */
export const SUBTASK_DATETIME_SQL = (subtaskAlias: string, mainTaskAlias: string) => `
  CASE 
    WHEN ${subtaskAlias}.status = 'completed' AND ${subtaskAlias}.completed_at IS NOT NULL THEN ${subtaskAlias}.completed_at
    ELSE COALESCE(${mainTaskAlias}.due_date, ${subtaskAlias}.created_at)
  END
`.trim()

/**
 * 클라이언트 측에서 task datetime 계산
 */
export function calculateTaskDatetime(
  status: string,
  completedAt: string | null,
  dueDate: string | null,
  createdAt: string
): string {
  if (status === 'completed' && completedAt) {
    return completedAt
  }
  return dueDate || createdAt
}
