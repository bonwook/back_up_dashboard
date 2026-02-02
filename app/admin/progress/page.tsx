"use client"

import { useState, useEffect, useCallback, useMemo, use } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Loader2, CheckCircle2, Clock, Pause, FileText, AlertCircle, Check, X, Bold, Italic, Underline, Minus, Grid3x3 as TableIcon, Upload, Edit, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { sanitizeHtml } from "@/lib/utils/sanitize"
import { Progress } from "@/components/ui/progress"
import { uploadWithProgress } from "@/lib/utils/upload-with-progress"
import { calculateFileExpiry, formatDateShort } from "@/lib/utils/dateHelpers"
import { Task, TaskStatus, Profile, ResolvedFileKey } from "./types"
import TaskBlock from "./components/TaskBoard/TaskBlock"

export default function ClientProgressPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null)
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [resolvedFileKeys, setResolvedFileKeys] = useState<ResolvedFileKey[]>([])
  const [finalizedTaskIds, setFinalizedTaskIds] = useState<Set<string>>(new Set())
  const { toast } = useToast()
  
  // 작업공간 상태
  const [workForm, setWorkForm] = useState({
    title: "",
    content: "",
    priority: "medium",
  })
  const [editorState, setEditorState] = useState({
    bold: false,
    italic: false,
    underline: false,
  })
  const [tableGridHover, setTableGridHover] = useState({ row: 0, col: 0, show: false })
  const [workTaskId, setWorkTaskId] = useState<string | null>(null)
  const [workTaskIsSubtask, setWorkTaskIsSubtask] = useState(false)
  const [workAttachedFiles, setWorkAttachedFiles] = useState<File[]>([])
  const [workResolvedFileKeys, setWorkResolvedFileKeys] = useState<ResolvedFileKey[]>([])
  const [isUploadingWork, setIsUploadingWork] = useState(false)
  const [workUploadProgress, setWorkUploadProgress] = useState(0)
  const [isWorkAreaDragOver, setIsWorkAreaDragOver] = useState(false)
  const [isWorkAreaReadOnly, setIsWorkAreaReadOnly] = useState(false)
  
  // 댓글 에디터 상태
  const [workCommentContent, setWorkCommentContent] = useState("")
  const [workCommentFiles, setWorkCommentFiles] = useState<File[]>([])
  const [workCommentResolvedFileKeys, setWorkCommentResolvedFileKeys] = useState<ResolvedFileKey[]>([])
  const [workCommentEditorState, setWorkCommentEditorState] = useState({
    bold: false,
    italic: false,
    underline: false,
  })
  const [workCommentTableGridHover, setWorkCommentTableGridHover] = useState({ row: 0, col: 0, show: false })
  
  // 작업공간 탭 모드 (개별/공동)
  const [contentMode, setContentMode] = useState<'main' | 'add'>('add')
  
  // Task 선택 시 작업공간에 정보 표시하지 않음 (Comment 버튼을 눌렀을 때만 표시)
  
  // 드래그 중인 task도 작업공간에 표시 (드롭 전에는 표시하지 않음)
  // useEffect(() => {
  //   if (draggedTask && !selectedTask) {
  //     setWorkForm({
  //       title: draggedTask.title || "",
  //       content: draggedTask.content || "",
  //       priority: draggedTask.priority || "medium",
  //       description: draggedTask.description || "",
  //     })
  //     setWorkTaskId(draggedTask.id)
  //     
  //     setTimeout(() => {
  //       const editor = document.getElementById('work-content')
  //       if (editor && draggedTask.content) {
  //         editor.innerHTML = draggedTask.content
  //       }
  //     }, 0)
  //   }
  // }, [draggedTask, selectedTask])
  
  // contentEditable 초기값 설정
  useEffect(() => {
    const editor = document.getElementById('work-content')
    if (editor && workForm.content && !editor.innerHTML) {
      editor.innerHTML = workForm.content
    }
  }, [])
  
  // 에디터 상태 업데이트 함수
  const updateEditorState = () => {
    const editor = document.getElementById('work-content')
    if (editor) {
      setEditorState({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
      })
    }
  }
  
  // 댓글 에디터 상태 업데이트 함수
  const updateCommentEditorState = () => {
    const editor = document.getElementById('work-comment-content')
    if (editor) {
      setWorkCommentEditorState({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
      })
    }
  }
  
  // 테이블 리사이즈 핸들러 추가 함수
  const addResizeHandlersToTable = (table: HTMLTableElement) => {
    const editor = document.getElementById('work-content')
    if (!editor) return
    
    const rows = table.querySelectorAll('tr')
    rows.forEach((row) => {
      const cells = row.querySelectorAll('td')
      cells.forEach((cell) => {
        const existingHandle = cell.querySelector('[data-resize-handle]')
        if (existingHandle) {
          existingHandle.remove()
        }
        
        const resizeHandle = document.createElement('div')
        resizeHandle.setAttribute('data-resize-handle', 'true')
        resizeHandle.style.position = 'absolute'
        resizeHandle.style.right = '-4px'
        resizeHandle.style.top = '0'
        resizeHandle.style.width = '8px'
        resizeHandle.style.height = '100%'
        resizeHandle.style.cursor = 'col-resize'
        resizeHandle.style.backgroundColor = 'transparent'
        resizeHandle.style.zIndex = '10'
        resizeHandle.style.userSelect = 'none'
        
        cell.style.position = 'relative'
        
        let isResizing = false
        let startX = 0
        let startWidth = 0
        
        resizeHandle.addEventListener('mousedown', (e) => {
          e.preventDefault()
          e.stopPropagation()
          isResizing = true
          startX = e.clientX
          startWidth = cell.offsetWidth
          
          // 같은 열의 모든 셀 찾기
          const cellIndex = Array.from(row.children).indexOf(cell)
          const allCellsInColumn = Array.from(table.querySelectorAll('tr')).map(
            (row) => row.children[cellIndex] as HTMLElement
          )
          
          const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return
            const diff = e.clientX - startX
            const newWidth = Math.max(50, startWidth + diff)
            // 같은 열의 모든 셀에 동일한 너비 적용
            allCellsInColumn.forEach((colCell) => {
              if (colCell) {
                colCell.style.width = `${newWidth}px`
              }
            })
          }
          
          const handleMouseUp = () => {
            isResizing = false
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            const html = editor.innerHTML
            setWorkForm({ ...workForm, content: html })
          }
          
          document.addEventListener('mousemove', handleMouseMove)
          document.addEventListener('mouseup', handleMouseUp)
        })
        
        cell.appendChild(resizeHandle)
      })
    })
  }
  
  // 테이블 생성 함수
  const createTable = (rows: number, cols: number) => {
    const editor = document.getElementById('work-content')
    if (!editor) return
    
    // 에디터에 포커스 설정
    editor.focus()
    
    const table = document.createElement('table')
    table.style.borderCollapse = 'collapse'
    table.style.width = '100%'
    table.style.margin = '10px 0'
    table.style.border = '2px solid #6b7280'
    table.style.position = 'relative'
    table.style.tableLayout = 'fixed' // 테이블 레이아웃 고정
    table.setAttribute('data-resizable', 'true')
    
    // 각 열의 초기 너비 계산 (100%를 열 개수로 나눔)
    const columnWidth = `${100 / cols}%`
    
    for (let i = 0; i < rows; i++) {
      const row = document.createElement('tr')
      for (let j = 0; j < cols; j++) {
        const cell = document.createElement('td')
        cell.style.border = '2px solid #6b7280'
        cell.style.padding = '8px'
        cell.style.width = columnWidth // 고정 너비 설정
        cell.style.minWidth = '50px'
        cell.style.position = 'relative'
        cell.contentEditable = 'true'
        cell.innerHTML = '&nbsp;'
        
        // 테이블 셀에 포커스가 들어갈 때 포맷 초기화
        cell.addEventListener('focus', () => {
          document.execCommand('removeFormat', false)
          document.execCommand('unlink', false)
        })
        
        // 테이블 셀에 입력할 때 포맷 제거
        cell.addEventListener('input', () => {
          const selection = window.getSelection()
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0)
            const container = range.commonAncestorContainer
            if (cell.contains(container) || container === cell) {
              // 언더라인 등 포맷 제거
              const walker = document.createTreeWalker(
                cell,
                NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
                null
              )
              let node
              while (node = walker.nextNode()) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  const el = node as HTMLElement
                  if (el.tagName === 'U' || el.style.textDecoration === 'underline') {
                    const parent = el.parentNode
                    if (parent) {
                      while (el.firstChild) {
                        parent.insertBefore(el.firstChild, el)
                      }
                      parent.removeChild(el)
                    }
                  }
                }
              }
            }
          }
        })
        
        row.appendChild(cell)
      }
      table.appendChild(row)
    }
    
    // 에디터 내부에만 테이블 삽입
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      // 선택 범위가 에디터 내부에 있는지 확인
      if (editor.contains(range.commonAncestorContainer) || range.commonAncestorContainer === editor) {
        range.deleteContents()
        range.insertNode(table)
        range.setStartAfter(table)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
      } else {
        // 선택 범위가 에디터 외부에 있으면 에디터 끝에 추가
        const range = document.createRange()
        range.selectNodeContents(editor)
        range.collapse(false)
        range.insertNode(table)
        range.setStartAfter(table)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
      }
    } else {
      // 선택이 없으면 에디터 끝에 추가
      editor.appendChild(table)
      const range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(range)
      }
    }
    
    setTimeout(() => {
      addResizeHandlersToTable(table)
    }, 0)
    
    const html = editor.innerHTML
    setWorkForm({ ...workForm, content: html })
  }
  
  // 댓글 에디터 테이블 리사이즈 핸들러 추가 함수
  const addResizeHandlersToCommentTable = (table: HTMLTableElement) => {
    const editor = document.getElementById('work-comment-content')
    if (!editor) return
    
    const rows = table.querySelectorAll('tr')
    rows.forEach((row) => {
      const cells = row.querySelectorAll('td')
      cells.forEach((cell) => {
        const existingHandle = cell.querySelector('[data-resize-handle]')
        if (existingHandle) {
          existingHandle.remove()
        }
        
        const resizeHandle = document.createElement('div')
        resizeHandle.setAttribute('data-resize-handle', 'true')
        resizeHandle.style.position = 'absolute'
        resizeHandle.style.right = '-4px'
        resizeHandle.style.top = '0'
        resizeHandle.style.width = '8px'
        resizeHandle.style.height = '100%'
        resizeHandle.style.cursor = 'col-resize'
        resizeHandle.style.backgroundColor = 'transparent'
        resizeHandle.style.zIndex = '10'
        resizeHandle.style.userSelect = 'none'
        
        cell.style.position = 'relative'
        
        let isResizing = false
        let startX = 0
        let startWidth = 0
        
        resizeHandle.addEventListener('mousedown', (e) => {
          e.preventDefault()
          e.stopPropagation()
          isResizing = true
          startX = e.clientX
          startWidth = cell.offsetWidth
          
          // 같은 열의 모든 셀 찾기
          const cellIndex = Array.from(row.children).indexOf(cell)
          const allCellsInColumn = Array.from(table.querySelectorAll('tr')).map(
            (row) => row.children[cellIndex] as HTMLElement
          )
          
          const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return
            const diff = e.clientX - startX
            const newWidth = Math.max(50, startWidth + diff)
            // 같은 열의 모든 셀에 동일한 너비 적용
            allCellsInColumn.forEach((colCell) => {
              if (colCell) {
                colCell.style.width = `${newWidth}px`
              }
            })
          }
          
          const handleMouseUp = () => {
            isResizing = false
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            const html = editor.innerHTML
            setWorkCommentContent(html)
          }
          
          document.addEventListener('mousemove', handleMouseMove)
          document.addEventListener('mouseup', handleMouseUp)
        })
        
        cell.appendChild(resizeHandle)
      })
    })
  }
  
  // 댓글 에디터 테이블 생성 함수
  const createCommentTable = (rows: number, cols: number) => {
    if (!workTaskId) return
    const editor = document.getElementById('work-comment-content')
    if (!editor) return
    
    // 에디터에 포커스 설정
    editor.focus()
    
    const table = document.createElement('table')
    table.style.borderCollapse = 'collapse'
    table.style.width = '100%'
    table.style.margin = '10px 0'
    table.style.border = '2px solid #6b7280'
    table.style.position = 'relative'
    table.style.tableLayout = 'fixed' // 테이블 레이아웃 고정
    table.setAttribute('data-resizable', 'true')
    
    // 각 열의 초기 너비 계산 (100%를 열 개수로 나눔)
    const columnWidth = `${100 / cols}%`
    
    for (let i = 0; i < rows; i++) {
      const row = document.createElement('tr')
      for (let j = 0; j < cols; j++) {
        const cell = document.createElement('td')
        cell.style.border = '2px solid #6b7280'
        cell.style.padding = '8px'
        cell.style.width = columnWidth // 고정 너비 설정
        cell.style.minWidth = '50px'
        cell.style.position = 'relative'
        cell.contentEditable = 'true'
        cell.innerHTML = '&nbsp;'
        
        // 테이블 셀에 포커스가 들어갈 때 포맷 초기화
        cell.addEventListener('focus', () => {
          document.execCommand('removeFormat', false)
          document.execCommand('unlink', false)
        })
        
        // 테이블 셀에 입력할 때 포맷 제거
        cell.addEventListener('input', () => {
          const selection = window.getSelection()
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0)
            const container = range.commonAncestorContainer
            if (cell.contains(container) || container === cell) {
              // 언더라인 등 포맷 제거
              const walker = document.createTreeWalker(
                cell,
                NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
                null
              )
              let node
              while (node = walker.nextNode()) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  const el = node as HTMLElement
                  if (el.tagName === 'U' || el.style.textDecoration === 'underline') {
                    const parent = el.parentNode
                    if (parent) {
                      while (el.firstChild) {
                        parent.insertBefore(el.firstChild, el)
                      }
                      parent.removeChild(el)
                    }
                  }
                }
              }
            }
          }
        })
        
        row.appendChild(cell)
      }
      table.appendChild(row)
    }
    
    // 에디터 내부에만 테이블 삽입
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      // 선택 범위가 에디터 내부에 있는지 확인
      if (editor.contains(range.commonAncestorContainer) || range.commonAncestorContainer === editor) {
        range.deleteContents()
        range.insertNode(table)
        range.setStartAfter(table)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
      } else {
        // 선택 범위가 에디터 외부에 있으면 에디터 끝에 추가
        const range = document.createRange()
        range.selectNodeContents(editor)
        range.collapse(false)
        range.insertNode(table)
        range.setStartAfter(table)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
      }
    } else {
      // 선택이 없으면 에디터 끝에 추가
      editor.appendChild(table)
      const range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(range)
      }
    }
    
    setTimeout(() => {
      addResizeHandlersToCommentTable(table)
    }, 0)
    
    const html = editor.innerHTML
    setWorkCommentContent(html)
  }

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
      } catch (error) {
        console.error("[Progress] 사용자 로드 오류:", error)
      }
    }
    loadUser()
  }, [])

  // 프로필 목록 로드
  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const response = await fetch("/api/profiles", {
          credentials: "include",
        })
        if (response.ok) {
          const profiles = await response.json()
          setAllProfiles(Array.isArray(profiles) ? profiles : [])
        }
      } catch (error) {
        console.error("[Progress] 프로필 목록 로드 오류:", error)
      }
    }
    loadProfiles()
  }, [])

  const loadTasks = useCallback(async () => {
    setIsLoading(true)
    try {
      // 내가 받은 task만 가져옴
      const response = await fetch("/api/tasks", {
        credentials: "include",
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error("Task 목록을 불러오는데 실패했습니다")
      }

      const data = await response.json()
      const loadedTasks: Task[] = Array.isArray(data.tasks) ? data.tasks : []
      
      // 내가 받은 task들만 표시 (assigned_to === user.id)
      // /api/tasks는 이미 현재 사용자에게 할당된 task만 반환함
      setTasks(loadedTasks)
    } catch (error: any) {
      console.error("[Progress] Task 로드 오류:", error)
      toast({
        title: "오류",
        description: error.message || "Task 목록을 불러오는데 실패했습니다",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  // 페이지 마운트 시 tasks 로드
  useEffect(() => {
    loadTasks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStatusChange = useCallback(async (taskId: string, newStatus: TaskStatus) => {
    setUpdatingTaskId(taskId)
    try {
      // Task인지 Subtask인지 확인
      const task = tasks.find(t => t.id === taskId)
      const isSubtask = task?.is_subtask || false

      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ 
          status: newStatus,
          is_subtask: isSubtask 
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "상태 업데이트 실패")
      }

      // UI 즉시 반영(완료대기 → 작업/보류 이동 시 완료대기에 남아보이는 현상 방지)
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t
          return {
            ...t,
            status: newStatus,
            completed_at: newStatus === "completed" ? new Date().toISOString() : null,
          }
        }),
      )

      // Task 목록 새로고침
      await loadTasks()

      toast({
        title: "상태 업데이트 완료",
        description: `${isSubtask ? '할당 업무' : 'Task'} 상태가 변경되었습니다`,
      })
    } catch (error: any) {
      toast({
        title: "오류",
        description: error.message || "상태 업데이트에 실패했습니다",
        variant: "destructive",
      })
    } finally {
      setUpdatingTaskId(null)
    }
  }, [tasks, loadTasks, toast])

  const handleDragStart = useCallback((e: React.DragEvent, task: Task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = "all" // copy와 move 모두 허용
    e.dataTransfer.setData("text/plain", task.id)
  }, [])

  const handleDragEnd = useCallback(() => {
    // 드래그가 끝났을 때 약간의 지연 후 상태 초기화 (드롭 이벤트가 먼저 처리되도록)
    setTimeout(() => {
      setDraggedTask(null)
    }, 100)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverStatus(status)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverStatus(null)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault()
    setDragOverStatus(null)

    if (!draggedTask) return

    // 같은 상태로 드롭하면 무시
    if (draggedTask.status === targetStatus) {
      setDraggedTask(null)
      return
    }

    // 상태 변경
    await handleStatusChange(draggedTask.id, targetStatus)
    setDraggedTask(null)
  }, [draggedTask, handleStatusChange])

  // 작업공간 드래그 오버 핸들러
  const handleWorkAreaDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // 드롭 가능한 커서로 변경 (copy 또는 move)
    if (e.dataTransfer.effectAllowed === "all" || e.dataTransfer.effectAllowed.includes("copy")) {
      e.dataTransfer.dropEffect = "copy"
    } else if (e.dataTransfer.effectAllowed.includes("move")) {
      e.dataTransfer.dropEffect = "move"
    } else {
      e.dataTransfer.dropEffect = "copy"
    }
    setIsWorkAreaDragOver(true)
  }, [])

  // 작업공간 드래그 리브 핸들러
  const handleWorkAreaDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // 자식 요소로 이동한 경우는 무시
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return
    }
    setIsWorkAreaDragOver(false)
  }, [])

  // 작업공간 드롭 핸들러
  const handleWorkAreaDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsWorkAreaDragOver(false)

    if (!draggedTask) return

    // 작업공간에 task 정보 표시 (읽기 전용)
    setWorkForm({
      title: draggedTask.title || "",
      content: draggedTask.content || "",
      priority: draggedTask.priority || "medium",
    })
    setWorkTaskId(draggedTask.id)
    setIsWorkAreaReadOnly(true) // 드롭으로 추가한 경우 읽기 전용

    // 첨부파일이 있으면 resolve
    if (draggedTask.file_keys && draggedTask.file_keys.length > 0) {
      try {
        const response = await fetch('/api/storage/resolve-file-keys', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ fileKeys: draggedTask.file_keys }),
        })
        if (response.ok) {
          const data = await response.json()
          setWorkResolvedFileKeys(data.resolvedKeys || [])
        }
      } catch (error) {
        console.error('파일 키 resolve 오류:', error)
        setWorkResolvedFileKeys([])
      }
    } else {
      setWorkResolvedFileKeys([])
    }

    // comment 첨부파일이 있으면 resolve
    if (draggedTask.comment_file_keys && draggedTask.comment_file_keys.length > 0) {
      try {
        const response = await fetch('/api/storage/resolve-file-keys', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ fileKeys: draggedTask.comment_file_keys }),
        })
        if (response.ok) {
          const data = await response.json()
          setWorkCommentResolvedFileKeys(data.resolvedKeys || [])
        }
      } catch (error) {
        console.error('comment 파일 키 resolve 오류:', error)
        setWorkCommentResolvedFileKeys([])
      }
    } else {
      setWorkCommentResolvedFileKeys([])
    }

    // contentEditable에 내용 설정
    setTimeout(() => {
      const editor = document.getElementById('work-content')
      if (editor && draggedTask.content) {
        editor.innerHTML = draggedTask.content
      }
      
      // comment 에디터에 내용 설정
      const commentEditor = document.getElementById('work-comment-content')
      if (commentEditor) {
        // comment 컬럼에서 첫 줄 개행 제거하여 표시
        const commentText = (draggedTask.comment as string) || ""
        commentEditor.innerHTML = commentText.startsWith('\n') ? commentText.substring(1) : commentText
        setWorkCommentContent(commentText.startsWith('\n') ? commentText.substring(1) : commentText)
      }
    }, 0)

    // 드래그 상태 초기화
    setDraggedTask(null)
  }, [draggedTask])

  const getPriorityColor = (priority: Task['priority']) => {
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

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'awaiting_completion':
        return <CheckCircle2 className="h-4 w-4 text-purple-500" />
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />
      case 'on_hold':
        return <Pause className="h-4 w-4 text-yellow-500" />
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-gray-500" />
      default:
        return null
    }
  }

  const getStatusLabel = (status: Task['status'], task?: Task) => {
    switch (status) {
      case 'completed':
        return '완료'
      case 'awaiting_completion':
        return '완료대기'
      case 'in_progress':
        return '작업'
      case 'on_hold':
        return '보류'
      case 'pending':
        return '대기'
      default:
        return status
    }
  }

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return 'border-green-500 bg-green-50/50 dark:bg-green-950/20'
      case 'awaiting_completion':
        return 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/20'
      case 'in_progress':
        return 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
      case 'on_hold':
        return 'border-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20'
      case 'pending':
        return 'border-gray-500 bg-gray-50/50 dark:bg-gray-950/20'
    }
  }

  // 상태별로 task 분류 (시간 순으로 정렬 - created_at 기준 오름차순) - 메모이제이션
  const pendingTasks = useMemo(() => 
    tasks.filter(t => t.status === 'pending').sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ), [tasks]
  )
  const inProgressTasks = useMemo(() => 
    tasks.filter(t => t.status === 'in_progress').sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ), [tasks]
  )
  const onHoldTasks = useMemo(() => 
    tasks.filter(t => t.status === 'on_hold').sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ), [tasks]
  )
  const awaitingCompletionTasks = useMemo(() => 
    tasks.filter(t => t.status === 'awaiting_completion').sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ), [tasks]
  )

  // 완료대기 탭에서 finalized된 task 제외
  const filteredAwaitingCompletionTasks = useMemo(() => 
    awaitingCompletionTasks.filter(t => !finalizedTaskIds.has(t.id)), 
    [awaitingCompletionTasks, finalizedTaskIds]
  )

  // 받은 업무는 pending 상태인 task만 표시 (상태별 관리로 옮기면 받은 업무에서 제거)
  const allReceivedTasks = useMemo(() => 
    tasks
      .filter(t => t.status === 'pending')
      .sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ), [tasks]
  )

  const statusColumns = useMemo<Array<{ status: TaskStatus; label: string; tasks: Task[]; icon: React.ReactElement }>>(() => [
    {
      status: 'in_progress',
      label: '작업',
      tasks: inProgressTasks,
      icon: <Clock className="h-5 w-5 text-blue-500" />
    },
    {
      status: 'on_hold',
      label: '보류',
      tasks: onHoldTasks,
      icon: <Pause className="h-5 w-5 text-yellow-500" />
    },
    {
      status: 'awaiting_completion',
      label: '완료대기',
      tasks: filteredAwaitingCompletionTasks,
      icon: <CheckCircle2 className="h-5 w-5 text-purple-500" />
    }
  ], [inProgressTasks, onHoldTasks, filteredAwaitingCompletionTasks])

  return (
    <div className="relative mx-auto max-w-7xl p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Progress</h1>
        <p className="text-muted-foreground mt-2">업무를 드래그하여 상태를 변경할 수 있습니다</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* 받은 업무 섹션 - 사용자 구분 없이 전체 표시, 가로 배치 */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">받은 업무</h2>
            {allReceivedTasks.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {allReceivedTasks.map((task) => (
                  <Card
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                    className={`rounded-lg shadow-sm hover:shadow-md transition-all bg-gradient-to-br from-background to-muted/30 hover:from-background hover:to-muted/50 border-2 ${
                      task.priority === 'urgent' ? 'border-red-500/50 hover:border-red-500' :
                      task.priority === 'high' ? 'border-orange-500/50 hover:border-orange-500' :
                      task.priority === 'medium' ? 'border-yellow-500/50 hover:border-yellow-500' :
                      'border-blue-500/50 hover:border-blue-500'
                    } ${
                      draggedTask?.id === task.id ? 'opacity-50 cursor-move scale-95' : 'opacity-100 cursor-pointer'
                    } ${
                      workTaskId === task.id ? 'ring-2 ring-gray-400 ring-offset-1 border-gray-400' : ''
                    }`}
                    onClick={(e) => {
                      // 드래그가 아닐 때만 팝업 열기
                      if (!draggedTask || draggedTask.id !== task.id) {
                        setSelectedTask(task)
                      }
                    }}
                  >
                    <CardContent className="p-2">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-semibold text-xs truncate" title={task.title}>
                            {task.title}
                            {task.subtitle && task.is_subtask && (
                              <span className="text-muted-foreground ml-1.5">({task.subtitle})</span>
                            )}
                          </h4>
                          <Badge className={`${getPriorityColor(task.priority)} text-[9px] px-1.5 py-0.5 font-medium shrink-0`} variant="outline">
                            {task.priority === 'urgent' ? '긴급' : 
                             task.priority === 'high' ? '높음' : 
                             task.priority === 'medium' ? '보통' : '낮음'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="truncate text-[10px] text-muted-foreground">{task.assigned_by_name || task.assigned_by_email}</span>
                          <span className="whitespace-nowrap text-[10px] text-muted-foreground">{new Date(task.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                받은 업무가 없습니다.
              </div>
            )}
          </div>

          {/* 구분선: 받은 업무 vs 상태 보드 */}
          <div className="my-8 border-t border-border/60" />

          {/* 상태별 칸반 보드 */}
          <div className="grid gap-6 lg:grid-cols-3">
            {statusColumns.map((column) => (
              <div key={column.status} className="relative">
                {column.status === 'awaiting_completion' && filteredAwaitingCompletionTasks.length > 0 && (
                  <p className="text-sm text-muted-foreground mb-2 absolute -top-6 left-1/2 -translate-x-1/2 w-full text-center">업무를 클릭해서 작업을 끝내세요</p>
                )}
                <Card
                  data-status={column.status}
                  className={`transition-colors ${
                    dragOverStatus === column.status
                      ? getStatusColor(column.status)
                      : ''
                  }`}
                  onDragOver={(e) => handleDragOver(e, column.status)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, column.status)}
                >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {column.icon}
                    {column.label}
                    <span className="text-sm font-normal text-muted-foreground">({column.tasks.length}개의 작업)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {column.tasks.length > 0 ? (
                      column.tasks.map((task) => (
                        <TaskBlock
                          key={task.id}
                          task={task}
                          onStatusChange={handleStatusChange}
                          updatingTaskId={updatingTaskId}
                          getPriorityColor={getPriorityColor}
                          getStatusIcon={getStatusIcon}
                          getStatusLabel={getStatusLabel}
                          onDragStart={handleDragStart}
                          isDragging={draggedTask?.id === task.id}
                          onTaskClick={setSelectedTask}
                          workTaskId={workTaskId}
                        />
                      ))
                    ) : (
                      column.status !== 'pending' && (
                        <Card className="border-2 border-dashed py-0 gap-0">
                          <CardContent className="p-2 h-[55px] flex items-center justify-center">
                            <p className="text-sm text-muted-foreground">작업을 여기로 드래그하세요</p>
                          </CardContent>
                        </Card>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
              </div>
            ))}
          </div>
          
          {/* 작업공간 섹션 */}
          <Card 
            className={`mt-8 transition-all duration-200 ${
              isWorkAreaDragOver ? 'border-4 border-primary shadow-lg ring-2 ring-primary/20' : ''
            }`}
            onDragOver={handleWorkAreaDragOver}
            onDragLeave={handleWorkAreaDragLeave}
            onDrop={handleWorkAreaDrop}
          >
            <CardHeader>
              <CardTitle className="text-2xl">작업공간</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">업무블록을 드래그하여 사용하세요</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-6 min-w-0 max-w-full">
                {/* 제목을 comment와 동일한 너비로 설정 */}
                <div className="grid grid-cols-2 gap-4 min-w-0 max-w-full">
                  <div className="space-y-2 min-w-0 max-w-full">
                    <Label htmlFor="work-title" className="text-base font-semibold">제목 *</Label>
                    <Input
                      id="work-title"
                      placeholder="제목을 입력하세요"
                      value={workForm.title}
                      onChange={(e) => setWorkForm({ ...workForm, title: e.target.value })}
                      className={`text-base h-12 w-full max-w-full min-w-0 ${isWorkAreaReadOnly || !workTaskId ? 'bg-muted/50' : ''}`}
                      disabled={isWorkAreaReadOnly || !workTaskId}
                      readOnly={isWorkAreaReadOnly || !workTaskId}
                    />
                  </div>
                  <div></div>
                </div>
                <div className="space-y-2 min-w-0 max-w-full">
                  <Label htmlFor="work-priority">중요도</Label>
                  <div className="flex items-end gap-2">
                    <Select
                      value={workForm.priority}
                      onValueChange={(value) => setWorkForm({ ...workForm, priority: value })}
                      disabled={isWorkAreaReadOnly || !workTaskId}
                    >
                      <SelectTrigger 
                        id="work-priority" 
                        className={`h-auto py-2 ${isWorkAreaReadOnly || !workTaskId ? 'cursor-default' : 'cursor-pointer'}`}
                        style={isWorkAreaReadOnly || !workTaskId ? { cursor: 'default' } : undefined}
                      >
                        {workForm.priority === "low" && (
                          <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-sm font-medium">낮음</span>
                        )}
                        {workForm.priority === "medium" && (
                          <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-700 text-sm font-medium">보통</span>
                        )}
                        {workForm.priority === "high" && (
                          <span className="px-2 py-1 rounded bg-orange-100 text-orange-700 text-sm font-medium">높음</span>
                        )}
                        {workForm.priority === "urgent" && (
                          <span className="px-2 py-1 rounded bg-red-100 text-red-700 text-sm font-medium">긴급</span>
                        )}
                        {!workForm.priority && (
                          <SelectValue placeholder="선택하세요" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low" className="cursor-pointer">
                          <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-sm font-medium">낮음</span>
                        </SelectItem>
                        <SelectItem value="medium" className="cursor-pointer">
                          <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-700 text-sm font-medium">보통</span>
                        </SelectItem>
                        <SelectItem value="high" className="cursor-pointer">
                          <span className="px-2 py-1 rounded bg-orange-100 text-orange-700 text-sm font-medium">높음</span>
                        </SelectItem>
                        <SelectItem value="urgent" className="cursor-pointer">
                          <span className="px-2 py-1 rounded bg-red-100 text-red-700 text-sm font-medium">긴급</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* 개별/공동 탭으로 변경 */}
                <div className="space-y-2 min-w-0 max-w-full">
                  {/* 개별/공동 슬라이딩 세그먼트 - is_multi_assign에 따라 조건부 렌더링 */}
                  {(() => {
                    const currentTask = workTaskId ? tasks.find(t => t.id === workTaskId) : null
                    const isMultiAssign = currentTask?.is_multi_assign
                    
                    // is_multi_assign이 false면 개별만, true면 공동만 표시
                    if (isMultiAssign === false) {
                      return null // 개별만 표시할 때는 탭 스위치 숨김
                    } else if (isMultiAssign === true) {
                      return null // 공동만 표시할 때는 탭 스위치 숨김
                    }
                    
                    // task가 없거나 is_multi_assign이 undefined인 경우 기본 탭 표시
                    return (
                      <div className="mb-3">
                        <div className="relative inline-flex items-center bg-muted rounded-full p-0.5 h-8 w-fit">
                          <div 
                            className="absolute h-7 rounded-full bg-background shadow-sm transition-all duration-200 ease-in-out"
                            style={{
                              width: '45px', 
                              left: contentMode === 'main' ? '2px' : '47px',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setContentMode('main')}
                            className={`relative z-10 w-[45px] h-7 text-sm font-medium transition-colors duration-200 ${
                              contentMode === 'main' ? 'text-foreground' : 'text-muted-foreground'
                            }`}
                          >
                            개별
                          </button>
                          <button
                            type="button"
                            onClick={() => setContentMode('add')}
                            className={`relative z-10 w-[45px] h-7 text-sm font-medium transition-colors duration-200 ${
                              contentMode === 'add' ? 'text-foreground' : 'text-muted-foreground'
                            }`}
                          >
                            공동
                          </button>
                        </div>
                      </div>
                    )
                  })()}
                  
                  {/* 개별 탭 - 공동 탭과 같은 구조로 변경 */}
                  {(() => {
                    const currentTask = workTaskId ? tasks.find(t => t.id === workTaskId) : null
                    const isMultiAssign = currentTask?.is_multi_assign
                    
                    // is_multi_assign이 false이거나, undefined일 때 contentMode가 'main'인 경우 개별 탭 표시
                    const showIndividual = (isMultiAssign === false) || (isMultiAssign === undefined && contentMode === 'main')
                    
                    return showIndividual && (
                    <>
                    {/* 본문 (위에 배치, full width) */}
                    <div className="space-y-2 min-w-0 max-w-full mb-4">
                      <Label className="text-base font-semibold">본문</Label>
                      {workForm.content ? (
                        <div className="border rounded-md overflow-hidden bg-muted/30" style={{
                          height: '280px',
                          minHeight: '280px',
                          maxHeight: '280px',
                          display: 'flex',
                          flexDirection: 'column'
                        }}>
                          <div
                            id="work-content-main-readonly"
                            className="text-sm bg-muted/50 p-3 wrap-break-word word-break break-all overflow-x-auto prose prose-sm max-w-none flex-1"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(workForm.content) }}
                            style={{
                              minHeight: '250px',
                              overflowY: 'auto',
                              userSelect: 'text',
                              whiteSpace: 'pre-wrap'
                            }}
                            ref={(el) => {
                              if (el) {
                                const tables = el.querySelectorAll('table')
                                tables.forEach((table) => {
                                  const cells = table.querySelectorAll('td, th')
                                  cells.forEach((cell) => {
                                    (cell as HTMLElement).contentEditable = 'false'
                                  })
                                })
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <div className="border rounded-md bg-muted/30 p-4 text-center text-muted-foreground" style={{
                          height: '280px',
                          minHeight: '280px',
                          maxHeight: '280px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          본문이 없습니다
                        </div>
                      )}
                      
                      {/* 본문 첨부파일 표시 */}
                      {workResolvedFileKeys.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">본문 첨부파일</Label>
                          <div className="flex flex-wrap gap-2 p-2 border border-transparent rounded-md bg-transparent">
                            {workResolvedFileKeys.map((resolved, idx) => (
                              <div key={`main-resolved-${idx}`} className="flex items-center gap-2 px-2 py-1 bg-transparent rounded border text-sm">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span 
                                  className="max-w-[150px] truncate cursor-pointer hover:underline"
                                  title={resolved.fileName}
                                  onClick={async (e) => {
                                    e.preventDefault()
                                    
                                    try {
                                      const response = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(resolved.s3Key)}&expiresIn=604800`, {
                                        credentials: 'include',
                                      })
                                      if (!response.ok) {
                                        const errorData = await response.json().catch(() => ({}))
                                        const errorMessage = errorData.error || '다운로드 URL 생성 실패'
                                        if (errorMessage.includes('존재하지 않') || errorMessage.includes('기간이 지났') || response.status === 404) {
                                          throw new Error('파일이 존재하지 않거나 다운로드 기간이 지났습니다.')
                                        }
                                        throw new Error(errorMessage)
                                      }
                                      const data = await response.json()
                                      if (data.signedUrl) {
                                        const a = document.createElement('a')
                                        a.href = data.signedUrl
                                        a.download = resolved.fileName
                                        document.body.appendChild(a)
                                        a.click()
                                        document.body.removeChild(a)
                                      } else {
                                        throw new Error('서명된 URL을 받을 수 없습니다')
                                      }
                                    } catch (error: any) {
                                      console.error('파일 다운로드 오류:', error)
                                      toast({
                                        title: '오류',
                                        description: error.message || '파일 다운로드에 실패했습니다.',
                                        variant: 'destructive',
                                      })
                                    }
                                  }}
                                >
                                  {resolved.fileName}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* 개별 탭도 공동 탭과 동일한 내용 에디터 + 첨부파일 UI를 사용합니다 */}
                    {/* 공동 탭(1437라인~)과 동일한 코드 구조이므로 생략 - 실제 사용 시 공동 탭 참조 */}
                    </>
                  )})()}
                  
                  {/* 공동 탭 - 편집 가능한 에디터 */}
                  {(() => {
                    const currentTask = workTaskId ? tasks.find(t => t.id === workTaskId) : null
                    const isMultiAssign = currentTask?.is_multi_assign
                    
                    // is_multi_assign이 true이거나, undefined일 때 contentMode가 'add'인 경우 공동 탭 표시
                    const showMulti = (isMultiAssign === true) || (isMultiAssign === undefined && contentMode === 'add')
                    
                    return showMulti && (
                    <>
                    {/* 본문 (위에 배치, full width) */}
                    <div className="space-y-2 min-w-0 max-w-full mb-4">
                      <Label className="text-base font-semibold">본문</Label>
                      {isWorkAreaReadOnly && workForm.content ? (
                        <div className="border rounded-md overflow-hidden bg-muted/30" style={{
                          height: '280px',
                          minHeight: '280px',
                          maxHeight: '280px',
                          display: 'flex',
                          flexDirection: 'column'
                        }}>
                          <div
                            id="work-content-readonly-add"
                            className="text-sm bg-muted/50 p-3 wrap-break-word word-break break-all overflow-x-auto prose prose-sm max-w-none flex-1"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(workForm.content) }}
                            style={{
                              minHeight: '250px',
                              overflowY: 'auto',
                              userSelect: 'none',
                              cursor: 'default',
                              opacity: 0.7,
                              whiteSpace: 'pre-wrap'
                            }}
                            ref={(el) => {
                              if (el) {
                                const tables = el.querySelectorAll('table')
                                tables.forEach((table) => {
                                  const cells = table.querySelectorAll('td, th')
                                  cells.forEach((cell) => {
                                    (cell as HTMLElement).contentEditable = 'false'
                                  })
                                })
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <div className="border rounded-md bg-muted/30 p-4 text-center text-muted-foreground" style={{
                          height: '280px',
                          minHeight: '280px',
                          maxHeight: '280px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          본문이 없습니다
                        </div>
                      )}
                      
                      {/* 본문 첨부파일 표시 */}
                      {workResolvedFileKeys.length > 0 && (
                        <div className="space-y-2 mt-2">
                          <Label className="text-sm font-semibold">본문 첨부파일</Label>
                          <div className="flex flex-wrap gap-2 p-2 border border-transparent rounded-md bg-transparent">
                            {workResolvedFileKeys.map((resolved, idx) => (
                              <div key={`multi-resolved-${idx}`} className="flex items-center gap-2 px-2 py-1 bg-transparent rounded border text-sm">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span 
                                  className="max-w-[150px] truncate cursor-pointer hover:underline"
                                  title={resolved.fileName}
                                  onClick={async (e) => {
                                    e.preventDefault()
                                    
                                    try {
                                      const response = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(resolved.s3Key)}&expiresIn=604800`, {
                                        credentials: 'include',
                                      })
                                      if (!response.ok) {
                                        const errorData = await response.json().catch(() => ({}))
                                        const errorMessage = errorData.error || '다운로드 URL 생성 실패'
                                        if (errorMessage.includes('존재하지 않') || errorMessage.includes('기간이 지났') || response.status === 404) {
                                          throw new Error('파일이 존재하지 않거나 다운로드 기간이 지났습니다.')
                                        }
                                        throw new Error(errorMessage)
                                      }
                                      const data = await response.json()
                                      if (data.signedUrl) {
                                        const a = document.createElement('a')
                                        a.href = data.signedUrl
                                        a.download = resolved.fileName
                                        document.body.appendChild(a)
                                        a.click()
                                        document.body.removeChild(a)
                                      } else {
                                        throw new Error('서명된 URL을 받을 수 없습니다')
                                      }
                                    } catch (error: any) {
                                      console.error('파일 다운로드 오류:', error)
                                      toast({
                                        title: '오류',
                                        description: error.message || '파일 다운로드에 실패했습니다.',
                                        variant: 'destructive',
                                      })
                                    }
                                  }}
                                >
                                  {resolved.fileName}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* 내용 에디터 (아래로 이동) */}
                    <div className="space-y-2 min-w-0 max-w-full">
                      <Label htmlFor="work-comment-content" className="text-base font-semibold">내용</Label>
                    <div className="border rounded-md overflow-hidden bg-background" style={{
                      height: '350px',
                      minHeight: '350px',
                      maxHeight: '350px',
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <div className="flex items-center gap-1 p-2 flex-wrap shrink-0">
                        <Button
                          type="button"
                          variant={workCommentEditorState.bold ? "secondary" : "ghost"}
                          size="sm"
                          className={`h-8 w-8 p-0 ${workCommentEditorState.bold ? 'bg-primary/10' : ''}`}
                          onClick={(e) => {
                            e.preventDefault()
                            if (!workTaskId) return
                            const editor = document.getElementById('work-comment-content')
                            if (editor) {
                              editor.focus()
                              document.execCommand('bold', false)
                              updateCommentEditorState()
                            }
                          }}
                          title="굵게 (Ctrl+B)"
                          disabled={!workTaskId}
                        >
                          <Bold className={`h-4 w-4 ${workCommentEditorState.bold ? 'text-primary' : ''}`} />
                        </Button>
                        <Button
                          type="button"
                          variant={workCommentEditorState.italic ? "secondary" : "ghost"}
                          size="sm"
                          className={`h-8 w-8 p-0 ${workCommentEditorState.italic ? 'bg-primary/10' : ''}`}
                          onClick={(e) => {
                            e.preventDefault()
                            if (!workTaskId) return
                            const editor = document.getElementById('work-comment-content')
                            if (editor) {
                              editor.focus()
                              document.execCommand('italic', false)
                              updateCommentEditorState()
                            }
                          }}
                          title="기울임 (Ctrl+I)"
                          disabled={!workTaskId}
                        >
                          <Italic className={`h-4 w-4 ${workCommentEditorState.italic ? 'text-primary' : ''}`} />
                        </Button>
                        <Button
                          type="button"
                          variant={workCommentEditorState.underline ? "secondary" : "ghost"}
                          size="sm"
                          className={`h-8 w-8 p-0 ${workCommentEditorState.underline ? 'bg-primary/10' : ''}`}
                          onClick={(e) => {
                            e.preventDefault()
                            if (!workTaskId) return
                            const editor = document.getElementById('work-comment-content')
                            if (editor) {
                              editor.focus()
                              document.execCommand('underline', false)
                              updateCommentEditorState()
                            }
                          }}
                          title="밑줄"
                          disabled={!workTaskId}
                        >
                          <Underline className={`h-4 w-4 ${workCommentEditorState.underline ? 'text-primary' : ''}`} />
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
                              if (!workTaskId) return
                              if (workCommentTableGridHover.show) {
                                setWorkCommentTableGridHover({ row: 0, col: 0, show: false })
                              } else {
                                setWorkCommentTableGridHover({ row: 0, col: 0, show: true })
                              }
                            }}
                            title="테이블"
                            disabled={!workTaskId}
                          >
                            <TableIcon className="h-4 w-4" />
                          </Button>
                          {workCommentTableGridHover.show && workTaskId && (
                            <div 
                              className="absolute top-full left-0 mt-2 bg-background border rounded-lg shadow-xl p-4 z-50 min-w-[280px]"
                              onMouseLeave={() => setWorkCommentTableGridHover({ row: 0, col: 0, show: false })}
                            >
                              <div className="grid grid-cols-10 gap-1 mb-3">
                                {Array.from({ length: 100 }).map((_, idx) => {
                                  const row = Math.floor(idx / 10) + 1
                                  const col = (idx % 10) + 1
                                  const isSelected = row <= workCommentTableGridHover.row && col <= workCommentTableGridHover.col
                                  
                                  return (
                                    <div
                                      key={idx}
                                      className={`w-5 h-5 border border-border rounded-sm transition-colors ${
                                        isSelected ? 'bg-primary border-primary' : 'bg-muted hover:bg-muted/80'
                                      }`}
                                      onMouseEnter={() => {
                                        setWorkCommentTableGridHover({ row, col, show: true })
                                      }}
                                      onClick={() => {
                                        if (!workTaskId) return
                                        createCommentTable(row, col)
                                        setWorkCommentTableGridHover({ row: 0, col: 0, show: false })
                                      }}
                                    />
                                  )
                                })}
                              </div>
                              <div className="text-sm text-center font-medium text-foreground border-t pt-2">
                                {workCommentTableGridHover.row > 0 && workCommentTableGridHover.col > 0 
                                  ? `${workCommentTableGridHover.row} x ${workCommentTableGridHover.col} 테이블`
                                  : '테이블 크기 선택'}
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
                            if (!workTaskId) return
                            const editor = document.getElementById('work-comment-content')
                            if (editor) {
                              editor.focus()
                              const hr = document.createElement('hr')
                              hr.style.border = 'none'
                              hr.style.borderTop = '2px solid #6b7280'
                              hr.style.margin = '10px 0'
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
                              const html = editor.innerHTML
                              setWorkCommentContent(html)
                            }
                          }}
                          title="구분선"
                          disabled={!workTaskId}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div
                        id="work-comment-content"
                        contentEditable={!!workTaskId}
                        suppressContentEditableWarning
                        onInput={(e) => {
                          if (!workTaskId) return
                          const html = e.currentTarget.innerHTML
                          setWorkCommentContent(html)
                          updateCommentEditorState()
                          setTimeout(() => {
                            const editor = document.getElementById('work-comment-content')
                            if (editor) {
                              const tables = editor.querySelectorAll('table[data-resizable="true"]')
                              tables.forEach((table) => {
                                addResizeHandlersToCommentTable(table as HTMLTableElement)
                              })
                            }
                          }, 0)
                        }}
                        onBlur={(e) => {
                          if (!workTaskId) return
                          const html = e.currentTarget.innerHTML
                          setWorkCommentContent(html)
                          updateCommentEditorState()
                        }}
                        onMouseUp={updateCommentEditorState}
                        onKeyUp={updateCommentEditorState}
                        className={`resize-none text-base leading-relaxed w-full max-w-full min-w-0 overflow-y-auto border-t p-3 focus:outline-none focus:ring-0 bg-background flex-1 ${!workTaskId ? 'opacity-50' : ''}`}
                        style={{ 
                          minHeight: '300px',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}
                        data-placeholder="내용을 입력하세요."
                      />
                      <style jsx global>{`
                        #work-comment-content:empty:before {
                          content: attr(data-placeholder);
                          color: #9ca3af;
                          pointer-events: none;
                        }
                        #work-comment-content[contenteditable="false"]:empty:before {
                          content: "작업을 선택해주세요.";
                          color: #9ca3af;
                          pointer-events: none;
                        }
                        #work-comment-content table {
                          border-collapse: collapse;
                          width: 100%;
                          margin: 10px 0;
                          border: 2px solid #6b7280;
                        }
                        #work-comment-content table td,
                        #work-comment-content table th {
                          border: 2px solid #6b7280;
                          padding: 8px;
                          position: relative;
                        }
                        #work-comment-content table td u,
                        #work-comment-content table th u,
                        #work-comment-content table td[style*="underline"],
                        #work-comment-content table th[style*="underline"],
                        #work-comment-content table td *[style*="underline"],
                        #work-comment-content table th *[style*="underline"] {
                          text-decoration: none !important;
                        }
                        #work-comment-content table td * u,
                        #work-comment-content table th * u {
                          text-decoration: none !important;
                        }
                        #work-comment-content hr {
                          border: none;
                          border-top: 2px solid #6b7280;
                          margin: 10px 0;
                        }
                        #work-content-readonly table {
                          border-collapse: collapse;
                          width: 100%;
                          margin: 10px 0;
                          border: 2px solid #6b7280;
                        }
                        #work-content-readonly table td,
                        #work-content-readonly table th {
                          border: 2px solid #6b7280;
                          padding: 8px;
                          cursor: default !important;
                          pointer-events: none;
                          user-select: none;
                        }
                        #work-content-readonly hr {
                          border: none;
                          border-top: 2px solid #6b7280;
                          margin: 10px 0;
                        }
                        /* 모든 contentEditable 테이블 셀의 언더라인 제거 */
                        table[data-resizable="true"] td[contenteditable="true"] u,
                        table[data-resizable="true"] th[contenteditable="true"] u,
                        table[data-resizable="true"] td[contenteditable="true"][style*="underline"],
                        table[data-resizable="true"] th[contenteditable="true"][style*="underline"],
                        table[data-resizable="true"] td[contenteditable="true"] *[style*="underline"],
                        table[data-resizable="true"] th[contenteditable="true"] *[style*="underline"],
                        table[data-resizable="true"] td[contenteditable="true"] * u,
                        table[data-resizable="true"] th[contenteditable="true"] * u {
                          text-decoration: none !important;
                        }
                      `}</style>
                    </div>
                  </div>
                
                {/* 첨부파일 */}
                <div className="space-y-2 min-w-0 max-w-full mt-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold">작성 내용 첨부파일</Label>
                          <div className="flex items-center gap-2">
                            {(workCommentFiles.length > 0 || workCommentResolvedFileKeys.length > 0) && (
                              <div className="text-sm text-muted-foreground">
                                {workCommentFiles.length + workCommentResolvedFileKeys.length}개 파일
                              </div>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (!workTaskId) return
                                
                                  const input = document.createElement('input')
                                  input.type = 'file'
                                  input.multiple = true
                                  input.onchange = (e) => {
                                    const files = (e.target as HTMLInputElement).files
                                    if (files && files.length > 0) {
                                      const maxSize = 1024 * 1024 * 1024 // 1GB
                                      const fileArray = Array.from(files)
                                      const validFiles: File[] = []
                                      
                                      for (const file of fileArray) {
                                        if (file.size > maxSize) {
                                          toast({
                                            title: '파일 크기 초과',
                                            description: `${file.name} 파일이 1GB를 초과합니다.`,
                                            variant: 'destructive',
                                          })
                                          continue
                                        }
                                        validFiles.push(file)
                                      }
                                      
                                      if (validFiles.length > 0) {
                                        setWorkCommentFiles(prev => [...prev, ...validFiles])
                                      }
                                    }
                                  }
                                  input.click()
                                }}
                                disabled={!workTaskId || isUploadingWork}
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                파일 첨부
                              </Button>
                          </div>
                        </div>
                        {(workCommentFiles.length > 0 || workCommentResolvedFileKeys.length > 0) ? (
                          <div className="flex flex-wrap gap-2 p-2 border border-transparent rounded-md bg-transparent mb-2">
                            {/* 기존 저장된 첨부파일 (workCommentResolvedFileKeys) - 전체 표시 */}
                            {workCommentResolvedFileKeys.map((resolved, idx) => (
                              <div key={`comment-resolved-${idx}`} className="flex items-center gap-2 px-2 py-1 bg-transparent rounded border text-sm">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span 
                                  className="max-w-[150px] truncate 
                                   hover:underline" 
                                  title={resolved.fileName}
                                  onClick={async (e) => {
                                    e.preventDefault()
                                    try {
                                      const response = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(resolved.s3Key)}&expiresIn=604800`, {
                                        credentials: 'include',
                                      })
                                      if (!response.ok) {
                                        const errorData = await response.json().catch(() => ({}))
                                        const errorMessage = errorData.error || '다운로드 URL 생성 실패'
                                        // NoSuchKey 에러 메시지 확인
                                        if (errorMessage.includes('존재하지 않') || errorMessage.includes('기간이 지났') || response.status === 404) {
                                          throw new Error('파일이 존재하지 않거나 다운로드 기간이 지났습니다.')
                                        }
                                        throw new Error(errorMessage)
                                      }
                                      const data = await response.json()
                                      if (data.signedUrl) {
                                        const a = document.createElement('a')
                                        a.href = data.signedUrl
                                        a.download = resolved.fileName
                                        document.body.appendChild(a)
                                        a.click()
                                        document.body.removeChild(a)
                                      } else {
                                        throw new Error('서명된 URL을 받을 수 없습니다')
                                      }
                                    } catch (error: any) {
                                      console.error('파일 다운로드 오류:', error)
                                      toast({
                                        title: '오류',
                                        description: error.message || '파일 다운로드에 실패했습니다. 파일이 존재하지 않거나 다운로드 기간이 지났습니다.',
                                        variant: 'destructive',
                                      })
                                    }
                                  }}
                                >
                                  {resolved.fileName}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => {
                                    if (!workTaskId) return
                                    setWorkCommentResolvedFileKeys(workCommentResolvedFileKeys.filter((_, i) => i !== idx))
                                  }}
                                  disabled={!workTaskId}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                            {/* 새로 업로드한 첨부파일 (workCommentFiles) - 전체 표시 */}
                            {workCommentFiles.map((file, idx) => (
                              <div key={`comment-${idx}`} className="flex items-center gap-2 px-2 py-1 bg-transparent rounded border text-sm">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="max-w-[150px] truncate" title={`${(file.size / 1024 / 1024).toFixed(2)}MB`}>
                                  {file.name}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => {
                                    if (!workTaskId) return
                                    setWorkCommentFiles(workCommentFiles.filter((_, i) => i !== idx))
                                  }}
                                  disabled={!workTaskId}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>* 파일 크기 제한: 각 파일당 최대 1GB</div>
                      </div>
                    </div>
                    </>
                  )})()}
                </div>
              </div>
              {workTaskId && (
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    type="button"
                    onClick={async () => {
                      if (!workTaskId || isUploadingWork) return
                      
                      setIsUploadingWork(true)
                      setWorkUploadProgress(0)
                      try {
                        // 댓글 첨부파일 업로드 (여러 개)
                        let fileKeys: string[] = []
                        if (workCommentFiles.length > 0) {
                          for (let i = 0; i < workCommentFiles.length; i++) {
                            const file = workCommentFiles[i]
                            const formData = new FormData()
                            formData.append("file", file)
                            formData.append("fileType", "other")
                            // Progress에서 첨부파일은 temp/attachment/{userId}/ 경로에 저장
                            // path에 userId를 포함시키지 않고, API에서 토큰의 userId를 사용하도록 함
                            formData.append("path", `temp/attachment/${file.name}`)
                            
                            const uploadData = await uploadWithProgress<{ path?: string }>({
                              url: "/api/storage/upload",
                              formData,
                              withCredentials: true,
                              onProgress: (p) => {
                                const overallProgress = ((i + p.percent / 100) / workCommentFiles.length) * 100
                                setWorkUploadProgress(Math.round(overallProgress))
                              },
                            })
                            if (uploadData?.path) fileKeys.push(uploadData.path)
                          }
                        }
                        
                        // 댓글 내용 가져오기
                        const commentEditor = document.getElementById('work-comment-content')
                        const commentContent = commentEditor ? commentEditor.innerHTML : workCommentContent
                        
                        // file_keys(관리자/업무 본문 첨부)는 기본적으로 기존 값 유지
                        // 과거 버그/교체 과정에서 client 첨부가 file_keys에 섞여 들어간 경우가 있어,
                        // comment_file_keys에 해당하는 키는 file_keys에서 제거하여 "중복 표시"를 방지
                        const existingCommentFileKeys = workCommentResolvedFileKeys.map(r => r.originalKey)
                        const existingFileKeys = workResolvedFileKeys
                          .map(r => r.originalKey)
                          .filter((k) => !existingCommentFileKeys.includes(k))
                        
                        // comment 첨부파일 키:
                        // - 새 파일 업로드가 있으면 기존 키에 추가
                        // - 새 업로드가 없으면 현재 선택(남아있는) 키만 저장
                        const commentFileKeys = [...existingCommentFileKeys, ...fileKeys]
                        
                        // Task 업데이트
                        // subtask인 경우: content 필드를 업데이트 (comment는 무시)
                        // main task인 경우: comment와 comment_file_keys를 업데이트
                        let updateBody: any = {}
                        if (workTaskIsSubtask) {
                          updateBody = {
                            content: commentContent || "",
                            comment_file_keys: commentFileKeys,
                          }
                        } else {
                          updateBody = {
                            content: workForm.content || "",
                            file_keys: existingFileKeys,
                            comment: commentContent || "",
                            comment_file_keys: commentFileKeys,
                          }
                        }
                        
                        const updateResponse = await fetch(`/api/tasks/${workTaskId}`, {
                          method: 'PATCH',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          credentials: 'include',
                          body: JSON.stringify(updateBody),
                        })
                        
                        if (!updateResponse.ok) {
                          const errorData = await updateResponse.json().catch(() => ({}))
                          throw new Error(errorData.error || 'Task 업데이트 실패')
                        }
                        
                        // 임시저장 데이터 삭제
                        localStorage.removeItem(`work-comment-temp-${workTaskId}`)
                        
                        toast({
                          title: "성공",
                          description: "댓글이 저장되었습니다.",
                        })
                        
                        // 작업 목록 새로고침
                        loadTasks()
                        
                        // 댓글 초기화 (저장 후에는 초기화하지 않음 - 다시 불러올 때 복원되므로)
                        // setWorkCommentContent("")
                        // setWorkCommentFiles([])
                        // setWorkCommentResolvedFileKeys([])
                        // const commentEditorEl = document.getElementById('work-comment-content')
                        // if (commentEditorEl) {
                        //   commentEditorEl.innerHTML = ""
                        // }
                        
                        // 새로 업로드한 파일만 초기화
                        setWorkCommentFiles([])
                      } catch (error) {
                        console.error("댓글 저장 오류:", error)
                        toast({
                          title: "오류",
                          description: error instanceof Error ? error.message : "댓글 저장에 실패했습니다.",
                          variant: "destructive",
                        })
                      } finally {
                        setIsUploadingWork(false)
                        setWorkUploadProgress(0)
                      }
                    }}
                    disabled={isUploadingWork || !workTaskId}
                  >
                    {isUploadingWork ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        저장 중...
                      </>
                    ) : (
                      "저장"
                    )}
                  </Button>
                  {isUploadingWork && (
                    <div className="w-[260px] self-center">
                      <Progress value={workUploadProgress} />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Task 상세 정보 Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => {
        if (!open) {
          setSelectedTask(null)
          setResolvedFileKeys([])
        }
      }}>
        <DialogContent className="max-h-[80vh] overflow-y-auto overflow-x-hidden" style={{ width: 'calc((1280px - 48px - 16px) * 7/10)', maxWidth: '851px' }}>
          {selectedTask && (
            <TaskDialogContent 
              task={selectedTask}
              resolvedFileKeys={resolvedFileKeys}
              setResolvedFileKeys={setResolvedFileKeys}
              getStatusIcon={getStatusIcon}
              getPriorityColor={getPriorityColor}
              getStatusLabel={getStatusLabel}
              toast={toast}
              onTaskUpdate={() => {
                loadTasks()
                setSelectedTask(null)
                setResolvedFileKeys([])
              }}
              finalizedTaskIds={finalizedTaskIds}
              setFinalizedTaskIds={setFinalizedTaskIds}
              onEditTask={async (task) => {
                // subtask인 경우, main task 가져오기
                let mainTaskContent = task.content || ""
                let mainTaskFileKeys: string[] = task.file_keys || []
                
                if (task.is_subtask && task.task_id) {
                  try {
                    const mainTaskRes = await fetch(`/api/tasks/${task.task_id}`, { credentials: "include" })
                    if (mainTaskRes.ok) {
                      const mainTaskData = await mainTaskRes.json()
                      mainTaskContent = mainTaskData.task?.content || ""
                      mainTaskFileKeys = mainTaskData.task?.file_keys || []
                    }
                  } catch (error) {
                    console.error('main task 로드 오류:', error)
                  }
                }
                
                // 작업공간에 task 정보 표시 (읽기 전용)
                setWorkForm({
                  title: task.title || "",
                  content: mainTaskContent, // main task의 content
                  priority: task.priority || "medium",
                })
                setWorkTaskId(task.id)
                setWorkTaskIsSubtask(task.is_subtask || false)
                setIsWorkAreaReadOnly(true) // 수정 버튼으로 추가한 경우 읽기 전용

                // 본문 첨부파일 resolve (main task의 file_keys)
                if (mainTaskFileKeys.length > 0) {
                  fetch('/api/storage/resolve-file-keys', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({ fileKeys: mainTaskFileKeys }),
                  })
                    .then(response => response.json())
                    .then(data => {
                      setWorkResolvedFileKeys(data.resolvedKeys || [])
                    })
                    .catch(error => {
                      console.error('파일 키 resolve 오류:', error)
                      setWorkResolvedFileKeys([])
                    })
                } else {
                  setWorkResolvedFileKeys([])
                }

                // comment 첨부파일이 있으면 resolve
                if (task.comment_file_keys && task.comment_file_keys.length > 0) {
                  fetch('/api/storage/resolve-file-keys', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({ fileKeys: task.comment_file_keys }),
                  })
                    .then(response => response.json())
                    .then(data => {
                      setWorkCommentResolvedFileKeys(data.resolvedKeys || [])
                    })
                    .catch(error => {
                      console.error('comment 파일 키 resolve 오류:', error)
                      setWorkCommentResolvedFileKeys([])
                    })
                } else {
                  setWorkCommentResolvedFileKeys([])
                }

                // contentEditable에 내용 설정
                setTimeout(() => {
                  const editor = document.getElementById('work-content')
                  if (editor && mainTaskContent) {
                    editor.innerHTML = mainTaskContent
                  }
                  
                  // comment 에디터에 내용 설정
                  const commentEditor = document.getElementById('work-comment-content')
                  if (commentEditor) {
                    // subtask인 경우: subtask의 content를 표시
                    // main task인 경우: comment 컬럼 내용 표시
                    let contentToShow = ""
                    if (task.is_subtask) {
                      contentToShow = task.content || ""
                    } else {
                      const commentText = (task.comment as string) || ""
                      contentToShow = commentText.startsWith('\n') ? commentText.substring(1) : commentText
                    }
                    commentEditor.innerHTML = contentToShow
                    setWorkCommentContent(contentToShow)
                  }
                }, 0)

                // Dialog 닫기
                setSelectedTask(null)
                setResolvedFileKeys([])
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface TaskDialogContentProps {
  task: Task
  resolvedFileKeys: ResolvedFileKey[]
  setResolvedFileKeys: React.Dispatch<React.SetStateAction<ResolvedFileKey[]>>
  getStatusIcon: (status: Task['status']) => React.ReactElement | null
  getPriorityColor: (priority: Task['priority']) => string
  getStatusLabel: (status: Task['status'], task?: Task) => string
  toast: ReturnType<typeof useToast>['toast']
  onTaskUpdate: () => void
  finalizedTaskIds: Set<string>
  setFinalizedTaskIds: React.Dispatch<React.SetStateAction<Set<string>>>
  onEditTask?: (task: Task) => void
}

function TaskDialogContent({
  task,
  resolvedFileKeys,
  setResolvedFileKeys,
  getStatusIcon,
  getPriorityColor,
  getStatusLabel,
  toast,
  onTaskUpdate,
  finalizedTaskIds,
  setFinalizedTaskIds,
  onEditTask
}: TaskDialogContentProps) {
  // comment 컬럼에서 첫 줄 개행 제거하여 표시
  const existingComment = task.comment ? (task.comment.startsWith('\n') ? task.comment.substring(1) : task.comment) : ''
  const [comment, setComment] = useState(existingComment)
  const [isSavingComment, setIsSavingComment] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [commentResolvedFileKeys, setCommentResolvedFileKeys] = useState<ResolvedFileKey[]>([])
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [isLoadingSubtasks, setIsLoadingSubtasks] = useState(false)

  // 서브태스크 로드
  useEffect(() => {
    const loadSubtasks = async () => {
      setIsLoadingSubtasks(true)
      try {
        const res = await fetch(`/api/tasks/${task.id}/subtasks`, { credentials: "include" })
        if (!res.ok) return
        const data = await res.json()
        setSubtasks(Array.isArray(data.subtasks) ? data.subtasks : [])
      } catch {
        // ignore
      } finally {
        setIsLoadingSubtasks(false)
      }
    }
    loadSubtasks()
  }, [task.id])

  // 모든 서브태스크가 완료되었는지 확인
  const allSubtasksCompleted = useMemo(() => {
    if (subtasks.length === 0) return false
    return subtasks.every((st: any) => st.status === "completed")
  }, [subtasks])

  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" })
        if (!res.ok) return
        const me = await res.json()
        setUser(me)
      } catch (error) {
        console.error('사용자 로드 오류:', error)
      }
    }
    loadUser()
  }, [])

  // Dialog가 열릴 때 file_keys를 resolve
  useEffect(() => {
    if (task.file_keys && task.file_keys.length > 0 && resolvedFileKeys.length === 0) {
      const resolveFileKeys = async () => {
        try {
          const response = await fetch('/api/storage/resolve-file-keys', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ fileKeys: task.file_keys }),
          })
          if (response.ok) {
            const data = await response.json()
            setResolvedFileKeys(data.resolvedKeys || [])
          }
        } catch (error) {
          console.error('파일 키 resolve 오류:', error)
        }
      }
      resolveFileKeys()
    }
  }, [task.file_keys, resolvedFileKeys.length, setResolvedFileKeys])

  // Dialog가 열릴 때 comment_file_keys를 resolve
  useEffect(() => {
    if (task.comment_file_keys && task.comment_file_keys.length > 0 && commentResolvedFileKeys.length === 0) {
      const resolveCommentFileKeys = async () => {
        try {
          const response = await fetch('/api/storage/resolve-file-keys', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ fileKeys: task.comment_file_keys }),
          })
          if (response.ok) {
            const data = await response.json()
            setCommentResolvedFileKeys(data.resolvedKeys || [])
          }
        } catch (error) {
          console.error('comment 파일 키 resolve 오류:', error)
        }
      }
      resolveCommentFileKeys()
    }
  }, [task.comment_file_keys, commentResolvedFileKeys.length])

  const handleSaveComment = async () => {
    setIsSavingComment(true)
    try {
      // comment 컬럼에 저장 (첫 줄에 개행 포함)
      const formattedComment = comment.trim() ? `\n${comment.trim()}` : null

      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ comment: formattedComment }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '댓글 저장 실패')
      }

      toast({
        title: '성공',
        description: '댓글이 저장되었습니다',
      })
      onTaskUpdate()
    } catch (error: any) {
      toast({
        title: '오류',
        description: error.message || '댓글 저장에 실패했습니다',
        variant: 'destructive',
      })
    } finally {
      setIsSavingComment(false)
    }
  }

  const handleDeleteTask = async () => {
    setIsDeleting(true)
    try {
      // comment 컬럼에 저장 (첫 줄에 개행 포함)
      const formattedComment = comment.trim() ? `\n${comment.trim()}` : null

      // comment 업데이트 및 status를 completed로 변경
      // status가 completed로 변경되면 API에서 자동으로 cases로 이동
      const updateResponse = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          comment: formattedComment,
          status: 'completed'
        }),
      })

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json()
        throw new Error(errorData.error || '작업 완료 처리 실패')
      }

      // Report 생성
      const reportResponse = await fetch(`/api/tasks/${task.id}/create-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!reportResponse.ok) {
        let errorMessage = 'Report 생성 실패'
        try {
          const errorData = await reportResponse.json()
          errorMessage = errorData.error || errorData.message || errorMessage
          console.error('[Progress] Report 생성 실패:', errorData)
        } catch (parseError) {
          const errorText = await reportResponse.text()
          console.error('[Progress] Report 생성 실패 (응답 파싱 오류):', errorText)
          errorMessage = errorText || errorMessage
        }
        // Report 생성 실패해도 작업 완료는 유지 (조용히 실패)
        console.warn('[Progress] Report 생성은 실패했지만 작업 완료는 정상 처리되었습니다:', errorMessage)
      }

      toast({
        title: '성공',
        description: '작업이 완료되었습니다. Reports에서 확인할 수 있습니다.',
      })
      setShowDeleteDialog(false)
      onTaskUpdate()
    } catch (error: any) {
      toast({
        title: '오류',
        description: error.message || '작업 완료 처리에 실패했습니다',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <DialogHeader className="pr-8">
        <DialogTitle className="flex items-center gap-2 break-words word-break break-all">
          {getStatusIcon(task.status)}
          <span className="min-w-0">
            {task.title}
            {task.subtitle && task.is_subtask && (
              <span className="text-muted-foreground text-sm ml-2">({task.subtitle})</span>
            )}
          </span>
        </DialogTitle>
      </DialogHeader>
      <div className="flex items-center gap-2 flex-wrap mt-2 mb-4">
        <Badge className={getPriorityColor(task.priority)}>
          {task.priority === 'urgent' ? '긴급' : 
           task.priority === 'high' ? '높음' : 
           task.priority === 'medium' ? '보통' : '낮음'}
        </Badge>
        <Badge variant="outline">
          {getStatusLabel(task.status, task)}
        </Badge>
        <span className="text-xs text-muted-foreground">
          요청자: <span className="font-medium text-foreground">{task.assigned_by_name || task.assigned_by_email}</span>
        </span>
      </div>
      <div className="space-y-4 mt-4">
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted-foreground">시작일</p>
              <p className="font-medium">{formatDateShort(task.created_at)}</p>
            </div>
            {task.due_date && (
              <div>
                <p className="text-muted-foreground">마감일</p>
                <p className="font-medium">{formatDateShort(task.due_date)}</p>
              </div>
            )}
          </div>
          {task.completed_at && (
            <div>
              <p className="text-muted-foreground">종료일</p>
              <p className="font-medium">{formatDateShort(task.completed_at)}</p>
            </div>
          )}
        </div>
        {task.content && (
          <div>
            <div 
              ref={(el) => {
                if (el) {
                  // 테이블 셀의 contentEditable을 false로 설정
                  const tables = el.querySelectorAll('table')
                  tables.forEach((table) => {
                    const cells = table.querySelectorAll('td, th')
                    cells.forEach((cell) => {
                      (cell as HTMLElement).contentEditable = 'false'
                    })
                  })
                }
              }}
              className="text-sm bg-muted/50 p-3 rounded-md border border-border/50 break-words word-break break-all overflow-x-auto prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(task.content) }}
              style={{
                maxHeight: '400px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap'
              }}
            />
            <style jsx global>{`
              .prose table {
                border-collapse: collapse;
                width: 100%;
                margin: 10px 0;
                border: 2px solid #6b7280; /* Darker border */
              }
              .prose table td,
              .prose table th {
                border: 2px solid #6b7280; /* Darker border */
                padding: 8px;
                position: relative;
                cursor: default !important; /* Prevent cursor change */
              }
              .prose table td[contenteditable="true"],
              .prose table th[contenteditable="true"] {
                pointer-events: none; /* Prevent editing */
                user-select: none; /* Prevent selection */
                cursor: default !important;
              }
              .prose table td *,
              .prose table th * {
                cursor: default !important; /* Ensure children also have default cursor */
                pointer-events: none; /* Ensure children are not interactive */
              }
              .prose hr {
                border: none;
                border-top: 2px solid #6b7280; /* Darker separator */
                margin: 10px 0;
              }
            `}</style>
          </div>
        )}
        {comment && (
          <div>
            <p className="text-muted-foreground mb-2">완료 코멘트</p>
            <div 
              ref={(el) => {
                if (el) {
                  // 테이블 셀의 contentEditable을 false로 설정
                  const tables = el.querySelectorAll('table')
                  tables.forEach((table) => {
                    const cells = table.querySelectorAll('td, th')
                    cells.forEach((cell) => {
                      (cell as HTMLElement).contentEditable = 'false'
                    })
                  })
                }
              }}
              className="text-sm bg-muted/50 p-3 rounded-md border border-border/50 break-words word-break break-all overflow-x-auto prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(comment) }}
              style={{
                maxHeight: '400px',
                overflowY: 'auto'
              }}
            />
            <style jsx global>{`
              .prose table {
                border-collapse: collapse;
                width: 100%;
                margin: 10px 0;
                border: 2px solid #6b7280;
              }
              .prose table td,
              .prose table th {
                border: 2px solid #6b7280;
                padding: 8px;
                position: relative;
                cursor: default !important;
              }
              .prose table td[contenteditable="true"],
              .prose table th[contenteditable="true"] {
                pointer-events: none;
                user-select: none;
                cursor: default !important;
              }
              .prose table td *,
              .prose table th * {
                cursor: default !important;
                pointer-events: none;
              }
              .prose hr {
                border: none;
                border-top: 2px solid #6b7280;
                margin: 10px 0;
              }
            `}</style>
          </div>
        )}
        {task.file_keys && task.file_keys.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-2">본문 첨부 파일</p>
            <div className="space-y-2 text-sm">
              {resolvedFileKeys.length > 0 ? (
                resolvedFileKeys.map((resolved, index: number) => {
                  const expiry = calculateFileExpiry(resolved.uploadedAt || task.created_at)
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0" />
                      <a
                        href={`/api/storage/signed-url?path=${encodeURIComponent(resolved.s3Key)}&expiresIn=604800`}
                        onClick={async (e) => {
                          e.preventDefault()
                          try {
                            const response = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(resolved.s3Key)}&expiresIn=604800`, {
                              credentials: 'include',
                            })
                            if (!response.ok) {
                              const errorData = await response.json().catch(() => ({}))
                              const errorMessage = errorData.error || '다운로드 URL 생성 실패'
                              // NoSuchKey 에러 메시지 확인
                              if (errorMessage.includes('존재하지 않') || errorMessage.includes('기간이 지났') || response.status === 404) {
                                throw new Error('파일이 존재하지 않거나 다운로드 기간이 지났습니다.')
                              }
                              throw new Error(errorMessage)
                            }
                            const data = await response.json()
                            if (data.signedUrl) {
                              // 이미지 파일인지 확인
                              const fileName = resolved.fileName || 
                                (typeof resolved.s3Key === 'string' ? resolved.s3Key.split('/').pop() : null) || 
                                ''
                              const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg']
                              const fileExtension = fileName.toLowerCase().split('.').pop() || ''
                              const isImage = imageExtensions.includes(fileExtension)
                              
                              if (isImage) {
                                // 이미지 파일은 다운로드
                                const a = document.createElement('a')
                                a.href = data.signedUrl
                                a.download = fileName
                                document.body.appendChild(a)
                                a.click()
                                document.body.removeChild(a)
                              } else {
                                // 다른 파일은 새 창에서 열기
                                window.open(data.signedUrl, '_blank')
                              }
                            } else {
                              throw new Error('서명된 URL을 받을 수 없습니다')
                            }
                          } catch (error: any) {
                            console.error('파일 다운로드 오류:', error)
                            toast({
                              title: '오류',
                              description: error.message || '파일 다운로드에 실패했습니다. 파일이 존재하지 않거나 다운로드 기간이 지났습니다.',
                              variant: 'destructive',
                            })
                          }
                        }}
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        {resolved.fileName}
                      </a>
                      <span className={`text-xs shrink-0 ${expiry.isExpired ? 'text-red-500' : expiry.daysRemaining <= 2 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                        ({expiry.expiryText})
                      </span>
                    </div>
                  )
                })
              ) : (
                <div className="text-muted-foreground">파일 정보를 불러오는 중...</div>
              )}
            </div>
          </div>
        )}
        {task.comment_file_keys && task.comment_file_keys.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-2">작성자 첨부 파일</p>
            <div className="space-y-2 text-sm">
              {commentResolvedFileKeys.length > 0 ? (
                commentResolvedFileKeys.map((resolved, index: number) => {
                  const expiry = calculateFileExpiry(resolved.uploadedAt || task.updated_at)
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0" />
                      <a
                        href={`/api/storage/signed-url?path=${encodeURIComponent(resolved.s3Key)}&expiresIn=604800`}
                        onClick={async (e) => {
                          e.preventDefault()
                          try {
                            const response = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(resolved.s3Key)}&expiresIn=604800`, {
                              credentials: 'include',
                            })
                            if (!response.ok) {
                              const errorData = await response.json().catch(() => ({}))
                              const errorMessage = errorData.error || '다운로드 URL 생성 실패'
                              // NoSuchKey 에러 메시지 확인
                              if (errorMessage.includes('존재하지 않') || errorMessage.includes('기간이 지났') || response.status === 404) {
                                throw new Error('파일이 존재하지 않거나 다운로드 기간이 지났습니다.')
                              }
                              throw new Error(errorMessage)
                            }
                            const data = await response.json()
                            if (data.signedUrl) {
                              // 이미지 파일인지 확인
                              const fileName = resolved.fileName || 
                                (typeof resolved.s3Key === 'string' ? resolved.s3Key.split('/').pop() : null) || 
                                ''
                              const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg']
                              const fileExtension = fileName.toLowerCase().split('.').pop() || ''
                              const isImage = imageExtensions.includes(fileExtension)
                              
                              if (isImage) {
                                // 이미지 파일은 다운로드
                                const a = document.createElement('a')
                                a.href = data.signedUrl
                                a.download = fileName
                                document.body.appendChild(a)
                                a.click()
                                document.body.removeChild(a)
                              } else {
                                // 다른 파일은 새 창에서 열기
                                window.open(data.signedUrl, '_blank')
                              }
                            } else {
                              throw new Error('서명된 URL을 받을 수 없습니다')
                            }
                          } catch (error: any) {
                            console.error('파일 다운로드 오류:', error)
                            toast({
                              title: '오류',
                              description: error.message || '파일 다운로드에 실패했습니다. 파일이 존재하지 않거나 다운로드 기간이 지났습니다.',
                              variant: 'destructive',
                            })
                          }
                        }}
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        {resolved.fileName}
                      </a>
                      <span className={`text-xs shrink-0 ${expiry.isExpired ? 'text-red-500' : expiry.daysRemaining <= 2 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                        ({expiry.expiryText})
                      </span>
                    </div>
                  )
                })
              ) : (
                <div className="text-muted-foreground">파일 정보를 불러오는 중...</div>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end mt-4 pt-4 border-t">
        {onEditTask && task.status !== 'awaiting_completion' && (
          <Button
            onClick={() => {
              onEditTask(task)
            }}
            variant="outline"
            className="gap-2 cursor-pointer"
          >
            <Edit className="h-4 w-4" />
            작성
          </Button>
        )}
        {(task.status === 'awaiting_completion' || (subtasks.length > 0 && allSubtasksCompleted)) &&
         (user?.id === task.assigned_by || user?.role === 'admin') && (
          <Button
            onClick={() => setShowDeleteDialog(true)}
            variant="default"
            className="gap-2 cursor-pointer"
          >
            <Check className="h-4 w-4" />
            작업 끝내기
          </Button>
        )}
      </div>
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>작업을 끝내시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              {comment.trim() && comment !== existingComment
                ? '작성하신 댓글이 저장되고 작업이 완료 처리되어 Reports로 이동합니다. 이 작업은 되돌릴 수 없습니다.'
                : '이 작업을 완료 처리하고 Reports로 이동시킵니다. 이 작업은 되돌릴 수 없습니다.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTask}
              disabled={isDeleting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  처리 중...
                </>
              ) : (
                '확인'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// TaskBlock component imported from separate file
