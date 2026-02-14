import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { queryOne } from "@/lib/db/mysql"
import { toS3Key } from "@/lib/utils/s3Updates"

// GET /api/s3-updates/[id] - 단일 s3_update 조회
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

    const roleRes = await queryOne(
      `SELECT role FROM profiles WHERE id = ?`,
      [decoded.id]
    )
    if (!roleRes || (roleRes as { role: string }).role === "client") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const row = await queryOne(
      `SELECT id, file_name, bucket_name, file_size, upload_time, created_at
       FROM s3_updates WHERE id = ?`,
      [id]
    )

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const r = row as Record<string, unknown>
    const s3Update = {
      ...r,
      task_id: (r as { task_id?: string | null }).task_id ?? null,
      s3_key: toS3Key(r as { file_name: string; bucket_name?: string | null }),
    }

    return NextResponse.json({ s3Update })
  } catch (error: unknown) {
    console.error("[s3-updates/:id] Error:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
