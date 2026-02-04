import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { query } from "@/lib/db/mysql"
import { randomUUID } from "crypto"
import { writeAuditLog } from "@/lib/db/audit"

// GET /api/tasks/[id] - Task 또는 Subtask 상세 정보 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("auth-token")?.value
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Next.js 15에서는 params가 Promise이므로 await 필요
    const { id } = await params
    const taskId = id

    // Check if user is admin or staff (can view all tasks)
    const userRoleRes = await query(
      `SELECT role FROM profiles WHERE id = ?`,
      [decoded.id]
    )

    const userRole = userRoleRes && userRoleRes.length > 0 ? userRoleRes[0].role : null
    const isAdminOrStaff = userRole === "admin" || userRole === "staff"

    // 먼저 메인 태스크 확인
    const mainTaskSql = `
      SELECT 
        ta.*,
        ta.assignment_type,
        p_assigned_by.full_name as assigned_by_name,
        p_assigned_by.email as assigned_by_email,
        p_assigned_to.full_name as assigned_to_name,
        p_assigned_to.email as assigned_to_email
      FROM task_assignments ta
      LEFT JOIN profiles p_assigned_by ON ta.assigned_by = p_assigned_by.id
      LEFT JOIN profiles p_assigned_to ON ta.assigned_to = p_assigned_to.id
      WHERE ta.id = ?
    `

    const mainTasks = await query(mainTaskSql, [taskId])

    if (mainTasks && mainTasks.length > 0) {
      const task = mainTasks[0]

      // 권한 확인: admin/staff는 모든 task 조회 가능, 그 외는 자신의 task만
      if (!isAdminOrStaff && task.assigned_to !== decoded.id && task.assigned_by !== decoded.id) {
        return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
      }

      // Parse JSON file_keys, comment_file_keys
      try {
        const fileKeys = typeof task.file_keys === 'string' 
          ? JSON.parse(task.file_keys) 
          : task.file_keys || []
        const commentFileKeys = typeof task.comment_file_keys === 'string'
          ? JSON.parse(task.comment_file_keys)
          : task.comment_file_keys || []
        
        // 파일 업로드 날짜 정보 가져오기
        const fileKeysWithDates = await Promise.all(
          fileKeys.map(async (key: string) => {
            try {
              const fileInfo = await query(
                `SELECT uploaded_at FROM user_files WHERE s3_key = ? LIMIT 1`,
                [key]
              )
              return {
                key,
                uploaded_at: fileInfo && fileInfo.length > 0 ? fileInfo[0].uploaded_at : null
              }
            } catch {
              return { key, uploaded_at: null }
            }
          })
        )
        
        const commentFileKeysWithDates = await Promise.all(
          commentFileKeys.map(async (key: string) => {
            try {
              const fileInfo = await query(
                `SELECT uploaded_at FROM user_files WHERE s3_key = ? LIMIT 1`,
                [key]
              )
              return {
                key,
                uploaded_at: fileInfo && fileInfo.length > 0 ? fileInfo[0].uploaded_at : null
              }
            } catch {
              return { key, uploaded_at: null }
            }
          })
        )
        
        return NextResponse.json({
          task: {
            ...task,
            file_keys: fileKeysWithDates,
            comment_file_keys: commentFileKeysWithDates,
            shared_with: [],
          }
        })
      } catch {
        return NextResponse.json({
          task: {
            ...task,
            file_keys: [],
            comment_file_keys: [],
            shared_with: [],
          }
        })
      }
    }

    // 서브태스크 확인
    const subtaskSql = `
      SELECT 
        ts.*,
        ta.title,
        ta.priority,
        ta.due_date,
        ta.assigned_by,
        ta.assignment_type,
        ta.created_at as task_created_at,
        p_assigned_by.full_name as assigned_by_name,
        p_assigned_by.email as assigned_by_email,
        p_assigned_to.full_name as assigned_to_name,
        p_assigned_to.email as assigned_to_email
      FROM task_subtasks ts
      INNER JOIN task_assignments ta ON ts.task_id = ta.id
      LEFT JOIN profiles p_assigned_by ON ta.assigned_by = p_assigned_by.id
      LEFT JOIN profiles p_assigned_to ON ts.assigned_to = p_assigned_to.id
      WHERE ts.id = ?
    `

    const subtasks = await query(subtaskSql, [taskId])

    if (subtasks && subtasks.length > 0) {
      const subtask = subtasks[0]

      // 권한 확인: admin/staff는 모든 subtask 조회 가능, 그 외는 자신의 subtask만
      if (!isAdminOrStaff && subtask.assigned_to !== decoded.id && subtask.assigned_by !== decoded.id) {
        return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
      }

      // Parse JSON file_keys, comment_file_keys
      try {
        const fileKeys = typeof subtask.file_keys === 'string' 
          ? JSON.parse(subtask.file_keys) 
          : subtask.file_keys || []
        const commentFileKeys = typeof subtask.comment_file_keys === 'string'
          ? JSON.parse(subtask.comment_file_keys)
          : subtask.comment_file_keys || []
        
        // 파일 업로드 날짜 정보 가져오기
        const fileKeysWithDates = await Promise.all(
          fileKeys.map(async (key: string) => {
            try {
              const fileInfo = await query(
                `SELECT uploaded_at FROM user_files WHERE s3_key = ? LIMIT 1`,
                [key]
              )
              return {
                key,
                uploaded_at: fileInfo && fileInfo.length > 0 ? fileInfo[0].uploaded_at : null
              }
            } catch {
              return { key, uploaded_at: null }
            }
          })
        )
        
        const commentFileKeysWithDates = await Promise.all(
          commentFileKeys.map(async (key: string) => {
            try {
              const fileInfo = await query(
                `SELECT uploaded_at FROM user_files WHERE s3_key = ? LIMIT 1`,
                [key]
              )
              return {
                key,
                uploaded_at: fileInfo && fileInfo.length > 0 ? fileInfo[0].uploaded_at : null
              }
            } catch {
              return { key, uploaded_at: null }
            }
          })
        )
        
        return NextResponse.json({
          task: {
            id: subtask.id,
            task_id: subtask.task_id,
            subtitle: subtask.subtitle,
            assigned_to: subtask.assigned_to,
            assigned_by: subtask.assigned_by,
            title: subtask.title,
            content: subtask.content,
            priority: subtask.priority,
            status: subtask.status,
            due_date: subtask.due_date,
            file_keys: fileKeysWithDates,
            comment: subtask.comment,
            comment_file_keys: commentFileKeysWithDates,
            created_at: subtask.task_created_at || subtask.created_at,
            updated_at: subtask.updated_at,
            completed_at: subtask.completed_at,
            assigned_by_name: subtask.assigned_by_name,
            assigned_by_email: subtask.assigned_by_email,
            assigned_to_name: subtask.assigned_to_name,
            assigned_to_email: subtask.assigned_to_email,
            assignment_type: subtask.assignment_type,
            is_subtask: true,
            shared_with: [],
          }
        })
      } catch {
        return NextResponse.json({
          task: {
            ...subtask,
            file_keys: [],
            comment_file_keys: [],
            assignment_type: subtask.assignment_type,
            is_subtask: true,
            shared_with: [],
          }
        })
      }
    }

    return NextResponse.json({ error: "Task를 찾을 수 없습니다" }, { status: 404 })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

