"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Eye, CheckCircle2, Loader2, MousePointerClick, X, Download, ChevronDown, ChevronUp } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { getSignedDownloadUrl } from "@/lib/aws/s3"
import { sanitizeHtml } from "@/lib/utils/sanitize"

interface CompletedTask {
  id: string
  assigned_by: string
  assigned_to: string
  assigned_by_name: string
  assigned_by_email: string
  assigned_to_name: string
  assigned_to_email: string
  title: string
  content: string | null
  description: string | null
  comment: string | null
  priority: 'low' | 'medium' | 'high' | 'urgent'
  file_keys: string[]
  comment_file_keys: string[]
  created_at: string
  completed_at: string
  report_id?: string | null
  report_html?: string | null
  report_case_id?: string | null
  case_id?: string | null
  case_number?: string | null
}

export default function ClientReportsPage() {
  const [reports, setReports] = useState<any[]>([])
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set())
  const [resolvedFileKeys, setResolvedFileKeys] = useState<Record<string, Array<{ s3Key: string; fileName: string }>>>({})
  const { toast } = useToast()

  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" })
        if (!res.ok) {
          setUser(null)
          return
        }
        const me = await res.json()
        setUser(me)
      } catch {
        setUser(null)
      }
    }
    loadUser()
  }, [])

  useEffect(() => {
    if (user) {
      loadData()
    } else {
      setIsLoading(false)
    }
  }, [user])

  const loadData = async () => {
    setIsLoading(true)
    try {
      // Load reports from API
      const reportsResponse = await fetch("/api/reports", {
        credentials: "include",
      })

      if (reportsResponse.ok) {
        const reportsData = await reportsResponse.json()
        setReports(reportsData.reports || [])
      } else {
        setReports([])
      }

      // Load completed tasks from new reports API
      const tasksResponse = await fetch("/api/tasks/reports", {
        credentials: "include",
      })

      if (tasksResponse.ok) {
        const tasksData = await tasksResponse.json()
        setCompletedTasks(tasksData.tasks || [])
      } else {
        setCompletedTasks([])
      }
    } catch (error: any) {
      setReports([])
      setCompletedTasks([])
    } finally {
      setIsLoading(false)
    }
  }

  const getPriorityColor = (priority: CompletedTask['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500 text-white'
      case 'high':
        return 'bg-orange-500 text-white'
      case 'medium':
        return 'bg-yellow-500 text-white'
      case 'low':
        return 'bg-blue-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getPriorityLabel = (priority: CompletedTask['priority']) => {
    switch (priority) {
      case 'urgent':
        return '긴급'
      case 'high':
        return '높음'
      case 'medium':
        return '보통'
      case 'low':
        return '낮음'
      default:
        return priority
    }
  }

  const toggleTaskExpansion = (taskId: string) => {
    const newExpanded = new Set(expandedTaskIds)
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId)
    } else {
      newExpanded.add(taskId)
      // 확장 시 파일 키 resolve
      const task = completedTasks.find(t => t.id === taskId)
      if (task && !resolvedFileKeys[taskId]) {
        resolveTaskFiles(taskId, task.file_keys, task.comment_file_keys)
      }
    }
    setExpandedTaskIds(newExpanded)
  }

  const resolveTaskFiles = async (taskId: string, fileKeys: string[], commentFileKeys: string[]) => {
    try {
      const allKeys = Array.from(new Set([...(fileKeys || []), ...(commentFileKeys || [])]))
      if (allKeys.length === 0) return

      const response = await fetch('/api/storage/resolve-file-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileKeys: allKeys }),
      })

      if (!response.ok) return

      const data = await response.json()
      // resolvedKeys에 originalKey 추가
      const resolvedWithOriginal = (data.resolvedKeys || []).map((item: any) => ({
        ...item,
        originalKey: item.originalKey || item.s3Key
      }))
      setResolvedFileKeys(prev => ({
        ...prev,
        [taskId]: resolvedWithOriginal
      }))
    } catch (error) {
      console.error('파일 키 resolve 오류:', error)
    }
  }

  const handleFileDownload = async (s3Key: string, fileName: string) => {
    try {
      const response = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(s3Key)}&expiresIn=604800`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('다운로드 URL 생성 실패')
      }

      const data = await response.json()
      if (data.signedUrl) {
        const a = document.createElement('a')
        a.href = data.signedUrl
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    } catch (error: any) {
      toast({
        title: '오류',
        description: error.message || '파일 다운로드에 실패했습니다',
        variant: 'destructive',
      })
    }
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

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Reports</h1>
      </div>

      <Tabs defaultValue="completed" className="space-y-4 mt-8">
        <TabsList>
          <TabsTrigger value="completed">완료된 작업 ({completedTasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="completed">
          <div className="space-y-4">
            {completedTasks && completedTasks.length > 0 ? (
              completedTasks.map((task) => {
                const isExpanded = expandedTaskIds.has(task.id)
                const taskFiles = resolvedFileKeys[task.id] || []
                
                // file_keys와 comment_file_keys를 기준으로 파일 분류
                const adminFileKeys = new Set(task.file_keys || [])
                const clientFileKeys = new Set(task.comment_file_keys || [])
                
                const adminFiles = taskFiles.filter(f => {
                  // originalKey가 있으면 그것을 사용, 없으면 s3Key 사용
                  const key = (f as any).originalKey || f.s3Key
                  return adminFileKeys.has(key)
                })
                const clientFiles = taskFiles.filter(f => {
                  const key = (f as any).originalKey || f.s3Key
                  return clientFileKeys.has(key)
                })
                
                return (
                  <Card key={task.id} className="overflow-hidden">
                    <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => toggleTaskExpansion(task.id)}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                            <CardTitle className="text-lg truncate">{task.title}</CardTitle>
                            <Badge className={getPriorityColor(task.priority)}>
                              {getPriorityLabel(task.priority)}
                            </Badge>
                          </div>
                          <CardDescription className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">요청자: {task.assigned_by_name || task.assigned_by_email}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span>완료일: {new Date(task.completed_at).toLocaleString('ko-KR')}</span>
                            </div>
                          </CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" className="shrink-0">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </CardHeader>
                    
                    {isExpanded && (
                      <CardContent className="pt-0 space-y-6">
                        {/* 설명 */}
                        {task.description && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">설명</h4>
                            <div className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-md">
                              {task.description}
                            </div>
                          </div>
                        )}

                        {/* 본문과 내용 */}
                        <div className="grid grid-cols-2 gap-4">
                          {/* 본문 (Staff) */}
                          <div>
                            <h4 className="text-sm font-semibold mb-2">본문</h4>
                            {task.content ? (
                              <div 
                                id={`task-content-${task.id}`}
                                className="text-sm bg-muted/50 p-3 rounded-md prose prose-sm max-w-none dark:prose-invert overflow-auto max-h-96"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(task.content) }}
                              />
                            ) : (
                              <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md text-center">
                                본문이 없습니다
                              </div>
                            )}
                          </div>

                          {/* 내용 (Client Comment) */}
                          <div>
                            <h4 className="text-sm font-semibold mb-2">내용</h4>
                            {task.comment ? (
                              <div 
                                id={`task-comment-${task.id}`}
                                className="text-sm bg-muted/50 p-3 rounded-md prose prose-sm max-w-none dark:prose-invert overflow-auto max-h-96"
                                dangerouslySetInnerHTML={{ 
                                  __html: sanitizeHtml(
                                    task.comment.startsWith('\n') ? task.comment.slice(1) : task.comment
                                  ) 
                                }}
                              />
                            ) : (
                              <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md text-center">
                                내용이 없습니다
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* 테이블 스타일 */}
                        <style jsx global>{`
                          #task-content-${task.id} table,
                          #task-comment-${task.id} table {
                            border-collapse: collapse;
                            width: 100%;
                            margin: 10px 0;
                            border: 2px solid #6b7280;
                          }
                          #task-content-${task.id} table td,
                          #task-content-${task.id} table th,
                          #task-comment-${task.id} table td,
                          #task-comment-${task.id} table th {
                            border: 2px solid #6b7280;
                            padding: 8px;
                          }
                          #task-content-${task.id} hr,
                          #task-comment-${task.id} hr {
                            border: none;
                            border-top: 2px solid #9ca3af;
                            margin: 10px 0;
                          }
                        `}</style>

                        {/* 첨부파일 */}
                        {taskFiles.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">첨부파일</h4>
                            <div className="space-y-3">
                              {/* 관리자 첨부파일 */}
                              {adminFiles.length > 0 && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-2">
                                    {task.assigned_by_name || '관리자'} 첨부파일
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {adminFiles.map((file, idx) => (
                                      <Button
                                        key={`admin-${idx}`}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleFileDownload(file.s3Key, file.fileName)}
                                        className="text-xs"
                                      >
                                        <Download className="h-3 w-3 mr-1" />
                                        {file.fileName}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 사용자 첨부파일 */}
                              {clientFiles.length > 0 && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-2">
                                    {task.assigned_to_name || '사용자'} 첨부파일
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {clientFiles.map((file, idx) => (
                                      <Button
                                        key={`client-${idx}`}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleFileDownload(file.s3Key, file.fileName)}
                                        className="text-xs"
                                      >
                                        <Download className="h-3 w-3 mr-1" />
                                        {file.fileName}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                )
              })
            ) : (
              <Card>
                <CardContent className="py-12">
                  <p className="text-center text-muted-foreground">완료된 작업이 없습니다</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
