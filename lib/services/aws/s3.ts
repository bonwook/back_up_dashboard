import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

// AWS SDK는 자동으로 다음 순서로 자격 증명을 찾습니다:
// 1. 환경 변수 (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) - 로컬 환경에서 사용
// 2. 자격 증명 파일 (~/.aws/credentials)
// 3. IAM 역할 (EC2 인스턴스에 연결된 경우) - EC2 환경에서 사용
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
})

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!

export async function uploadToS3(file: Buffer, key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
  })

  await s3Client.send(command)
  return `s3://${BUCKET_NAME}/${key}`
}

export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  return await getSignedUrl(s3Client, command, { expiresIn })
}

export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  await s3Client.send(command)
}

export function getPublicUrl(key: string): string {
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
}

export interface S3FileInfo {
  key: string
  size: number
  lastModified: Date
  contentType?: string
}

export async function listFiles(prefix: string): Promise<S3FileInfo[]> {
  const allFiles: S3FileInfo[] = []
  let continuationToken: string | undefined = undefined

  do {
    const command: ListObjectsV2Command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    })

    const response = await s3Client.send(command)
    
    if (response.Contents) {
      const files = response.Contents.map((item) => ({
        key: item.Key || "",
        size: item.Size || 0,
        lastModified: item.LastModified || new Date(),
        contentType: undefined, // ListObjectsV2 doesn't return ContentType
      }))
      allFiles.push(...files)
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
  } while (continuationToken)

  return allFiles
}

// 폴더 내 모든 파일 삭제
export async function deleteFolder(folderPrefix: string): Promise<number> {
  // 폴더 내 모든 파일 목록 조회
  const files = await listFiles(folderPrefix)
  
  if (files.length === 0) {
    return 0
  }

  // 모든 파일 삭제
  let deletedCount = 0
  for (const file of files) {
    try {
      await deleteFile(file.key)
      deletedCount++
    } catch (error) {
      console.error(`Failed to delete file: ${file.key}`, error)
      // 계속 진행
    }
  }

  return deletedCount
}