// PATCH /api/tasks/[id] - Task 또는 Subtask 상태 업데이트
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("auth-token")?.value
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Next.js 15에서는 params가 Promise이므로 await 필요
    const { id } = await params
    const taskId = id
    const body = await request.json()
    const { status, description, content, file_keys, comment, comment_file_keys, due_date, is_subtask } = body

    // Subtask인 경우 (명시적으로 is_subtask가 true인 경우)
    if (is_subtask) {
      return await handleSubtaskUpdate(taskId, decoded.id, body, request)
    }

    // 먼저 메인 Task가 존재하는지 확인
    const taskResult = await query(
      "SELECT id, assigned_to, assigned_by, status as current_status, due_date as current_due_date FROM task_assignments WHERE id = ?",
      [taskId]
    )
    const task = taskResult && taskResult.length > 0 ? taskResult[0] : null

    // 메인 Task가 없으면 Subtask 확인
    if (!task) {
      const subtaskResult = await query(
        "SELECT id, task_id, assigned_to, status as current_status FROM task_subtasks WHERE id = ?",
        [taskId]
      )
      const subtask = subtaskResult && subtaskResult.length > 0 ? subtaskResult[0] : null
      
      if (subtask) {
        // Subtask로 처리
        return await handleSubtaskUpdate(taskId, decoded.id, body, request)
      }
      
      // 둘 다 없으면 404
      return NextResponse.json({ error: "Task를 찾을 수 없습니다" }, { status: 404 })
    }

    // 메인 Task 처리

    // 사용자 역할 확인
    const userRoleRes = await query(
      `SELECT role FROM profiles WHERE id = ?`,
      [decoded.id]
    )
    const userRole = userRoleRes && userRoleRes.length > 0 ? userRoleRes[0].role : null
    const isAdminOrStaff = userRole === "admin" || userRole === "staff"

    // due_date는 admin/staff는 모든 업무 수정 가능, 그 외는 요청자·담당자만 수정 가능
    if (due_date !== undefined) {
      if (!isAdminOrStaff) {
        const isAssigner = decoded.id === task.assigned_by
        const isAssignee = decoded.id === task.assigned_to
        if (!isAssigner && !isAssignee) {
          return NextResponse.json({ error: "마감일은 이 업무의 요청자·담당자 또는 관리자만 수정할 수 있습니다" }, { status: 403 })
        }
      }
    }

    if (task.assigned_to !== decoded.id && !isAdminOrStaff) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
    }

    // 상태 업데이트 또는 description 업데이트
    const updateFields: string[] = ["updated_at = NOW()"]
    const updateParams: (string | null)[] = []
    let statusChanged = false
    let oldStatus = task.current_status
    let dueDateChanged = false
    const oldDueDate = task.current_due_date ?? null

    // 완료(completed) 상태인 작업은 마감일 변경 불가
    // (단, status를 completed가 아닌 상태로 변경하는 요청과 함께 오는 경우는 허용)
    const nextStatus = status !== undefined ? status : oldStatus
    if (due_date !== undefined && nextStatus === "completed") {
      return NextResponse.json({ error: "완료된 작업은 마감일을 변경할 수 없습니다" }, { status: 400 })
    }

    if (status !== undefined) {
      const validStatuses = ['pending', 'in_progress', 'on_hold', 'awaiting_completion', 'completed']
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: "유효하지 않은 상태입니다" }, { status: 400 })
      }

      // 완료대기 → 작업끝내기(completed): 업무를 준 사람(assigned_by) 또는 admin만 가능. 담당자(assigned_to)는 임의 완료 불가
      if (status === 'completed' && oldStatus === 'awaiting_completion') {
        const isAssigner = decoded.id === task.assigned_by
        const isAdmin = userRole === 'admin'
        if (!isAssigner && !isAdmin) {
          return NextResponse.json(
            { error: "완료대기에서 작업 끝내기는 업무를 준 사람(요청자)만 할 수 있습니다" },
            { status: 403 }
          )
        }
      }
      
      // 상태가 변경되었는지 확인
      if (oldStatus !== status) {
        statusChanged = true
      }
      
      updateFields.push("status = ?")
      updateParams.push(status)

      // 완료 상태로 변경 시 completed_at 설정
      if (status === 'completed') {
        updateFields.push("completed_at = NOW()")
      } else {
        updateFields.push("completed_at = NULL")
      }
    }

    if (description !== undefined) {
      updateFields.push("description = ?")
      updateParams.push(description)
    }

    if (content !== undefined) {
      updateFields.push("content = ?")
      updateParams.push(content || "")
    }

    if (file_keys !== undefined) {
      const rawFileKeys = Array.isArray(file_keys) ? file_keys : []
      const rawCommentKeys = Array.isArray(comment_file_keys) ? comment_file_keys : []
      const commentSet = new Set(rawCommentKeys.filter((k) => typeof k === "string" && k))

      // file_keys 중복 제거 + comment_file_keys와 겹치는 키 제거(클라이언트 첨부가 file_keys에 섞여 들어가는 것 방지)
      const deduped: string[] = []
      const seen = new Set<string>()
      for (const k of rawFileKeys) {
        const key = typeof k === "string" ? k : ""
        if (!key) continue
        if (commentSet.has(key)) continue
        if (seen.has(key)) continue
        seen.add(key)
        deduped.push(key)
      }

      const fileKeysJson = JSON.stringify(deduped)
      updateFields.push("file_keys = ?")
      updateParams.push(fileKeysJson)
    }

    if (comment !== undefined) {
      // comment는 첫 줄에 개행을 포함하여 저장
      const commentWithNewline = comment ? `\n${comment}` : null
      updateFields.push("comment = ?")
      updateParams.push(commentWithNewline)
    }

    if (comment_file_keys !== undefined) {
      // Comment 첨부파일 여러 개 허용. 중복 제거만 수행.
      const raw = Array.isArray(comment_file_keys) ? comment_file_keys : []
      const deduped: string[] = []
      const seen = new Set<string>()
      for (const k of raw) {
        const key = typeof k === "string" ? k : ""
        if (!key) continue
        if (seen.has(key)) continue
        seen.add(key)
        deduped.push(key)
      }
      const commentFileKeysJson = JSON.stringify(deduped)
      updateFields.push("comment_file_keys = ?")
      updateParams.push(commentFileKeysJson)
    }

    if (due_date !== undefined) {
      // due_date는 staff/admin만 수정 가능 (이미 위에서 확인)
      const dueDateValue = due_date ? (due_date instanceof Date ? due_date.toISOString().split('T')[0] : due_date) : null
      updateFields.push("due_date = ?")
      updateParams.push(dueDateValue)
      if ((oldDueDate ?? null) !== (dueDateValue ?? null)) {
        dueDateChanged = true
      }
    }

    if (updateFields.length === 1) {
      return NextResponse.json({ error: "업데이트할 필드가 없습니다" }, { status: 400 })
    }

    // task_assignments 테이블 업데이트
    if (updateFields.length > 1) {
      await query(
        `UPDATE task_assignments SET ${updateFields.join(", ")} WHERE id = ?`,
        [...updateParams, taskId]
      )
    }

    // 상태가 변경된 경우 task_status_history에 기록
    if (statusChanged && status !== undefined) {
      const historyId = randomUUID()
      await query(
        `INSERT INTO task_status_history (id, task_id, status, changed_by, changed_at) 
         VALUES (?, ?, ?, ?, NOW())`,
        [historyId, taskId, status, decoded.id]
      )

      await writeAuditLog({
        request,
        userId: decoded.id,
        action: "task.status_changed",
        taskId,
        details: { from: oldStatus, to: status },
      })

      // 본인이 본인에게 할당한 task를 완료한 경우, 모든 subtask도 완료 처리
      if (status === 'completed' && task.assigned_by === task.assigned_to) {
        // 본인이 본인에게 할당한 경우, 모든 subtask를 완료로 변경
        const subtasksResult = await query(
          `SELECT id FROM task_subtasks WHERE task_id = ? AND status != 'completed'`,
          [taskId]
        )
        
        if (subtasksResult && subtasksResult.length > 0) {
          await query(
            `UPDATE task_subtasks 
             SET status = 'completed', completed_at = NOW(), updated_at = NOW() 
             WHERE task_id = ? AND status != 'completed'`,
            [taskId]
          )
          
          // 각 subtask의 상태 변경 이력도 기록
          for (const subtask of subtasksResult) {
            const subtaskHistoryId = randomUUID()
            await query(
              `INSERT INTO task_status_history (id, task_id, status, changed_by, changed_at) 
               VALUES (?, ?, ?, ?, NOW())`,
              [subtaskHistoryId, taskId, 'completed', decoded.id]
            )
          }
        }
      }
    }

    if (dueDateChanged) {
      const dueDateValue = due_date ? (due_date instanceof Date ? due_date.toISOString().split('T')[0] : due_date) : null
      await writeAuditLog({
        request,
        userId: decoded.id,
        action: "task.due_date_changed",
        taskId,
        details: { from: oldDueDate, to: dueDateValue },
      })
    }

    return NextResponse.json({
      success: true,
      message: "Task가 업데이트되었습니다",
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

// Subtask 업데이트 처리
async function handleSubtaskUpdate(
  subtaskId: string,
  userId: string,
  body: any,
  request: NextRequest
) {
  const { status, content, file_keys, comment, comment_file_keys } = body

  // Subtask 확인
  const [subtask] = await query(
    "SELECT id, task_id, assigned_to, status as current_status FROM task_subtasks WHERE id = ?",
    [subtaskId]
  )

  if (!subtask) {
    return NextResponse.json({ error: "Subtask를 찾을 수 없습니다" }, { status: 404 })
  }

  // 사용자 역할 확인
  const userRoleRes = await query(
    `SELECT role FROM profiles WHERE id = ?`,
    [userId]
  )
  const userRole = userRoleRes && userRoleRes.length > 0 ? userRoleRes[0].role : null
  const isAdminOrStaff = userRole === "admin" || userRole === "staff"

  if (subtask.assigned_to !== userId && !isAdminOrStaff) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const updateFields: string[] = ["updated_at = NOW()"]
  const updateParams: (string | null)[] = []
  let statusChanged = false
  const oldStatus = subtask.current_status

  if (status !== undefined) {
    const validStatuses = ['pending', 'in_progress', 'on_hold', 'awaiting_completion', 'completed']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "유효하지 않은 상태입니다" }, { status: 400 })
    }
    
    if (oldStatus !== status) {
      statusChanged = true
    }
    
    updateFields.push("status = ?")
    updateParams.push(status)

    if (status === 'completed') {
      updateFields.push("completed_at = NOW()")
    } else {
      updateFields.push("completed_at = NULL")
    }
  }

  if (content !== undefined) {
    updateFields.push("content = ?")
    updateParams.push(content || "")
  }

  if (file_keys !== undefined) {
    const rawFileKeys = Array.isArray(file_keys) ? file_keys : []
    const rawCommentKeys = Array.isArray(comment_file_keys) ? comment_file_keys : []
    const commentSet = new Set(rawCommentKeys.filter((k) => typeof k === "string" && k))

    const deduped: string[] = []
    const seen = new Set<string>()
    for (const k of rawFileKeys) {
      const key = typeof k === "string" ? k : ""
      if (!key) continue
      if (commentSet.has(key)) continue
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(key)
    }

    const fileKeysJson = JSON.stringify(deduped)
    updateFields.push("file_keys = ?")
    updateParams.push(fileKeysJson)
  }

  if (comment !== undefined) {
    const commentWithNewline = comment ? `\n${comment}` : null
    updateFields.push("comment = ?")
    updateParams.push(commentWithNewline)
  }

  if (comment_file_keys !== undefined) {
    const raw = Array.isArray(comment_file_keys) ? comment_file_keys : []
    const deduped: string[] = []
    const seen = new Set<string>()
    for (const k of raw) {
      const key = typeof k === "string" ? k : ""
      if (!key) continue
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(key)
    }
    const commentFileKeysJson = JSON.stringify(deduped)
    updateFields.push("comment_file_keys = ?")
    updateParams.push(commentFileKeysJson)
  }

  if (updateFields.length === 1) {
    return NextResponse.json({ error: "업데이트할 필드가 없습니다" }, { status: 400 })
  }

  // Subtask 업데이트
  await query(
    `UPDATE task_subtasks SET ${updateFields.join(", ")} WHERE id = ?`,
    [...updateParams, subtaskId]
  )

  // 상태가 변경된 경우 task_status_history에 기록
  if (statusChanged && status !== undefined) {
    const historyId = randomUUID()
    await query(
      `INSERT INTO task_status_history (id, task_id, status, changed_by, changed_at) 
       VALUES (?, ?, ?, ?, NOW())`,
      [historyId, subtask.task_id, status, userId]
    )

    await writeAuditLog({
      request,
      userId,
      action: "subtask.status_changed",
      taskId: subtask.task_id,
      details: { subtaskId, from: oldStatus, to: status },
    })
  }

  return NextResponse.json({
    success: true,
    message: "Subtask가 업데이트되었습니다",
  })
}

