"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Activity, RefreshCw, Search, Paperclip, Trash2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { isTaskExpired } from "@/lib/utils/taskHelpers"

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
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'in_progress' | 'on_hold' | 'awaiting_completion' | 'completed'
  file_keys: string[]
  comment_file_keys?: string[]
  due_date?: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export default function WorklistPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [activeTab, setActiveTab] = useState<"worklist" | "completed">("worklist")
  const [completedReports, setCompletedReports] = useState<any[]>([])
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const loadTasks = async () => {
    setIsLoading(true)
    try {
      // Use API to get all tasks
      const response = await fetch("/api/tasks/all", {
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error("Failed to load tasks")
      }

      const data = await response.json()
      setTasks(data.tasks || [])
    } catch (error) {
      console.error("Failed to load tasks:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Worklist 목록에서는 첨부는 표시만 하고(클릭/다운로드는 상세 페이지에서), 상호작용은 제거

  const filterTasks = useCallback(() => {
    let filtered = [...tasks]

    // 탭에 따른 기본 필터링
    if (activeTab === "worklist") {
      // 진행 탭: 완료되지 않은 작업만
      filtered = filtered.filter((task) => task.status !== "completed")
    } else if (activeTab === "completed") {
      // 완료 탭: 완료된 작업만
      filtered = filtered.filter((task) => task.status === "completed")
    }

    // Search filter
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

    // Status filter (진행 탭에서만 적용)
    if (activeTab === "worklist" && statusFilter !== "all") {
      if (statusFilter === "expired") {
        // 마감됨: 완료 상태가 아니면서 마감일이 지난 작업
        filtered = filtered.filter((task) => isTaskExpired(task))
      } else {
        // 일반 상태 필터
        filtered = filtered.filter((task) => task.status === statusFilter)
      }
    }

    // Priority filter
    if (priorityFilter !== "all") {
      filtered = filtered.filter((task) => task.priority === priorityFilter)
    }

    setFilteredTasks(filtered)
  }, [tasks, searchQuery, statusFilter, priorityFilter, activeTab])

  useEffect(() => {
    loadTasks()
  }, [])

  // Dashboard에서 넘어오는 query 적용: tab/status/priority/q
  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab === "completed") setActiveTab("completed")
    if (tab === "worklist") setActiveTab("worklist")

    const status = searchParams.get("status")
    const priority = searchParams.get("priority")
    const q = searchParams.get("q")

    const validStatuses = new Set(["all", "pending", "in_progress", "on_hold", "awaiting_completion", "expired"])
    const validPriorities = new Set(["all", "urgent", "high", "medium", "low"])

    if (status && validStatuses.has(status)) setStatusFilter(status)
    if (priority && validPriorities.has(priority)) setPriorityFilter(priority)
    if (q !== null) setSearchQuery(q)
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
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "작업 삭제에 실패했습니다")
      }

      toast({
        title: "작업이 삭제되었습니다",
        description: "작업이 성공적으로 삭제되었습니다.",
      })

      // 목록 새로고침
      await loadTasks()
    } catch (error: any) {
      console.error("Failed to delete task:", error)
      toast({
        title: "삭제 실패",
        description: error.message || "작업 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      })
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
    const date = new Date(dateString)
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

        {/* 진행 탭 */}
        <TabsContent value="worklist">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>필터 및 검색</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">검색</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="제목, 담당자, 요청자로 검색..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">상태</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      <SelectItem value="pending">대기</SelectItem>
                      <SelectItem value="in_progress">작업중</SelectItem>
                      <SelectItem value="on_hold">보류</SelectItem>
                      <SelectItem value="awaiting_completion">완료대기</SelectItem>
                      <SelectItem value="expired">마감됨</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">우선순위</label>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      <SelectItem value="urgent">긴급</SelectItem>
                      <SelectItem value="high">높음</SelectItem>
                      <SelectItem value="medium">보통</SelectItem>
                      <SelectItem value="low">낮음</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>진행 중인 작업</CardTitle>
                  <CardDescription>총 {filteredTasks.length}개의 작업이 있습니다</CardDescription>
                </div>
                <Button onClick={loadTasks} variant="outline" size="icon" disabled={isLoading} aria-label="새로고침" title="새로고침">
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-muted-foreground">로딩 중...</div>
                </div>
              ) : filteredTasks.length === 0 ? (
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
                      {filteredTasks.map((task) => {
                        const expired = isTaskExpired(task)
                        return (
                          <TableRow
                            key={task.id}
                            className={`cursor-pointer hover:bg-accent/50 ${expired ? "bg-red-500/5" : ""}`}
                            onClick={() => router.push(`/admin/cases/${task.id}`)}
                          >
                            <TableCell className="font-medium">{task.title}</TableCell>
                            <TableCell>{task.assigned_by_name || task.assigned_by_email || "Unknown"}</TableCell>
                            <TableCell>{task.assigned_to_name || task.assigned_to_email || "Unknown"}</TableCell>
                            <TableCell>
                              {(task.file_keys && task.file_keys.length > 0) || (task.comment_file_keys && task.comment_file_keys.length > 0) ? (
                                <div
                                  className="inline-flex items-center px-2 text-muted-foreground"
                                  aria-label={`첨부파일 ${(task.file_keys?.length || 0) + (task.comment_file_keys?.length || 0)}개`}
                                  title={`첨부파일 ${(task.file_keys?.length || 0) + (task.comment_file_keys?.length || 0)}개`}
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
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => handleDeleteTask(task.id, e)}
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="작업 삭제"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
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
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => handleDeleteTask(r.id, e)}
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="작업 삭제"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
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
