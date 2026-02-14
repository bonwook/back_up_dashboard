"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2, UserPlus, Download } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"

interface S3Update {
  id: number
  file_name: string
  bucket_name?: string | null
  file_size?: number | null
  upload_time?: string | null
  created_at: string
  task_id: string | null
  s3_key: string
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return "-"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export default function S3UpdateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [s3Update, setS3Update] = useState<S3Update | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGettingUrl, setIsGettingUrl] = useState(false)
  const [id, setId] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    params.then((p) => setId(p.id))
  }, [params])

  useEffect(() => {
    if (!id) return
    const load = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/s3-updates/${id}`, { credentials: "include" })
        if (!res.ok) {
          if (res.status === 404) {
            router.push("/admin/cases")
            return
          }
          throw new Error("Failed to load")
        }
        const data = await res.json()
        setS3Update(data.s3Update)
      } catch {
        router.push("/admin/cases")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [id, router])

  const handleDownload = async () => {
    if (!id) return
    setIsGettingUrl(true)
    try {
      const res = await fetch(`/api/s3-updates/${id}/presigned-url`, {
        credentials: "include",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || "다운로드 URL 생성 실패")
      }
      const data = await res.json()
      const url = (data as { url: string }).url
      window.open(url, "_blank", "noopener,noreferrer")
      toast({
        title: "다운로드 링크 생성됨",
        description: "20분간 유효한 링크가 새 탭에서 열립니다.",
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "다운로드 URL을 가져오지 못했습니다."
      toast({
        title: "다운로드 실패",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsGettingUrl(false)
    }
  }

  const displayDate = s3Update?.upload_time || s3Update?.created_at || ""

  if (isLoading || !s3Update) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push("/admin/cases")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          뒤로가기
        </Button>
      </div>

      <Card className="mb-6 border-l-4 border-l-amber-500/50">
        <CardHeader>
          <CardTitle className="text-xl">S3 업로드 작업 (미할당)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">파일명</p>
            <p className="font-medium break-all">{s3Update.file_name}</p>
          </div>
          {s3Update.bucket_name && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">버킷/경로</p>
              <p className="text-sm break-all text-muted-foreground">{s3Update.bucket_name}</p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-muted-foreground">S3 객체 키</p>
            <p className="text-sm break-all text-muted-foreground">{s3Update.s3_key}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">파일 크기</p>
            <p className="text-sm">{formatBytes(s3Update.file_size)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">업로드일</p>
            <p className="text-sm">
              {displayDate
                ? new Date(displayDate).toLocaleString("ko-KR", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "-"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-4">
            <Button asChild>
              <Link href={`/admin/analytics?from=worklist&s3_update_id=${s3Update.id}`}>
                <UserPlus className="mr-2 h-4 w-4" />
                업무 추가 (담당자 지정)
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={isGettingUrl}
            >
              {isGettingUrl ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              다운로드 (20분 유효 링크)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
