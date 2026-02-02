import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { query } from "@/lib/db/mysql"

// GET /api/tasks/all-with-subtasks - 모든 task와 subtask 목록 조회 (관리자 전용)
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // 관리자 권한 확인
    const [userProfile] = await query(
      "SELECT role FROM profiles WHERE id = ?",
      [decoded.id]
    )

    if (!userProfile || (userProfile.role !== "admin" && userProfile.role !== "staff")) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
    }

    // 모든 task 가져오기
    const allTasks = await query(`
      SELECT 
        ta.*,
        p_assigned_by.full_name as assigned_by_name,
        p_assigned_by.email as assigned_by_email,
        p_assigned_to.full_name as assigned_to_name,
        p_assigned_to.email as assigned_to_email
      FROM task_assignments ta
      LEFT JOIN profiles p_assigned_by ON ta.assigned_by = p_assigned_by.id
      LEFT JOIN profiles p_assigned_to ON ta.assigned_to = p_assigned_to.id
      ORDER BY ta.created_at DESC
    `)

    // 모든 subtask 가져오기 (subtitle 포함)
    const allSubtasks = await query(`
      SELECT 
        ts.*,
        ts.subtitle,
        ta.title,
        ta.priority,
        ta.due_date,
        ta.assigned_by,
        ta.created_at as task_created_at,
        p_assigned_by.full_name as assigned_by_name,
        p_assigned_by.email as assigned_by_email,
        p_assigned_to.full_name as assigned_to_name,
        p_assigned_to.email as assigned_to_email
      FROM task_subtasks ts
      INNER JOIN task_assignments ta ON ts.task_id = ta.id
      LEFT JOIN profiles p_assigned_by ON ta.assigned_by = p_assigned_by.id
      LEFT JOIN profiles p_assigned_to ON ts.assigned_to = p_assigned_to.id
      ORDER BY ta.created_at DESC
    `)

    // Task 데이터 파싱
    const parsedTasks = allTasks.map((task: Record<string, unknown>) => {
      try {
        const fileKeys = typeof task.file_keys === 'string' 
          ? JSON.parse(task.file_keys) 
          : task.file_keys || []
        const commentFileKeys = typeof task.comment_file_keys === 'string'
          ? JSON.parse(task.comment_file_keys)
          : task.comment_file_keys || []
        
        return {
          ...task,
          file_keys: fileKeys,
          comment_file_keys: commentFileKeys,
          shared_with: [],
          is_multi_assign: task.is_multi_assign || false,
          created_at: task.created_at,
        }
      } catch {
        return {
          ...task,
          file_keys: [],
          comment_file_keys: [],
          shared_with: [],
          is_multi_assign: task.is_multi_assign || false,
          created_at: task.created_at,
        }
      }
    })

    // Subtask 데이터 파싱
    const parsedSubtasks = allSubtasks.map((subtask: Record<string, unknown>) => {
      try {
        const fileKeys = typeof subtask.file_keys === 'string' 
          ? JSON.parse(subtask.file_keys) 
          : subtask.file_keys || []
        const commentFileKeys = typeof subtask.comment_file_keys === 'string'
          ? JSON.parse(subtask.comment_file_keys)
          : subtask.comment_file_keys || []
        
        return {
          id: subtask.id,
          task_id: subtask.task_id,
          subtitle: subtask.subtitle || '',
          assigned_to: subtask.assigned_to,
          assigned_by: subtask.assigned_by,
          title: subtask.title,
          content: subtask.content,
          priority: subtask.priority,
          status: subtask.status,
          due_date: subtask.due_date,
          file_keys: fileKeys,
          comment: subtask.comment,
          comment_file_keys: commentFileKeys,
          created_at: subtask.task_created_at || subtask.created_at,
          updated_at: subtask.updated_at,
          completed_at: subtask.completed_at,
          assigned_by_name: subtask.assigned_by_name,
          assigned_by_email: subtask.assigned_by_email,
          assigned_to_name: subtask.assigned_to_name,
          assigned_to_email: subtask.assigned_to_email,
          is_multi_assign: true,
          is_subtask: true,
          shared_with: [],
        }
      } catch {
        return {
          ...subtask,
          subtitle: subtask.subtitle || '',
          file_keys: [],
          comment_file_keys: [],
          shared_with: [],
          is_multi_assign: true,
          is_subtask: true,
          created_at: subtask.task_created_at || subtask.created_at,
        }
      }
    })

    // Task와 Subtask를 합쳐서 반환
    const allTasksAndSubtasks = [...parsedTasks, ...parsedSubtasks]
    
    // created_at 기준으로 정렬
    allTasksAndSubtasks.sort((a, b) => {
      const dateA = new Date((a.created_at as string | number) || 0).getTime()
      const dateB = new Date((b.created_at as string | number) || 0).getTime()
      return dateB - dateA // 최신순
    })

    return NextResponse.json({ 
      tasks: allTasksAndSubtasks,
      meta: {
        totalTasks: parsedTasks.length,
        totalSubtasks: parsedSubtasks.length
      }
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
