import { type NextRequest, NextResponse } from "next/server"
import { query, getPool } from "@/lib/db/mysql"
import { verifyToken } from "@/lib/auth"

// GET /api/billing - 빌링 목록 조회
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

    const billing = await query(`
      SELECT 
        b.*,
        c.case_number,
        c.patient_name,
        p.full_name as client_name,
        p.organization as client_organization
      FROM billing b
      JOIN cases c ON b.case_id = c.id
      LEFT JOIN profiles p ON c.client_id = p.id
      ORDER BY b.created_at DESC
    `)

    return NextResponse.json(billing)
  } catch (error) {
    console.error("[v0] Error fetching billing:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/billing - 새 빌링 레코드 생성
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Admin/Staff만 생성 가능
    if (decoded.role !== "admin" && decoded.role !== "staff") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { case_id, amount, invoice_date, status = "pending" } = body

    if (!case_id || !amount || !invoice_date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const pool = getPool()
    const [result] = await pool.execute(
      `
      INSERT INTO billing (case_id, amount, invoice_date, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, NOW(), NOW())
    `,
      [case_id, amount, invoice_date, status],
    )

    const insertId = (result as any).insertId
    const newBilling = await query("SELECT * FROM billing WHERE id = ?", [insertId])

    return NextResponse.json(newBilling[0], { status: 201 })
  } catch (error) {
    console.error("[v0] Error creating billing:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

