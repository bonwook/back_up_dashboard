"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2, Calendar as CalendarIcon, FileText, X, Send, Bold, Italic, Underline, Minus, Grid3x3 as TableIcon } from "lucide-react"
import Link from "next/link"
import { SafeHtml } from "@/components/safe-html"
import { cn } from "@/lib/utils"
import { sanitizeHtml } from "@/lib/utils/sanitize"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format, addDays } from "date-fns"
import { ko } from "date-fns/locale"
import { useToast } from "@/hooks/use-toast"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { downloadWithProgress } from "@/lib/utils/download-with-progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  filterValidFileKeys,
  extractFileName,
  resolveFileKeys,
  mapResolvedKeys,
  classifyFilesByUploader,
  resolveSubtaskFileKeys,
  type SubtaskFileKeyItem,
  type ResolvedFileKey,
  type ResolvedSubtaskFile,
} from "@/lib/utils/fileKeyHelpers"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getStatusBadge, getStatusColor, getStatusBorderColor, getStatusTextColor, getPriorityBadge } from "@/lib/utils/taskStatusHelpers"
import { FileListItem } from "./components/FileListItem"
import { StaffSessionBlock } from "./components/StaffSessionBlock"
import { useSubtaskCompletion } from "@/lib/hooks/useSubtaskCompletion"
import { useContentEditor } from "@/lib/hooks/useContentEditor"

interface Task {
  id: string
  assigned_to: string
  assigned_by: string
  assigned_by_name?: string
  assigned_by_email?: string
  assigned_to_name?: string
  assigned_to_email?: string
  title: string
  content: string | null
  description: string | null
  comment?: string | null
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'in_progress' | 'on_hold' | 'awaiting_completion' | 'completed'
  file_keys: string[]
  comment_file_keys?: string[]
  due_date?: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  is_multi_assign?: boolean
}

