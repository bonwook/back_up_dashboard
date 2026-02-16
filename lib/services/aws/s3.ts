import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!
const REGION = process.env.AWS_REGION ?? ""

/** AWS 자격 증명 만료/미설정 시 클라이언트에 보여줄 메시지 */
export const AWS_CREDENTIALS_USER_MESSAGE =
  "AWS 자격 증명이 만료되었거나 설정되지 않았습니다. 관리자에게 문의하세요."

/** 에러가 AWS 자격 증명(SSO 만료 등) 문제인지 판별 */
export function isAwsCredentialsError(error: unknown): boolean {
  const err = error as { name?: string; message?: string }
  return (
    err?.name === "CredentialsProviderError" ||
    String(err?.message ?? "").includes("session has expired") ||
    String(err?.message ?? "").includes("reauthenticate")
  )
}

/**
 * 업로드/일반 다운로드/목록/삭제용.
 * env에 AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY가 있으면 사용하고,
 * 없으면 기본 자격증명 체인(로컬 SSO 등) 사용. SSO는 만료되면 aws sso login 재실행 필요.
 */
function getS3ClientConfig(): { region: string; credentials?: { accessKeyId: string; secretAccessKey: string } } {
  const useEnvCredentials =
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
  if (useEnvCredentials) {
    return {
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    }
  }
  return { region: REGION }
}

/** S3 task(s3_updates)에서 온 파일 다운로드(presigned URL) 전용 — 기본 자격증명 체인(SSO 세션 등) 사용 */
function getTaskDownloadS3Client(): S3Client {
  return new S3Client({ region: REGION })
}

/** 업로드/일반 다운로드용 — env 있으면 사용, 없으면 로컬 기본 체인 */
export const s3Client = new S3Client(getS3ClientConfig())

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

/**
 * S3 task(s3_updates)에서 온 파일 다운로드 전용 presigned URL.
 * 기본 자격증명 체인(SSO 세션 등)을 사용하므로, task 다운로드에만 사용할 것.
 */
export async function getSignedDownloadUrlForTaskDownload(key: string, expiresIn = 3600): Promise<string> {
  const client = getTaskDownloadS3Client()
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })
  return await getSignedUrl(client, command, { expiresIn })
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
