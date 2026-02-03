"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import {
  FileText,
  CheckCircle2,
  Clock,
  Pause,
  AlertCircle,
  Check,
  Edit,
  Loader2,
  Trash2,
} from "lucide-react"
import { sanitizeHtml } from "@/lib/utils/sanitize"
import { SafeHtml } from "@/components/safe-html"
import { calculateFileExpiry, formatDateShort } from "@/lib/utils/dateHelpers"
import { downloadWithProgress } from "@/lib/utils/download-with-progress"
import { TaskCommentSection } from "./TaskCommentSection"
import { DueDateEditor } from "./DueDateEditor"

export interface TaskDetailTask {
  id: string
  title: string
  subtitle?: string
  content: string | null
  comment?: string | null
  priority: "low" | "medium" | "high" | "urgent"
  status: string
  file_keys?: string[]
  comment_file_keys?: string[]
  created_at: string
  updated_at: string
  completed_at: string | null
  due_date?: string | null
  assigned_to?: string
  assigned_by?: string
  assigned_by_name?: string
  assigned_by_email?: string
  is_subtask?: boolean
}

interface ResolvedFileKey {
  originalKey: string
  s3Key: string
  fileName: string
  uploadedAt?: string | null
  userId?: string | null
}

export interface TaskDetailDialogProps {
  task: TaskDetailTask | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskUpdate?: () => void
  onEditTask?: (task: TaskDetailTask) => void
  finalizedTaskIds?: Set<string>
  setFinalizedTaskIds?: React.Dispatch<React.SetStateAction<Set<string>>>
  userRole?: string | null
  /** client progress에서만 태스크 제거 버튼 표시 */
  showDeleteTaskButton?: boolean
  /** 작업 끝내기 버튼 표시 (admin progress에서 담당자 본인일 때 false 전달) */
  showCompleteButton?: boolean
  /** progress 페이지에서 마감일 편집 표시 */
  showDueDateEditor?: boolean
}