interface Subtask {
  id: string
  task_id: string
  subtitle: string
  assigned_to: string
  assigned_to_name?: string
  assigned_to_email?: string
  content: string | null
  comment?: string | null
  status: 'pending' | 'in_progress' | 'on_hold' | 'awaiting_completion' | 'completed'
  file_keys: string[]
  comment_file_keys?: string[]
  created_at: string
  updated_at: string
  completed_at: string | null
}

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [task, setTask] = useState<Task | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const [taskId, setTaskId] = useState<string | null>(null)
  const { toast } = useToast()
  const [me, setMe] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [selectedDueDate, setSelectedDueDate] = useState<Date | null>(null)
  const [isUpdatingDueDate, setIsUpdatingDueDate] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isDuePopoverOpen, setIsDuePopoverOpen] = useState(false)
  const [resolvedFileKeys, setResolvedFileKeys] = useState<ResolvedFileKey[]>([])
  const [resolvedCommentFileKeys, setResolvedCommentFileKeys] = useState<ResolvedFileKey[]>([])
  const [resolvedSubtaskFileKeys, setResolvedSubtaskFileKeys] = useState<ResolvedSubtaskFile[]>([])
  const [isResolvingFiles, setIsResolvingFiles] = useState(false)
  const [isResolvingCommentFiles, setIsResolvingCommentFiles] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<number>(0)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadingFileName, setDownloadingFileName] = useState<string>("")
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [comments, setComments] = useState<Array<{ id: string; content: string; created_at: string; user_id: string; full_name: string | null }>>([])
  const [newComment, setNewComment] = useState("")
  const [isPostingComment, setIsPostingComment] = useState(false)
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [selectedSubtask, setSelectedSubtask] = useState<Subtask | null>(null)
  /** 공동 업무에서 부제 태그 클릭 시 선택된 부제 (요청자 내용 수정 시 편집 대상, showMyAssignment 시 분담 블록 필터) */
  const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(null)
  /** 그룹별 선택된 담당자 블록 (분담내용에서 블록 선택 시) — subtitle -> subtask id */
  const [selectedSubtaskIdBySubtitle, setSelectedSubtaskIdBySubtitle] = useState<Record<string, string | null>>({})
  const [isLoadingSubtasks, setIsLoadingSubtasks] = useState(false)
  const [isEditingRequesterContent, setIsEditingRequesterContent] = useState(false)
  const [isSavingRequesterContent, setIsSavingRequesterContent] = useState(false)
  const didSetInitialRequesterContent = useRef(false)
  /** 공동 수정 시 에디터에 마지막으로 로드한 소스(부제) 추적 — 부제 전환 시 에디터 내용 갱신용 */
  const lastRequesterContentSourceRef = useRef<{ taskId: string; subtitle: string | null } | null>(null)
  /** 공동: 요청자 내용 카드에서 "담당업무 표시" 선택 시 true → 내가 작성한 분담내용 표시 */
  const [showMyAssignment, setShowMyAssignment] = useState(false)
  const [isEditingMyComment, setIsEditingMyComment] = useState(false)
  const [isSavingMyComment, setIsSavingMyComment] = useState(false)
  const didSetMyCommentEditorRef = useRef(false)

  // 서브태스크 완료 처리 hook
  const { completeSubtask, isCompleting: isCompletingSubtask } = useSubtaskCompletion({
    onSuccess: () => {
      loadSubtasks()
      reloadTask()
    }
  })

  // 요청자 내용 편집용 서식 툴바 (굵게/기울임/밑줄/테이블/구분선)
  const {
    editorState: requesterEditorState,
    updateEditorState: updateRequesterEditorState,
    tableGridHover: requesterTableGridHover,
    setTableGridHover: setRequesterTableGridHover,
    createTable: createRequesterTable,
    addResizeHandlersToTable: addResizeHandlersToRequesterTable,
  } = useContentEditor({ editorId: "requester-content-editor", onContentChange: () => {} })

  useEffect(() => {
    params.then((p) => {
      setTaskId(p.id)
    })
  }, [params])

  // 현재 사용자 역할 로드 (staff/admin만 완료 처리 버튼 노출)
  useEffect(() => {
    const loadMe = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" })
        if (res.ok) {
          const me = await res.json()
          setMe(me)
          setUserRole(me.role || null)
        }
      } catch {
        // ignore
      }
    }
    loadMe()
  }, [])

  useEffect(() => {
    if (!taskId) return

    const loadTask = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/tasks/${taskId}`, {
          credentials: "include",
        })

        if (!response.ok) {
          if (response.status === 404) {
            router.push("/admin/cases")
            return
          }
          throw new Error("Failed to load task")
        }

        const data = await response.json()
        setTask(data.task)
        if (data.task.due_date) {
          setSelectedDueDate(new Date(data.task.due_date))
        } else {
          setSelectedDueDate(null)
        }
      } catch (error) {
        console.error("Failed to load task:", error)
        router.push("/admin/cases")
      } finally {
        setIsLoading(false)
      }
    }

    loadTask()
  }, [taskId, router])

  // 첨부파일 resolve + 업로더 기준으로 분리(기존 데이터에서 file_keys에 섞여 있는 사용자 파일도 분리)
  useEffect(() => {
    const run = async () => {
      const rawFileKeys = Array.isArray(task?.file_keys) ? task!.file_keys : []
      const rawCommentKeys = Array.isArray(task?.comment_file_keys) ? task!.comment_file_keys : []

      // 유효한 문자열 키만 필터링
      const fileKeys = filterValidFileKeys(rawFileKeys)
      const commentKeys = filterValidFileKeys(rawCommentKeys)

      if (fileKeys.length === 0 && commentKeys.length === 0) {
        setResolvedFileKeys([])
        setResolvedCommentFileKeys([])
        return
      }

      const allKeys = Array.from(new Set([...fileKeys, ...commentKeys]))
      setIsResolvingFiles(true)
      setIsResolvingCommentFiles(true)
      
      try {
        const res = await fetch("/api/storage/resolve-file-keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ fileKeys: allKeys }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || "첨부파일 정보를 불러오지 못했습니다.")
        }

        const data = await res.json()
        const resolvedKeys = Array.isArray(data.resolvedKeys) ? data.resolvedKeys : []
        
        // API 응답을 Map으로 변환
        const resolvedKeyMap = mapResolvedKeys(resolvedKeys)
        
        // 파일 분류
        const { adminFiles, userFiles } = classifyFilesByUploader({
          allKeys,
          resolvedKeyMap,
          clientId: (task as any)?.assigned_to || null,
          preferUserKeys: commentKeys,
        })

        setResolvedFileKeys(adminFiles)
        setResolvedCommentFileKeys(userFiles)
      } catch {
        // fallback: 원본 배열 기준으로만 분리
        setResolvedFileKeys(resolveFileKeys(fileKeys))
        setResolvedCommentFileKeys(resolveFileKeys(commentKeys))
      } finally {
        setIsResolvingFiles(false)
        setIsResolvingCommentFiles(false)
      }
    }

    run()
  }, [task?.file_keys, task?.comment_file_keys, task?.assigned_to])

  const handleDownload = useCallback(async (s3Key: string, fileName?: string) => {
    try {
      const name = fileName || extractFileName(s3Key, "download")
      setIsDownloading(true)
      setDownloadingFileName(name)
      setDownloadProgress(0)
      await downloadWithProgress({
        url: `/api/storage/download?path=${encodeURIComponent(s3Key)}`,
        fileName: name,
        withCredentials: true,
        onProgress: (p) => setDownloadProgress(p.percent),
      })
    } catch (e: any) {
      toast({
        title: "다운로드 실패",
        description: e?.message || "다운로드 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsDownloading(false)
      setDownloadingFileName("")
      setDownloadProgress(0)
    }
  }, [toast])

  const reloadTask = useCallback(async () => {
    if (!taskId) return
    const res = await fetch(`/api/tasks/${taskId}`, { credentials: "include" })
    if (res.ok) {
      const data = await res.json()
      setTask(data.task)
    }
  }, [taskId])

  // 수정 모드 종료 시 초기화 플래그 리셋 (의존성 배열 길이 고정을 위해 별도 effect)
  useEffect(() => {
    if (!isEditingRequesterContent) {
      didSetInitialRequesterContent.current = false
      lastRequesterContentSourceRef.current = null
    }
  }, [isEditingRequesterContent])

  const loadComments = useCallback(async () => {
    if (!taskId) return
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()
      setComments(Array.isArray(data.comments) ? data.comments : [])
    } catch {
      // ignore
    }
  }, [taskId])

  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!taskId) return
    const ok = confirm("이 댓글을 삭제할까요?")
    if (!ok) return
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments?commentId=${encodeURIComponent(commentId)}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "댓글 삭제 실패")
      }
      await loadComments()
    } catch (e: any) {
      toast({
        title: "댓글 삭제 실패",
        description: e?.message || "댓글을 삭제하는 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    }
  }, [taskId, loadComments, toast])

  useEffect(() => {
    if (!taskId) return
    loadComments()
  }, [taskId, loadComments])

  // 서브태스크 로드
  const loadSubtasks = useCallback(async () => {
    if (!taskId) return
    setIsLoadingSubtasks(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks`, { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()
      setSubtasks(Array.isArray(data.subtasks) ? data.subtasks : [])
    } catch {
      // ignore
    } finally {
      setIsLoadingSubtasks(false)
    }
  }, [taskId])

  useEffect(() => {
    if (!taskId) return
    loadSubtasks()
  }, [taskId, loadSubtasks])

  type TaskStatusType = "pending" | "in_progress" | "on_hold" | "awaiting_completion" | "completed"
  const handleStatusChange = useCallback(
    async (id: string, newStatus: TaskStatusType) => {
      setIsUpdatingStatus(true)
      try {
        const res = await fetch(`/api/tasks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status: newStatus }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || "상태 업데이트 실패")
        }
        await reloadTask()
        await loadSubtasks()
        if (taskId) {
          window.dispatchEvent(new CustomEvent("task-content-updated", { detail: { taskId } }))
        }
        toast({ title: "상태가 변경되었습니다." })
        router.refresh()
      } catch (e: any) {
        toast({
          title: "상태 변경 실패",
          description: e?.message || "상태를 변경하는 중 오류가 발생했습니다.",
          variant: "destructive",
        })
      } finally {
        setIsUpdatingStatus(false)
      }
    },
    [taskId, reloadTask, loadSubtasks, toast, router]
  )

  // subtask 첨부파일 resolve
  useEffect(() => {
    const run = async () => {
      // 모든 subtask의 comment_file_keys 수집
      const subtaskFileKeys: SubtaskFileKeyItem[] = []
      
      subtasks.forEach((subtask) => {
        if (subtask.comment_file_keys && subtask.comment_file_keys.length > 0) {
          const validKeys = filterValidFileKeys(subtask.comment_file_keys)
          validKeys.forEach((key) => {
            subtaskFileKeys.push({
              key,
              subtaskId: subtask.id,
              assignedToName: subtask.assigned_to_name || subtask.assigned_to_email || "담당자"
            })
          })
        }
      })

      if (subtaskFileKeys.length === 0) {
        setResolvedSubtaskFileKeys([])
        return
      }

      try {
        const allKeys = subtaskFileKeys.map(item => item.key)
        const res = await fetch("/api/storage/resolve-file-keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ fileKeys: allKeys }),
        })

        if (!res.ok) {
          throw new Error("subtask 첨부파일 정보를 불러오지 못했습니다.")
        }

        const data = await res.json()
        const resolvedKeys = Array.isArray(data.resolvedKeys) ? data.resolvedKeys : []
        
        // API 응답을 Map으로 변환 (userId 필드는 제외)
        const resolvedKeyMap = new Map<string, { s3Key: string; fileName: string; uploadedAt?: string | null }>()
        resolvedKeys.forEach((k: any) => {
          if (typeof k === "object" && k !== null && "originalKey" in k) {
            resolvedKeyMap.set(String(k.originalKey), {
              s3Key: k.s3Key,
              fileName: k.fileName,
              uploadedAt: k.uploadedAt ?? null
            })
          }
        })
        
        // 서브태스크 파일 키 resolve
        const resolved = resolveSubtaskFileKeys(subtaskFileKeys, resolvedKeyMap)
        setResolvedSubtaskFileKeys(resolved)
      } catch (error) {
        console.error("subtask 첨부파일 resolve 오류:", error)
        setResolvedSubtaskFileKeys([])
      }
    }

    run()
  }, [subtasks])

  // 서브태스크를 subtitle(작업명)별로 그룹화
  const groupedSubtasks = useMemo(() => {
    const groups = new Map<string, Subtask[]>()
    subtasks.forEach((subtask) => {
      const key = subtask.subtitle
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(subtask)
    })
    return Array.from(groups.entries()).map(([subtitle, tasks]) => ({
      subtitle,
      tasks,
    }))
  }, [subtasks])

  /** 공동: 현재 로그인 사용자에게 할당된 subtask 목록 (담당업무 표시용) */
  const mySubtasks = useMemo(
    () => (me?.id ? subtasks.filter((st) => st.assigned_to === me.id) : []),
    [subtasks, me?.id]
  )
  const mySubtaskForComment = mySubtasks[0] ?? null

  // 담당업무 표시 시 분담내용에서 본인(me.id) subtask 블록 자동 선택
  useEffect(() => {
    if (!showMyAssignment || !me?.id || subtasks.length === 0) return
    const mySt = subtasks.find((st) => st.assigned_to === me.id)
    if (mySt) {
      setSelectedSubtask(mySt)
      setSelectedSubtitle(mySt.subtitle)
    }
  }, [showMyAssignment, me?.id, subtasks])

  // 내 담당업무 편집 시 에디터에 초기값 한 번만 설정
  useEffect(() => {
    if (!isEditingMyComment || !mySubtaskForComment) {
      didSetMyCommentEditorRef.current = false
      return
    }
    const t = setTimeout(() => {
      const el = document.getElementById("my-comment-editor") as HTMLElement | null
      if (!el || didSetMyCommentEditorRef.current) return
      const raw = mySubtaskForComment.comment ?? ""
      const commentDisplay = raw.startsWith("\n") ? raw.substring(1) : raw
      el.innerHTML = sanitizeHtml(commentDisplay)
      didSetMyCommentEditorRef.current = true
    }, 0)
    return () => clearTimeout(t)
  }, [isEditingMyComment, mySubtaskForComment?.id])

  /** 공동: 내 담당업무(분담내용) 저장 — subtask comment PATCH */
  const handleSaveMyComment = useCallback(async () => {
    if (!mySubtaskForComment) return
    const el = document.getElementById("my-comment-editor") as HTMLElement | null
    if (!el) return
    const raw = el.innerHTML || ""
    const comment = sanitizeHtml(raw.trim() ? raw : "")
    setIsSavingMyComment(true)
    try {
      const res = await fetch(`/api/tasks/${mySubtaskForComment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ comment, is_subtask: true }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "분담내용 저장 실패")
      }
      toast({ title: "저장됨", description: "내 담당업무 내용이 저장되었습니다." })
      await loadSubtasks()
      setIsEditingMyComment(false)
      if (taskId) {
        window.dispatchEvent(new CustomEvent("task-content-updated", { detail: { taskId } }))
      }
      router.refresh()
    } catch (e: any) {
      toast({
        title: "저장 실패",
        description: e?.message || "분담내용을 저장하는 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsSavingMyComment(false)
    }
  }, [mySubtaskForComment, taskId, loadSubtasks, toast, router])

  // 요청자 내용 편집 시 에디터에 초기값 설정 (개별: task.content, 공동: 선택/기본 부제의 첫 서브태스크 content) + 테이블 리사이즈
  useEffect(() => {
    if (!isEditingRequesterContent || !task) return
    const t = setTimeout(() => {
      const el = document.getElementById("requester-content-editor") as HTMLElement | null
      if (!el) return
      const isJoint = subtasks.length > 0
      const effectiveSubtitle = isJoint ? (selectedSubtitle ?? groupedSubtasks[0]?.subtitle ?? null) : null
      const contentToLoad = effectiveSubtitle
        ? (groupedSubtasks.find((g) => g.subtitle === effectiveSubtitle)?.tasks[0]?.content ?? "")
        : (task.content ?? "")
      const sourceKey = { taskId: task.id, subtitle: effectiveSubtitle }
      const prev = lastRequesterContentSourceRef.current
      if (prev?.taskId !== sourceKey.taskId || prev?.subtitle !== sourceKey.subtitle) {
        lastRequesterContentSourceRef.current = sourceKey
        el.innerHTML = contentToLoad
        didSetInitialRequesterContent.current = true
      }
      el.querySelectorAll("table").forEach((table) => {
        addResizeHandlersToRequesterTable(table as HTMLTableElement)
      })
    }, 0)
    return () => clearTimeout(t)
  }, [isEditingRequesterContent, task?.id, task?.content, subtasks.length, selectedSubtitle, groupedSubtasks, addResizeHandlersToRequesterTable])

  const handleSaveRequesterContent = useCallback(async () => {
    if (!taskId || !task) return
    const el = document.getElementById("requester-content-editor") as HTMLElement | null
    if (!el) return
    const raw = el.innerHTML || ""
    const content = sanitizeHtml(raw.trim() ? raw : "")
    setIsSavingRequesterContent(true)
    try {
      if (subtasks.length > 0) {
        const effectiveSubtitle = selectedSubtitle ?? groupedSubtasks[0]?.subtitle ?? null
        const group = effectiveSubtitle ? groupedSubtasks.find((g) => g.subtitle === effectiveSubtitle) : groupedSubtasks[0]
        if (!group) {
          toast({ title: "저장 실패", description: "선택된 부제를 찾을 수 없습니다.", variant: "destructive" })
          return
        }
        for (const st of group.tasks) {
          const res = await fetch(`/api/tasks/${st.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ content, is_subtask: true }),
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.error || "요청자 내용 저장 실패")
          }
        }
      } else {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ content }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || "요청자 내용 저장 실패")
        }
      }
      toast({ title: "저장됨", description: "요청자 내용이 저장되었습니다." })
      await reloadTask()
      await loadSubtasks()
      setIsEditingRequesterContent(false)
      window.dispatchEvent(new CustomEvent("task-content-updated", { detail: { taskId } }))
      router.refresh()
    } catch (e: any) {
      toast({
        title: "저장 실패",
        description: e?.message || "요청자 내용을 저장하는 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsSavingRequesterContent(false)
    }
  }, [taskId, task, subtasks.length, selectedSubtitle, groupedSubtasks, reloadTask, loadSubtasks, toast])

  // 실제 resolve된 담당자 첨부파일이 있는 subtaskId 집합 (아이콘은 이 기준으로만 표시)
  const subtaskIdsWithResolvedFiles = useMemo(() => {
    const set = new Set<string>()
    resolvedSubtaskFileKeys.forEach((f) => set.add(f.subtaskId))
    return set
  }, [resolvedSubtaskFileKeys])

  const applyDueDate = useCallback(async (next: Date | null): Promise<boolean> => {
    if (!taskId) return false
    try {
      setIsUpdatingDueDate(true)
      const dueDateValue = next ? format(next, "yyyy-MM-dd") : null
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ due_date: dueDateValue }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "마감일 업데이트 실패")
      }

      toast({
        title: dueDateValue ? "마감일이 적용되었습니다" : "마감일이 제거되었습니다",
        description: dueDateValue ? format(next as Date, "yyyy년 MM월 dd일", { locale: ko }) : undefined,
      })

      await reloadTask()
      return true
    } catch (error: any) {
      toast({
        title: "마감일 업데이트 실패",
        description: error.message || "마감일을 업데이트하는 중 오류가 발생했습니다.",
        variant: "destructive",
      })
      // 실패 시 원래 값으로 복원
      setSelectedDueDate(task?.due_date ? new Date(task.due_date) : null)
      return false
    } finally {
      setIsUpdatingDueDate(false)
    }
  }, [taskId, toast, reloadTask, task?.due_date])

  // 모든 서브태스크가 완료되었는지 확인
  const allSubtasksCompleted = useMemo(() => {
    if (subtasks.length === 0) return false
    return subtasks.every(st => st.status === "completed")
  }, [subtasks])

  const handlePostComment = useCallback(async () => {
    if (!taskId) return
    const content = newComment.trim()
    if (!content) return
    setIsPostingComment(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "댓글 저장 실패")
      }
      setNewComment("")
      await loadComments()
    } catch (e: any) {
      toast({
        title: "댓글 작성 실패",
        description: e?.message || "댓글을 저장하는 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsPostingComment(false)
    }
  }, [taskId, newComment, loadComments, toast])

  const handleFinalizeTask = useCallback(async () => {
    if (!taskId || !task) return
    if (!(userRole === "admin" || userRole === "staff")) return
    
    // awaiting_completion 이거나, 모든 서브태스크가 완료된 경우 완료 가능
    const canFinalize = task.status === "awaiting_completion" || 
                        (subtasks.length > 0 && allSubtasksCompleted)
    
    if (!canFinalize) return

    setIsFinalizing(true)
    try {
      // 1) 상태를 completed로 변경 (completed_at 자동 설정)
      const updateRes = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "completed" }),
      })

      if (!updateRes.ok) {
        const err = await updateRes.json().catch(() => ({}))
        throw new Error(err.error || "작업 완료 처리 실패")
      }

      // 2) Report 생성 (staff/admin도 가능하도록 서버 권한 확장)
      const reportRes = await fetch(`/api/tasks/${taskId}/create-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      })
      if (!reportRes.ok) {
        const err = await reportRes.json().catch(() => ({}))
        throw new Error(err.error || "Report 생성 실패")
      }

      toast({
        title: "완료 처리됨",
        description: "작업이 완료 처리되었고 Report가 저장되었습니다.",
      })

      await reloadTask()
    } catch (e: any) {
      toast({
        title: "완료 처리 실패",
        description: e?.message || "완료 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsFinalizing(false)
    }
  }, [taskId, task, userRole, toast, reloadTask, subtasks, allSubtasksCompleted])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!task) {
    return null
  }

  // 수정 권한: 요청자(assigned_by) 또는 admin만. 할당받은 staff(assigned_to)는 수정 불가
  const canEditTask = userRole === "admin" || me?.id === task.assigned_by
  // 담당자(staff/admin)만 상태 변경 가능, 요청자(assigned_by)는 상태 선택 블록 미노출
  const canChangeStatus =
    (userRole === "staff" || userRole === "admin") && me?.id !== task.assigned_by

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          뒤로가기
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-0.5 pt-3">
          <div className="flex items-start justify-between gap-4 mb-1">
            <CardTitle className="text-xl font-bold">{task.title}</CardTitle>
            {canChangeStatus && (
              <Select
                value={task.status}
                onValueChange={(value) => handleStatusChange(task.id, value as TaskStatusType)}
                disabled={isUpdatingStatus}
              >
                <SelectTrigger
                  className={cn(
                    "h-7 min-w-22 w-auto max-w-26 text-xs shrink-0 border px-2.5 py-1 font-normal",
                    getStatusColor(task.status),
                    getStatusTextColor(task.status)
                  )}
                  aria-label="상태 변경"
                >
                  {isUpdatingStatus ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                      변경 중
                    </span>
                  ) : (
                    <SelectValue placeholder="상태" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending" className="text-gray-500 focus:text-gray-500">
                    대기
                  </SelectItem>
                  <SelectItem value="in_progress" className="text-blue-500 focus:text-blue-500">
                    작업중
                  </SelectItem>
                  <SelectItem value="on_hold" className="text-yellow-500 focus:text-yellow-500">
                    보류
                  </SelectItem>
                  <SelectItem value="awaiting_completion" className="text-purple-500 focus:text-purple-500">
                    완료대기
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          {/* 중요도, 상태, 생성일, 마감일 */}
          <div className="flex items-center gap-3 text-xs mb-1">
            {/* 중요도 */}
            {getPriorityBadge(task.priority)}
            
            {/* 상태 */}
            {getStatusBadge(task.status)}
            {/* 개별/공동 */}
            <Badge variant={task.is_multi_assign ? "secondary" : "outline"} className="font-normal">
              {task.is_multi_assign ? "공동" : "개별"}
            </Badge>
            
            {/* 생성일 */}
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">생성</span>
              <span className="font-medium">{format(new Date(task.created_at), "yy.MM.dd", { locale: ko })}</span>
            </div>
            
            {/* 마감일 */}
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">마감</span>
              <span className="font-medium">{selectedDueDate ? format(selectedDueDate, "yy.MM.dd", { locale: ko }) : "미정"}</span>
              {canEditTask && (
                <Popover open={isDuePopoverOpen} onOpenChange={setIsDuePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 p-0 hover:bg-muted"
                      disabled={isUpdatingDueDate || task.status === "completed"}
                    >
                      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDueDate || undefined}
                      classNames={{
                        today:
                          "bg-transparent text-foreground rounded-md border border-muted-foreground/30 data-[selected=true]:border-primary data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground",
                      }}
                      onSelect={async (date) => {
                        if (task.status === "completed") return
                        if (!date) {
                          setSelectedDueDate(null)
                          return
                        }

                        if (selectedDueDate && format(selectedDueDate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")) {
                          setSelectedDueDate(null)
                          return
                        }

                        setSelectedDueDate(date)
                      }}
                      initialFocus
                    />
                    {task.status !== "completed" && (
                      <div className="p-3 border-t">
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full"
                          onClick={async () => {
                            const ok = await applyDueDate(selectedDueDate)
                            if (ok) setIsDuePopoverOpen(false)
                          }}
                          disabled={isUpdatingDueDate}
                        >
                          적용
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 pb-3">
          {/* 담당자 정보 */}
          {groupedSubtasks.length === 0 ? (
            <div className="flex items-center gap-6 text-sm mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">요청자</span>
                <span className="font-medium">{task.assigned_by_name || task.assigned_by_email || "Unknown"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">담당자</span>
                <span className="font-medium">{task.assigned_to_name || task.assigned_to_email || "Unknown"}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-6 text-sm mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">요청자</span>
                <span className="font-medium">{task.assigned_by_name || task.assigned_by_email || "Unknown"}</span>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <span className="text-muted-foreground">담당자</span>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {Array.from(new Set(subtasks.map(st => st.assigned_to))).map((userId, idx) => {
                    const subtask = subtasks.find(st => st.assigned_to === userId)
                    const hasResolvedFile = subtasks.some(st => st.assigned_to === userId && subtaskIdsWithResolvedFiles.has(st.id))
                    return (
                      <span key={userId || idx} className="text-xs font-medium inline-flex items-center gap-1">
                        {subtask?.assigned_to_name || subtask?.assigned_to_email || "담당자"}
                        {hasResolvedFile && (
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-label="첨부파일 있음" />
                        )}
                        {idx < Array.from(new Set(subtasks.map(st => st.assigned_to))).length - 1 && ", "}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
          
          {/* 첨부파일 정보 */}
          {(resolvedFileKeys.length > 0 || resolvedCommentFileKeys.length > 0) && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {resolvedFileKeys.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  <span>{task.assigned_by_name || "요청자"} 첨부: {resolvedFileKeys.length}개</span>
                </div>
              )}
              {resolvedCommentFileKeys.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  <span>{task.assigned_to_name || "담당자"} 등록: {resolvedCommentFileKeys.length}개</span>
                </div>
              )}
            </div>
          )}
          
          {/* 완료일 */}
          {task.completed_at && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1.5">
              <CalendarIcon className="h-3.5 w-3.5" />
              <span>완료일:</span>
              <span className="font-medium text-foreground">{format(new Date(task.completed_at), "yyyy년 MM월 dd일 HH:mm", { locale: ko })}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {task.description && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>설명</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{task.description}</p>
          </CardContent>
        </Card>
      )}

      {/* 개별 할당: subtasks가 없을 때 */}
      {subtasks.length === 0 && (
        <div className="space-y-6 mb-6">
          {/* 요청자 내용 - 항상 표시 (요청자/admin일 때 수정 가능) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg">{task.assigned_by_name || task.assigned_by_email} 내용</CardTitle>
              {canEditTask && !isEditingRequesterContent && (
                <Button variant="outline" size="sm" onClick={() => setIsEditingRequesterContent(true)}>
                  수정
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {canEditTask && isEditingRequesterContent ? (
                <>
                  <div
                    className="border rounded-md overflow-hidden bg-background flex flex-col"
                    style={{
                      height: "350px",
                      minHeight: "350px",
                      maxHeight: "350px",
                    }}
                  >
                    <div className="flex items-center gap-1 p-2 flex-wrap shrink-0 border-b">
                      <Button
                        type="button"
                        variant={requesterEditorState.bold ? "secondary" : "ghost"}
                        size="sm"
                        className={`h-8 w-8 p-0 ${requesterEditorState.bold ? "bg-primary/10" : ""}`}
                        onClick={(e) => {
                          e.preventDefault()
                          const editor = document.getElementById("requester-content-editor")
                          if (editor) {
                            editor.focus()
                            document.execCommand("bold", false)
                            updateRequesterEditorState()
                          }
                        }}
                        title="굵게 (Ctrl+B)"
                      >
                        <Bold className={`h-4 w-4 ${requesterEditorState.bold ? "text-primary" : ""}`} />
                      </Button>
                      <Button
                        type="button"
                        variant={requesterEditorState.italic ? "secondary" : "ghost"}
                        size="sm"
                        className={`h-8 w-8 p-0 ${requesterEditorState.italic ? "bg-primary/10" : ""}`}
                        onClick={(e) => {
                          e.preventDefault()
                          const editor = document.getElementById("requester-content-editor")
                          if (editor) {
                            editor.focus()
                            document.execCommand("italic", false)
                            updateRequesterEditorState()
                          }
                        }}
                        title="기울임 (Ctrl+I)"
                      >
                        <Italic className={`h-4 w-4 ${requesterEditorState.italic ? "text-primary" : ""}`} />
                      </Button>
                      <Button
                        type="button"
                        variant={requesterEditorState.underline ? "secondary" : "ghost"}
                        size="sm"
                        className={`h-8 w-8 p-0 ${requesterEditorState.underline ? "bg-primary/10" : ""}`}
                        onClick={(e) => {
                          e.preventDefault()
                          const editor = document.getElementById("requester-content-editor")
                          if (editor) {
                            editor.focus()
                            document.execCommand("underline", false)
                            updateRequesterEditorState()
                          }
                        }}
                        title="밑줄"
                      >
                        <Underline className={`h-4 w-4 ${requesterEditorState.underline ? "text-primary" : ""}`} />
                      </Button>
                      <div className="w-px h-6 bg-border mx-1" />
                      <div className="relative">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.preventDefault()
                            setRequesterTableGridHover(
                              requesterTableGridHover.show
                                ? { row: 0, col: 0, show: false }
                                : { row: 0, col: 0, show: true }
                            )
                          }}
                          title="테이블"
                        >
                          <TableIcon className="h-4 w-4" />
                        </Button>
                        {requesterTableGridHover.show && (
                          <div
                            className="absolute top-full left-0 mt-2 bg-background border rounded-lg shadow-xl p-4 z-50 min-w-[280px]"
                            onMouseLeave={() => setRequesterTableGridHover({ row: 0, col: 0, show: false })}
                          >
                            <div className="grid grid-cols-10 gap-1 mb-3">
                              {Array.from({ length: 100 }).map((_, idx) => {
                                const row = Math.floor(idx / 10) + 1
                                const col = (idx % 10) + 1
                                const isSelected =
                                  row <= requesterTableGridHover.row && col <= requesterTableGridHover.col
                                return (
                                  <div
                                    key={idx}
                                    className={`w-5 h-5 border border-border rounded-sm transition-colors ${
                                      isSelected ? "bg-primary border-primary" : "bg-muted hover:bg-muted/80"
                                    }`}
                                    onMouseEnter={() => setRequesterTableGridHover({ row, col, show: true })}
                                    onClick={() => {
                                      createRequesterTable(row, col)
                                      setRequesterTableGridHover({ row: 0, col: 0, show: false })
                                    }}
                                  />
                                )
                              })}
                            </div>
                            <div className="text-sm text-center font-medium text-foreground border-t pt-2">
                              {requesterTableGridHover.row > 0 && requesterTableGridHover.col > 0
                                ? `${requesterTableGridHover.row} x ${requesterTableGridHover.col} 테이블`
                                : "테이블 크기 선택"}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="w-px h-6 bg-border mx-1" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.preventDefault()
                          const editor = document.getElementById("requester-content-editor") as HTMLElement
                          if (editor) {
                            editor.focus()
                            const hr = document.createElement("hr")
                            hr.style.border = "none"
                            hr.style.borderTop = "2px solid #6b7280"
                            hr.style.margin = "10px 0"
                            const selection = window.getSelection()
                            if (selection && selection.rangeCount > 0) {
                              const range = selection.getRangeAt(0)
                              range.deleteContents()
                              range.insertNode(hr)
                              range.setStartAfter(hr)
                              range.collapse(true)
                              selection.removeAllRanges()
                              selection.addRange(range)
                            }
                          }
                        }}
                        title="구분선"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div
                      id="requester-content-editor"
                      contentEditable
                      suppressContentEditableWarning
                      data-placeholder="내용을 입력하세요."
                      onInput={() => {
                        updateRequesterEditorState()
                        const editor = document.getElementById("requester-content-editor")
                        if (editor) {
                          editor.querySelectorAll("table[data-resizable='true']").forEach((table) => {
                            addResizeHandlersToRequesterTable(table as HTMLTableElement)
                          })
                        }
                      }}
                      onBlur={updateRequesterEditorState}
                      onMouseUp={updateRequesterEditorState}
                      onKeyUp={updateRequesterEditorState}
                      className="text-sm p-3 wrap-break-word word-break break-all overflow-x-auto overflow-y-auto prose prose-sm max-w-none flex-1 custom-scrollbar focus:outline-none focus:ring-0 resize-none w-full min-w-0"
                      style={{
                        minHeight: "280px",
                        whiteSpace: "pre-wrap",
                      }}
                    />
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={handleSaveRequesterContent} disabled={isSavingRequesterContent}>
                      {isSavingRequesterContent ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditingRequesterContent(false)}
                      disabled={isSavingRequesterContent}
                    >
                      취소
                    </Button>
                  </div>
                </>
              ) : task.content ? (
                <div
                  className="border rounded-md overflow-hidden bg-background"
                  style={{
                    height: "300px",
                    minHeight: "300px",
                    maxHeight: "300px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    id="worklist-content-display"
                    className="text-sm bg-muted/50 p-3 wrap-break-word word-break break-all overflow-x-auto overflow-y-auto prose prose-sm max-w-none flex-1 dark:prose-invert custom-scrollbar"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(task.content) }}
                    style={{
                      userSelect: "none",
                      cursor: "default",
                      whiteSpace: "pre-wrap",
                    }}
                  />
                </div>
              ) : (
                <div
                  className="border rounded-md bg-muted/30 p-4 text-center text-muted-foreground"
                  style={{
                    height: "300px",
                    minHeight: "300px",
                    maxHeight: "300px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  내용이 없습니다
                </div>
              )}
            </CardContent>
          </Card>

          {/* 담당자 내용 - 항상 표시 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{task.assigned_to_name || task.assigned_to_email} 내용</CardTitle>
            </CardHeader>
            <CardContent>
              {task.comment && task.comment.trim() ? (
                <div
                  className="border rounded-md overflow-hidden bg-background"
                  style={{
                    height: "300px",
                    minHeight: "300px",
                    maxHeight: "300px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    className="text-sm bg-muted/50 p-3 wrap-break-word word-break break-all overflow-x-auto overflow-y-auto prose prose-sm max-w-none flex-1 dark:prose-invert custom-scrollbar"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(task.comment.startsWith('\n') ? task.comment.substring(1) : task.comment) }}
                    style={{
                      userSelect: "none",
                      cursor: "default",
                      whiteSpace: "pre-wrap",
                    }}
                  />
                </div>
              ) : (
                <div
                  className="border rounded-md bg-muted/30 p-4 text-center text-muted-foreground"
                  style={{
                    height: "300px",
                    minHeight: "300px",
                    maxHeight: "300px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  내용이 없습니다
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 공동 할당: subtasks가 있을 때 */}
      {subtasks.length > 0 && (
        <div className="space-y-6 mb-6">
          {showMyAssignment ? (
            /* 내 담당업무 보기: 기존 단일 카드 + 분담내용 카드 */
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-lg">내 담당업무</CardTitle>
                    <Badge
                      variant="outline"
                      className="text-[11px] font-normal cursor-pointer shrink-0"
                      onClick={() => setShowMyAssignment(false)}
                    >
                      요청자 내용
                    </Badge>
                  </div>
                  {mySubtaskForComment && !isEditingMyComment && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditingMyComment(true)}>
                      수정
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {(() => {
                  const commentRaw = mySubtaskForComment?.comment ?? ""
                  const commentDisplay = commentRaw.startsWith("\n") ? commentRaw.substring(1) : commentRaw
                  if (isEditingMyComment && mySubtaskForComment) {
                    return (
                      <>
                        <div
                          className="border rounded-md overflow-hidden bg-background flex flex-col"
                          style={{
                            height: "300px",
                            minHeight: "300px",
                            maxHeight: "300px",
                          }}
                        >
                          <div
                            id="my-comment-editor"
                            contentEditable
                            suppressContentEditableWarning
                            data-placeholder="내가 작성한 분담내용을 입력하세요."
                            className="text-sm p-3 wrap-break-word word-break break-all overflow-x-auto overflow-y-auto prose prose-sm max-w-none flex-1 custom-scrollbar focus:outline-none focus:ring-0 resize-none w-full min-w-0"
                            style={{ minHeight: "280px", whiteSpace: "pre-wrap" }}
                          />
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" onClick={handleSaveMyComment} disabled={isSavingMyComment}>
                            {isSavingMyComment ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsEditingMyComment(false)}
                            disabled={isSavingMyComment}
                          >
                            취소
                          </Button>
                        </div>
                      </>
                    )
                  }
                  return commentDisplay ? (
                    <div
                      className="border rounded-md overflow-hidden bg-background"
                      style={{
                        height: "300px",
                        minHeight: "300px",
                        maxHeight: "300px",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <div
                        className="text-sm bg-muted/50 p-3 wrap-break-word word-break break-all overflow-x-auto overflow-y-auto prose prose-sm max-w-none flex-1 dark:prose-invert custom-scrollbar"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(commentDisplay) }}
                        style={{ userSelect: "none", cursor: "default", whiteSpace: "pre-wrap" }}
                      />
                    </div>
                  ) : (
                    <div
                      className="border rounded-md bg-muted/30 p-4 text-center text-muted-foreground"
                      style={{
                        height: "300px",
                        minHeight: "300px",
                        maxHeight: "300px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      내가 작성한 분담내용이 없습니다. 수정 버튼으로 작성해 보세요.
                    </div>
                  )
                  })()}
                </CardContent>
          </Card>

          {/* 분담내용 (내 담당업무 보기 시 단일 카드) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                분담내용 {selectedSubtask && <span className="text-sm text-muted-foreground ml-2">- {selectedSubtask.assigned_to_name || selectedSubtask.assigned_to_email}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-hidden" style={{ height: "500px", display: "flex", gap: "8px" }}>
                <div className="flex-1 overflow-hidden flex flex-col min-w-0">
                  {selectedSubtask ? (
                    <div className="h-full overflow-y-auto custom-scrollbar">
                      {selectedSubtask.comment && selectedSubtask.comment.trim() ? (
                        <div
                          id="worklist-subtask-content"
                          className="text-sm bg-muted/50 p-4 prose prose-sm max-w-none dark:prose-invert h-full"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedSubtask.comment.startsWith('\n') ? selectedSubtask.comment.substring(1) : selectedSubtask.comment) }}
                          style={{
                            userSelect: "none",
                            cursor: "default",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            overflowWrap: "break-word",
                          }}
                        />
                      ) : (
                        <div className="bg-muted/30 p-4 text-center text-muted-foreground h-full flex items-center justify-center">
                          담당자가 작성한 내용이 없습니다
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-muted/30 p-4 text-center text-muted-foreground h-full flex items-center justify-center">
                      서브태스크를 선택하세요
                    </div>
                  )}
                </div>
                <div className="w-[240px] bg-muted/30 overflow-y-auto custom-scrollbar p-2 space-y-3">
                  {isLoadingSubtasks ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    (selectedSubtitle ? groupedSubtasks.filter((g) => g.subtitle === selectedSubtitle) : groupedSubtasks).map((group) => (
                      <div key={group.subtitle} className="border-2 border-muted rounded-lg p-2 bg-background/50 space-y-1.5">
                        <div className="text-[11px] font-semibold text-foreground/80 mb-1 px-1">{group.subtitle}</div>
                        {group.tasks.map((subtask) => (
                          <StaffSessionBlock
                            key={subtask.id}
                            subtask={subtask}
                            isSelected={selectedSubtask?.id === subtask.id}
                            isCompleting={isCompletingSubtask}
                            onSelect={() => setSelectedSubtask(selectedSubtask?.id === subtask.id ? null : subtask)}
                            onComplete={completeSubtask}
                            canCompleteSubtask={canEditTask}
                            hasAttachment={subtaskIdsWithResolvedFiles.has(subtask.id)}
                            isMyBlock={subtask.assigned_to === me?.id}
                          />
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        /* 요청자 내용 보기: 그룹별 요청자 내용 + 분담내용 카드 */
        <>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <CardTitle className="text-lg">요청자 내용</CardTitle>
            {mySubtasks.length > 0 && (
              <Badge
                variant="outline"
                className="text-[11px] font-normal cursor-pointer shrink-0"
                onClick={() => {
                  setShowMyAssignment(true)
                  const mySub = mySubtasks[0]
                  if (mySub) {
                    setSelectedSubtask(mySub)
                    setSelectedSubtitle(mySub.subtitle)
                  }
                }}
              >
                담당업무 표시
              </Badge>
            )}
          </div>
          {canEditTask && isEditingRequesterContent && selectedSubtitle && (() => {
            const group = groupedSubtasks.find((g) => g.subtitle === selectedSubtitle)
            if (!group) return null
            return (
              <Card className="mb-4">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">요청자 내용 수정 - {selectedSubtitle}</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setIsEditingRequesterContent(false)}>취소</Button>
                </CardHeader>
                <CardContent>
                  <div
                    className="border rounded-md overflow-hidden bg-background flex flex-col"
                    style={{
                      height: "350px",
                      minHeight: "350px",
                      maxHeight: "350px",
                    }}
                  >
                    <div className="flex items-center gap-1 p-2 flex-wrap shrink-0 border-b">
                      <Button
                        type="button"
                        variant={requesterEditorState.bold ? "secondary" : "ghost"}
                        size="sm"
                        className={`h-8 w-8 p-0 ${requesterEditorState.bold ? "bg-primary/10" : ""}`}
                        onClick={(e) => {
                          e.preventDefault()
                          const editor = document.getElementById("requester-content-editor")
                          if (editor) {
                            editor.focus()
                            document.execCommand("bold", false)
                            updateRequesterEditorState()
                          }
                        }}
                        title="굵게 (Ctrl+B)"
                      >
                        <Bold className={`h-4 w-4 ${requesterEditorState.bold ? "text-primary" : ""}`} />
                      </Button>
                      <Button
                        type="button"
                        variant={requesterEditorState.italic ? "secondary" : "ghost"}
                        size="sm"
                        className={`h-8 w-8 p-0 ${requesterEditorState.italic ? "bg-primary/10" : ""}`}
                        onClick={(e) => {
                          e.preventDefault()
                          const editor = document.getElementById("requester-content-editor")
                          if (editor) {
                            editor.focus()
                            document.execCommand("italic", false)
                            updateRequesterEditorState()
                          }
                        }}
                        title="기울임 (Ctrl+I)"
                      >
                        <Italic className={`h-4 w-4 ${requesterEditorState.italic ? "text-primary" : ""}`} />
                      </Button>
                      <Button
                        type="button"
                        variant={requesterEditorState.underline ? "secondary" : "ghost"}
                        size="sm"
                        className={`h-8 w-8 p-0 ${requesterEditorState.underline ? "bg-primary/10" : ""}`}
                        onClick={(e) => {
                          e.preventDefault()
                          const editor = document.getElementById("requester-content-editor")
                          if (editor) {
                            editor.focus()
                            document.execCommand("underline", false)
                            updateRequesterEditorState()
                          }
                        }}
                        title="밑줄"
                      >
                        <Underline className={`h-4 w-4 ${requesterEditorState.underline ? "text-primary" : ""}`} />
                      </Button>
                      <div className="w-px h-6 bg-border mx-1" />
                      <div className="relative">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.preventDefault()
                            setRequesterTableGridHover(
                              requesterTableGridHover.show
                                ? { row: 0, col: 0, show: false }
                                : { row: 0, col: 0, show: true }
                            )
                          }}
                          title="테이블"
                        >
                          <TableIcon className="h-4 w-4" />
                        </Button>
                        {requesterTableGridHover.show && (
                          <div
                            className="absolute top-full left-0 mt-2 bg-background border rounded-lg shadow-xl p-4 z-50 min-w-[280px]"
                            onMouseLeave={() => setRequesterTableGridHover({ row: 0, col: 0, show: false })}
                          >
                            <div className="grid grid-cols-10 gap-1 mb-3">
                              {Array.from({ length: 100 }).map((_, idx) => {
                                const row = Math.floor(idx / 10) + 1
                                const col = (idx % 10) + 1
                                const isSelected =
                                  row <= requesterTableGridHover.row && col <= requesterTableGridHover.col
                                return (
                                  <div
                                    key={idx}
                                    className={`w-5 h-5 border border-border rounded-sm transition-colors ${
                                      isSelected ? "bg-primary border-primary" : "bg-muted hover:bg-muted/80"
                                    }`}
                                    onMouseEnter={() => setRequesterTableGridHover({ row, col, show: true })}
                                    onClick={() => {
                                      createRequesterTable(row, col)
                                      setRequesterTableGridHover({ row: 0, col: 0, show: false })
                                    }}
                                  />
                                )
                              })}
                            </div>
                            <div className="text-sm text-center font-medium text-foreground border-t pt-2">
                              {requesterTableGridHover.row > 0 && requesterTableGridHover.col > 0
                                ? `${requesterTableGridHover.row} x ${requesterTableGridHover.col} 테이블`
                                : "테이블 크기 선택"}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="w-px h-6 bg-border mx-1" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.preventDefault()
                          const editor = document.getElementById("requester-content-editor") as HTMLElement
                          if (editor) {
                            editor.focus()
                            const hr = document.createElement("hr")
                            hr.style.border = "none"
                            hr.style.borderTop = "2px solid #6b7280"
                            hr.style.margin = "10px 0"
                            const selection = window.getSelection()
                            if (selection && selection.rangeCount > 0) {
                              const range = selection.getRangeAt(0)
                              range.deleteContents()
                              range.insertNode(hr)
                              range.setStartAfter(hr)
                              range.collapse(true)
                              selection.removeAllRanges()
                              selection.addRange(range)
                            }
                          }
                        }}
                        title="구분선"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div
                      id="requester-content-editor"
                      contentEditable
                      suppressContentEditableWarning
                      data-placeholder="내용을 입력하세요."
                      onInput={() => {
                        updateRequesterEditorState()
                        const editor = document.getElementById("requester-content-editor")
                        if (editor) {
                          editor.querySelectorAll("table[data-resizable='true']").forEach((table) => {
                            addResizeHandlersToRequesterTable(table as HTMLTableElement)
                          })
                        }
                      }}
                      onBlur={updateRequesterEditorState}
                      onMouseUp={updateRequesterEditorState}
                      onKeyUp={updateRequesterEditorState}
                      className="text-sm p-3 wrap-break-word word-break break-all overflow-x-auto overflow-y-auto prose prose-sm max-w-none flex-1 custom-scrollbar focus:outline-none focus:ring-0 resize-none w-full min-w-0"
                      style={{
                        minHeight: "280px",
                        whiteSpace: "pre-wrap",
                      }}
                    />
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={handleSaveRequesterContent} disabled={isSavingRequesterContent}>
                      {isSavingRequesterContent ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditingRequesterContent(false)}
                      disabled={isSavingRequesterContent}
                    >
                      취소
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })()}
          {groupedSubtasks.map((group) => {
            const selectedSubtaskInGroup = group.tasks.find((t) => t.id === selectedSubtaskIdBySubtitle[group.subtitle]) ?? null
            const groupRequesterContent = group.tasks[0]?.content ?? ""
            return (
              <Card key={group.subtitle}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">{group.subtitle}</CardTitle>
                  {canEditTask && !isEditingRequesterContent && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedSubtitle(group.subtitle)
                        setIsEditingRequesterContent(true)
                      }}
                    >
                      수정
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground mb-1">요청자 내용</p>
                    <div className="border rounded-md bg-muted/30 p-2 min-h-[80px] overflow-y-auto max-h-[200px]">
                      {groupRequesterContent ? (
                        <div
                          className="text-sm p-2 prose prose-sm max-w-none dark:prose-invert"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(groupRequesterContent) }}
                          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                        />
                      ) : (
                        <span className="text-muted-foreground text-sm">내용이 없습니다</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground mb-1">분담내용</p>
                    <div className="border rounded-md overflow-hidden" style={{ height: "400px", display: "flex", gap: "8px" }}>
                      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
                        {selectedSubtaskInGroup ? (
                          <div className="h-full overflow-y-auto custom-scrollbar">
                            {selectedSubtaskInGroup.comment && selectedSubtaskInGroup.comment.trim() ? (
                              <div
                                className="text-sm bg-muted/50 p-4 prose prose-sm max-w-none dark:prose-invert h-full"
                                dangerouslySetInnerHTML={{
                                  __html: sanitizeHtml(
                                    selectedSubtaskInGroup.comment.startsWith("\n")
                                      ? selectedSubtaskInGroup.comment.substring(1)
                                      : selectedSubtaskInGroup.comment
                                  ),
                                }}
                                style={{
                                  userSelect: "none",
                                  cursor: "default",
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                  overflowWrap: "break-word",
                                }}
                              />
                            ) : (
                              <div className="bg-muted/30 p-4 text-center text-muted-foreground h-full flex items-center justify-center">
                                담당자가 작성한 내용이 없습니다
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-muted/30 p-4 text-center text-muted-foreground h-full flex items-center justify-center">
                            서브태스크를 선택하세요
                          </div>
                        )}
                      </div>
                      <div className="w-[220px] bg-muted/30 overflow-y-auto custom-scrollbar p-2 space-y-2">
                        {isLoadingSubtasks ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          group.tasks.map((subtask) => (
                            <StaffSessionBlock
                              key={subtask.id}
                              subtask={subtask}
                              isSelected={selectedSubtaskInGroup?.id === subtask.id}
                              isCompleting={isCompletingSubtask}
                              onSelect={() =>
                                setSelectedSubtaskIdBySubtitle((prev) => ({
                                  ...prev,
                                  [group.subtitle]: prev[group.subtitle] === subtask.id ? null : subtask.id,
                                }))
                              }
                              onComplete={completeSubtask}
                              canCompleteSubtask={canEditTask}
                              hasAttachment={subtaskIdsWithResolvedFiles.has(subtask.id)}
                              isMyBlock={subtask.assigned_to === me?.id}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </>
      )}
        </div>
      )}

      {/* 스타일 */}
      <style jsx global>{`
        #worklist-content-display table,
        #worklist-content-display-joint table,
        #worklist-subtask-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 10px 0;
          border: 2px solid #6b7280;
        }
        #worklist-content-display table td,
        #worklist-content-display table th,
        #worklist-content-display-joint table td,
        #worklist-content-display-joint table th,
        #worklist-subtask-content table td,
        #worklist-subtask-content table th {
          border: 2px solid #6b7280;
          padding: 8px;
          cursor: default !important;
          pointer-events: none;
          user-select: none;
        }
        #worklist-content-display hr,
        #worklist-content-display-joint hr,
        #worklist-subtask-content hr {
          border: none;
          border-top: 2px solid #9ca3af;
          margin: 10px 0;
        }
        /* 요청자 내용 편집 에디터 */
        #requester-content-editor:empty:before,
        #my-comment-editor:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        #requester-content-editor table {
          border-collapse: collapse;
          width: 100%;
          margin: 10px 0;
          border: 2px solid #6b7280;
        }
        #requester-content-editor table td,
        #requester-content-editor table th {
          border: 2px solid #6b7280;
          padding: 8px;
          position: relative;
        }
        #requester-content-editor table td u,
        #requester-content-editor table th u,
        #requester-content-editor table td[style*="underline"],
        #requester-content-editor table th[style*="underline"] {
          text-decoration: none !important;
        }
        #requester-content-editor hr {
          border: none;
          border-top: 2px solid #9ca3af;
          margin: 10px 0;
        }
        table[data-resizable="true"] td[contenteditable="true"] u,
        table[data-resizable="true"] th[contenteditable="true"] u,
        table[data-resizable="true"] td[contenteditable="true"][style*="underline"],
        table[data-resizable="true"] th[contenteditable="true"][style*="underline"] {
          text-decoration: none !important;
        }
        
        /* 스크롤바 스타일 */
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.3);
        }
        
        /* 다크모드 스크롤바 */
        .dark .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>

      {/* 댓글 - 말풍선 스타일 */}
      <div className="mb-6 rounded-xl border bg-muted/20 overflow-hidden flex flex-col" style={{ minHeight: "280px" }}>
        <div className="flex-1 max-h-[320px] overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">아직 댓글이 없습니다.</p>
          ) : (
            comments.map((c) => {
              const canDelete = (me?.id && c.user_id === me.id) || userRole === "admin"
              const isMe = me?.id && c.user_id === me.id

              // 공동사용자별 말풍선 색 (등장 순서로 고정)
              const userOrder = Array.from(new Set(comments.map((x) => x.user_id)))
              const userIndex = userOrder.indexOf(c.user_id)
              const bubbleColors = [
                "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
                "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
                "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
                "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
                "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200",
                "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200",
              ]
              const bubbleClass = isMe
                ? "bg-primary text-primary-foreground"
                : bubbleColors[userIndex % bubbleColors.length]

              return (
                <div
                  key={c.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                    <div className="flex items-center gap-2 px-2 mb-1">
                      <span className="text-[11px] font-medium text-foreground/90">
                        {c.full_name || "사용자"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(c.created_at).toLocaleString("ko-KR", {
                          year: "numeric",
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {canDelete && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="ml-auto h-6 w-6 shrink-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          onClick={() => handleDeleteComment(c.id)}
                          title="댓글 삭제"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <div
                      className={`rounded-2xl px-4 py-3 shadow-md ${bubbleClass}`}
                    >
                      <div className="text-sm wrap-break-word word-break break-all text-inherit [&_p]:my-0 [&_pre]:whitespace-pre-wrap [&_a]:underline">
                        <SafeHtml
                          html={c.content || ""}
                          className="prose prose-sm max-w-none prose-p:my-0 [&_table]:w-max [&_pre]:whitespace-pre-wrap [&_code]:break-all prose-inherit"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {userRole !== "client" && (
          <div className="border-t bg-background p-2 flex gap-2 items-end">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="댓글을 입력하세요..."
              className="min-h-[44px] max-h-[120px] resize-none py-3 px-4 rounded-2xl border-0 focus-visible:ring-2 bg-muted/50"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  if (newComment.trim()) handlePostComment()
                }
              }}
            />
            <Button
              size="icon"
              className="h-11 w-11 rounded-full shrink-0"
              onClick={handlePostComment}
              disabled={isPostingComment || newComment.trim().length === 0}
              title="전송"
            >
              {isPostingComment ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        )}
        {userRole === "client" && (
          <div className="border-t bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            댓글은 작업 진행 페이지에서만 작성할 수 있습니다
          </div>
        )}
      </div>

      {/* 첨부파일 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>첨부파일</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isDownloading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate">다운로드 중: {downloadingFileName}</span>
                  <span className="shrink-0">{downloadProgress}%</span>
                </div>
                <Progress value={downloadProgress} />
              </div>
            )}
            
            {/* 요청자 첨부파일 */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground/90">요청자 첨부파일</h4>
              {resolvedFileKeys.length > 0 ? (
                <div className="space-y-2 pl-2">
                  {resolvedFileKeys.map((f, index) => (
                    <FileListItem
                      key={`admin-${index}`}
                      fileName={f.fileName}
                      s3Key={f.s3Key}
                      uploadedAt={f.uploadedAt}
                      fallbackDate={task.created_at}
                      onDownload={handleDownload}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground pl-2">첨부파일이 없습니다</p>
              )}
            </div>
            
            {/* 담당자 첨부파일 (개별 - 메인 태스크) */}
            {subtasks.length === 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground/90">담당자 첨부파일</h4>
                {resolvedCommentFileKeys.length > 0 ? (
                  <div className="space-y-2 pl-2">
                    {resolvedCommentFileKeys.map((f, index) => (
                      <FileListItem
                        key={`user-${index}`}
                        fileName={f.fileName}
                        s3Key={f.s3Key}
                        uploadedAt={f.uploadedAt}
                        fallbackDate={task.updated_at}
                        onDownload={handleDownload}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground pl-2">첨부파일이 없습니다</p>
                )}
              </div>
            )}
            
            {/* 담당자 첨부파일 (공동 - 서브태스크별) */}
            {subtasks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground/90">담당자 첨부파일</h4>
                {resolvedSubtaskFileKeys.length > 0 ? (
                  <div className="space-y-2 pl-2">
                    {resolvedSubtaskFileKeys.map((f, index) => (
                      <FileListItem
                        key={`subtask-${index}`}
                        fileName={f.fileName}
                        s3Key={f.s3Key}
                        uploadedAt={f.uploadedAt}
                        fallbackDate={task.updated_at}
                        assignedToName={f.assignedToName}
                        onDownload={handleDownload}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground pl-2">첨부파일이 없습니다</p>
                )}
              </div>
            )}
            
            {(resolvedFileKeys.length > 0 || resolvedCommentFileKeys.length > 0 || resolvedSubtaskFileKeys.length > 0) && (
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 완료대기이거나 모든 서브태스크가 완료된 경우: 작업완료 버튼 표시 (요청자 또는 admin만) */}
      {canEditTask &&
       (userRole === "admin" || userRole === "staff") &&
       (task.status === "awaiting_completion" || (subtasks.length > 0 && allSubtasksCompleted)) &&
       task.status !== "completed" && (
        <div className="mt-10 flex justify-center">
          <Button onClick={handleFinalizeTask} disabled={isFinalizing} className="min-w-[180px] cursor-pointer">
            {isFinalizing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                처리 중...
              </>
            ) : (
              "작업완료"
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