// DELETE /api/tasks/[id] - Task 삭제 (CASCADE 삭제 포함)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get("auth-token")?.value
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Next.js 15에서는 params가 Promise이므로 await 필요
    const { id } = await params
    const taskId = id

    // 사용자 역할 확인
    const userRoleRes = await query(
      `SELECT role FROM profiles WHERE id = ?`,
      [decoded.id]
    )
    const userRole = userRoleRes && userRoleRes.length > 0 ? userRoleRes[0].role : null
    const isAdminOrStaff = userRole === "admin" || userRole === "staff"

    // 먼저 메인 Task가 존재하는지 확인
    const taskResult = await query(
      "SELECT id, assigned_to, status FROM task_assignments WHERE id = ?",
      [taskId]
    )
    const task = taskResult && taskResult.length > 0 ? taskResult[0] : null

    if (task) {
      // 권한 확인: admin/staff는 모든 task 삭제 가능, 그 외는 자신의 task만
      if (!isAdminOrStaff && task.assigned_to !== decoded.id) {
        return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
      }
    } else {
      // 서브태스크 확인
      const subtaskResult = await query(
        "SELECT id, task_id, assigned_to FROM task_subtasks WHERE id = ?",
        [taskId]
      )
      const subtask = subtaskResult && subtaskResult.length > 0 ? subtaskResult[0] : null
      
      if (!subtask) {
        return NextResponse.json({ error: "Task를 찾을 수 없습니다" }, { status: 404 })
      }

      // 서브태스크 권한 확인
      if (!isAdminOrStaff && subtask.assigned_to !== decoded.id) {
        return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
      }

      // 서브태스크 삭제
      await query("DELETE FROM task_subtasks WHERE id = ?", [taskId])
      
      // 감사 로그 기록
      await writeAuditLog({
        request,
        userId: decoded.id,
        action: "subtask.deleted",
        taskId: subtask.task_id,
        details: { subtaskId: taskId },
      })

      return NextResponse.json({
        success: true,
        message: "Subtask가 삭제되었습니다",
      })
    }

    // 관련 데이터 명시적 삭제 (CASCADE가 설정되어 있어도 명시적으로 삭제)
    
    // 안전한 삭제 헬퍼 함수
    const safeDelete = async (tableName: string, condition: string, params: any[]) => {
      try {
        const result = await query(`DELETE FROM ${tableName} WHERE ${condition}`, params)
        return result
      } catch (error: any) {
        // 테이블이 없는 경우 무시
        if (error.code !== 'ER_NO_SUCH_TABLE') {
          throw error
        }
      }
    }
    
    // 1. 댓글 삭제
    await safeDelete("task_comments", "task_id = ?", [taskId])
    
    // 2. 상태 변경 이력 삭제
    await safeDelete("task_status_history", "task_id = ?", [taskId])
    
    // 3. 공유 관계 삭제
    await safeDelete("task_shared_with", "task_id = ?", [taskId])
    
    // 4. 파일 첨부 삭제
    await safeDelete("task_file_attachments", "task_id = ?", [taskId])
    
    // 5. 세부 업무 삭제 (먼저 세부 업무의 파일 첨부 삭제)
    try {
      const subtasks = await query("SELECT id FROM task_subtasks WHERE task_id = ?", [taskId])
      for (const subtask of subtasks) {
        await safeDelete("task_file_attachments", "subtask_id = ?", [subtask.id])
      }
      await safeDelete("task_subtasks", "task_id = ?", [taskId])
    } catch (error: any) {
      if (error.code !== 'ER_NO_SUCH_TABLE') {
        throw error
      }
    }
    
    // 6. 메인 Task 삭제
    await query("DELETE FROM task_assignments WHERE id = ?", [taskId])

    // 감사 로그 기록
    await writeAuditLog({
      request,
      userId: decoded.id,
      action: "task.deleted",
      taskId,
      details: { status: task.status },
    })

    return NextResponse.json({
      success: true,
      message: "Task와 모든 관련 데이터가 삭제되었습니다",
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

