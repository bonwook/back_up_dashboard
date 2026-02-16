import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { queryOne } from "@/lib/db/mysql"
import { getSignedDownloadUrl } from "@/lib/aws/s3"
import { toS3Key } from "@/lib/utils/s3Updates"

const PRESIGN_EXPIRES_SECONDS = 20 * 60 // 20분

// GET /api/s3-updates/[id]/presigned-url - 20분 유효 다운로드 URL
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
      `SELECT file_name, bucket_name FROM s3_updates WHERE id = ?`,
      [id]
    )

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const r = row as { file_name: string; bucket_name?: string | null }
    const s3Key = toS3Key(r)
    const signedUrl = await getSignedDownloadUrl(s3Key, PRESIGN_EXPIRES_SECONDS)

    return NextResponse.json({
      url: signedUrl,
      expiresIn: PRESIGN_EXPIRES_SECONDS,
      fileName: r.file_name || s3Key.split("/").pop() || "download",
    })
  } catch (error: unknown) {
    console.error("[s3-updates presigned-url] Error:", error)
    const err = error as { name?: string; message?: string }
    const isCredentialsError =
      err?.name === "CredentialsProviderError" ||
      String(err?.message || "").includes("session has expired") ||
      String(err?.message || "").includes("reauthenticate")
    const message = isCredentialsError
      ? "AWS 자격 증명이 만료되었거나 설정되지 않았습니다. 관리자에게 문의하세요."
      : (error instanceof Error ? error.message : "Internal server error")
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
