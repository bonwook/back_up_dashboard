import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/mysql"
import { verifyToken } from "@/lib/auth"

// GET /api/profiles - 프로필 조회
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

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const email = searchParams.get("email")
    const role = searchParams.get("role")

    let sql = "SELECT id, email, full_name, organization, role FROM profiles WHERE 1=1"
    const params: (string | null)[] = []

    if (id) {
      sql += " AND id = ?"
      params.push(id)
    }
    if (email) {
      sql += " AND email = ?"
      params.push(email)
    }
    if (role) {
      sql += " AND role = ?"
      params.push(role)
    }

    const profiles = await query(sql, params)

    return NextResponse.json(profiles)
  } catch (error) {
    console.error("[v0] Error fetching profiles:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


