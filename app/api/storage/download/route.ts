import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import { NoSuchKey } from "@aws-sdk/client-s3"
import { Readable } from "node:stream"
import { isValidS3Key } from "@/lib/utils/filename"

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
})

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!

// GET /api/storage/download - 파일 다운로드
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

    const userId = decoded.id
    const { searchParams } = new URL(request.url)
    const path = searchParams.get("path")

    if (!path) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 })
    }

    // Extract key from s3:// path or use as-is
    const key = path.startsWith("s3://") ? path.replace(`s3://${BUCKET_NAME}/`, "") : path

    if (!isValidS3Key(key, userId)) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })

    const response = await s3Client.send(command)
    const body = response.Body as any

    if (!body) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    // 스트리밍으로 바로 응답하여 다운로드 진행률(progress)이 실시간으로 계산되도록 함
    // (기존 방식: 서버에서 전부 버퍼링 후 응답 -> 클라이언트에서는 0→100처럼 보임)
    let streamBody: ReadableStream | any = null

    // AWS SDK v3 (Node)에서는 보통 response.Body가 Readable(Node stream)임
    // NextResponse는 Web ReadableStream을 받을 수 있으므로 변환해서 전달
    if (typeof body?.getReader === "function") {
      // already a web ReadableStream
      streamBody = body
    } else if (typeof (Readable as any).toWeb === "function" && typeof body?.pipe === "function") {
      streamBody = (Readable as any).toWeb(body)
    } else {
      // fallback: 지원하지 않는 런타임일 경우 기존처럼 버퍼링 (최후의 수단)
      const chunks: Uint8Array[] = []
      for await (const chunk of body as any) {
        chunks.push(chunk)
      }
      const buffer = Buffer.concat(chunks)
      streamBody = buffer
    }

    const keyFileName = key.split("/").pop() || "download"
    const safeFileName = keyFileName.replace(/[\r\n"]/g, "")
    const encodedFileName = encodeURIComponent(safeFileName)
    
    // ASCII 호환 대체 파일명 생성 (한글 등 비ASCII 문자를 제거)
    const asciiFileName = safeFileName.replace(/[^\x00-\x7F]/g, '') || "download"

    const headers: Record<string, string> = {
      "Content-Type": response.ContentType || "application/octet-stream",
      // filename은 ASCII만 지원, filename*는 UTF-8 인코딩 지원 (RFC 5987)
      "Content-Disposition": `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`,
    }
    if (response.ContentLength && Number.isFinite(response.ContentLength)) {
      headers["Content-Length"] = String(response.ContentLength)
    }

    return new NextResponse(streamBody, {
      headers: {
        ...headers,
      },
    })
  } catch (error) {
    const err = error as { name?: string; Code?: string } | null
    const isNoSuchKey = error instanceof NoSuchKey || (err && (err.name === "NoSuchKey" || err.Code === "NoSuchKey"))
    if (isNoSuchKey) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }
    console.error("[v0] Error downloading file:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

