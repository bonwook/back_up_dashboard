import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { listFiles } from "@/lib/aws/s3"

// GET /api/storage/list - S3 파일 리스트 조회
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
    const prefix = searchParams.get("prefix") || ""
    const fileType = searchParams.get("fileType") // excel, pdf, dicom

    // 사용자별, 파일타입별 prefix 구성
    let finalPrefix = prefix
    if (decoded.id) {
      if (fileType) {
        finalPrefix = `${decoded.id}/${fileType}/`
      } else {
        finalPrefix = `${decoded.id}/`
      }
    }

    const files = await listFiles(finalPrefix)

    return NextResponse.json({ files })
  } catch (error) {
    console.error("[v0] Error listing files:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

