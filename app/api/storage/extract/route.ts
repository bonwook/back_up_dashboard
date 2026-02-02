import { type NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import { uploadToS3, listFiles } from "@/lib/aws/s3"
import { query } from "@/lib/db/mysql"
import { randomUUID } from "crypto"
import { isValidS3Key } from "@/lib/utils/filename"
import unzipper from "unzipper"
import { Readable } from "stream"

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
})

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!

// POST /api/storage/extract - zip 파일 압축 해제
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

    const userId = decoded.id
    const body = await request.json()
    const { zipKey } = body

    if (!zipKey) {
      return NextResponse.json({ error: "zipKey is required" }, { status: 400 })
    }

    // S3 키 보안 검증
    if (!isValidS3Key(zipKey, userId)) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
    }

    // zip 파일이 존재하는지 확인
    const key = zipKey.startsWith("s3://") ? zipKey.replace(`s3://${BUCKET_NAME}/`, "") : zipKey

    // zip 파일의 경로에서 폴더명 생성
    // 예: userId/zip/test.zip -> userId/zip/test (폴더)
    const keyParts = key.split('/')
    const zipFileName = keyParts[keyParts.length - 1]
    const zipFileNameWithoutExt = zipFileName.replace(/\.zip$/i, '')
    const targetFolderPath = keyParts.slice(0, -1).join('/') + '/' + zipFileNameWithoutExt

    console.log(`[Extract] Extracting ${key} to ${targetFolderPath}`)

    // S3에서 zip 파일 다운로드
    const getObjectCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })

    const response = await s3Client.send(getObjectCommand)
    if (!response.Body) {
      return NextResponse.json({ error: "Failed to download zip file" }, { status: 500 })
    }

    // Body를 Buffer로 변환
    const chunks: Uint8Array[] = []
    const bodyStream = response.Body as any
    
    for await (const chunk of bodyStream) {
      chunks.push(chunk)
    }
    
    const buffer = Buffer.concat(chunks)

    // zip 파일 압축 해제 (스트리밍 방식)
    const directory = await unzipper.Open.buffer(buffer)
    
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let extractedCount = 0
          let extractedSize = 0
          const extractedFiles: string[] = []
          
          // 유효한 파일만 필터링
          const validFiles = directory.files.filter(file => {
            if (file.type === 'Directory') return false
            if (file.path.includes('__MACOSX') || file.path.startsWith('.')) return false
            return true
          })
          
          const totalFiles = validFiles.length
          // 전체 파일 크기 계산 (압축 해제 전 크기)
          const totalSize = validFiles.reduce((sum, file) => sum + (file.uncompressedSize || 0), 0)

          if (totalFiles === 0) {
            controller.enqueue(encoder.encode(JSON.stringify({ 
              type: 'complete',
              progress: 100,
              success: true,
              message: '압축 해제할 파일이 없습니다',
              extractedCount: 0,
              extractedSize: 0,
              totalSize: 0
            }) + '\n'))
            controller.close()
            return
          }

          const formatSize = (bytes: number) => {
            if (bytes < 1024) return `${bytes}B`
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`
            if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
            return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`
          }

          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'progress',
            progress: 5,
            message: `${totalFiles}개 파일 확인됨 (총 ${formatSize(totalSize)})`,
            extractedCount: 0,
            totalFiles,
            extractedSize: 0,
            totalSize
          }) + '\n'))

          // MIME 타입 매핑
          const mimeTypes: Record<string, string> = {
            'txt': 'text/plain',
            'pdf': 'application/pdf',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'xls': 'application/vnd.ms-excel',
            'csv': 'text/csv',
            'dcm': 'application/dicom',
            'dicom': 'application/dicom',
            'nii': 'application/octet-stream',
            'zip': 'application/zip',
          }

          // 병렬 처리를 위한 배치 크기 (동시에 15개씩 처리 - 성능 개선)
          const batchSize = 15
          
          for (let i = 0; i < validFiles.length; i += batchSize) {
            const batch = validFiles.slice(i, i + batchSize)
            
            // DB 배치 삽입을 위한 데이터 수집
            const dbRecords: any[] = []
            
            // 배치 내 파일들을 병렬로 처리
            const batchResults = await Promise.all(batch.map(async (file) => {
              // 파일 내용 추출
              const fileBuffer = await file.buffer()
              const fileSize = fileBuffer.length

              // S3에 업로드할 경로 구성
              const targetKey = `${targetFolderPath}/${file.path}`

              // 파일 타입 추정
              const fileExtension = file.path.split('.').pop()?.toLowerCase() || 'bin'
              let contentType = mimeTypes[fileExtension] || 'application/octet-stream'

              // S3에 업로드
              await uploadToS3(fileBuffer, targetKey, contentType)

              // 파일 타입 결정
              let fileType = 'other'
              if (['xlsx', 'xls', 'csv'].includes(fileExtension)) {
                fileType = 'excel'
              } else if (fileExtension === 'pdf') {
                fileType = 'pdf'
              } else if (['dcm', 'dicom'].includes(fileExtension)) {
                fileType = 'dicom'
              } else if (['nii'].includes(fileExtension)) {
                fileType = 'nifti'
              } else if (fileExtension === 'zip' || fileExtension === '7z') {
                fileType = 'zip'
              }

              return {
                fileId: randomUUID(),
                fileName: file.path.split('/').pop() || file.path,
                targetKey,
                fileSize,
                contentType,
                fileType
              }
            }))

            // DB 배치 삽입
            for (const record of batchResults) {
              await query(
                `INSERT INTO user_files (
                  id, user_id, file_name, file_path, s3_key, s3_bucket, 
                  file_size, content_type, file_type, uploaded_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                  record.fileId,
                  userId,
                  record.fileName,
                  `s3://${BUCKET_NAME}/${record.targetKey}`,
                  record.targetKey,
                  BUCKET_NAME,
                  record.fileSize,
                  record.contentType,
                  record.fileType,
                ]
              )
              extractedFiles.push(record.targetKey)
              extractedSize += record.fileSize
            }

            extractedCount += batch.length

            // 진행률 계산 (5% ~ 95%)
            const progress = 5 + Math.floor((extractedCount / totalFiles) * 90)
            const sizeProgress = totalSize > 0 ? Math.floor((extractedSize / totalSize) * 100) : 0
            
            controller.enqueue(encoder.encode(JSON.stringify({ 
              type: 'progress',
              progress,
              message: `${extractedCount}/${totalFiles} 파일 압축 해제 중 (${formatSize(extractedSize)} / ${formatSize(totalSize)})`,
              extractedCount,
              totalFiles,
              extractedSize,
              totalSize,
              sizeProgress
            }) + '\n'))
          }

          // 완료
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'complete',
            progress: 100,
            success: true,
            message: `${extractedCount}개의 파일이 압축 해제되었습니다 (총 ${formatSize(extractedSize)})`,
            extractedCount,
            totalFiles,
            extractedSize,
            totalSize,
            targetFolder: targetFolderPath,
            files: extractedFiles,
          }) + '\n'))
          
          controller.close()
        } catch (error) {
          console.error("[Extract API] Error:", error)
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'error',
            error: error instanceof Error ? error.message : '압축 해제 실패'
          }) + '\n'))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error("[Extract API] Error extracting zip file:", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