function getPriorityColor(priority: TaskDetailTask["priority"]) {
  switch (priority) {
    case "urgent":
      return "bg-red-500 text-white"
    case "high":
      return "bg-orange-500 text-white"
    case "medium":
      return "bg-yellow-500 text-white"
    case "low":
      return "bg-blue-500 text-white"
    default:
      return "bg-gray-500 text-white"
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case "awaiting_completion":
      return <CheckCircle2 className="h-4 w-4 text-purple-500" />
    case "in_progress":
      return <Clock className="h-4 w-4 text-blue-500" />
    case "on_hold":
      return <Pause className="h-4 w-4 text-yellow-500" />
    case "pending":
      return <AlertCircle className="h-4 w-4 text-gray-500" />
    default:
      return null
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "completed":
      return "완료"
    case "awaiting_completion":
      return "완료대기"
    case "in_progress":
      return "작업"
    case "on_hold":
      return "보류"
    case "pending":
      return "대기"
    default:
      return status
  }
}

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onTaskUpdate,
  onEditTask,
  finalizedTaskIds,
  setFinalizedTaskIds,
  userRole: propUserRole,
  showDeleteTaskButton = false,
  showCompleteButton = true,
  showDueDateEditor = false,
}: TaskDetailDialogProps) {
  const { toast } = useToast()
  const [user, setUser] = useState<{ id: string; role?: string } | null>(null)
  const [userRole, setUserRole] = useState<string | null>(propUserRole ?? null)
  const [resolvedFileKeys, setResolvedFileKeys] = useState<ResolvedFileKey[]>([])
  const [commentResolvedFileKeys, setCommentResolvedFileKeys] = useState<
    ResolvedFileKey[]
  >([])
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteTaskDialog, setShowDeleteTaskDialog] = useState(false)
  const [isDeletingTask, setIsDeletingTask] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadingFileName, setDownloadingFileName] = useState("")

  useEffect(() => {
    if (propUserRole !== undefined) setUserRole(propUserRole)
  }, [propUserRole])

  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" })
        if (!res.ok) return
        const me = await res.json()
        setUser(me)
        if (propUserRole == null) setUserRole(me.role || null)
      } catch {
        // ignore
      }
    }
    loadUser()
  }, [propUserRole])

  useEffect(() => {
    if (!task?.id) return
    const load = async () => {
      try {
        const res = await fetch(`/api/tasks/${task.id}/subtasks`, {
          credentials: "include",
        })
        if (!res.ok) return
        const data = await res.json()
        setSubtasks(Array.isArray(data.subtasks) ? data.subtasks : [])
      } catch {
        // ignore
      }
    }
    load()
  }, [task?.id])

  useEffect(() => {
    if (!task?.file_keys?.length) {
      setResolvedFileKeys([])
      return
    }
    let cancelled = false
    fetch("/api/storage/resolve-file-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ fileKeys: task.file_keys }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setResolvedFileKeys(data.resolvedKeys || [])
      })
      .catch(() => {
        if (!cancelled) setResolvedFileKeys([])
      })
    return () => {
      cancelled = true
    }
  }, [task?.id, task?.file_keys?.length])

  useEffect(() => {
    if (!task?.comment_file_keys?.length) {
      setCommentResolvedFileKeys([])
      return
    }
    let cancelled = false
    fetch("/api/storage/resolve-file-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ fileKeys: task.comment_file_keys }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setCommentResolvedFileKeys(data.resolvedKeys || [])
      })
      .catch(() => {
        if (!cancelled) setCommentResolvedFileKeys([])
      })
    return () => {
      cancelled = true
    }
  }, [task?.id, task?.comment_file_keys?.length])

  const allSubtasksCompleted = useMemo(
    () =>
      subtasks.length > 0 && subtasks.every((st: any) => st.status === "completed"),
    [subtasks]
  )

  const handleDownloadWithProgress = async (s3Key: string, name?: string) => {
    const fileName = name ?? s3Key.split("/").pop() ?? "download"
    setIsDownloading(true)
    setDownloadingFileName(fileName)
    setDownloadProgress(0)
    try {
      await downloadWithProgress({
        url: `/api/storage/download?path=${encodeURIComponent(s3Key)}`,
        fileName,
        withCredentials: true,
        onProgress: (p) => setDownloadProgress(p.percent),
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "다운로드 중 오류가 발생했습니다."
      toast({
        title: "다운로드 실패",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsDownloading(false)
      setDownloadingFileName("")
      setDownloadProgress(0)
    }
  }

  const handleCompleteTask = async () => {
    if (!task || !onTaskUpdate) return
    setIsDeleting(true)
    try {
      const updateRes = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "completed" }),
      })
      if (!updateRes.ok) {
        const err = await updateRes.json().catch(() => ({}))
        throw new Error(err.error || "작업 완료 처리 실패")
      }
      const reportRes = await fetch(`/api/tasks/${task.id}/create-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      })
      if (!reportRes.ok) {
        const err = await reportRes.json().catch(() => ({}))
        console.warn("Report 생성 실패:", err)
      }
      toast({
        title: "완료 처리됨",
        description: "작업이 완료 처리되었고 Report가 저장되었습니다.",
      })
      setShowCompleteDialog(false)
      onTaskUpdate()
      if (setFinalizedTaskIds) setFinalizedTaskIds((prev) => new Set(prev).add(task.id))
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "작업 완료 처리에 실패했습니다."
      toast({ title: "완료 처리 실패", description: message, variant: "destructive" })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteTaskFromDB = async () => {
    if (!task || !onTaskUpdate) return
    setIsDeletingTask(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Task 삭제 실패")
      }
      toast({ title: "성공", description: "Task가 삭제되었습니다." })
      setShowDeleteTaskDialog(false)
      onOpenChange(false)
      onTaskUpdate()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Task 삭제에 실패했습니다."
      toast({ title: "오류", description: message, variant: "destructive" })
    } finally {
      setIsDeletingTask(false)
    }
  }

  if (!task) return null

  const comment = task.comment
    ? task.comment.startsWith("\n")
      ? task.comment.substring(1)
      : task.comment
    : ""

  const proseTableStyles = (
    <style jsx global>{`
      .task-detail-prose table {
        border-collapse: collapse;
        width: 100%;
        margin: 10px 0;
        border: 2px solid #6b7280;
      }
      .task-detail-prose table td,
      .task-detail-prose table th {
        border: 2px solid #6b7280;
        padding: 8px;
        cursor: default !important;
      }
      .task-detail-prose table td[contenteditable="true"],
      .task-detail-prose table th[contenteditable="true"] {
        pointer-events: none;
        user-select: none;
      }
      .task-detail-prose table td *,
      .task-detail-prose table th * {
        cursor: default !important;
        pointer-events: none;
      }
      .task-detail-prose hr {
        border: none;
        border-top: 2px solid #6b7280;
        margin: 10px 0;
      }
    `}</style>
  )

  const canComplete =
    (task.status === "awaiting_completion" ||
      (subtasks.length > 0 && allSubtasksCompleted)) &&
    (user?.id === task.assigned_by ||
      userRole === "admin" ||
      userRole === "staff")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[80vh] overflow-y-auto overflow-x-hidden"
        style={{
          width: "calc((1280px - 48px - 16px) * 7/10)",
          maxWidth: "851px",
        }}
      >
        <DialogHeader className="pr-8 pb-3">
          <div className="flex items-center gap-2 wrap-break-word word-break break-all">
            {getStatusIcon(task.status)}
            <DialogTitle className="min-w-0">
              {task.title}
              {task.subtitle && task.is_subtask && (
                <span className="text-muted-foreground text-sm ml-2">
                  ({task.subtitle})
                </span>
              )}
            </DialogTitle>
            {showDeleteTaskButton && userRole !== "client" && (
              <Button
                type="button"
                onClick={() => setShowDeleteTaskDialog(true)}
                variant="ghost"
                size="sm"
                className="h-6 px-2 ml-auto shrink-0 cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex items-center justify-between gap-4 pb-4 border-b">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={getPriorityColor(task.priority)}>
              {task.priority === "urgent"
                ? "긴급"
                : task.priority === "high"
                  ? "높음"
                  : task.priority === "medium"
                    ? "보통"
                    : "낮음"}
            </Badge>
            <Badge variant="outline">{getStatusLabel(task.status)}</Badge>
            <span className="text-xs text-muted-foreground">
              작업 요청자:{" "}
              <span className="font-medium text-foreground">
                {task.assigned_by_name || task.assigned_by_email}
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              {task.due_date
                ? `시작일 ${formatDateShort(task.created_at)} ~ 마감일 ${formatDateShort(task.due_date)}`
                : `시작일 ${formatDateShort(task.created_at)}`}
            </span>
          </div>
        </div>

        <div className="space-y-4 mt-4">
          {isDownloading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate">다운로드 중: {downloadingFileName}</span>
                <span className="shrink-0">{downloadProgress}%</span>
              </div>
              <Progress value={downloadProgress} />
            </div>
          )}

          {showDueDateEditor && (userRole !== "client" || task.completed_at) && (
            <div className="grid grid-cols-2 gap-4">
              {userRole !== "client" && (
                <div>
                  <p className="text-muted-foreground mb-1">마감일</p>
                  <DueDateEditor
                    taskId={task.id}
                    dueDate={task.due_date}
                    onUpdate={onTaskUpdate ?? (() => {})}
                    userRole={userRole}
                  />
                </div>
              )}
              {task.completed_at && (
                <div>
                  <p className="text-muted-foreground">종료일</p>
                  <p className="font-medium">{formatDateShort(task.completed_at)}</p>
                </div>
              )}
            </div>
          )}

          <div>
            <p className="text-muted-foreground mb-2">요청자 내용</p>
            {task.content ? (
              <div
                className="text-sm bg-muted/50 p-3 rounded-md border border-border/50 wrap-break-word word-break break-all overflow-x-auto prose prose-sm max-w-none task-detail-prose"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(task.content) }}
                style={{
                  maxHeight: "400px",
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              />
            ) : (
              <div className="text-sm bg-muted/30 p-3 rounded-md border border-border/50 text-center text-muted-foreground min-h-[80px] flex items-center justify-center">
                내용이 없습니다
              </div>
            )}
            {task.content && proseTableStyles}
          </div>

          <div>
            <p className="text-muted-foreground mb-2">담당자 내용</p>
            {comment ? (
              <div
                className="text-sm bg-muted/50 p-3 rounded-md border border-border/50 wrap-break-word word-break break-all overflow-x-auto prose prose-sm max-w-none task-detail-prose"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(comment) }}
                style={{
                  maxHeight: "400px",
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              />
            ) : (
              <div className="text-sm bg-muted/30 p-3 rounded-md border border-border/50 text-center text-muted-foreground min-h-[80px] flex items-center justify-center">
                내용이 없습니다
              </div>
            )}
            {comment && proseTableStyles}
          </div>

          {task.file_keys && task.file_keys.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-2">요청자 첨부파일</p>
              <div className="space-y-2 text-sm">
                {resolvedFileKeys.length > 0 ? (
                  resolvedFileKeys.map((resolved, index) => {
                    // 요청자 첨부는 '요청한 날짜(작업 생성일)' 기준 7일
                    const expiry = calculateFileExpiry(task.created_at)
                    return (
                      <div key={index} className="flex items-center gap-2">
                        <FileText className={`h-4 w-4 shrink-0 ${expiry.isExpired ? "text-muted-foreground/60" : ""}`} />
                        <button
                          type="button"
                          className={`text-left max-w-[200px] truncate ${expiry.isExpired ? "cursor-not-allowed text-muted-foreground line-through" : "text-blue-600 hover:text-blue-800 underline cursor-pointer"}`}
                          onClick={() => {
                            if (expiry.isExpired) return
                            handleDownloadWithProgress(
                              resolved.s3Key,
                              resolved.fileName
                            )
                          }}
                          disabled={expiry.isExpired}
                        >
                          {resolved.fileName}
                        </button>
                        <span
                          className={`text-xs shrink-0 ${expiry.isExpired ? "text-red-500" : expiry.daysRemaining <= 2 ? "text-orange-500" : "text-muted-foreground"}`}
                        >
                          ({expiry.expiryText})
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-muted-foreground">
                    파일 정보를 불러오는 중...
                  </div>
                )}
              </div>
            </div>
          )}

          {task.comment_file_keys && task.comment_file_keys.length > 0 && (() => {
            const assigneeFileKeys = commentResolvedFileKeys.filter(
              (r) => r.userId === task.assigned_to
            )
            const showSection =
              commentResolvedFileKeys.length === 0 || assigneeFileKeys.length > 0
            if (!showSection) return null
            return (
              <div>
                <p className="text-muted-foreground mb-2">담당자 첨부파일</p>
                <div className="space-y-2 text-sm">
                  {commentResolvedFileKeys.length === 0 ? (
                    <div className="text-muted-foreground">
                      파일 정보를 불러오는 중...
                    </div>
                  ) : (
                    assigneeFileKeys.map((resolved, index) => {
                      const expiry = calculateFileExpiry(resolved.uploadedAt ?? null)
                      return (
                        <div
                          key={index}
                          role="button"
                          tabIndex={expiry.isExpired ? -1 : 0}
                          className={`flex items-center gap-2 ${expiry.isExpired ? "cursor-not-allowed" : "cursor-pointer"}`}
                          onClick={() => {
                            if (expiry.isExpired) return
                            handleDownloadWithProgress(
                              resolved.s3Key,
                              resolved.fileName
                            )
                          }}
                          onKeyDown={(e) => {
                            if (expiry.isExpired) return
                            if (e.key === "Enter")
                              handleDownloadWithProgress(
                                resolved.s3Key,
                                resolved.fileName
                              )
                          }}
                        >
                          <FileText className={`h-4 w-4 shrink-0 ${expiry.isExpired ? "text-muted-foreground/60" : ""}`} />
                          <span className={`max-w-[200px] truncate ${expiry.isExpired ? "text-muted-foreground line-through" : "text-blue-600 hover:text-blue-800 underline"}`}>
                            {resolved.fileName}
                          </span>
                          <span
                            className={`text-xs shrink-0 ${expiry.isExpired ? "text-red-500" : expiry.daysRemaining <= 2 ? "text-orange-500" : "text-muted-foreground"}`}
                          >
                            ({expiry.expiryText})
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })()}

          <div className="pt-4 border-t">
            <TaskCommentSection
              taskId={task.id}
              me={user}
              allowWrite={false}
              allowDelete={false}
            />
          </div>
        </div>

        <div className="flex justify-end mt-4 pt-4 border-t gap-2">
          {onEditTask && task.status !== "awaiting_completion" && (
            <Button
              type="button"
              onClick={() => onEditTask(task)}
              variant="outline"
              className="gap-2 cursor-pointer"
            >
              <Edit className="h-4 w-4" />
              작성
            </Button>
          )}
          {canComplete && showCompleteButton && (
              <Button
                type="button"
                onClick={() => setShowCompleteDialog(true)}
                variant="default"
                className="gap-2 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                작업 끝내기
              </Button>
            )}
        </div>

        <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>작업을 끝내시겠습니까?</AlertDialogTitle>
              <AlertDialogDescription>
                이 작업을 완료 처리하고 Reports로 이동시킵니다. 되돌릴 수 없습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCompleteTask}
                disabled={isDeleting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    처리 중...
                  </>
                ) : (
                  "확인"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {showDeleteTaskButton && (
          <AlertDialog
            open={showDeleteTaskDialog}
            onOpenChange={setShowDeleteTaskDialog}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>이 작업을 제거하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  작업이 목록에서 제거됩니다. 되돌릴 수 없습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeletingTask}>
                  취소
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteTaskFromDB}
                  disabled={isDeletingTask}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isDeletingTask ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      삭제 중...
                    </>
                  ) : (
                    "제거"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </DialogContent>
    </Dialog>
  )
}
