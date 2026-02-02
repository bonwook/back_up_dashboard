import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { query } from "@/lib/db/mysql"

// GET /api/task_assignments - Admin/Staff가 모든 task 목록 조회 (배열 status 필터 및 정렬 지원)
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
    const statusParam = searchParams.get("status") // 배열 형태 또는 단일 값
    const orderBy = searchParams.get("orderBy") || "created_at"
    const orderDir = searchParams.get("orderDir")?.toUpperCase() || "DESC"

    // Validate orderBy and orderDir
    const validOrderBy = ["created_at", "updated_at", "completed_at", "due_date", "priority", "status"]
    const validOrderDir = ["ASC", "DESC"]
    
    if (!validOrderBy.includes(orderBy)) {
      return NextResponse.json({ error: "Invalid orderBy parameter" }, { status: 400 })
    }
    
    if (!validOrderDir.includes(orderDir)) {
      return NextResponse.json({ error: "Invalid orderDir parameter" }, { status: 400 })
    }

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

    // Handle status filter - support both array and single value
    if (statusParam) {
      try {
        // Try to parse as JSON array
        const statusArray = JSON.parse(statusParam)
        if (Array.isArray(statusArray) && statusArray.length > 0) {
          const placeholders = statusArray.map(() => '?').join(',')
          sql += ` AND ta.status IN (${placeholders})`
          params.push(...statusArray)
        }
      } catch {
        // If not JSON, treat as single value
        sql += " AND ta.status = ?"
        params.push(statusParam)
      }
    }

    // Add ORDER BY clause
    sql += ` ORDER BY ta.${orderBy} ${orderDir}`

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
    console.error("[Task Assignments API] Error fetching tasks:", error)
    const errorMessage = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
