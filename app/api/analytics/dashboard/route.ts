import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/mysql"
import { verifyToken } from "@/lib/auth"

// GET /api/analytics/dashboard - 대시보드 통계
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

    // Admin/Staff만 접근 가능
    if (decoded.role !== "admin" && decoded.role !== "staff") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const countOne = async (sql: string, params: any[] = []) => {
      const [row] = await query(sql, params)
      return Number((row as any)?.cnt || 0)
    }

    // task_assignments 테이블 사용 (MySQL COUNT로 계산)
    const totalTasks = await countOne(`SELECT COUNT(*) as cnt FROM task_assignments`)
    const pendingTasks = await countOne(`SELECT COUNT(*) as cnt FROM task_assignments WHERE status = 'pending'`)
    const inProgressTasks = await countOne(`SELECT COUNT(*) as cnt FROM task_assignments WHERE status = 'in_progress'`)
    const completedTasks = await countOne(`SELECT COUNT(*) as cnt FROM task_assignments WHERE status = 'completed'`)
    const onHoldTasks = await countOne(`SELECT COUNT(*) as cnt FROM task_assignments WHERE status = 'on_hold'`)
    const awaitingCompletionTasks = await countOne(`SELECT COUNT(*) as cnt FROM task_assignments WHERE status = 'awaiting_completion'`)

    const totalClients = await countOne(`SELECT COUNT(*) as cnt FROM profiles WHERE role = 'client'`)

    // Reports: reports 테이블이 있으면 그것을 우선(스냅샷 기반), 없으면 완료된 작업 수로 fallback
    let totalReports = 0
    try {
      const [tableCheck] = await query(
        `SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reports'`
      )
      const hasReportsTable = Number((tableCheck as any)?.cnt || 0) > 0
      if (hasReportsTable) {
        const [cntRow] = await query(`SELECT COUNT(*) as cnt FROM reports`)
        totalReports = Number((cntRow as any)?.cnt || 0)
      } else {
        totalReports = Number(completedTasks || 0)
      }
    } catch {
      totalReports = Number(completedTasks || 0)
    }

    const completionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0

    // Get staff count for admin
    const totalStaff = await countOne(`SELECT COUNT(*) as cnt FROM profiles WHERE role = 'staff'`)
    const totalAdmins = await countOne(`SELECT COUNT(*) as cnt FROM profiles WHERE role = 'admin'`)

    return NextResponse.json({
      totalTasks,
      pendingTasks,
      inProgressTasks,
      completedTasks,
      onHoldTasks,
      awaitingCompletionTasks,
      totalClients,
      totalReports,
      totalStaff,
      totalAdmins,
      completionRate,
    })
  } catch (error) {
    console.error("[Dashboard API] Error fetching dashboard analytics:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
