"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Activity, RefreshCw, Search, Paperclip, Trash2, Plus } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { isTaskExpired } from "@/lib/utils/taskHelpers"
import { parseFlexibleDate } from "@/lib/utils/dateHelpers"
import type { Task, S3UpdateRow } from "@/lib/types"

export default function WorklistPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([])
  const [s3Updates, setS3Updates] = useState<S3UpdateRow[]>([])
  const [filteredS3Updates, setFilteredS3Updates] = useState<S3UpdateRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [assignmentFilter, setAssignmentFilter] = useState<"all" | "requested" | "assigned">("all")
  const [bucketFilter, setBucketFilter] = useState<string>("all")
  const [activeTab, setActiveTab] = useState<"worklist" | "completed">("worklist")
  const [completedReports, setCompletedReports] = useState<any[]>([])
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(false)
  const [me, setMe] = useState<{ id: string; role?: string } | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  useEffect(() => {
    const loadMe = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" })
        if (res.ok) {
          const data = await res.json()
          setMe(data)
        }
      } catch {
        // ignore
      }
    }
    loadMe()
  }, [])

  const loadTasks = async () => {
    setIsLoading(true)
    try {
      const [tasksRes, s3Res] = await Promise.all([
        fetch("/api/tasks/all", { credentials: "include" }),
        fetch("/api/s3-updates", { credentials: "include" }),
      ])
      if (!tasksRes.ok) throw new Error("Failed to load tasks")
      const tasksData = await tasksRes.json()
      setTasks(tasksData.tasks || [])
      if (s3Res.ok) {
        const s3Data = await s3Res.json()
        setS3Updates(s3Data.s3Updates || [])
      } else {
        setS3Updates([])
      }
    } catch (error) {
      console.error("Failed to load tasks:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // s3_updates 버킷: bucket_name만 사용
  const getBucketName = useCallback((row: S3UpdateRow) => (row.bucket_name ?? "").trim(), [])

  // task_assignments의 file_keys 경로에서 버킷 추출 (첫 경로 세그먼트 = 버킷)
  const getBucketFromTask = useCallback((task: Task) => {
    const keys = task.file_keys
    if (!keys?.length) return ""
    const first = (keys[0] ?? "").trim()
    const segment = first.split("/")[0]
    return segment || ""
  }, [])

  const uniqueBuckets = useMemo(() => {
    const fromS3 = s3Updates.map(getBucketName).filter(Boolean)
    const fromTasks = tasks.map(getBucketFromTask).filter(Boolean)
    const names = [...new Set([...fromS3, ...fromTasks])] as string[]
    return names.sort((a, b) => a.localeCompare(b))
  }, [s3Updates, tasks, getBucketName, getBucketFromTask])

  // task.id -> bucket (file_keys 경로로 판별, S3에서 할당된 업무)
  const taskIdToBucket = useMemo(() => {
    const map = new Map<string, string>()
    for (const task of tasks) {
      const bucket = getBucketFromTask(task)
      if (bucket) map.set(task.id, bucket)
    }
    return map
  }, [tasks, getBucketFromTask])

  // S3에서 온 업무인지 (s3_updates.task_id로 연결된 task id 집합)
  const taskIdsFromS3 = useMemo(() => {
    const set = new Set<string>()
    for (const row of s3Updates) {
      if (row.task_id) set.add(String(row.task_id))
    }
    return set
  }, [s3Updates])

  const filterTasks = useCallback(() => {
    let filtered = [...tasks]

    // 탭에 따른 기본 필터링
    if (activeTab === "worklist") {
      filtered = filtered.filter((task) => task.status !== "completed")
    } else if (activeTab === "completed") {
      filtered = filtered.filter((task) => task.status === "completed")
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          task.assigned_by_name?.toLowerCase().includes(query) ||
          task.assigned_by_email?.toLowerCase().includes(query) ||
          task.assigned_to_name?.toLowerCase().includes(query) ||
          task.assigned_to_email?.toLowerCase().includes(query)
      )
    }

    if (activeTab === "worklist" && statusFilter !== "all") {
      if (statusFilter === "expired") {
        filtered = filtered.filter((task) => isTaskExpired(task))
      } else {
        filtered = filtered.filter((task) => task.status === statusFilter)
      }
    }

    if (priorityFilter !== "all") {
      filtered = filtered.filter((task) => task.priority === priorityFilter)
    }

    if (me?.id && assignmentFilter !== "all") {
      if (assignmentFilter === "requested") {
        filtered = filtered.filter((task) => task.assigned_by === me.id)
      } else if (assignmentFilter === "assigned") {
        filtered = filtered.filter((task) => task.assigned_to === me.id)
      }
    }

    // S3 필터: "s3_only" = S3에서 온 태스크만, 특정 버킷 = 해당 버킷 S3만
    if (bucketFilter === "s3_only") {
      filtered = filtered.filter((task) => taskIdsFromS3.has(task.id))
    } else if (bucketFilter !== "all") {
      const key = bucketFilter.trim()
      filtered = filtered.filter((task) => taskIdsFromS3.has(task.id) && taskIdToBucket.get(task.id) === key)
    }

    setFilteredTasks(filtered)

    // s3_updates 목록: 진행 탭 + 전체일 때만, bucket_name·검색어로 필터
    let s3Filtered = [...s3Updates]
    if (activeTab !== "worklist" || assignmentFilter !== "all") {
      s3Filtered = []
    } else {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        s3Filtered = s3Filtered.filter(
          (row) =>
            (row.file_name || "").toLowerCase().includes(q) ||
            (row.s3_key || "").toLowerCase().includes(q) ||
            (row.bucket_name || "").toLowerCase().includes(q)
        )
      }
      if (bucketFilter === "s3_only") {
        // S3만 보기: s3 미할당 건은 그대로 전부 (버킷 필터 없음)
      } else if (bucketFilter !== "all") {
        const key = bucketFilter.trim()
        s3Filtered = s3Filtered.filter((row) => getBucketName(row) === key)
      }
    }
    setFilteredS3Updates(s3Filtered)
  }, [tasks, s3Updates, searchQuery, statusFilter, priorityFilter, bucketFilter, activeTab, assignmentFilter, me?.id, getBucketName, taskIdToBucket, taskIdsFromS3])

  useEffect(() => {
    loadTasks()
  }, [])

  // 케이스 상세에서 요청자 내용 수정 시 해당 task 반영
  useEffect(() => {
    const handler = async (e: Event) => {
      const { taskId } = (e as CustomEvent<{ taskId: string }>).detail
      try {
        const res = await fetch(`/api/tasks/${taskId}`, { credentials: "include" })
        if (!res.ok) return
        const data = await res.json()
        const updated = data.task
        if (!updated) return
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t))
        )
      } catch {
        // 무시
      }
    }
    window.addEventListener("task-content-updated", handler)
    return () => window.removeEventListener("task-content-updated", handler)
  }, [])

  // 다른 탭에서 수정 후 이 탭으로 돌아오면 목록 새로고침
  useEffect(() => {
    const onFocus = () => loadTasks()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [])

  // Dashboard에서 넘어오는 query 적용: tab/status/priority/q/filter
  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab === "completed") setActiveTab("completed")
    if (tab === "worklist") setActiveTab("worklist")

    const status = searchParams.get("status")
    const priority = searchParams.get("priority")
    const q = searchParams.get("q")
    const filter = searchParams.get("filter")

    const validStatuses = new Set(["all", "pending", "in_progress", "on_hold", "awaiting_completion", "expired"])
    const validPriorities = new Set(["all", "urgent", "high", "medium", "low"])
    const validFilters = new Set(["all", "requested", "assigned"])

    if (status && validStatuses.has(status)) setStatusFilter(status)
    if (priority && validPriorities.has(priority)) setPriorityFilter(priority)
    if (q !== null) setSearchQuery(q)
    if (filter && validFilters.has(filter)) setAssignmentFilter(filter as "all" | "requested" | "assigned")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    filterTasks()
  }, [filterTasks])

  useEffect(() => {
    if (activeTab !== "completed") return
    const run = async () => {
      setIsLoadingCompleted(true)
      try {
        const res = await fetch("/api/reports", { credentials: "include", cache: "no-store" as any })
        if (!res.ok) return
        const data = await res.json()
        setCompletedReports(Array.isArray(data.reports) ? data.reports : [])
      } finally {
        setIsLoadingCompleted(false)
      }
    }
    run()
  }, [activeTab])

  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation() // 행 클릭 이벤트 방지
    
    if (!confirm("이 작업을 삭제하시겠습니까? 할당받은 모든 사용자의 작업도 삭제됩니다.")) {
      return
    }

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        const message = body.error || "작업 삭제에 실패했습니다"
        toast({
          title: "삭제 실패",
          description: message,
          variant: "destructive",
        })
        return
      }

      toast({
        title: "작업이 삭제되었습니다",
        description: "작업이 성공적으로 삭제되었습니다.",
      })

      // 목록 새로고침
      await loadTasks()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "작업 삭제 중 오류가 발생했습니다."
      toast({
        title: "삭제 실패",
        description: message,
        variant: "destructive",
      })
    }
  }

  const handleDeleteS3Update = async (s3UpdateId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("이 S3 업무를 삭제하시겠습니까? 목록에서 제거됩니다.")) return
    try {
      const response = await fetch(`/api/s3-updates/${s3UpdateId}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        const message = body.error || "S3 업무 삭제에 실패했습니다"
        toast({ title: "삭제 실패", description: message, variant: "destructive" })
        return
      }
      toast({ title: "S3 업무가 삭제되었습니다", description: "목록에서 제거되었습니다." })
      await loadTasks()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "S3 업무 삭제 중 오류가 발생했습니다."
      toast({ title: "삭제 실패", description: message, variant: "destructive" })
    }
  }

  const filteredCompletedReports = useMemo(() => {
    if (!searchQuery) return completedReports
    const q = searchQuery.toLowerCase()
    return completedReports.filter((r: any) => {
      const title = (r.patient_name || r.title || "").toLowerCase()
      const by = (r.assigned_by_name || "").toLowerCase()
      const to = (r.assigned_to_name || "").toLowerCase()
      return title.includes(q) || by.includes(q) || to.includes(q)
    })
  }, [completedReports, searchQuery])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/10 text-green-500">완료</Badge>
      case "awaiting_completion":
        return <Badge className="bg-purple-500/10 text-purple-500">완료대기</Badge>
      case "in_progress":
        return <Badge className="bg-blue-500/10 text-blue-500">작업중</Badge>
      case "on_hold":
        return <Badge className="bg-yellow-500/10 text-yellow-500">보류</Badge>
      case "pending":
        return <Badge className="bg-gray-500/10 text-gray-500">대기</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Badge className="bg-red-500 text-white">긴급</Badge>
      case "high":
        return <Badge className="bg-orange-500 text-white">높음</Badge>
      case "medium":
        return <Badge className="bg-yellow-500 text-white">보통</Badge>
      case "low":
        return <Badge className="bg-blue-500 text-white">낮음</Badge>
      default:
        return <Badge>{priority}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    const date = parseFlexibleDate(dateString)
    if (!date) return "-"
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Worklist</h1>
          <p className="text-muted-foreground">모든 작업 목록을 확인하고 관리하세요</p>
        </div>
        <Button asChild size="default" className="shrink-0">
          <Link href="/admin/analytics?from=worklist">
            <Plus className="mr-2 h-4 w-4" />
            업무 추가
          </Link>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v as any)
        // URL 업데이트 (브라우저 히스토리에 추가)
        router.push(`/admin/cases?tab=${v}`)
      }} className="space-y-4">
        <TabsList>
          <TabsTrigger value="worklist">진행</TabsTrigger>
          <TabsTrigger value="completed">완료</TabsTrigger>
        </TabsList>

        {/* 진행 탭: 필터 한 줄 + 전체 그리드 하나 */}
        <TabsContent value="worklist">
          <Card>
            <CardHeader>
              <CardTitle>진행 중인 작업</CardTitle>
              <CardDescription>
                총 {filteredTasks.length + filteredS3Updates.length}개
                {filteredS3Updates.length > 0 && ` (S3 미할당 ${filteredS3Updates.length}건)`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="제목, 담당자, 요청자, 파일명..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant={assignmentFilter === "all" ? "default" : "outline"}
                    size="sm"
                    className="h-9"
                    onClick={() => setAssignmentFilter("all")}
                  >
                    전체
                  </Button>
                  <Button
                    type="button"
                    variant={assignmentFilter === "requested" ? "default" : "outline"}
                    size="sm"
                    className="h-9"
                    onClick={() => setAssignmentFilter("requested")}
                  >
                    요청
                  </Button>
                  <Button
                    type="button"
                    variant={assignmentFilter === "assigned" ? "default" : "outline"}
                    size="sm"
                    className="h-9"
                    onClick={() => setAssignmentFilter("assigned")}
                  >
                    담당
                  </Button>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[120px] h-9">
                    <SelectValue placeholder="상태" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">상태 전체</SelectItem>
                    <SelectItem value="pending">대기</SelectItem>
                    <SelectItem value="in_progress">작업중</SelectItem>
                    <SelectItem value="on_hold">보류</SelectItem>
                    <SelectItem value="awaiting_completion">완료대기</SelectItem>
                    <SelectItem value="expired">마감됨</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[110px] h-9">
                    <SelectValue placeholder="우선순위" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">우선순위</SelectItem>
                    <SelectItem value="urgent">긴급</SelectItem>
                    <SelectItem value="high">높음</SelectItem>
                    <SelectItem value="medium">보통</SelectItem>
                    <SelectItem value="low">낮음</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={bucketFilter} onValueChange={setBucketFilter}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="S3" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="s3_only">S3만 보기</SelectItem>
                    {uniqueBuckets.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={loadTasks} variant="outline" size="icon" className="h-9 w-9 shrink-0" disabled={isLoading} aria-label="새로고침" title="새로고침">
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-muted-foreground">로딩 중...</div>
                </div>
              ) : filteredTasks.length === 0 && filteredS3Updates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Activity className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-muted-foreground">진행 중인 작업이 없습니다</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>제목</TableHead>
                        <TableHead className="w-[80px] text-center">S3</TableHead>
                        <TableHead>개별/공동</TableHead>
                        <TableHead>요청자</TableHead>
                        <TableHead>담당자</TableHead>
                        <TableHead>첨부</TableHead>
                        <TableHead>우선순위</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>생성일</TableHead>
                        <TableHead>마감일</TableHead>
                        <TableHead className="w-[80px]">삭제</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredS3Updates.map((row) => (
                        <TableRow
                          key={`s3-${row.id}`}
                          className="cursor-pointer hover:bg-accent/50 bg-amber-500/5 border-l-4 border-l-amber-500/50"
                          onClick={() => router.push(`/admin/cases/s3-update/${row.id}`)}
                        >
                          <TableCell className="font-medium">
                            {row.file_name}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-block w-2 h-2 rounded-full bg-amber-500/80 shrink-0" aria-label="S3" />
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-amber-500/10 text-amber-600 font-normal">미할당</Badge>
                          </TableCell>
                          <TableCell>-</TableCell>
                          <TableCell>미지정</TableCell>
                          <TableCell>
                            <div className="inline-flex items-center px-2 text-muted-foreground" aria-label="첨부 있음">
                              <Paperclip className="h-4 w-4" />
                            </div>
                          </TableCell>
                          <TableCell>-</TableCell>
                          <TableCell>
                            <Badge className="bg-amber-500/10 text-amber-600">미할당</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(row.upload_time || row.created_at)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">-</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {(me?.role === "admin" || me?.role === "staff") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => handleDeleteS3Update(String(row.id), e)}
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="S3 업무 삭제"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredTasks.map((task) => {
                        const expired = isTaskExpired(task)
                        return (
                          <TableRow
                            key={task.id}
                            className={`cursor-pointer hover:bg-accent/50 ${expired ? "bg-red-500/5" : ""}`}
                            onClick={() => router.push(`/admin/cases/${task.id}`)}
                          >
                            <TableCell className="font-medium">{task.title}</TableCell>
                            <TableCell className="text-center">
                              {taskIdsFromS3.has(task.id) ? (
                                <span className="inline-block w-2 h-2 rounded-full bg-amber-500/80 shrink-0" aria-label="S3" />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={task.is_multi_assign ? "secondary" : "outline"} className="font-normal">
                                {task.is_multi_assign ? "공동" : "개별"}
                              </Badge>
                            </TableCell>
                            <TableCell>{task.assigned_by_name || task.assigned_by_email || "Unknown"}</TableCell>
                            <TableCell>{task.assigned_to_name || task.assigned_to_email || "Unknown"}</TableCell>
                            <TableCell>
                              {task.has_any_attachment ?? ((task.file_keys?.length ?? 0) + (task.comment_file_keys?.length ?? 0) > 0) ? (
                                <div
                                  className="inline-flex items-center px-2 text-muted-foreground"
                                  aria-label="첨부파일 있음"
                                  title="첨부파일 있음"
                                >
                                  <Paperclip className="h-4 w-4" />
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">&nbsp;</span>
                              )}
                            </TableCell>
                            <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                            <TableCell>{getStatusBadge(task.status)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{formatDate(task.created_at)}</TableCell>
                            <TableCell className={`text-sm ${expired ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                              {task.due_date ? formatDate(task.due_date) : "-"}
                            </TableCell>
                            <TableCell>
                              {(me?.id === task.assigned_by || me?.role === "admin" || me?.role === "staff") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => handleDeleteTask(task.id, e)}
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  title="작업 삭제"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
              </div>

              <div className="mt-3 space-y-2">
                <label className="text-sm font-medium">검색</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="제목, 요청자/담당자로 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingCompleted ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-muted-foreground">로딩 중...</div>
                </div>
              ) : filteredCompletedReports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Activity className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-muted-foreground">완료된 작업이 없습니다</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>제목</TableHead>
                        <TableHead>요청자</TableHead>
                        <TableHead>담당자</TableHead>
                        <TableHead>완료일</TableHead>
                        <TableHead className="w-[80px]">삭제</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCompletedReports.map((r: any, idx: number) => {
                        const title = r.patient_name || r.title || "완료 작업"
                        const priority = (r.priority || r.task_snapshot?.priority || "medium") as string
                        return (
                          <TableRow
                            key={r.report_id || r.id || `done-${idx}`}
                            className="cursor-pointer hover:bg-accent/50"
                            onClick={() => router.push(`/admin/cases/${r.id}`)}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate">{title}</span>
                                {getPriorityBadge(priority)}
                              </div>
                            </TableCell>
                            <TableCell>{r.assigned_by_name || "Unknown"}</TableCell>
                            <TableCell>{r.assigned_to_name || "Unknown"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {r.completed_at ? new Date(r.completed_at).toLocaleString("ko-KR") : "-"}
                            </TableCell>
                            <TableCell>
                              {(me?.id === r.assigned_by || me?.role === "admin" || me?.role === "staff") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => handleDeleteTask(r.id, e)}
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  title="작업 삭제"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  )
}
