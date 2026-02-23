"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { TaskRegistrationForm } from "@/app/admin/analytics/components/TaskRegistrationForm"
import { S3BucketInfoCard } from "@/components/s3-bucket-info-card"
import {
  getFileType,
  formatFileSize,
  updateDisplayedFiles,
  getDisplayPath,
} from "@/app/admin/analytics/utils/fileUtils"
import type { S3File } from "@/app/admin/analytics/types"

interface S3Update {
  id: number
  file_name: string
  bucket_name?: string | null
  file_size?: number | null
  upload_time?: string | null
  created_at: string
  task_id: string | null
  status?: string
  s3_key: string
}

export default function S3UpdateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [s3Update, setS3Update] = useState<S3Update | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [id, setId] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [isRefreshingFileList, setIsRefreshingFileList] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  // 현재 세션 S3 파일 목록 (presigned 파일은 목록에 없음, 버킷 카드에서만 다운로드)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [allFiles, setAllFiles] = useState<S3File[]>([])
  const [files, setFiles] = useState<S3File[]>([])
  const [currentPath, setCurrentPath] = useState<string>("")
  const [isLoadingSessionFiles, setIsLoadingSessionFiles] = useState(false)

  const s3Key = s3Update?.s3_key ?? ""

  const loadSessionFiles = useCallback(async () => {
    setIsLoadingSessionFiles(true)
    try {
      const res = await fetch("/api/storage/files", { credentials: "include" })
      if (!res.ok) throw new Error("파일 목록을 불러올 수 없습니다.")
      const data = await res.json()
      const list = data.files ?? []
      setAllFiles(list)
      updateDisplayedFiles(list, currentPath, setFiles)
    } catch (e) {
      toast({
        title: "세션 파일 목록 로드 실패",
        description: e instanceof Error ? e.message : "다시 시도해 주세요.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingSessionFiles(false)
    }
  }, [currentPath, toast])

  const refreshFileList = async () => {
    if (!id) return
    setIsRefreshingFileList(true)
    try {
      const res = await fetch(`/api/s3-updates/${id}`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load")
      const data = await res.json()
      const loaded = data.s3Update as S3Update
      setS3Update(loaded)
      setSelectedFiles((prev) => {
        const next = new Set(prev)
        if (loaded?.s3_key) next.add(loaded.s3_key)
        return next
      })
      toast({ title: "파일 목록을 새로고침했습니다." })
    } catch {
      toast({ title: "새로고침에 실패했습니다.", variant: "destructive" })
    } finally {
      setIsRefreshingFileList(false)
    }
  }

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
        const loaded = data.s3Update as S3Update
        setS3Update(loaded)
        if (loaded?.s3_key) setSelectedFiles(new Set([loaded.s3_key]))
      } catch {
        router.push("/admin/cases")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [id, router])

  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" })
        if (res.ok) {
          const me = await res.json()
          setUser(me)
        }
      } catch {
        // ignore
      }
    }
    loadUser()
  }, [])

  useEffect(() => {
    if (user) loadSessionFiles()
  }, [user, loadSessionFiles])

  useEffect(() => {
    if (allFiles.length > 0) {
      updateDisplayedFiles(allFiles, currentPath, setFiles)
    }
  }, [currentPath, allFiles])

  const handleFolderClick = (folderPath: string) => {
    setCurrentPath(folderPath)
    updateDisplayedFiles(allFiles, folderPath, setFiles)
  }

  const handleGoUp = () => {
    if (!currentPath) return
    const pathParts = currentPath.split("/")
    pathParts.pop()
    const newPath = pathParts.join("/")
    setCurrentPath(newPath)
    updateDisplayedFiles(allFiles, newPath, setFiles)
  }

  const handleToggleFile = (fileKey: string, checked: boolean) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev)
      if (checked) next.add(fileKey)
      else next.delete(fileKey)
      if (s3Key && !next.has(s3Key)) next.add(s3Key)
      return next
    })
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allKeys = files.filter((f) => f.fileType !== "folder").map((f) => f.key)
      setSelectedFiles((prev) => {
        const next = new Set(prev)
        allKeys.forEach((k) => next.add(k))
        if (s3Key) next.add(s3Key)
        return next
      })
    } else {
      setSelectedFiles(s3Key ? new Set([s3Key]) : new Set())
    }
  }

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

      {/* 1. 버킷(S3) — 다른 AWS 쪽 1건, 다운로드는 여기서만 */}
      <S3BucketInfoCard s3Update={{ ...s3Update, s3_key: s3Key }} />

      {/* 2. 연결된 업무 있음 → 보기로 이동 / 없음 → 업무 할당 폼 */}
      {s3Update.task_id ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">연결된 업무</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              이 S3 건에는 이미 업무가 연결되어 있습니다. 업무 상세에서 확인·수정할 수 있습니다.
            </p>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => router.push(`/admin/cases/${s3Update.task_id}`)}
              className="w-full sm:w-auto"
            >
              연결된 업무 보기
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">업무 할당</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskRegistrationForm
              s3UpdateId={id ?? undefined}
              initialTitle={s3Update.file_name}
              onSuccess={(taskId) => {
                toast({ title: "업무가 등록되었습니다." })
                router.replace(`/admin/cases/${taskId}`)
              }}
              selectedFiles={selectedFiles}
              setSelectedFiles={setSelectedFiles}
            >
              <div className="flex flex-col flex-1 overflow-hidden gap-2">
                <div className="flex items-center justify-end gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => {
                      refreshFileList()
                      loadSessionFiles()
                    }}
                    disabled={isRefreshingFileList || isLoadingSessionFiles}
                  >
                    <RefreshCw
                      className={`h-3 w-3 sm:h-4 sm:w-4 ${isRefreshingFileList || isLoadingSessionFiles ? "animate-spin" : ""}`}
                    />
                    <span className="hidden sm:inline ml-2">새로고침</span>
                  </Button>
                </div>
                <div className="overflow-x-auto overflow-y-auto border rounded-md flex-1 min-h-0" style={{ maxHeight: "400px" }}>
                  {isLoadingSessionFiles ? (
                    <p className="text-center text-muted-foreground py-8">로딩 중...</p>
                  ) : files.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">현재 세션 버킷에 파일이 없습니다.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 bg-background">
                            {files.length > 0 && (
                              <Checkbox
                                checked={
                                  files.filter((f) => f.fileType !== "folder").length > 0 &&
                                  files.every((f) => f.fileType === "folder" || selectedFiles.has(f.key))
                                }
                                onCheckedChange={(c) => handleSelectAll(!!c)}
                              />
                            )}
                          </TableHead>
                          <TableHead className="w-[40%] bg-background">파일명</TableHead>
                          <TableHead className="w-[15%] bg-background">타입</TableHead>
                          <TableHead className="w-[15%] bg-background">크기</TableHead>
                          <TableHead className="w-[15%] bg-background">업로드일</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentPath && (
                          <TableRow className="cursor-pointer hover:bg-muted/50 bg-muted/30" onClick={handleGoUp}>
                            <TableCell colSpan={5} className="font-medium">
                              <span className="flex items-center gap-2">
                                <ArrowLeft className="h-4 w-4" />
                                뒤로가기
                                <span className="text-xs text-muted-foreground truncate" title={getDisplayPath(currentPath)}>
                                  ({currentPath.split("/").pop() || currentPath})
                                </span>
                              </span>
                            </TableCell>
                          </TableRow>
                        )}
                        {files.map((file, index) => {
                          if (file.fileType === "folder") {
                            return (
                              <TableRow
                                key={index}
                                className="cursor-pointer hover:bg-muted/50 bg-blue-50/50 dark:bg-blue-950/20"
                                onClick={() => handleFolderClick(file.key)}
                              >
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <Checkbox disabled />
                                </TableCell>
                                <TableCell className="font-medium">
                                  <span className="flex items-center gap-2">
                                    <span className="text-lg">📁</span>
                                    {file.fileName || file.key.split("/").pop() || file.key}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs">폴더</TableCell>
                                <TableCell>-</TableCell>
                                <TableCell>-</TableCell>
                              </TableRow>
                            )
                          }
                          return (
                            <TableRow key={index} className="hover:bg-muted/50">
                              <TableCell>
                                <Checkbox
                                  checked={selectedFiles.has(file.key)}
                                  onCheckedChange={(c) => handleToggleFile(file.key, !!c)}
                                />
                              </TableCell>
                              <TableCell className="font-medium break-all">
                                {file.fileName || file.key.split("/").pop() || file.key}
                              </TableCell>
                              <TableCell>
                                <span className="text-xs">
                                  {getFileType(file) === "excel"
                                    ? "Excel"
                                    : getFileType(file) === "pdf"
                                      ? "PDF"
                                      : getFileType(file) === "dicom"
                                        ? "DICOM"
                                        : "기타"}
                                </span>
                              </TableCell>
                              <TableCell>{formatFileSize(file.size)}</TableCell>
                              <TableCell>
                                {new Date(file.lastModified).toLocaleDateString("ko-KR", {
                                  month: "2-digit",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  위 목록은 현재 로그인한 세션의 S3 버킷입니다. 상단 버킷 정보의 파일은 다운로드 버튼으로 받으세요.
                </p>
              </div>
            </TaskRegistrationForm>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
