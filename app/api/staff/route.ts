import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/mysql"
import { verifyToken } from "@/lib/auth"

// GET /api/staff - Staff 목록 조회
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

    const staff = await query(`
      SELECT id, full_name, email
      FROM profiles
      WHERE role IN ('admin', 'staff')
      ORDER BY full_name
    `)

    return NextResponse.json({ staff })
  } catch (error) {
    console.error("[v0] Error fetching staff:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
