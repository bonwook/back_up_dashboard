import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { query } from "@/lib/db/mysql"

// GET /api/tasks/all - Admin/Staff가 모든 task 목록 조회
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

    // Check if user is admin or staff
    const userRoleRes = await query(
      `SELECT role FROM profiles WHERE id = ?`,
      [decoded.id]
    )

    if (!userRoleRes || userRoleRes.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userRole = userRoleRes[0].role
    if (userRole !== "admin" && userRole !== "staff") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") // optional filter

    let sql = `
      SELECT 
        ta.*,
        p_assigned_by.full_name as assigned_by_name,
        p_assigned_by.email as assigned_by_email,
        p_assigned_to.full_name as assigned_to_name,
        p_assigned_to.email as assigned_to_email
      FROM task_assignments ta
      LEFT JOIN profiles p_assigned_by ON ta.assigned_by = p_assigned_by.id
      LEFT JOIN profiles p_assigned_to ON ta.assigned_to = p_assigned_to.id
      WHERE 1=1
    `
    const params: (string | number)[] = []

    if (status) {
      sql += " AND ta.status = ?"
      params.push(status)
    }

    sql += " ORDER BY ta.created_at DESC"

    const tasks = await query(sql, params)

    // Parse JSON file_keys and comment_file_keys
    const tasksWithParsedKeys = tasks.map((task: Record<string, unknown>) => {
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
        }
      } catch {
        return {
          ...task,
          file_keys: [],
          comment_file_keys: [],
        }
      }
    })

    return NextResponse.json({ tasks: tasksWithParsedKeys })
  } catch (error: unknown) {
    console.error("[Tasks All API] Error fetching tasks:", error)
    const errorMessage = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
